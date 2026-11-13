import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCatalogProductImagesRouter } from "../src/features/media/catalog-product-images.routes.js";
import { type MediaStorage } from "../src/features/media/media.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminToken = "P".repeat(48);
const catalogItemId = "33333333-3333-4333-8333-333333333339";
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

test("catalog products reject a fourth photo and remove the rejected upload", async (t) => {
  const deletedObjectIds: string[] = [];
  const currentItem = {
    id: catalogItemId,
    type: "PRODUCT" as const,
    imageObjectIds: ["first-photo", "second-photo", "third-photo"],
  };
  const transaction = {
    $queryRaw: async () => [],
    repairCatalogItem: {
      findUnique: async () => currentItem,
      update: async () => {
        throw new Error(
          "Update must not run when the image limit has been reached.",
        );
      },
    },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(adminToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
          : null,
    },
    $transaction: async <T>(
      operation: (client: typeof transaction) => Promise<T>,
    ) => operation(transaction),
  };
  const storage: MediaStorage = {
    upload: async () => "rejected-fourth-photo",
    delete: async (objectId) => {
      deletedObjectIds.push(objectId);
    },
    download: async () => ({ bytes: jpeg, contentType: "image/jpeg" }),
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCatalogProductImagesRouter(
      database as unknown as DatabaseClient,
      storage,
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/catalog/${catalogItemId}/images`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "image/jpeg",
      },
      body: jpeg,
    },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(deletedObjectIds, ["rejected-fourth-photo"]);
});
