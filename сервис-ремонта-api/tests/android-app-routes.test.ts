import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import type { AndroidApkMetadataReader } from "../src/features/android-app/android-apk-metadata.js";
import {
  APK_CONTENT_TYPE,
  type AndroidApkStorage,
  createAndroidAppRouter,
} from "../src/features/android-app/android-app.routes.js";
import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import type { PushNotification } from "../src/features/notifications/push-notifications.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const zipFixture = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]);
const testApkMetadataReader: AndroidApkMetadataReader = async (bytes) => {
  const release = bytes.subarray(zipFixture.length).toString();
  if (release === "release-one") {
    return {
      packageName: "ru.utp.servise",
      versionCode: 67,
      versionName: "1.5.33",
    };
  }
  if (release === "release-two") {
    return {
      packageName: "ru.utp.servise",
      versionCode: 68,
      versionName: "1.5.34",
    };
  }
  return {
    packageName: "wrong.package",
    versionCode: 1,
    versionName: "invalid",
  };
};

test("public APK link follows the current upload and administrators can replace or delete it", async (t) => {
  const tokens = {
    admin: "A".repeat(48),
    customer: "C".repeat(48),
    technician: "T".repeat(48),
    inactive: "I".repeat(48),
  };
  const users = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "admin@example.test",
      displayName: "Администратор",
      phoneNumber: null,
      avatarObjectId: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.admin,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "customer@example.test",
      displayName: "Клиент",
      phoneNumber: null,
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.customer,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "technician@example.test",
      displayName: "Мастер",
      phoneNumber: null,
      avatarObjectId: null,
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.technician,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      email: "inactive@example.test",
      displayName: "Отключённый аккаунт",
      phoneNumber: null,
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: false,
      mustChangePassword: false,
      token: tokens.inactive,
    },
  ];
  const settings = new Map<string, unknown>();
  const storedObjects = new Map<string, Buffer>();
  const deleteFailures = new Set<string>();
  const deletedObjects: string[] = [];
  const recordedAnalyticsEvents: Array<{
    metric: string;
    channel: string;
  }> = [];
  let sentRecipientIds: string[] = [];
  let sentNotification: PushNotification | undefined;
  let notificationSendCount = 0;
  let notificationDeliverySucceeded = true;
  let registeredDeviceCount = 4;
  let nextObjectNumber = 0;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (item) => hashSessionToken(item.token) === where.tokenHash,
        );
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    appSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => {
        const value = settings.get(where.key);
        return value === undefined ? null : { key: where.key, value };
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { key: string };
        create: { value: unknown };
        update: { value: unknown };
      }) => {
        const value = settings.has(where.key) ? update.value : create.value;
        settings.set(where.key, value);
        return { key: where.key, value };
      },
    },
    user: {
      findMany: async ({ where }: { where: { active: boolean } }) =>
        users
          .filter((user) => user.active === where.active)
          .map(({ id }) => ({ id })),
    },
    pushDeviceToken: {
      count: async ({ where }: { where: { userId: { in: string[] } } }) => {
        assert.ok(
          where.userId.in.every((userId) =>
            users.some((user) => user.id === userId && user.active),
          ),
        );
        return registeredDeviceCount;
      },
    },
    productAnalyticsDailyMetric: {
      upsert: async ({
        create,
      }: {
        create: { metric: string; channel: string };
      }) => {
        recordedAnalyticsEvents.push({
          metric: create.metric,
          channel: create.channel,
        });
        return create;
      },
    },
  };
  const storage: AndroidApkStorage = {
    upload: async (bytes) => {
      nextObjectNumber += 1;
      const objectId = `apk-${nextObjectNumber}`;
      storedObjects.set(objectId, Buffer.from(bytes));
      return objectId;
    },
    delete: async (objectId) => {
      if (deleteFailures.has(objectId))
        throw new Error("Temporary storage failure");
      storedObjects.delete(objectId);
      deletedObjects.push(objectId);
    },
    downloadUrl: async (objectId) =>
      `https://files.example.test/${objectId}?token=signed`,
  };
  const previousOrigin = process.env.WEB_APP_ORIGIN;
  process.env.WEB_APP_ORIGIN = "https://site.example.test";
  t.after(() => {
    if (previousOrigin === undefined) delete process.env.WEB_APP_ORIGIN;
    else process.env.WEB_APP_ORIGIN = previousOrigin;
  });

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createAndroidAppRouter(
      database as unknown as DatabaseClient,
      storage,
      async (_client, recipientUserIds, notification) => {
        notificationSendCount += 1;
        sentRecipientIds = [...recipientUserIds];
        sentNotification = notification;
        return notificationDeliverySucceeded;
      },
      testApkMetadataReader,
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });
  const apkUploadHeaders = (token: string) => ({
    ...authHeaders(token),
    "content-type": APK_CONTENT_TYPE,
  });

  const legacy = await fetch(`${baseUrl}/android-app/download`, {
    redirect: "manual",
  });
  assert.equal(legacy.status, 302);
  assert.equal(
    legacy.headers.get("location"),
    "https://site.example.test/downloads/ru.utp.servise.apk",
  );

  const notifyBeforeUpload = await fetch(
    `${baseUrl}/admin/android-app/notify`,
    {
      method: "POST",
      headers: authHeaders(tokens.admin),
    },
  );
  assert.equal(notifyBeforeUpload.status, 409);

  const unauthenticated = await fetch(`${baseUrl}/admin/android-app`);
  assert.equal(unauthenticated.status, 401);

  const wrongRole = await fetch(`${baseUrl}/admin/android-app`, {
    method: "POST",
    headers: {
      ...authHeaders(tokens.customer),
      "content-type": APK_CONTENT_TYPE,
    },
    body: zipFixture,
  });
  assert.equal(wrongRole.status, 403);
  assert.equal(storedObjects.size, 0);

  const invalidUpload = await fetch(`${baseUrl}/admin/android-app`, {
    method: "POST",
    headers: apkUploadHeaders(tokens.admin),
    body: Buffer.from("not an APK"),
  });
  assert.equal(invalidUpload.status, 400);

  const missingVersion = await fetch(`${baseUrl}/admin/android-app`, {
    method: "POST",
    headers: { ...authHeaders(tokens.admin), "content-type": APK_CONTENT_TYPE },
    body: zipFixture,
  });
  assert.equal(missingVersion.status, 400);
  assert.equal(storedObjects.size, 0);

  const firstBytes = Buffer.concat([zipFixture, Buffer.from("release-one")]);
  const firstUpload = await fetch(`${baseUrl}/admin/android-app`, {
    method: "POST",
    headers: apkUploadHeaders(tokens.admin),
    body: firstBytes,
  });
  assert.equal(firstUpload.status, 200);
  const firstUploadResult = await firstUpload.json();
  assert.equal(firstUploadResult.apk.state, "available");
  assert.equal(firstUploadResult.apk.versionCode, 67);
  assert.equal(firstUploadResult.apk.versionName, "1.5.33");
  assert.deepEqual(storedObjects.get("apk-1"), firstBytes);
  assert.equal(notificationSendCount, 0);

  const currentAppVersion = await fetch(`${baseUrl}/android-app`);
  assert.equal(currentAppVersion.headers.get("cache-control"), "no-store");
  const currentAppVersionResult = await currentAppVersion.json();
  assert.equal(currentAppVersionResult.apk.versionCode, 67);
  assert.equal(currentAppVersionResult.apk.versionName, "1.5.33");
  assert.equal(
    currentAppVersionResult.apk.sha256,
    firstUploadResult.apk.sha256,
  );

  const staleUpload = await fetch(`${baseUrl}/admin/android-app`, {
    method: "POST",
    headers: apkUploadHeaders(tokens.admin),
    body: firstBytes,
  });
  assert.equal(staleUpload.status, 409);
  assert.equal(storedObjects.size, 1);

  const forbiddenNotification = await fetch(
    `${baseUrl}/admin/android-app/notify`,
    {
      method: "POST",
      headers: authHeaders(tokens.customer),
    },
  );
  assert.equal(forbiddenNotification.status, 403);
  assert.equal(notificationSendCount, 0);

  const sentAnnouncement = await fetch(`${baseUrl}/admin/android-app/notify`, {
    method: "POST",
    headers: authHeaders(tokens.admin),
  });
  assert.equal(sentAnnouncement.status, 200);
  assert.equal(notificationSendCount, 1);
  assert.deepEqual(await sentAnnouncement.json(), {
    recipientCount: 3,
    deviceCount: 4,
    deliverySucceeded: true,
  });
  assert.deepEqual(
    sentRecipientIds.sort(),
    users
      .filter((user) => user.active)
      .map((user) => user.id)
      .sort(),
  );
  assert.equal(sentNotification?.data.type, "app_update");
  assert.equal(sentNotification?.androidTag, "android-app-update");

  notificationDeliverySucceeded = false;
  const partialAnnouncement = await fetch(
    `${baseUrl}/admin/android-app/notify`,
    {
      method: "POST",
      headers: authHeaders(tokens.admin),
    },
  );
  assert.equal(partialAnnouncement.status, 200);
  assert.equal((await partialAnnouncement.json()).deliverySucceeded, false);

  const firstDownload = await fetch(`${baseUrl}/android-app/download`, {
    redirect: "manual",
  });
  assert.equal(firstDownload.status, 302);
  assert.equal(
    firstDownload.headers.get("location"),
    "https://files.example.test/apk-1?token=signed",
  );
  assert.equal(recordedAnalyticsEvents.length, 2);
  assert.ok(
    recordedAnalyticsEvents.every(
      ({ metric, channel }) => metric === "APP_DOWNLOAD" && channel === "OTHER",
    ),
  );

  deleteFailures.add("apk-1");
  const secondBytes = Buffer.concat([zipFixture, Buffer.from("release-two")]);
  const replacement = await fetch(`${baseUrl}/admin/android-app`, {
    method: "POST",
    headers: apkUploadHeaders(tokens.admin),
    body: secondBytes,
  });
  assert.equal(replacement.status, 200);
  const replacementResult = await replacement.json();
  assert.equal(replacementResult.cleanupPending, true);
  assert.equal(replacementResult.apk.versionCode, 68);
  assert.equal(replacementResult.apk.versionName, "1.5.34");
  assert.equal(storedObjects.has("apk-1"), true);
  assert.equal(deletedObjects.includes("apk-1"), false);

  deleteFailures.clear();
  const retryCleanup = await fetch(`${baseUrl}/admin/android-app/cleanup`, {
    method: "POST",
    headers: authHeaders(tokens.admin),
  });
  assert.equal(retryCleanup.status, 200);
  assert.deepEqual(await retryCleanup.json(), {
    cleanupPending: false,
    pendingDeletionCount: 0,
  });
  assert.equal(storedObjects.has("apk-1"), false);

  const currentDownload = await fetch(`${baseUrl}/android-app/download`, {
    redirect: "manual",
  });
  assert.equal(
    currentDownload.headers.get("location"),
    "https://files.example.test/apk-2?token=signed",
  );
  assert.equal(recordedAnalyticsEvents.length, 3);

  const removed = await fetch(`${baseUrl}/admin/android-app`, {
    method: "DELETE",
    headers: authHeaders(tokens.admin),
  });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).apk.state, "deleted");
  assert.equal(storedObjects.size, 0);
  const notifyAfterRemoval = await fetch(
    `${baseUrl}/admin/android-app/notify`,
    {
      method: "POST",
      headers: authHeaders(tokens.admin),
    },
  );
  assert.equal(notifyAfterRemoval.status, 409);
  const noLongerAvailable = await fetch(`${baseUrl}/android-app/download`);
  assert.equal(noLongerAvailable.status, 404);
});
