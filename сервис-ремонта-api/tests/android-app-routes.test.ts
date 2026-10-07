import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import {
  APK_CONTENT_TYPE,
  type AndroidApkStorage,
  createAndroidAppRouter,
} from "../src/features/android-app/android-app.routes.js";
import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const zipFixture = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0]);

test("public APK link follows the current upload and administrators can replace or delete it", async (t) => {
  const tokens = { admin: "A".repeat(48), customer: "C".repeat(48) };
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
  ];
  const settings = new Map<string, unknown>();
  const storedObjects = new Map<string, Buffer>();
  const deleteFailures = new Set<string>();
  const deletedObjects: string[] = [];
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
    createAndroidAppRouter(database as unknown as DatabaseClient, storage),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

  const legacy = await fetch(`${baseUrl}/android-app/download`, {
    redirect: "manual",
  });
  assert.equal(legacy.status, 302);
  assert.equal(
    legacy.headers.get("location"),
    "https://site.example.test/downloads/ru.utp.servise.apk",
  );

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
    headers: { ...authHeaders(tokens.admin), "content-type": APK_CONTENT_TYPE },
    body: Buffer.from("not an APK"),
  });
  assert.equal(invalidUpload.status, 400);

  const firstBytes = Buffer.concat([zipFixture, Buffer.from("release-one")]);
  const firstUpload = await fetch(`${baseUrl}/admin/android-app`, {
    method: "POST",
    headers: { ...authHeaders(tokens.admin), "content-type": APK_CONTENT_TYPE },
    body: firstBytes,
  });
  assert.equal(firstUpload.status, 200);
  assert.equal((await firstUpload.json()).apk.state, "available");
  assert.deepEqual(storedObjects.get("apk-1"), firstBytes);

  const firstDownload = await fetch(`${baseUrl}/android-app/download`, {
    redirect: "manual",
  });
  assert.equal(firstDownload.status, 302);
  assert.equal(
    firstDownload.headers.get("location"),
    "https://files.example.test/apk-1?token=signed",
  );

  deleteFailures.add("apk-1");
  const secondBytes = Buffer.concat([zipFixture, Buffer.from("release-two")]);
  const replacement = await fetch(`${baseUrl}/admin/android-app`, {
    method: "POST",
    headers: { ...authHeaders(tokens.admin), "content-type": APK_CONTENT_TYPE },
    body: secondBytes,
  });
  assert.equal(replacement.status, 200);
  assert.equal((await replacement.json()).cleanupPending, true);
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

  const removed = await fetch(`${baseUrl}/admin/android-app`, {
    method: "DELETE",
    headers: authHeaders(tokens.admin),
  });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).apk.state, "deleted");
  assert.equal(storedObjects.size, 0);
  const noLongerAvailable = await fetch(`${baseUrl}/android-app/download`);
  assert.equal(noLongerAvailable.status, 404);
});
