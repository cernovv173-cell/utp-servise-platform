import { HttpError } from "../http/http-error.js";

export const supportedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type SupportedImageType = (typeof supportedImageTypes)[number];

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const MAX_PROJECT_FILE_BYTES = 10 * 1024 * 1024;
export const supportedVideoTypes = ["video/mp4"] as const;
export type SupportedVideoType = (typeof supportedVideoTypes)[number];
export type SupportedMediaType = SupportedImageType | SupportedVideoType;

type StorageConfig = {
  readonly apiUrl: string;
  readonly token: string;
};

const storageConfig = (
  errorCode = "IMAGE_STORAGE_UNAVAILABLE",
  unavailableMessage = "Хранилище фотографий временно недоступно.",
): StorageConfig => {
  const apiUrl = process.env.AMAZI_STORAGE_API_URL?.trim().replace(/\/+$/, "");
  const token = process.env.AMAZI_STORAGE_PROJECT_TOKEN?.trim();
  if (!apiUrl || !token) {
    throw new HttpError(503, errorCode, unavailableMessage);
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

export const validateMedia = (
  bytes: Buffer,
  contentType: string,
): SupportedMediaType => {
  const normalized = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (supportedImageTypes.includes(normalized as SupportedImageType)) {
    return validateImage(bytes, normalized!);
  }
  const validMp4 =
    normalized === "video/mp4" &&
    bytes.length >= 12 &&
    bytes.toString("ascii", 4, 8) === "ftyp";
  if (!validMp4 || bytes.length === 0 || bytes.length > MAX_VIDEO_BYTES) {
    throw new HttpError(
      400,
      "INVALID_MEDIA",
      "Выберите фото JPEG, PNG, WebP (до 5 МБ) или видео MP4 (до 20 МБ).",
    );
  }
  return "video/mp4";
};

const storageRequest = async (
  path: string,
  init: RequestInit = {},
  errorCode = "IMAGE_STORAGE_ERROR",
  connectionMessage = "Не удалось связаться с хранилищем фотографий.",
): Promise<Response> => {
  const isProjectFileRequest = errorCode === "PROJECT_FILE_STORAGE_ERROR";
  const config = storageConfig(
    isProjectFileRequest ? "PROJECT_FILE_STORAGE_ERROR" : undefined,
    isProjectFileRequest ? "Хранилище файлов временно недоступно." : undefined,
  );
  try {
    return await fetch(`${config.apiUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${config.token}`,
        ...init.headers,
      },
    });
  } catch {
    throw new HttpError(502, errorCode, connectionMessage);
  }
};

export const uploadProjectFile = async (
  bytes: Buffer,
  contentType: string,
  fileName: string,
): Promise<string> => {
  if (
    bytes.length === 0 ||
    bytes.length > MAX_PROJECT_FILE_BYTES ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,119}$/u.test(fileName) ||
    !/^[a-zA-Z0-9][a-zA-Z0-9.+-]*\/[a-zA-Z0-9][a-zA-Z0-9.+-]*$/u.test(
      contentType,
    )
  ) {
    throw new HttpError(
      400,
      "INVALID_PROJECT_FILE",
      "Файл отчёта имеет недопустимый формат или размер.",
    );
  }
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    fileName,
  );
  const response = await storageRequest(
    "/uploads",
    { method: "POST", body: form },
    "PROJECT_FILE_STORAGE_ERROR",
    "Не удалось связаться с хранилищем файлов.",
  );
  if (!response.ok) {
    throw new HttpError(
      502,
      "PROJECT_FILE_STORAGE_ERROR",
      "Не удалось сохранить файл отчёта.",
    );
  }
  const result = (await response.json().catch(() => null)) as {
    readonly objectId?: unknown;
  } | null;
  if (typeof result?.objectId !== "string" || result.objectId.length === 0) {
    throw new HttpError(
      502,
      "PROJECT_FILE_STORAGE_ERROR",
      "Хранилище не подтвердило сохранение файла отчёта.",
    );
  }
  return result.objectId;
};

export const uploadProjectMedia = async (
  bytes: Buffer,
  contentType: SupportedMediaType,
): Promise<string> => {
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(bytes)], { type: contentType }),
    contentType.startsWith("video/") ? "video" : "image",
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

const deleteProjectObject = async (
  objectId: string,
  errorCode: string,
  failureMessage: string,
): Promise<void> => {
  const response = await storageRequest(
    `/objects/${encodeURIComponent(objectId)}`,
    { method: "DELETE" },
    errorCode,
    failureMessage,
  );
  if (!response.ok && response.status !== 404) {
    throw new HttpError(502, errorCode, failureMessage);
  }
};

export const deleteProjectImage = async (objectId: string): Promise<void> =>
  deleteProjectObject(
    objectId,
    "IMAGE_STORAGE_ERROR",
    "Не удалось удалить старую фотографию.",
  );

export const deleteProjectFile = async (objectId: string): Promise<void> =>
  deleteProjectObject(
    objectId,
    "PROJECT_FILE_STORAGE_ERROR",
    "Не удалось удалить файл отчёта из хранилища.",
  );

const resolveDownloadResponse = async (
  objectId: string,
  errorCode = "IMAGE_STORAGE_ERROR",
): Promise<Response> => {
  const isProjectFile = errorCode === "PROJECT_FILE_STORAGE_ERROR";
  const missingFileMessage = isProjectFile
    ? "Хранилище не вернуло файл."
    : "Хранилище не вернуло фотографию.";
  const invalidUrlMessage = isProjectFile
    ? "Хранилище вернуло недопустимый адрес файла."
    : "Хранилище вернуло недопустимый адрес фотографии.";
  let response = await storageRequest(
    `/objects/${encodeURIComponent(objectId)}/download`,
    {},
    errorCode,
    isProjectFile
      ? "Не удалось получить файл из хранилища."
      : "Не удалось получить фотографию из хранилища.",
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
      throw new HttpError(502, errorCode, missingFileMessage);
    }
    const parsedUrl = new URL(downloadUrl);
    if (parsedUrl.protocol !== "https:") {
      throw new HttpError(502, errorCode, invalidUrlMessage);
    }
    try {
      response = await fetch(parsedUrl);
    } catch {
      throw new HttpError(
        502,
        errorCode,
        isProjectFile
          ? "Не удалось скачать файл из хранилища."
          : "Не удалось скачать фотографию из хранилища.",
      );
    }
  }
  return response;
};

export const downloadProjectFile = async (
  objectId: string,
): Promise<{ readonly bytes: Buffer; readonly contentType: string }> => {
  const response = await resolveDownloadResponse(
    objectId,
    "PROJECT_FILE_STORAGE_ERROR",
  );
  if (!response.ok) {
    throw new HttpError(
      404,
      "PROJECT_FILE_NOT_FOUND",
      "Файл отчёта не найден.",
    );
  }
  const contentType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (!contentType) {
    throw new HttpError(
      502,
      "PROJECT_FILE_STORAGE_ERROR",
      "Хранилище вернуло файл без типа содержимого.",
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PROJECT_FILE_BYTES) {
    throw new HttpError(
      502,
      "PROJECT_FILE_STORAGE_ERROR",
      "Файл отчёта повреждён или превышает допустимый размер.",
    );
  }
  return { bytes, contentType };
};

export const downloadProjectMedia = async (
  objectId: string,
): Promise<{
  readonly bytes: Buffer;
  readonly contentType: SupportedMediaType;
}> => {
  const response = await resolveDownloadResponse(objectId);
  if (!response.ok) {
    throw new HttpError(404, "IMAGE_NOT_FOUND", "Фотография не найдена.");
  }
  const contentType = response.headers
    ?.get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase() as SupportedMediaType | undefined;
  if (
    !contentType ||
    (!supportedImageTypes.includes(contentType as SupportedImageType) &&
      !supportedVideoTypes.includes(contentType as SupportedVideoType))
  ) {
    throw new HttpError(
      502,
      "IMAGE_STORAGE_ERROR",
      "Хранилище вернуло файл неподдерживаемого формата.",
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const maxBytes = contentType.startsWith("video/")
    ? MAX_VIDEO_BYTES
    : MAX_IMAGE_BYTES;
  if (bytes.length === 0 || bytes.length > maxBytes) {
    throw new HttpError(
      502,
      "IMAGE_STORAGE_ERROR",
      "Файл повреждён или превышает допустимый размер.",
    );
  }
  validateMedia(bytes, contentType);
  return { bytes, contentType };
};

export const uploadProjectImage = async (
  bytes: Buffer,
  contentType: SupportedImageType,
): Promise<string> => uploadProjectMedia(bytes, contentType);

export const downloadProjectImage = async (
  objectId: string,
): Promise<{
  readonly bytes: Buffer;
  readonly contentType: SupportedImageType;
}> => {
  const file = await downloadProjectMedia(objectId);
  if (!supportedImageTypes.includes(file.contentType as SupportedImageType)) {
    throw new HttpError(
      502,
      "IMAGE_STORAGE_ERROR",
      "Файл не является фотографией.",
    );
  }
  return {
    bytes: file.bytes,
    contentType: file.contentType as SupportedImageType,
  };
};
