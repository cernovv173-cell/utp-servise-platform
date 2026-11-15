import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import {
  type MediaStorage,
  createMediaRouter,
} from "../src/features/media/media.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";
import {
  validateImage,
  validateMedia,
} from "../src/lib/storage/project-images.js";

const jpegFixture = Buffer.from([0xff, 0xd8, 0xff, 0x01]);
const mp4Fixture = Buffer.from("0000ftypisom", "ascii");

test("media accepts real image and MP4 signatures and rejects mislabeled or empty uploads", () => {
  assert.equal(validateImage(jpegFixture, "image/jpeg"), "image/jpeg");
  assert.throws(() => validateImage(jpegFixture, "image/png"), {
    code: "INVALID_IMAGE",
  });
  assert.throws(() => validateImage(Buffer.alloc(0), "image/jpeg"), {
    code: "INVALID_IMAGE",
  });
  assert.equal(validateMedia(mp4Fixture, "video/mp4"), "video/mp4");
  assert.throws(() => validateMedia(mp4Fixture, "video/quicktime"), {
    code: "INVALID_MEDIA",
  });
  assert.throws(() => validateMedia(Buffer.from("not an mp4"), "video/mp4"), {
    code: "INVALID_MEDIA",
  });
});

test("avatars, order photos, and offer prizes remain visible only to authorized users", async (t) => {
  const tokens = {
    owner: "O".repeat(48),
    stranger: "S".repeat(48),
    admin: "A".repeat(48),
  };
  const owner = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@example.test",
    displayName: "Клиент",
    phoneNumber: null,
    avatarObjectId: null as string | null,
    role: "CUSTOMER" as const,
    active: true,
    mustChangePassword: false,
  };
  const stranger = {
    ...owner,
    id: "22222222-2222-4222-8222-222222222222",
    email: "stranger@example.test",
    displayName: "Другой клиент",
    role: "CUSTOMER" as const,
  };
  const admin = {
    ...owner,
    id: "33333333-3333-4333-8333-333333333333",
    email: "admin@example.test",
    displayName: "Администратор",
    role: "ADMIN" as const,
  };
  const sessions = [
    { ...owner, token: tokens.owner },
    { ...stranger, token: tokens.stranger },
    { ...admin, token: tokens.admin },
  ];
  let storedBytes = jpegFixture;
  let objectIdSequence = 0;
  const storage: MediaStorage = {
    upload: async (bytes) => {
      storedBytes = Buffer.from(bytes);
      objectIdSequence += 1;
      return `image-${objectIdSequence}`;
    },
    delete: async () => undefined,
    download: async () => ({ bytes: storedBytes, contentType: "image/jpeg" }),
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        return session
          ? { expiresAt: new Date(Date.now() + 60_000), user: session }
          : null;
      },
    },
    user: {
      update: async ({ data }: { data: { avatarObjectId: string } }) => {
        owner.avatarObjectId = data.avatarObjectId;
        return owner;
      },
      findFirst: async ({ where }: { where: { avatarObjectId: string } }) =>
        owner.avatarObjectId === where.avatarObjectId
          ? { id: owner.id, role: owner.role }
          : null,
    },
    repairOrder: {
      findUnique: async () => ({
        id: "44444444-4444-4444-8444-444444444444",
        customerId: owner.id,
        assignedTechnicianId: null,
      }),
    },
    newsArticle: {
      findFirst: async () => null,
    },
    craftItem: {
      findFirst: async () => null,
    },
    review: {
      findFirst: async () => null,
    },
    siteBanner: {
      findFirst: async () => null,
    },
    craftOrderChatMessage: {
      findFirst: async () => null,
    },
    repairOrderPhoto: {
      findUnique: async ({ where }: { where: { objectId: string } }) =>
        where.objectId === "image-2"
          ? { order: { customerId: owner.id, assignedTechnicianId: null } }
          : null,
      create: async ({ data }: { data: Record<string, unknown> }) => ({
        id: "55555555-5555-4555-8555-555555555555",
        ...data,
      }),
    },
    repairOrderIntake: {
      findFirst: async () => null,
    },
    customerOffer: {
      findFirst: async ({
        where,
      }: {
        where: {
          OR: Array<Record<string, string>>;
          isPublished?: boolean;
        };
      }) => {
        const imageId = where.OR.flatMap(Object.values).find(Boolean);
        if (imageId === "published-offer-prize")
          return { id: "published-offer" };
        if (
          imageId === "draft-offer-prize" &&
          where.isPublished === undefined
        ) {
          return { id: "draft-offer" };
        }
        return null;
      },
    },
    repairCatalogItem: {
      findFirst: async () => null,
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createMediaRouter(database as unknown as DatabaseClient, storage),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const authHeaders = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "image/jpeg",
  });

  const uploaded = await fetch(`${baseUrl}/media/avatar`, {
    method: "POST",
    headers: authHeaders(tokens.owner),
    body: jpegFixture,
  });
  assert.equal(uploaded.status, 200);
  assert.equal((await uploaded.json()).user.avatarObjectId, "image-1");

  const privateAvatar = await fetch(`${baseUrl}/media/image-1`, {
    headers: { authorization: `Bearer ${tokens.stranger}` },
  });
  assert.equal(privateAvatar.status, 404);

  const savedPhoto = await fetch(
    `${baseUrl}/orders/44444444-4444-4444-8444-444444444444/photos`,
    {
      method: "POST",
      headers: authHeaders(tokens.owner),
      body: jpegFixture,
    },
  );
  assert.equal(savedPhoto.status, 201);
  assert.equal((await savedPhoto.json()).photo.objectId, "image-2");

  const visiblePhoto = await fetch(`${baseUrl}/media/image-2`, {
    headers: { authorization: `Bearer ${tokens.owner}` },
  });
  assert.equal(visiblePhoto.status, 200);
  assert.equal(visiblePhoto.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await visiblePhoto.arrayBuffer()), jpegFixture);

  const visibleOfferPrize = await fetch(
    `${baseUrl}/media/published-offer-prize`,
    { headers: { authorization: `Bearer ${tokens.owner}` } },
  );
  assert.equal(visibleOfferPrize.status, 200);

  const hiddenDraftPrize = await fetch(`${baseUrl}/media/draft-offer-prize`, {
    headers: { authorization: `Bearer ${tokens.owner}` },
  });
  assert.equal(hiddenDraftPrize.status, 404);

  const adminDraftPrize = await fetch(`${baseUrl}/media/draft-offer-prize`, {
    headers: { authorization: `Bearer ${tokens.admin}` },
  });
  assert.equal(adminDraftPrize.status, 200);
});
