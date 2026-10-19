import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { type MediaStorage } from "../src/features/media/media-storage.js";
import { createReviewShowcaseRouter } from "../src/features/reviews/review-showcase.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const reviewId = "33333333-3333-4333-8333-333333333333";
const imageBytes = Buffer.from([0xff, 0xd8, 0xff, 0x01]);

test("review showcase exposes only approved photos and requires client consent", async (t) => {
  const adminToken = "A".repeat(48);
  const admin = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.test",
    displayName: "Администратор",
    phoneNumber: null,
    avatarObjectId: null,
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  const review = {
    id: reviewId,
    rating: 5,
    comment: "Ремонт завершён.",
    createdAt: new Date("2026-10-18T12:00:00.000Z"),
    isPublished: true,
    clientPhotoObjectId: null as string | null,
    clientPhotoConsentAt: null as Date | null,
    workPhotoObjectId: "work-photo",
    customer: { displayName: "Клиент" },
    order: { deviceType: "LAPTOP", status: "COMPLETED" as string },
  };
  const deletedObjects: string[] = [];
  let uploads = 0;
  const storage: MediaStorage = {
    upload: async () => {
      uploads += 1;
      return `uploaded-${uploads}`;
    },
    delete: async (objectId) => {
      deletedObjects.push(objectId);
    },
    download: async () => ({ bytes: imageBytes, contentType: "image/jpeg" }),
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(adminToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
          : null,
    },
    review: {
      findMany: async () => [review],
      findFirst: async ({ where }: { where: Record<string, any> }) => {
        if (where.id && where.id !== review.id) return null;
        if (where.isPublished && !review.isPublished) return null;
        if (where.order?.status && where.order.status !== review.order.status)
          return null;
        return review;
      },
      findUnique: async () => review,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(review, data);
        return review;
      },
    },
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createReviewShowcaseRouter(database as unknown as DatabaseClient, storage),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const adminHeaders = {
    authorization: `Bearer ${adminToken}`,
    "content-type": "image/jpeg",
  };

  const publicReviews = await fetch(`${baseUrl}/public/reviews`);
  assert.equal(publicReviews.status, 200);
  const publicReview = (await publicReviews.json()).reviews[0];
  assert.equal(publicReview.hasWorkPhoto, true);
  assert.equal(publicReview.hasClientPhoto, false);
  assert.equal("workPhotoObjectId" in publicReview, false);

  const workPhoto = await fetch(
    `${baseUrl}/public/reviews/${reviewId}/image/work`,
  );
  assert.equal(workPhoto.status, 200);
  assert.equal(workPhoto.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(Buffer.from(await workPhoto.arrayBuffer()), imageBytes);

  const missingConsent = await fetch(
    `${baseUrl}/admin/reviews/${reviewId}/showcase-image/client`,
    { method: "POST", headers: adminHeaders, body: imageBytes },
  );
  assert.equal(missingConsent.status, 400);
  assert.equal(uploads, 0);

  const savedClientPhoto = await fetch(
    `${baseUrl}/admin/reviews/${reviewId}/showcase-image/client?clientPhotoConsent=true`,
    { method: "POST", headers: adminHeaders, body: imageBytes },
  );
  assert.equal(savedClientPhoto.status, 200);
  assert.equal(review.clientPhotoObjectId, "uploaded-1");
  assert.ok(review.clientPhotoConsentAt);

  const clientPhoto = await fetch(
    `${baseUrl}/public/reviews/${reviewId}/image/client`,
  );
  assert.equal(clientPhoto.status, 200);

  const removedClientPhoto = await fetch(
    `${baseUrl}/admin/reviews/${reviewId}/showcase-image/client`,
    { method: "DELETE", headers: { authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(removedClientPhoto.status, 200);
  assert.equal(review.clientPhotoObjectId, null);
  assert.equal(review.clientPhotoConsentAt, null);
  assert.deepEqual(deletedObjects, ["uploaded-1"]);

  review.isPublished = false;
  const hiddenPhoto = await fetch(
    `${baseUrl}/public/reviews/${reviewId}/image/work`,
  );
  assert.equal(hiddenPhoto.status, 404);
});
