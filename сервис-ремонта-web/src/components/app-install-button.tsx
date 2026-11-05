import { useQuery } from "@tanstack/react-query";
import { Bot, House } from "lucide-react";

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

import { getAndroidApk, getAndroidApkDownloadUrl } from "@/lib/api";

export const AppInstallButton = () => {
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

  return (
    <div className="flex flex-wrap items-center gap-3">
      {downloadUrl ? (
        <a
          href={downloadUrl}
          download="UTP-Servise.apk"
          aria-label="Скачать последнюю версию UTP Servise для Android"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-red-600 px-5 text-sm font-semibold text-white shadow-md shadow-red-600/25 transition hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
        >
          <Bot size={18} aria-hidden="true" />
          Android APK
        </a>
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
            <ModalTitle>Добавить UTP Servise на экран «Домой»</ModalTitle>
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
