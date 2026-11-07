import express, { type RequestHandler, Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import {
  productAnalyticsChannel,
  recordProductAnalytics,
} from "../analytics/product-analytics.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import { sendPushNotification } from "../notifications/push-notifications.js";
import {
  type AndroidApkMetadataReader,
  readAndroidApkMetadata,
} from "./android-apk-metadata.js";
import {
  deleteProjectApk,
  getProjectApkDownloadUrl,
  uploadProjectApk,
} from "./android-app.storage.js";

export const APK_CONTENT_TYPE = "application/vnd.android.package-archive";
export const MAX_APK_BYTES = 100 * 1024 * 1024;

const APK_SETTING_KEY = "android_app_apk";
const APK_FILE_NAME = "UTP-Servise.apk";
const ANDROID_APP_PACKAGE_NAME = "ru.utp.servise";
const appVersionMetadataSchema = z.object({
  versionCode: z.number().int().positive().max(2_147_483_647),
  versionName: z.string().trim().min(1).max(100),
});

const activeApkSchema = z
  .object({
    status: z.literal("available"),
    objectId: z.string().trim().min(1).max(255),
    sizeBytes: z.number().int().positive().max(MAX_APK_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
    versionCode: z.number().int().positive().max(2_147_483_647).optional(),
    versionName: z.string().trim().min(1).max(100).optional(),
    uploadedAt: z.string().datetime(),
    pendingDeletionObjectIds: z
      .array(z.string().trim().min(1).max(255))
      .max(100),
  })
  .strict()
  .refine(
    (record) =>
      (record.versionCode === undefined) === (record.versionName === undefined),
    "Version code and name must be stored together.",
  );

const deletedApkSchema = z
  .object({
    status: z.literal("deleted"),
    deletedAt: z.string().datetime(),
    pendingDeletionObjectIds: z
      .array(z.string().trim().min(1).max(255))
      .max(100),
  })
  .strict();

const apkRecordSchema = z.discriminatedUnion("status", [
  activeApkSchema,
  deletedApkSchema,
]);
type ApkRecord = z.infer<typeof apkRecordSchema>;
type ActiveApkRecord = z.infer<typeof activeApkSchema>;

export type AndroidApkStorage = {
  readonly upload: typeof uploadProjectApk;
  readonly delete: typeof deleteProjectApk;
  readonly downloadUrl: typeof getProjectApkDownloadUrl;
};

export type AndroidAppUpdateNotificationSender = typeof sendPushNotification;

const projectApkStorage: AndroidApkStorage = {
  upload: uploadProjectApk,
  delete: deleteProjectApk,
  downloadUrl: getProjectApkDownloadUrl,
};

const apkBody: RequestHandler = express.raw({
  type: APK_CONTENT_TYPE,
  limit: MAX_APK_BYTES,
});

const findRecord = async (
  database: DatabaseClient,
): Promise<ApkRecord | null> => {
  const setting = await database.appSetting.findUnique({
    where: { key: APK_SETTING_KEY },
  });
  if (!setting) return null;
  const parsed = apkRecordSchema.safeParse(setting.value);
  if (!parsed.success) {
    throw new HttpError(
      500,
      "APK_SETTINGS_INVALID",
      "Не удалось прочитать состояние Android-приложения.",
    );
  }
  return parsed.data;
};

const saveRecord = async (
  database: DatabaseClient,
  record: ApkRecord,
): Promise<void> => {
  await database.appSetting.upsert({
    where: { key: APK_SETTING_KEY },
    create: {
      key: APK_SETTING_KEY,
      value: record as Prisma.InputJsonValue,
    },
    update: { value: record as Prisma.InputJsonValue },
  });
};

const cleanRetiredObjects = async (
  database: DatabaseClient,
  storage: AndroidApkStorage,
  record: ApkRecord,
): Promise<ApkRecord> => {
  const pending = record.pendingDeletionObjectIds;
  if (pending.length === 0) return record;
  const failed: string[] = [];
  for (const objectId of pending) {
    try {
      await storage.delete(objectId);
    } catch {
      failed.push(objectId);
    }
  }
  const updated = { ...record, pendingDeletionObjectIds: failed } as ApkRecord;
  if (failed.length !== pending.length) await saveRecord(database, updated);
  return updated;
};

const legacyApkUrl = (): string | null => {
  const configuredOrigin = process.env.WEB_APP_ORIGIN?.split(",")[0]?.trim();
  if (!configuredOrigin) return null;
  try {
    const origin = new URL(configuredOrigin);
    if (origin.protocol !== "https:" && origin.protocol !== "http:")
      return null;
    return new URL("/downloads/ru.utp.servise.apk", origin).toString();
  } catch {
    return null;
  }
};

const publicStatus = async (database: DatabaseClient) => {
  const record = await findRecord(database);
  if (record?.status === "available") {
    return {
      state: "available" as const,
      fileName: APK_FILE_NAME,
      sizeBytes: record.sizeBytes,
      versionCode: record.versionCode ?? null,
      versionName: record.versionName ?? null,
      sha256: record.sha256,
      uploadedAt: record.uploadedAt,
      downloadPath: "/android-app/download",
    };
  }
  if (record?.status === "deleted") {
    return {
      state: "deleted" as const,
      fileName: null,
      sizeBytes: null,
      versionCode: null,
      versionName: null,
      sha256: null,
      uploadedAt: null,
    };
  }
  return {
    state: legacyApkUrl() ? ("legacy" as const) : ("unavailable" as const),
    fileName: legacyApkUrl() ? APK_FILE_NAME : null,
    sizeBytes: null,
    versionCode: null,
    versionName: null,
    sha256: null,
    uploadedAt: null,
  };
};

const apkInfo = (record: ApkRecord | null) => {
  if (!record) {
    return {
      state: legacyApkUrl() ? ("legacy" as const) : ("unavailable" as const),
      fileName: legacyApkUrl() ? APK_FILE_NAME : null,
      sizeBytes: null,
      sha256: null,
      versionCode: null,
      versionName: null,
      uploadedAt: null,
      pendingDeletionCount: 0,
    };
  }
  if (record.status === "deleted") {
    return {
      state: "deleted" as const,
      fileName: null,
      sizeBytes: null,
      sha256: null,
      versionCode: null,
      versionName: null,
      uploadedAt: record.deletedAt,
      pendingDeletionCount: record.pendingDeletionObjectIds.length,
    };
  }
  return {
    state: "available" as const,
    fileName: APK_FILE_NAME,
    sizeBytes: record.sizeBytes,
    sha256: record.sha256,
    versionCode: record.versionCode ?? null,
    versionName: record.versionName ?? null,
    uploadedAt: record.uploadedAt,
    pendingDeletionCount: record.pendingDeletionObjectIds.length,
  };
};

const uploadedApk = (bytes: Buffer): Buffer => {
  const contentType = APK_CONTENT_TYPE;
  const hasZipSignature =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;
  if (
    contentType !== APK_CONTENT_TYPE ||
    !hasZipSignature ||
    bytes.length === 0
  ) {
    throw new HttpError(
      400,
      "INVALID_APK",
      "Выберите APK-файл приложения Android.",
    );
  }
  if (bytes.length > MAX_APK_BYTES) {
    throw new HttpError(
      413,
      "APK_TOO_LARGE",
      "Размер APK не должен превышать 100 МБ.",
    );
  }
  return bytes;
};

const cleanRequestBody = (request: express.Request): Buffer => {
  if (
    request.header("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !==
    APK_CONTENT_TYPE
  ) {
    throw new HttpError(
      400,
      "INVALID_APK",
      "Выберите APK-файл приложения Android.",
    );
  }
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  return uploadedApk(bytes);
};

export const createAndroidAppRouter = (
  database: DatabaseClient,
  storage: AndroidApkStorage = projectApkStorage,
  sendUpdateNotification: AndroidAppUpdateNotificationSender = sendPushNotification,
  readApkMetadata: AndroidApkMetadataReader = readAndroidApkMetadata,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const requireAdmin = requireRoles("ADMIN");

  router.get("/android-app", async (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.json({ apk: await publicStatus(database) });
  });

  router.get("/android-app/download", async (request, response) => {
    const record = await findRecord(database);
    if (!record) {
      const fallbackUrl = legacyApkUrl();
      if (fallbackUrl) {
        await recordProductAnalytics(
          database,
          "APP_DOWNLOAD",
          productAnalyticsChannel(request),
        );
        response.redirect(302, fallbackUrl);
        return;
      }
      throw new HttpError(404, "APK_NOT_FOUND", "APK пока не загружен.");
    }
    if (record.status === "deleted") {
      throw new HttpError(404, "APK_NOT_FOUND", "APK пока не загружен.");
    }
    const url = await storage.downloadUrl(record.objectId);
    await recordProductAnalytics(
      database,
      "APP_DOWNLOAD",
      productAnalyticsChannel(request),
    );
    response.redirect(302, url);
  });

  router.get(
    "/admin/android-app",
    requireAuth,
    requireAdmin,
    async (_request, response) => {
      response.json({ apk: apkInfo(await findRecord(database)) });
    },
  );

  router.post(
    "/admin/android-app/notify",
    requireAuth,
    requireAdmin,
    async (_request, response) => {
      const record = await findRecord(database);
      if (record?.status !== "available") {
        throw new HttpError(
          409,
          "APK_NOT_AVAILABLE",
          "Сначала загрузите новую версию APK.",
        );
      }

      const activeUsers = await database.user.findMany({
        where: { active: true },
        select: { id: true },
      });
      const recipientUserIds = activeUsers.map(({ id }) => id);
      const deviceCount = await database.pushDeviceToken.count({
        where: { userId: { in: recipientUserIds } },
      });
      if (deviceCount === 0) {
        response.json({
          recipientCount: recipientUserIds.length,
          deviceCount: 0,
          deliverySucceeded: true,
        });
        return;
      }

      const deliverySucceeded = await sendUpdateNotification(
        database,
        recipientUserIds,
        {
          title: "Доступно обновление ЕНОТ СЕРВИС",
          body: "Откройте приложение — оно предложит скачать и установить новую версию.",
          data: {
            type: "app_update",
            notificationId: `android-app-update-${record.sha256}`,
          },
          androidTag: "android-app-update",
        },
      );
      response.json({
        recipientCount: recipientUserIds.length,
        deviceCount,
        deliverySucceeded,
      });
    },
  );

  router.post(
    "/admin/android-app",
    requireAuth,
    requireAdmin,
    apkBody,
    async (request, response) => {
      const bytes = cleanRequestBody(request);
      const apkMetadata = await readApkMetadata(bytes);
      if (apkMetadata.packageName !== ANDROID_APP_PACKAGE_NAME) {
        throw new HttpError(
          400,
          "WRONG_APK_PACKAGE",
          "Выбран APK другого приложения. Загрузите ЕНОТ СЕРВИС.",
        );
      }
      const versionMetadata = appVersionMetadataSchema.safeParse({
        versionCode: apkMetadata.versionCode,
        versionName: apkMetadata.versionName,
      });
      if (!versionMetadata.success) {
        throw new HttpError(
          400,
          "INVALID_APP_VERSION",
          "Не удалось прочитать версию из APK. Проверьте файл и попробуйте ещё раз.",
        );
      }
      const previous = await findRecord(database);
      if (
        previous?.status === "available" &&
        previous.versionCode !== undefined &&
        versionMetadata.data.versionCode <= previous.versionCode
      ) {
        throw new HttpError(
          409,
          "APP_VERSION_NOT_NEWER",
          "Номер сборки нового APK должен быть больше текущего.",
        );
      }
      const objectId = await storage.upload(bytes);
      const pendingDeletionObjectIds = [
        ...new Set([
          ...(previous?.pendingDeletionObjectIds ?? []),
          ...(previous?.status === "available" ? [previous.objectId] : []),
        ]),
      ];
      const uploadedAt = new Date().toISOString();
      const nextRecord: ActiveApkRecord = {
        status: "available",
        objectId,
        sizeBytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        versionCode: versionMetadata.data.versionCode,
        versionName: versionMetadata.data.versionName,
        uploadedAt,
        pendingDeletionObjectIds,
      };
      try {
        await saveRecord(database, nextRecord);
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
      const cleanedRecord = await cleanRetiredObjects(
        database,
        storage,
        nextRecord,
      );
      response.status(200).json({
        apk: apkInfo(cleanedRecord),
        cleanupPending: cleanedRecord.pendingDeletionObjectIds.length > 0,
      });
    },
  );

  router.post(
    "/admin/android-app/cleanup",
    requireAuth,
    requireAdmin,
    async (_request, response) => {
      const record = await findRecord(database);
      if (!record) {
        response.json({ cleanupPending: false, pendingDeletionCount: 0 });
        return;
      }
      const cleanedRecord = await cleanRetiredObjects(
        database,
        storage,
        record,
      );
      response.json({
        cleanupPending: cleanedRecord.pendingDeletionObjectIds.length > 0,
        pendingDeletionCount: cleanedRecord.pendingDeletionObjectIds.length,
      });
    },
  );

  router.delete(
    "/admin/android-app",
    requireAuth,
    requireAdmin,
    async (_request, response) => {
      const previous = await findRecord(database);
      const nextRecord: ApkRecord = {
        status: "deleted",
        deletedAt: new Date().toISOString(),
        pendingDeletionObjectIds: [
          ...new Set([
            ...(previous?.pendingDeletionObjectIds ?? []),
            ...(previous?.status === "available" ? [previous.objectId] : []),
          ]),
        ],
      };
      await saveRecord(database, nextRecord);
      const cleanedRecord = await cleanRetiredObjects(
        database,
        storage,
        nextRecord,
      );
      response.json({
        apk: apkInfo(cleanedRecord),
        cleanupPending: cleanedRecord.pendingDeletionObjectIds.length > 0,
      });
    },
  );

  return router;
};
