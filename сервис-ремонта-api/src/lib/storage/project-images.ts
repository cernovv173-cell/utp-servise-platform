import { HttpError } from "../http/http-error.js";

export const supportedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportedImageType = (typeof supportedImageTypes)[number];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type StorageConfig = {
  readonly apiUrl: string;
  readonly token: string;
};

const storageConfig = (): StorageConfig => {
  const apiUrl = process.env.AMAZI_STORAGE_API_URL?.trim().replace(/\/+$/, "");
  const token = process.env.AMAZI_STORAGE_PROJECT_TOKEN?.trim();
  if (!apiUrl || !token) {
    throw new HttpError(
      503,
      "IMAGE_STORAGE_UNAVAILABLE",
      "Хранилище фотографий временно недоступно.",
    );
  }
  return { apiUrl, token };
};

export const validateImage = (
  bytes: Buffer,
  contentType: string,
): SupportedImageType => {
  const normalized = contentType.split(";", 1)[0]?.trim().toLowerCase();
  const validSignature =
    (normalized === "image/jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (normalized === "image/png" &&
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (normalized === "image/webp" &&
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP");

  if (
    !supportedImageTypes.includes(normalized as SupportedImageType) ||
    !validSignature ||
    bytes.length === 0 ||
    bytes.length > MAX_IMAGE_BYTES
  ) {
    throw new HttpError(
      400,
      "INVALID_IMAGE",
      "Выберите изображение JPEG, PNG или WebP размером не более 5 МБ.",
    );
  }
  return normalized as SupportedImageType;
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
      "IMAGE_STORAGE_ERROR",
      "Не удалось связаться с хранилищем фотографий.",
    );
  }
};

export const uploadProjectImage = async (
  bytes: Buffer,
  contentType: SupportedImageType,
): Promise<string> => {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    "image",
  );
  const response = await storageRequest("/uploads", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    throw new HttpError(
      502,
      "IMAGE_STORAGE_ERROR",
      "Не удалось сохранить фотографию.",
    );
  }
  const result = (await response.json().catch(() => null)) as {
    readonly objectId?: unknown;
  } | null;
  if (typeof result?.objectId !== "string" || result.objectId.length === 0) {
    throw new HttpError(
      502,
      "IMAGE_STORAGE_ERROR",
      "Хранилище не подтвердило сохранение фотографии.",
    );
  }
  return result.objectId;
};

export const deleteProjectImage = async (objectId: string): Promise<void> => {
  const response = await storageRequest(
    `/objects/${encodeURIComponent(objectId)}`,
    { method: "DELETE" },
  );
  if (!response.ok && response.status !== 404) {
    throw new HttpError(
      502,
      "IMAGE_STORAGE_ERROR",
      "Не удалось удалить старую фотографию.",
    );
  }
};

const resolveDownloadResponse = async (objectId: string): Promise<Response> => {
  let response = await storageRequest(
    `/objects/${encodeURIComponent(objectId)}/download`,
  );
  const responseType = response.headers.get("content-type")?.split(";", 1)[0];
  if (response.ok && responseType?.toLowerCase() === "application/json") {
    const payload = (await response.json().catch(() => null)) as {
      readonly downloadUrl?: unknown;
      readonly signedUrl?: unknown;
      readonly url?: unknown;
    } | null;
    const downloadUrl =
      payload?.downloadUrl ?? payload?.signedUrl ?? payload?.url;
    if (typeof downloadUrl !== "string") {
      throw new HttpError(
        502,
        "IMAGE_STORAGE_ERROR",
        "Хранилище не вернуло фотографию.",
      );
    }
    const parsedUrl = new URL(downloadUrl);
    if (parsedUrl.protocol !== "https:") {
      throw new HttpError(
        502,
        "IMAGE_STORAGE_ERROR",
        "Хранилище вернуло недопустимый адрес фотографии.",
      );
    }
    response = await fetch(parsedUrl);
  }
  return response;
};

export const downloadProjectImage = async (
  objectId: string,
): Promise<{
  readonly bytes: Buffer;
  readonly contentType: SupportedImageType;
}> => {
  const response = await resolveDownloadResponse(objectId);
  if (!response.ok) {
    throw new HttpError(404, "IMAGE_NOT_FOUND", "Фотография не найдена.");
  }
  const contentType = response.headers
    ?.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase() as SupportedImageType | undefined;
  if (!contentType || !supportedImageTypes.includes(contentType)) {
    throw new HttpError(
      502,
      "IMAGE_STORAGE_ERROR",
      "Хранилище вернуло файл неподдерживаемого формата.",
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new HttpError(
      502,
      "IMAGE_STORAGE_ERROR",
      "Фотография повреждена или превышает допустимый размер.",
    );
  }
  validateImage(bytes, contentType);
  return { bytes, contentType };
};
