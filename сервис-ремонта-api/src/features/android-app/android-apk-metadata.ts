import { createRequire } from "node:module";

import { HttpError } from "../../lib/http/http-error.js";

const require = createRequire(import.meta.url);
const { Apk } = require("node-apk") as typeof import("node-apk");

export type AndroidApkMetadata = {
  packageName: string;
  versionCode: number;
  versionName: string;
};

export type AndroidApkMetadataReader = (
  bytes: Buffer,
) => Promise<AndroidApkMetadata>;

export const readAndroidApkMetadata: AndroidApkMetadataReader = async (
  bytes,
) => {
  const apk = new Apk(bytes);
  try {
    const manifest = await apk.getManifestInfo();
    const metadata = {
      packageName: manifest.package.trim(),
      versionCode: manifest.versionCode,
      versionName: manifest.versionName.trim(),
    };

    if (
      !metadata.packageName ||
      !Number.isSafeInteger(metadata.versionCode) ||
      metadata.versionCode <= 0 ||
      metadata.versionCode > 2_147_483_647 ||
      !metadata.versionName ||
      metadata.versionName.length > 100
    ) {
      throw new HttpError(
        400,
        "INVALID_APK_VERSION",
        "Не удалось прочитать версию из APK. Проверьте файл и попробуйте ещё раз.",
      );
    }

    return metadata;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      400,
      "INVALID_APK",
      "Не удалось прочитать APK. Выберите корректный файл Android-приложения.",
    );
  } finally {
    apk.close();
  }
};
