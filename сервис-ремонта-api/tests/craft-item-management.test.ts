import express, { type Router } from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCraftsRouter } from "../src/features/crafts/crafts.routes.js";
import {
  type MediaStorage,
  createMediaRouter,
} from "../src/features/media/media.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminToken = "A".repeat(48);
const craftItemId = "33333333-3333-4333-8333-333333333338";
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x01]);

const admin = {
  id: "admin-id",
  email: "admin@example.test",
  displayName: "Администратор",
  phoneNumber: null,
  avatarObjectId: null,
  role: "ADMIN" as const,
  active: true,
  mustChangePassword: false,
};

type TestContextLike = { after: (callback: () => void) => void };

const withServer = async (t: TestContextLike, router: Router) => {
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}/api`;
};

const sessionRepository = {
  findUnique: async ({ where }: { where: { tokenHash: string } }) =>
    where.tokenHash === hashSessionToken(adminToken)
      ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
      : null,
};

test("craft item photos allow at most three and keep the legacy primary image in sync", async (t) => {
  let item = {
    id: craftItemId,
    imageObjectId: "legacy-photo",
    imageObjectIds: [] as string[],
  };
  const deletedObjectIds: string[] = [];
  let uploadCount = 0;
  const storage: MediaStorage = {
    upload: async () => {
      uploadCount += 1;
      return `uploaded-${uploadCount}`;
    },
    delete: async (objectId) => {
      deletedObjectIds.push(objectId);
    },
    download: async () => ({ bytes: jpeg, contentType: "image/jpeg" }),
  };
  const craftItemRepository = {
    findUnique: async () => item,
    update: async ({ data }: { data: Partial<typeof item> }) => {
      item = { ...item, ...data };
      return item;
    },
  };
  const database = {
    session: sessionRepository,
    craftItem: craftItemRepository,
    $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) =>
      operation({
        $queryRaw: async () => [],
        craftItem: craftItemRepository,
      }),
  };
  const baseUrl = await withServer(
    t,
    createMediaRouter(database as unknown as DatabaseClient, storage),
  );
  const addImage = () =>
    fetch(`${baseUrl}/craft-items/${craftItemId}/images`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "image/jpeg",
      },
      body: jpeg,
    });

  const first = await addImage();
  assert.equal(first.status, 201);
  assert.deepEqual(item.imageObjectIds, ["legacy-photo", "uploaded-1"]);
  assert.equal(item.imageObjectId, "legacy-photo");

  const second = await addImage();
  assert.equal(second.status, 201);
  assert.deepEqual(item.imageObjectIds, [
    "legacy-photo",
    "uploaded-1",
    "uploaded-2",
  ]);

  const fourth = await addImage();
  assert.equal(fourth.status, 409);
  assert.equal(uploadCount, 3);
  assert.deepEqual(deletedObjectIds, ["uploaded-3"]);

  const removePrimary = await fetch(
    `${baseUrl}/craft-items/${craftItemId}/images/legacy-photo`,
    { method: "DELETE", headers: { authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(removePrimary.status, 200);
  assert.deepEqual(item.imageObjectIds, ["uploaded-1", "uploaded-2"]);
  assert.equal(item.imageObjectId, "uploaded-1");
  assert.deepEqual(deletedObjectIds, ["uploaded-3", "legacy-photo"]);
});

test("craft item deletion blocks open orders and removes the listing photos otherwise", async (t) => {
  let deleteAllowed = false;
  let itemDeleted = false;
  const deletedObjectIds: string[] = [];
  const item = {
    id: craftItemId,
    imageObjectId: "first-photo",
    imageObjectIds: ["first-photo", "second-photo"],
  };
  const craftItemRepository = {
    findUnique: async () => item,
    delete: async () => {
      itemDeleted = true;
      return item;
    },
  };
  const transaction = {
    $queryRaw: async () => [],
    craftItem: craftItemRepository,
    craftOrder: {
      findFirst: async () =>
        deleteAllowed ? null : { id: "open-craft-order" },
    },
    shopOrderItem: { findFirst: async () => null },
  };
  const database = {
    session: sessionRepository,
    $transaction: async <T>(
      operation: (client: typeof transaction) => Promise<T>,
    ) => operation(transaction),
  };
  const storage: MediaStorage = {
    upload: async () => "unused",
    delete: async (objectId) => {
      deletedObjectIds.push(objectId);
    },
    download: async () => ({ bytes: jpeg, contentType: "image/jpeg" }),
  };
  const baseUrl = await withServer(
    t,
    createCraftsRouter(
      database as unknown as DatabaseClient,
      undefined,
      storage,
    ),
  );

  const blocked = await fetch(`${baseUrl}/craft-items/${craftItemId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(blocked.status, 409);
  assert.equal(itemDeleted, false);
  assert.deepEqual(deletedObjectIds, []);

  deleteAllowed = true;
  const deleted = await fetch(`${baseUrl}/craft-items/${craftItemId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleted.status, 204);
  assert.equal(itemDeleted, true);
  assert.deepEqual(deletedObjectIds, ["first-photo", "second-photo"]);
});

test("admins can edit a published craft item without taking it offline", async (t) => {
  const publishedItem = {
    id: craftItemId,
    title: "Старая версия",
    description: "Старое описание",
    priceRub: 1000,
    stockQuantity: 1,
    customOrderAvailable: true,
    isPublished: true,
  };
  let savedItem = publishedItem;
  const database = {
    session: sessionRepository,
    craftItem: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<typeof publishedItem>;
      }) => {
        assert.equal(where.id, craftItemId);
        savedItem = { ...savedItem, ...data };
        return savedItem;
      },
    },
  };
  const baseUrl = await withServer(
    t,
    createCraftsRouter(database as unknown as DatabaseClient),
  );

  const response = await fetch(`${baseUrl}/craft-items/${craftItemId}`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: "Обновлённое изделие",
      description: "Новое описание",
      priceRub: 1500,
      stockQuantity: 2,
      customOrderAvailable: false,
    }),
  });

  assert.equal(response.status, 200);
  const result = (await response.json()) as { item: typeof publishedItem };
  assert.equal(result.item.title, "Обновлённое изделие");
  assert.equal(result.item.priceRub, 1500);
  assert.equal(result.item.isPublished, true);
});
