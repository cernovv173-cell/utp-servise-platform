import { useQuery } from "@tanstack/react-query";
import { Bot, Check, House, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Modal,
  ModalClose,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  ModalTrigger,
} from "@/components/modal";

import { readApkResponse } from "@/features/android-app/read-apk-response";

import { getAndroidApk, getAndroidApkDownloadUrl } from "@/lib/api";

export const AppInstallButton = () => {
  const [downloadStatus, setDownloadStatus] = useState<"idle" | "downloading" | "complete">("idle");
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const apkQuery = useQuery({
    queryKey: ["android-app"],
    queryFn: ({ signal }) => getAndroidApk(signal),
    staleTime: 60_000,
    retry: false,
  });
  const apkState = apkQuery.data?.apk.state;
  const downloadUrl =
    apkState === "available" || apkState === "legacy"
      ? getAndroidApkDownloadUrl()
      : apkQuery.isError || apkQuery.isPending
        ? "/downloads/ru.utp.servise.apk"
        : null;
  const downloadApk = async () => {
    if (!downloadUrl || downloadStatus === "downloading") return;
    setDownloadStatus("downloading");
    setDownloadProgress(0);

    try {
      const response = await fetch(downloadUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("APK download failed");

      const file = await readApkResponse(
        response,
        apkQuery.data?.apk.sizeBytes,
        setDownloadProgress,
      );
      const blobUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = apkQuery.data?.apk.fileName || "UTP-Servise.apk";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      setDownloadStatus("complete");
      window.setTimeout(() => {
        setDownloadStatus("idle");
        setDownloadProgress(null);
      }, 2_000);
    } catch {
      setDownloadStatus("idle");
      setDownloadProgress(null);
      toast.error("Не удалось скачать APK. Попробуйте ещё раз.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {downloadUrl ? (
        <button
          type="button"
          onClick={downloadApk}
          disabled={downloadStatus === "downloading"}
          aria-busy={downloadStatus === "downloading"}
          aria-label={
            downloadStatus === "downloading"
              ? downloadProgress === null
                ? "Скачивание APK"
                : `Скачивание APK: ${downloadProgress}%`
              : "Скачать последнюю версию ЕНОТ СЕРВИС для Android"
          }
          className="relative inline-flex min-h-11 min-w-40 items-center justify-center gap-2 overflow-hidden rounded-full bg-red-600 px-5 text-sm font-semibold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:cursor-wait disabled:hover:bg-red-600"
        >
          {downloadStatus === "downloading" ? (
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          ) : downloadStatus === "complete" ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <Bot size={18} aria-hidden="true" />
          )}
          <span aria-live="polite" aria-atomic="true">
            {downloadStatus === "downloading"
              ? downloadProgress === null
                ? "Загрузка…"
                : `Загрузка ${downloadProgress}%`
              : downloadStatus === "complete"
                ? "Готово"
                : "Android APK"}
          </span>
          {downloadStatus === "downloading" && downloadProgress !== null && (
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-red-950/30">
              <span
                className="block h-full bg-white/90 transition-[width] duration-150"
                style={{ width: `${downloadProgress}%` }}
              />
            </span>
          )}
        </button>
      ) : (
        <span
          aria-label="Скачивание Android-приложения временно недоступно"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-400 px-5 text-sm font-semibold text-white"
        >
          <Bot size={18} aria-hidden="true" />
          APK пока не загружен
        </span>
      )}

      <Modal>
        <ModalTrigger asChild>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <House size={17} aria-hidden="true" />
            На экран «Домой»
          </button>
        </ModalTrigger>
        <ModalContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <ModalHeader>
            <ModalTitle>Добавить ЕНОТ СЕРВИС на экран «Домой»</ModalTitle>
            <ModalDescription className="dark:text-slate-300">
              Так вы создадите ярлык веб-версии на iPhone или iPad. Это не установка приложения из
              App Store.
            </ModalDescription>
          </ModalHeader>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700 dark:text-slate-200">
            <li>Откройте сайт в браузере Safari.</li>
            <li>Нажмите «Поделиться» в меню браузера.</li>
            <li>
              Выберите «На экран „Домой“», включите «Открывать как веб-приложение» и нажмите
              «Добавить».
            </li>
          </ol>
          <ModalFooter>
            <ModalClose asChild>
              <button
                type="button"
                className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Понятно
              </button>
            </ModalClose>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};
