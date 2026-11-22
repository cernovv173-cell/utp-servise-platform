import { HttpError } from "../../lib/http/http-error.js";

const APK_CONTENT_TYPE = "application/vnd.android.package-archive";

type StorageConfig = {
  readonly apiUrl: string;
  readonly token: string;
};

const storageConfig = (): StorageConfig => {
  const apiUrl = process.env.AMAZI_STORAGE_API_URL?.trim().replace(/\/+$/u, "");
  const token = process.env.AMAZI_STORAGE_PROJECT_TOKEN?.trim();
  if (!apiUrl || !token) {
    throw new HttpError(
      503,
      "APK_STORAGE_UNAVAILABLE",
      "Хранилище APK временно недоступно.",
    );
  }
  return { apiUrl, token };
};

const storageRequest = async (
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const config = storageConfig();
  try {
    return await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...init.headers,
      },
    });
  } catch {
    throw new HttpError(
      502,
      "APK_STORAGE_ERROR",
      "Не удалось связаться с хранилищем APK.",
    );
  }
};

export const uploadProjectApk = async (bytes: Buffer): Promise<string> => {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: APK_CONTENT_TYPE }),
    "UTP-Servise.apk",
  );
  const response = await storageRequest("/uploads", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new HttpError(502, "APK_STORAGE_ERROR", "Не удалось сохранить APK.");
  }
  const result = (await response.json().catch(() => null)) as {
    readonly objectId?: unknown;
  } | null;
  if (typeof result?.objectId !== "string" || result.objectId.length === 0) {
    throw new HttpError(
      502,
      "APK_STORAGE_ERROR",
      "Хранилище не подтвердило сохранение APK.",
    );
  }
  return result.objectId;
};

export const deleteProjectApk = async (objectId: string): Promise<void> => {
  const response = await storageRequest(
    `/objects/${encodeURIComponent(objectId)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw new HttpError(
      502,
      "APK_STORAGE_ERROR",
      "Не удалось удалить прежний APK из хранилища.",
    );
  }
};

const safeHttpsUrl = (value: string | null): string => {
  if (!value) {
    throw new HttpError(
      502,
      "APK_STORAGE_ERROR",
      "Хранилище не вернуло ссылку на APK.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new HttpError(
      502,
      "APK_STORAGE_ERROR",
      "Хранилище вернуло недопустимую ссылку на APK.",
    );
  }
  if (parsed.protocol !== "https:") {
    throw new HttpError(
      502,
      "APK_STORAGE_ERROR",
      "Хранилище вернуло недопустимую ссылку на APK.",
    );
  }
  return parsed.toString();
};

const downloadFromSignedUrl = async (value: string): Promise<Response> => {
  let url = safeHttpsUrl(value);
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    let response: Response;
    try {
      response = await fetch(url, { redirect: "manual" });
    } catch {
      throw new HttpError(
        502,
        "APK_STORAGE_ERROR",
        "Не удалось скачать APK из хранилища.",
      );
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirectCount === 5) {
        throw new HttpError(
          502,
          "APK_STORAGE_ERROR",
          "Хранилище вернуло недопустимую ссылку на APK.",
        );
      }
      url = safeHttpsUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok || !response.body) {
      throw new HttpError(
        response.status === 404 ? 404 : 502,
        response.status === 404 ? "APK_NOT_FOUND" : "APK_STORAGE_ERROR",
        "Не удалось скачать APK из хранилища.",
      );
    }
    return response;
  }
  throw new HttpError(
    502,
    "APK_STORAGE_ERROR",
    "Хранилище вернуло слишком много перенаправлений.",
  );
};

export const downloadProjectApk = async (
  objectId: string,
): Promise<Response> => {
  const response = await storageRequest(
    `/objects/${encodeURIComponent(objectId)}/download`,
    { redirect: "manual" },
  );
  const location = response.headers.get("location");
  if (response.status >= 300 && response.status < 400 && location) {
    return downloadFromSignedUrl(location);
  }
  if (!response.ok) {
    throw new HttpError(404, "APK_NOT_FOUND", "Файл приложения не найден.");
  }
  const contentType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType === "application/json") {
    const payload = (await response.json().catch(() => null)) as {
      readonly downloadUrl?: unknown;
      readonly signedUrl?: unknown;
      readonly url?: unknown;
    } | null;
    const url = payload?.downloadUrl ?? payload?.signedUrl ?? payload?.url;
    if (typeof url !== "string") {
      throw new HttpError(
        502,
        "APK_STORAGE_ERROR",
        "Хранилище не вернуло ссылку на APK.",
      );
    }
    return downloadFromSignedUrl(url);
  }
  if (!response.body) {
    throw new HttpError(404, "APK_NOT_FOUND", "Файл приложения не найден.");
  }
  return response;
};
