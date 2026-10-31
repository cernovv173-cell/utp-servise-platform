import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  cleanupAndroidApk,
  deleteAndroidApk,
  getAdminAndroidApk,
  getAndroidApkDownloadUrl,
  notifyAndroidApkUpdate,
  uploadAndroidApk,
} from "@/lib/api";

const MAX_APK_BYTES = 100 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

export const AndroidApkManagement = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmNotify, setConfirmNotify] = useState(false);

  const query = useQuery({
    queryKey: ["admin-android-app", token],
    queryFn: ({ signal }) => getAdminAndroidApk(token!, signal),
    enabled: Boolean(token),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-android-app", token] }),
      queryClient.invalidateQueries({ queryKey: ["android-app"] }),
    ]);
  };

  const upload = useMutation({
    mutationFn: (apk: File) => uploadAndroidApk(token!, apk),
    onSuccess: async (result) => {
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setError("");
      setNotice(
        result.cleanupPending
          ? "Новая версия опубликована для скачивания, но удаление одной из предыдущих копий не завершилось. Повторите очистку ниже."
          : "Новая версия APK доступна по постоянной ссылке на сайте.",
      );
      await refresh();
    },
    onError: () => setError("Не удалось загрузить APK. Проверьте файл и повторите попытку."),
  });

  const remove = useMutation({
    mutationFn: () => deleteAndroidApk(token!),
    onSuccess: async (result) => {
      setConfirmDelete(false);
      setNotice(
        result.cleanupPending
          ? "Ссылка на приложение отключена, но не все копии удалось удалить. Повторите очистку ниже."
          : "APK удалён и больше не предлагается для скачивания.",
      );
      await refresh();
    },
    onError: () => setError("Не удалось удалить APK. Повторите попытку."),
  });

  const cleanup = useMutation({
    mutationFn: () => cleanupAndroidApk(token!),
    onSuccess: async (result) => {
      setNotice(
        result.cleanupPending
          ? "Некоторые старые копии пока не удалось удалить. Попробуйте ещё раз позже."
          : "Старые копии APK удалены из хранилища.",
      );
      await refresh();
    },
    onError: () => setError("Не удалось завершить очистку старых APK."),
  });

  const notifyUsers = useMutation({
    mutationFn: () => notifyAndroidApkUpdate(token!),
    onSuccess: (result) => {
      setConfirmNotify(false);
      setError("");
      setNotice(
        result.deviceCount === 0
          ? `Активных пользователей: ${result.recipientCount}. Рассылка не отправлена: нет зарегистрированных push-устройств.`
          : result.deliverySucceeded
            ? `Уведомление отправлено на ${result.deviceCount} зарегистрированных устройств.`
            : `Рассылка запущена для ${result.deviceCount} устройств, но часть уведомлений не доставлена.`,
      );
    },
    onError: () => setError("Не удалось отправить уведомление об обновлении."),
  });

  const chooseFile = (selected: File | null) => {
    setError("");
    setNotice("");
    if (!selected) {
      setFile(null);
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".apk")) {
      setFile(null);
      setError("Выберите файл с расширением .apk.");
      return;
    }
    if (selected.size <= 0 || selected.size > MAX_APK_BYTES) {
      setFile(null);
      setError("Размер APK должен быть не более 100 МБ.");
      return;
    }
    setFile(selected);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!file) {
      setError("Сначала выберите APK-файл.");
      return;
    }
    upload.mutate(file);
  };

  const apk = query.data?.apk;
  const canDownload = apk?.state === "available" || apk?.state === "legacy";
  const canDelete = apk?.state === "available" || apk?.state === "legacy";
  const pendingDeletionCount = apk?.pendingDeletionCount ?? 0;

  return (
    <SectionCard>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Android-приложение — APK</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Загрузите подписанный APK: кнопка «Android APK» на сайте начнёт выдавать эту версию. При
            замене предыдущий файл удаляется из хранилища.
          </p>
        </div>
        {canDownload && (
          <a
            href={getAndroidApkDownloadUrl()}
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Скачать текущий APK
          </a>
        )}
      </div>

      <div className="mt-5 rounded-xl border border-slate-100 p-4 text-sm dark:border-slate-800">
        {query.isLoading ? (
          <p className="text-slate-500">Проверяем текущий APK…</p>
        ) : query.isError ? (
          <p role="alert" className="text-rose-600">
            Не удалось получить сведения о текущем APK.
          </p>
        ) : apk?.state === "available" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Текущая версия доступна для скачивания</p>
              <p className="mt-1 text-slate-500">
                {apk.fileName} · {formatBytes(apk.sizeBytes ?? 0)} · загружен{" "}
                {apk.uploadedAt ? new Date(apk.uploadedAt).toLocaleString("ru-RU") : ""}
              </p>
            </div>
            {apk.sha256 && (
              <p className="max-w-full font-mono text-xs break-all text-slate-400">
                SHA-256: {apk.sha256}
              </p>
            )}
          </div>
        ) : apk?.state === "legacy" ? (
          <div>
            <p className="font-semibold">Сейчас используется APK из текущей сборки сайта</p>
            <p className="mt-1 text-slate-500">
              Загрузите отдельный APK, чтобы перейти на управляемую версию. После загрузки сайт
              будет направлять пользователей на новый файл.
            </p>
          </div>
        ) : (
          <p className="text-slate-500">Активный APK пока не загружен.</p>
        )}
      </div>

      <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="grid gap-2 text-sm font-medium">
          Новый APK (до 100 МБ)
          <input
            ref={inputRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(event) => chooseFile(event.currentTarget.files?.[0] ?? null)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white text-sm file:mr-3 file:min-h-11 file:border-0 file:bg-slate-100 file:px-4 file:font-semibold dark:border-slate-700 dark:bg-slate-950 dark:file:bg-slate-800"
          />
          <span className="text-xs font-normal text-slate-500">
            {file ? `${file.name} · ${formatBytes(file.size)}` : "Формат файла: .apk"}
          </span>
        </label>
        <button
          type="submit"
          disabled={!file || upload.isPending || query.isLoading}
          className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {upload.isPending
            ? "Загружаем…"
            : apk?.state === "available"
              ? "Заменить APK"
              : "Загрузить APK"}
        </button>
      </form>

      {apk?.state === "available" && (
        <div className="mt-5 rounded-xl border border-blue-100 p-4 dark:border-blue-900">
          <h3 className="text-sm font-semibold">Уведомление пользователей</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Загрузка APK не отправляет уведомление. Нажмите отдельную кнопку, чтобы сообщить об
            обновлении всем активным пользователям с зарегистрированными push-устройствами.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {confirmNotify ? (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Отправить push-уведомление об обновлении сейчас?
                </p>
                <button
                  type="button"
                  onClick={() => notifyUsers.mutate()}
                  disabled={notifyUsers.isPending}
                  className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {notifyUsers.isPending ? "Отправляем…" : "Подтвердить рассылку"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmNotify(false)}
                  disabled={notifyUsers.isPending}
                  className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
                >
                  Отмена
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setNotice("");
                  setConfirmNotify(true);
                }}
                className="min-h-10 rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300 dark:hover:bg-blue-950"
              >
                Сообщить всем об обновлении
              </button>
            )}
          </div>
        </div>
      )}

      {canDelete && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {confirmDelete ? (
            <>
              <p className="text-sm text-rose-600">Удалить APK и отключить его скачивание?</p>
              <button
                type="button"
                onClick={() => remove.mutate()}
                disabled={remove.isPending}
                className="min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {remove.isPending ? "Удаляем…" : "Подтвердить удаление"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
              >
                Отмена
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError("");
                setConfirmDelete(true);
              }}
              aria-label="Удалить APK"
              title="Удалить APK"
              className="grid size-10 place-items-center rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
            >
              <X size={17} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {pendingDeletionCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
          <p>Осталось удалить старых файлов: {pendingDeletionCount}.</p>
          <button
            type="button"
            onClick={() => cleanup.mutate()}
            disabled={cleanup.isPending}
            className="min-h-9 rounded-lg border border-amber-300 px-3 font-semibold disabled:opacity-50 dark:border-amber-800"
          >
            {cleanup.isPending ? "Проверяем…" : "Повторить очистку"}
          </button>
        </div>
      )}

      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-4 text-sm ${error ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}
        >
          {error || notice}
        </p>
      )}
      <p className="mt-4 text-xs leading-5 text-slate-500">
        APK скачивается с актуальной версии сайта. Android попросит пользователя подтвердить
        установку обновления — сайт не может установить его незаметно.
      </p>
    </SectionCard>
  );
};
