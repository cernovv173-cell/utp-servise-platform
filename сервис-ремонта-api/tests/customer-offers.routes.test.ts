import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCustomerOffersRouter } from "../src/features/customer-offers/customer-offers.routes.js";
import type { MediaStorage } from "../src/features/media/media-storage.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminToken = "A".repeat(48);
const customerToken = "C".repeat(48);
const secondCustomerToken = "D".repeat(48);
const thirdCustomerToken = "E".repeat(48);
const technicianToken = "T".repeat(48);
const promotionId = "11111111-1111-4111-8111-111111111111";
const giveawayId = "22222222-2222-4222-8222-222222222222";
const scheduledGiveawayId = "33333333-3333-4333-8333-333333333333";
const legacyQuizId = "44444444-4444-4444-8444-444444444444";
const unpublishedOfferId = "55555555-5555-4555-8555-555555555555";

const makeOffer = (
  id: string,
  values: Partial<{
    type: string;
    firstPlacePrize: string | null;
    firstPlacePrizeImageId: string | null;
    firstPlacePoints: number;
    secondPlacePrize: string | null;
    secondPlacePrizeImageId: string | null;
    secondPlacePoints: number;
    thirdPlacePrize: string | null;
    thirdPlacePrizeImageId: string | null;
    thirdPlacePoints: number;
    startsAt: Date;
    endsAt: Date;
    isPublished: boolean;
    drawnAt: Date | null;
    resultsPublishedAt: Date | null;
  }> = {},
) => ({
  id,
  type: "PROMOTION" as const,
  title: "Весенняя акция",
  content: "Запишитесь на участие в предложении.",
  firstPlacePrize: null,
  firstPlacePrizeImageId: null,
  firstPlacePoints: 0,
  secondPlacePrize: null,
  secondPlacePrizeImageId: null,
  secondPlacePoints: 0,
  thirdPlacePrize: null,
  thirdPlacePrizeImageId: null,
  thirdPlacePoints: 0,
  isPublished: true,
  startsAt: new Date(Date.now() - 60_000),
  endsAt: new Date(Date.now() + 3_600_000),
  drawnAt: null,
  resultsPublishedAt: null,
  createdById: "admin-user",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...values,
});

const createHarness = (storage?: MediaStorage) => {
  const users = [
    {
      id: "admin-user",
      email: "admin@test.invalid",
      displayName: "Администратор",
      role: "ADMIN" as const,
      token: adminToken,
    },
    {
      id: "customer-user",
      email: "customer@test.invalid",
      displayName: "Клиент Один",
      role: "CUSTOMER" as const,
      token: customerToken,
    },
    {
      id: "customer-two",
      email: "second@test.invalid",
      displayName: "Клиент Два",
      role: "CUSTOMER" as const,
      token: secondCustomerToken,
    },
    {
      id: "customer-three",
      email: "third@test.invalid",
      displayName: "Клиент Три",
      role: "CUSTOMER" as const,
      token: thirdCustomerToken,
    },
    {
      id: "tech-user",
      email: "tech@test.invalid",
      displayName: "Мастер",
      role: "TECHNICIAN" as const,
      token: technicianToken,
    },
  ];
  const offers = [
    makeOffer(promotionId),
    makeOffer(giveawayId, {
      type: "GIVEAWAY",
      title: "Розыгрыш трёх призов",
      firstPlacePrize: "Приз 1-го места",
      firstPlacePoints: 400,
      secondPlacePrize: "Приз 2-го места",
      secondPlacePoints: 200,
      thirdPlacePrize: "Приз 3-го места",
      thirdPlacePoints: 100,
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() - 60_000),
    }),
    makeOffer(scheduledGiveawayId, {
      type: "GIVEAWAY",
      firstPlacePrize: "Приз 1-го места",
      firstPlacePoints: 400,
      secondPlacePrize: "Приз 2-го места",
      secondPlacePoints: 200,
      thirdPlacePrize: "Приз 3-го места",
      thirdPlacePoints: 100,
      startsAt: new Date(Date.now() + 3_600_000),
      endsAt: new Date(Date.now() + 7_200_000),
    }),
    makeOffer(legacyQuizId, { type: "QUIZ" }),
    makeOffer(unpublishedOfferId, { type: "GIVEAWAY", isPublished: false }),
  ];
  const entries: Array<{
    id: string;
    offerId: string;
    customerId: string;
    joinedAt: Date;
    place: number | null;
  }> = [
    {
      id: "entry-one",
      offerId: giveawayId,
      customerId: "customer-user",
      joinedAt: new Date(),
      place: null,
    },
    {
      id: "entry-two",
      offerId: giveawayId,
      customerId: "customer-two",
      joinedAt: new Date(),
      place: null,
    },
    {
      id: "entry-three",
      offerId: giveawayId,
      customerId: "customer-three",
      joinedAt: new Date(),
      place: null,
    },
  ];
  const loyaltyTransactions: Array<Record<string, unknown>> = [];
  const offerPushDeliveries: Array<{
    id: string;
    offerId: string;
    nextAttemptAt: Date;
    lockedUntil: Date | null;
    sentAt: Date | null;
    attemptCount: number;
    lastError: string | null;
  }> = [];
  const winnerPushDeliveries: Array<{
    id: string;
    offerId: string;
    customerId: string;
  }> = [];
  let entryNumber = 4;
  let offerNumber = 4;

  const entryMatches = (
    entry: (typeof entries)[number],
    filter: Record<string, any>,
  ) => {
    if (Array.isArray(filter.OR)) {
      return filter.OR.some((condition: Record<string, any>) =>
        entryMatches(entry, condition),
      );
    }
    if (filter.customerId && entry.customerId !== filter.customerId)
      return false;
    if (filter.place?.not === null && entry.place === null) return false;
    if (filter.place === null && entry.place !== null) return false;
    return true;
  };

  const includeOffer = (
    offer: (typeof offers)[number],
    include: Record<string, any>,
  ) => {
    const offerEntries = entries.filter((entry) => entry.offerId === offer.id);
    const entryFilter = include.entries?.where ?? {};
    const selectedEntries = offerEntries.filter((entry) =>
      entryMatches(entry, entryFilter),
    );
    const selected = selectedEntries.map((entry) => {
      if (include.entries?.select?.customer) {
        const customer = users.find((user) => user.id === entry.customerId)!;
        return {
          customerId: entry.customerId,
          joinedAt: entry.joinedAt,
          place: entry.place,
          customer: { displayName: customer.displayName },
        };
      }
      return {
        id: entry.id,
        customerId: entry.customerId,
        joinedAt: entry.joinedAt,
        place: entry.place,
        customer: {
          displayName:
            users.find((user) => user.id === entry.customerId)?.displayName ??
            "",
        },
      };
    });
    return {
      ...offer,
      _count: { entries: offerEntries.length },
      entries: selected,
    };
  };

  const selectOffer = (
    offer: (typeof offers)[number],
    select: Record<string, any>,
  ) =>
    Object.fromEntries(
      Object.entries(select).map(([key, value]) => {
        if (key === "entries") {
          const entryFilter = value?.where ?? {};
          const selectedEntries = entries
            .filter(
              (entry) =>
                entry.offerId === offer.id && entryMatches(entry, entryFilter),
            )
            .sort((left, right) => (left.place ?? 0) - (right.place ?? 0))
            .map((entry) =>
              Object.fromEntries(
                Object.entries(value?.select ?? {}).map(
                  ([field]: [string, any]) => {
                    if (field === "customer") {
                      return [
                        field,
                        {
                          displayName:
                            users.find((user) => user.id === entry.customerId)
                              ?.displayName ?? "",
                        },
                      ];
                    }
                    return [
                      field,
                      entry[
                        field as
                          "id" | "offerId" | "customerId" | "joinedAt" | "place"
                      ],
                    ];
                  },
                ),
              ),
            );
          return [key, selectedEntries];
        }
        return [key, offer[key as keyof typeof offer]];
      }),
    );

  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (candidate) => hashSessionToken(candidate.token) === where.tokenHash,
        );
        return user
          ? {
              expiresAt: new Date(Date.now() + 60_000),
              user: {
                ...user,
                phoneNumber: null,
                gender: null,
                birthDate: null,
                telegramChatId: null,
                maxUserId: null,
                avatarObjectId: null,
                salaryRatePercent: 75,
                active: true,
                mustChangePassword: false,
              },
            }
          : null;
      },
    },
    customerOffer: {
      findFirst: async ({
        where,
        select,
      }: {
        where: Record<string, any>;
        select?: Record<string, boolean>;
      }) => {
        const now = new Date();
        const offer = offers.find((candidate) => {
          const active = candidate.startsAt <= now && candidate.endsAt > now;
          const completed =
            candidate.endsAt <= now && candidate.resultsPublishedAt !== null;
          return (
            candidate.id === where.id &&
            candidate.isPublished === where.isPublished &&
            (where.type?.in === undefined ||
              where.type.in.includes(candidate.type)) &&
            (active || completed)
          );
        });
        if (!offer) return null;
        return select
          ? Object.fromEntries(
              Object.keys(select).map((key) => [
                key,
                offer[key as keyof typeof offer],
              ]),
            )
          : { ...offer };
      },
      findMany: async ({
        where,
        include,
        select,
      }: {
        where?: {
          type?: { in: string[] };
          isPublished?: boolean;
          startsAt?: { lte: Date };
          endsAt?: { gt?: Date; lte?: Date };
          resultsPublishedAt?: { not?: null; lte?: Date };
          entries?: { some?: Record<string, any> };
        };
        include?: Record<string, any>;
        select?: Record<string, any>;
      }) =>
        offers
          .filter(
            (offer) =>
              (where?.isPublished === undefined ||
                offer.isPublished === where.isPublished) &&
              (!where?.type?.in || where.type.in.includes(offer.type)) &&
              (!where?.startsAt?.lte || offer.startsAt <= where.startsAt.lte) &&
              (!where?.endsAt?.gt || offer.endsAt > where.endsAt.gt) &&
              (!where?.endsAt?.lte || offer.endsAt <= where.endsAt.lte) &&
              (where?.resultsPublishedAt?.not !== null ||
                offer.resultsPublishedAt !== null) &&
              (!where?.resultsPublishedAt?.lte ||
                (offer.resultsPublishedAt !== null &&
                  offer.resultsPublishedAt <= where.resultsPublishedAt.lte)) &&
              (!where?.entries?.some ||
                entries.some(
                  (entry) =>
                    entry.offerId === offer.id &&
                    entryMatches(entry, where.entries!.some!),
                )),
          )
          .map((offer) =>
            select
              ? selectOffer(offer, select)
              : includeOffer(offer, include ?? {}),
          ),
      findUnique: async ({
        where,
        include,
        select,
      }: {
        where: { id: string };
        include?: Record<string, any>;
        select?: Record<string, boolean>;
      }) => {
        const offer = offers.find((candidate) => candidate.id === where.id);
        if (!offer) return null;
        if (select) {
          return Object.fromEntries(
            Object.keys(select).map((key) => [
              key,
              offer[key as keyof typeof offer],
            ]),
          );
        }
        return include ? includeOffer(offer, include) : { ...offer };
      },
      findUniqueOrThrow: async ({
        where,
        include,
      }: {
        where: { id: string };
        include: Record<string, any>;
      }) => {
        const offer = offers.find((candidate) => candidate.id === where.id);
        assert.ok(offer);
        return includeOffer(offer, include);
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const offer = makeOffer(
          `44444444-4444-4444-8444-${String(offerNumber++).padStart(12, "0")}`,
          data as Parameters<typeof makeOffer>[1],
        );
        offers.push(offer);
        return offer;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const offer = offers.find((candidate) => candidate.id === where.id);
        assert.ok(offer);
        Object.assign(offer, data);
        return offer;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          drawnAt?: null | { not: null };
          resultsPublishedAt?: null;
        };
        data: { drawnAt?: Date; resultsPublishedAt?: Date };
      }) => {
        const offer = offers.find(
          (candidate) =>
            candidate.id === where.id &&
            (where.drawnAt === undefined ||
              (where.drawnAt === null
                ? candidate.drawnAt === null
                : candidate.drawnAt !== null)) &&
            (where.resultsPublishedAt === undefined ||
              candidate.resultsPublishedAt === null),
        );
        if (!offer) return { count: 0 };
        Object.assign(offer, data);
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: { id: string } }) => {
        const index = offers.findIndex((offer) => offer.id === where.id);
        if (index < 0) return { count: 0 };
        offers.splice(index, 1);
        for (
          let entryIndex = entries.length - 1;
          entryIndex >= 0;
          entryIndex -= 1
        ) {
          if (entries[entryIndex]?.offerId === where.id)
            entries.splice(entryIndex, 1);
        }
        for (
          let deliveryIndex = offerPushDeliveries.length - 1;
          deliveryIndex >= 0;
          deliveryIndex -= 1
        ) {
          if (offerPushDeliveries[deliveryIndex]?.offerId === where.id)
            offerPushDeliveries.splice(deliveryIndex, 1);
        }
        for (
          let deliveryIndex = winnerPushDeliveries.length - 1;
          deliveryIndex >= 0;
          deliveryIndex -= 1
        ) {
          if (winnerPushDeliveries[deliveryIndex]?.offerId === where.id)
            winnerPushDeliveries.splice(deliveryIndex, 1);
        }
        return { count: 1 };
      },
    },
    customerOfferPushDelivery: {
      findUnique: async ({ where }: { where: { offerId: string } }) =>
        offerPushDeliveries.find(
          (delivery) => delivery.offerId === where.offerId,
        ) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { offerId: string };
        create: { offerId: string; nextAttemptAt: Date };
        update: Partial<{
          nextAttemptAt: Date;
          lockedUntil: Date | null;
          attemptCount: number;
          lastError: string | null;
        }>;
      }) => {
        const existing = offerPushDeliveries.find(
          (delivery) => delivery.offerId === where.offerId,
        );
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const delivery = {
          id: `offer-push-${offerPushDeliveries.length + 1}`,
          ...create,
          lockedUntil: null,
          sentAt: null,
          attemptCount: 0,
          lastError: null,
        };
        offerPushDeliveries.push(delivery);
        return delivery;
      },
      deleteMany: async ({
        where,
      }: {
        where: { offerId: string; sentAt?: null };
      }) => {
        const index = offerPushDeliveries.findIndex(
          (delivery) =>
            delivery.offerId === where.offerId &&
            (where.sentAt === undefined || delivery.sentAt === where.sentAt),
        );
        if (index < 0) return { count: 0 };
        offerPushDeliveries.splice(index, 1);
        return { count: 1 };
      },
    },
    customerOfferWinnerPushDelivery: {
      createMany: async ({
        data,
      }: {
        data: Array<{ offerId: string; customerId: string }>;
      }) => {
        let count = 0;
        for (const delivery of data) {
          if (
            winnerPushDeliveries.some(
              (existing) =>
                existing.offerId === delivery.offerId &&
                existing.customerId === delivery.customerId,
            )
          ) {
            continue;
          }
          winnerPushDeliveries.push({
            id: `winner-push-${winnerPushDeliveries.length + 1}`,
            ...delivery,
          });
          count += 1;
        }
        return { count };
      },
    },
    customerOfferParticipation: {
      findUnique: async ({
        where,
        select,
      }: {
        where: { offerId_customerId: { offerId: string; customerId: string } };
        select?: Record<string, boolean>;
      }) => {
        const entry = entries.find(
          (entry) =>
            entry.offerId === where.offerId_customerId.offerId &&
            entry.customerId === where.offerId_customerId.customerId,
        );
        if (!entry || !select) return entry ?? null;
        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            entry[field as keyof typeof entry],
          ]),
        );
      },
      findMany: async ({ where }: { where: { offerId: string } }) =>
        entries.filter((entry) => entry.offerId === where.offerId),
      create: async ({
        data,
        select,
      }: {
        data: {
          offerId: string;
          customerId: string;
        };
        select?: Record<string, boolean>;
      }) => {
        const entry = {
          id: `entry-${entryNumber++}`,
          ...data,
          joinedAt: new Date(),
          place: null,
        };
        entries.push(entry);
        if (!select) return entry;
        return Object.fromEntries(
          Object.keys(select).map((field) => [
            field,
            entry[field as keyof typeof entry],
          ]),
        );
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; offerId: string; place: null };
        data: { place: number };
      }) => {
        const entry = entries.find(
          (candidate) =>
            candidate.id === where.id &&
            candidate.offerId === where.offerId &&
            candidate.place === null,
        );
        if (!entry) return { count: 0 };
        entry.place = data.place;
        return { count: 1 };
      },
    },
    loyaltyTransaction: {
      createMany: async ({
        data,
      }: {
        data: Array<Record<string, unknown>>;
      }) => {
        for (const item of data) {
          if (
            !loyaltyTransactions.some(
              (existing) =>
                existing.customerOfferId === item.customerOfferId &&
                existing.customerId === item.customerId,
            )
          ) {
            loyaltyTransactions.push(item);
          }
        }
        return { count: data.length };
      },
    },
    $queryRaw: async () => [],
  };
  Object.assign(client, {
    $transaction: async <T>(
      operation: (transaction: typeof client) => Promise<T>,
    ) => operation(client),
  });

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCustomerOffersRouter(client as unknown as DatabaseClient, storage),
  );
  app.use(errorHandler);
  const server = app.listen(0);

  return {
    offers,
    entries,
    loyaltyTransactions,
    offerPushDeliveries,
    winnerPushDeliveries,
    server,
  };
};

test("administrators manage prize photos and public access excludes unpublished offers", async (t) => {
  const images = new Map<string, { bytes: Buffer; contentType: string }>();
  const deletedIds: string[] = [];
  let uploadCount = 0;
  let downloadCount = 0;
  const storage: MediaStorage = {
    upload: async (bytes, contentType) => {
      const objectId = `offer-prize-image-${++uploadCount}`;
      images.set(objectId, { bytes: Buffer.from(bytes), contentType });
      return objectId;
    },
    delete: async (objectId) => {
      deletedIds.push(objectId);
      images.delete(objectId);
    },
    download: async (objectId) => {
      downloadCount += 1;
      const image = images.get(objectId);
      assert.ok(image);
      return image;
    },
  };
  const harness = createHarness(storage);
  const activeGiveaway = harness.offers.find(
    (offer) => offer.id === giveawayId,
  );
  assert.ok(activeGiveaway);
  activeGiveaway.startsAt = new Date(Date.now() - 3_600_000);
  activeGiveaway.endsAt = new Date(Date.now() + 3_600_000);
  await once(harness.server, "listening");
  t.after(() => harness.server.close());
  const address = harness.server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });
  const imageBytes = Buffer.from([0xff, 0xd8, 0xff]);
  const upload = (
    offerId: string,
    place: number,
    token: string,
    bytes = imageBytes,
  ) =>
    fetch(`${baseUrl}/admin/offers/${offerId}/prizes/${place}/image`, {
      method: "POST",
      headers: { ...headers(token), "content-type": "image/jpeg" },
      body: bytes,
    });

  const customerUpload = await upload(giveawayId, 1, customerToken);
  assert.equal(customerUpload.status, 403);
  assert.equal(uploadCount, 0);

  const invalidUpload = await upload(
    giveawayId,
    1,
    adminToken,
    Buffer.from("not an image"),
  );
  assert.equal(invalidUpload.status, 400);
  assert.equal(uploadCount, 0);

  const firstUpload = await upload(giveawayId, 1, adminToken);
  assert.equal(firstUpload.status, 201);
  const firstObjectId = (await firstUpload.json()).objectId as string;
  assert.equal(
    harness.offers.find((offer) => offer.id === giveawayId)
      ?.firstPlacePrizeImageId,
    firstObjectId,
  );

  const publicImage = await fetch(
    `${baseUrl}/public/offers/${giveawayId}/prizes/1/image`,
  );
  assert.equal(publicImage.status, 200);
  assert.equal(publicImage.headers.get("content-type"), "image/jpeg");
  assert.equal(publicImage.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()), imageBytes);

  const replacement = await upload(giveawayId, 1, adminToken);
  assert.equal(replacement.status, 201);
  const replacementId = (await replacement.json()).objectId as string;
  assert.ok(deletedIds.includes(firstObjectId));
  assert.equal(images.has(firstObjectId), false);

  const hiddenUpload = await upload(unpublishedOfferId, 2, adminToken);
  assert.equal(hiddenUpload.status, 201);
  const hiddenObjectId = (await hiddenUpload.json()).objectId as string;
  const downloadsBeforeDraftRead = downloadCount;
  const hiddenPublicImage = await fetch(
    `${baseUrl}/public/offers/${unpublishedOfferId}/prizes/2/image`,
  );
  assert.equal(hiddenPublicImage.status, 404);
  assert.equal(downloadCount, downloadsBeforeDraftRead);
  assert.equal(images.has(hiddenObjectId), true);

  const removed = await fetch(
    `${baseUrl}/admin/offers/${giveawayId}/prizes/1/image`,
    { method: "DELETE", headers: headers(adminToken) },
  );
  assert.equal(removed.status, 204);
  assert.equal(
    harness.offers.find((offer) => offer.id === giveawayId)
      ?.firstPlacePrizeImageId,
    null,
  );
  assert.ok(deletedIds.includes(replacementId));
  assert.equal(images.has(replacementId), false);
});

test("customers join once, and administrators draw and publish three distinct winners", async (t) => {
  const harness = createHarness();
  await once(harness.server, "listening");
  t.after(() => harness.server.close());
  const address = harness.server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });

  const publicOffersResponse = await fetch(`${baseUrl}/public/offers`);
  assert.equal(publicOffersResponse.status, 200);
  assert.equal(publicOffersResponse.headers.get("cache-control"), "no-store");
  const publicOffers = await publicOffersResponse.json();
  assert.deepEqual(
    publicOffers.offers.map((offer: { id: string }) => offer.id),
    [promotionId],
  );
  assert.equal(publicOffers.offers[0].participantCount, undefined);
  assert.equal(publicOffers.offers[0].myParticipation, undefined);
  assert.equal(publicOffers.offers[0].winners, undefined);
  assert.deepEqual(publicOffers.completedOffers, []);

  const listing = await fetch(`${baseUrl}/offers`, {
    headers: headers(customerToken),
  });
  assert.equal(listing.status, 200);
  const listingBody = await listing.json();
  assert.equal(listingBody.offers.length, 3);
  assert.equal(
    listingBody.offers.find((offer: { id: string }) => offer.id === giveawayId)
      .winners.length,
    0,
  );

  const joined = await fetch(`${baseUrl}/offers/${promotionId}/participate`, {
    method: "POST",
    headers: headers(customerToken),
  });
  assert.equal(joined.status, 201);
  const repeated = await fetch(`${baseUrl}/offers/${promotionId}/participate`, {
    method: "POST",
    headers: headers(customerToken),
  });
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).alreadyParticipating, true);
  assert.equal(
    harness.entries.filter((entry) => entry.offerId === promotionId).length,
    1,
  );

  const notYetOpen = await fetch(
    `${baseUrl}/offers/${scheduledGiveawayId}/participate`,
    {
      method: "POST",
      headers: headers(customerToken),
    },
  );
  assert.equal(notYetOpen.status, 409);

  const forbidden = await fetch(`${baseUrl}/admin/offers`, {
    headers: headers(customerToken),
  });
  assert.equal(forbidden.status, 403);

  const draw = await fetch(`${baseUrl}/admin/offers/${giveawayId}/draw`, {
    method: "POST",
    headers: headers(adminToken),
  });
  assert.equal(draw.status, 200);
  const drawBody = await draw.json();
  assert.equal(drawBody.offer.winners.length, 3);
  assert.deepEqual(
    drawBody.offer.winners.map((winner: { place: number }) => winner.place),
    [1, 2, 3],
  );
  assert.equal(harness.loyaltyTransactions.length, 0);

  const beforePublish = await fetch(`${baseUrl}/offers`, {
    headers: headers(customerToken),
  });
  const privateOffer = (await beforePublish.json()).offers.find(
    (offer: { id: string }) => offer.id === giveawayId,
  );
  assert.equal(privateOffer.winners.length, 0);
  assert.equal(privateOffer.myParticipation.place, null);

  const forbiddenPublish = await fetch(
    `${baseUrl}/admin/offers/${giveawayId}/publish-results`,
    {
      method: "POST",
      headers: headers(customerToken),
    },
  );
  assert.equal(forbiddenPublish.status, 403);

  const publish = await fetch(
    `${baseUrl}/admin/offers/${giveawayId}/publish-results`,
    {
      method: "POST",
      headers: headers(adminToken),
    },
  );
  assert.equal(publish.status, 200);
  const publishedOffer = (await publish.json()).offer;
  assert.equal(publishedOffer.resultsPublishedAt !== null, true);
  assert.equal(harness.loyaltyTransactions.length, 3);
  assert.equal(harness.winnerPushDeliveries.length, 3);
  assert.deepEqual(
    harness.winnerPushDeliveries.map(({ customerId }) => customerId).sort(),
    (publishedOffer.winners as Array<{ customerId: string }>)
      .map(({ customerId }) => customerId)
      .sort(),
  );
  const expectedPoints = new Map([
    [1, 400],
    [2, 200],
    [3, 100],
  ]);
  for (const winner of publishedOffer.winners as Array<{
    place: number;
    customerId: string;
  }>) {
    const transaction = harness.loyaltyTransactions.find(
      (item) => item.customerId === winner.customerId,
    );
    assert.equal(transaction?.points, expectedPoints.get(winner.place));
    assert.equal(transaction?.customerOfferId, giveawayId);
    assert.equal(transaction?.actorId, "admin-user");
    assert.equal(transaction?.type, "OFFER_REWARD");
  }

  const publicResults = await fetch(`${baseUrl}/offers`, {
    headers: headers(customerToken),
  });
  const customerOffer = (await publicResults.json()).offers.find(
    (offer: { id: string }) => offer.id === giveawayId,
  );
  assert.equal(customerOffer.winners.length, 3);

  const completedResponse = await fetch(`${baseUrl}/public/offers`);
  assert.equal(completedResponse.status, 200);
  const completedBody = await completedResponse.json();
  assert.deepEqual(
    completedBody.offers.map((offer: { id: string }) => offer.id),
    [promotionId],
  );
  assert.deepEqual(
    completedBody.completedOffers.map((offer: { id: string }) => offer.id),
    [giveawayId],
  );
  const completedOffer = completedBody.completedOffers[0];
  assert.equal(
    completedOffer.resultsPublishedAt,
    publishedOffer.resultsPublishedAt,
  );
  assert.deepEqual(
    completedOffer.winners.map(
      ({
        place,
        prize,
        bonusPoints,
      }: {
        place: number;
        prize: string | null;
        bonusPoints: number;
      }) => ({ place, prize, bonusPoints }),
    ),
    [
      { place: 1, prize: "Приз 1-го места", bonusPoints: 400 },
      { place: 2, prize: "Приз 2-го места", bonusPoints: 200 },
      { place: 3, prize: "Приз 3-го места", bonusPoints: 100 },
    ],
  );
  assert.deepEqual(
    new Set(
      completedOffer.winners.map(
        (winner: { displayName: string }) => winner.displayName,
      ),
    ),
    new Set(["Клиент Один", "Клиент Два", "Клиент Три"]),
  );
  assert.ok(
    completedOffer.winners.every(
      (winner: Record<string, unknown>) => winner.customerId === undefined,
    ),
  );

  const repeatedPublish = await fetch(
    `${baseUrl}/admin/offers/${giveawayId}/publish-results`,
    {
      method: "POST",
      headers: headers(adminToken),
    },
  );
  assert.equal(repeatedPublish.status, 200);
  assert.equal(harness.loyaltyTransactions.length, 3);
  assert.equal(harness.winnerPushDeliveries.length, 3);
});

test("legacy quiz records are hidden and cannot be joined", async (t) => {
  const harness = createHarness();
  await once(harness.server, "listening");
  t.after(() => harness.server.close());
  const address = harness.server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });

  const customerOffers = await fetch(`${baseUrl}/offers`, {
    headers: headers(customerToken),
  });
  assert.equal(customerOffers.status, 200);
  assert.equal(
    (await customerOffers.json()).offers.some(
      (offer: { id: string }) => offer.id === legacyQuizId,
    ),
    false,
  );

  const participation = await fetch(
    `${baseUrl}/offers/${legacyQuizId}/participate`,
    {
      method: "POST",
      headers: {
        ...headers(customerToken),
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    },
  );
  assert.equal(participation.status, 404);
  assert.equal(
    harness.entries.filter((entry) => entry.offerId === legacyQuizId).length,
    0,
  );
});

test("offer rewards allow one, two, or three places without prize photos", async (t) => {
  const harness = createHarness();
  await once(harness.server, "listening");
  t.after(() => harness.server.close());
  const address = harness.server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/admin/offers`;
  const body = {
    type: "GIVEAWAY",
    title: "Розыгрыш",
    content: "Подробные условия участия.",
    firstPlacePrize: "Первый приз",
    firstPlacePoints: 250,
    secondPlacePrize: "Второй приз",
    secondPlacePoints: 150,
    thirdPlacePrize: "Третий приз",
    thirdPlacePoints: 50,
    startsAt: new Date(Date.now() + 60_000).toISOString(),
    endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    isPublished: true,
  };

  const customerCreate = await fetch(baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${customerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  assert.equal(customerCreate.status, 403);

  const adminCreate = await fetch(baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  assert.equal(adminCreate.status, 201);
  const created = await adminCreate.json();
  assert.equal(created.offer.firstPlacePoints, 250);
  assert.equal(created.offer.firstPlacePrizeImageId, null);
  assert.equal(created.offer.isPublished, true);
  assert.equal(harness.offerPushDeliveries.length, 1);
  assert.equal(harness.offerPushDeliveries[0]?.offerId, created.offer.id);
  assert.ok(
    harness.offerPushDeliveries[0]?.nextAttemptAt.getTime() <= Date.now(),
  );
  assert.ok(
    harness.offerPushDeliveries[0]!.nextAttemptAt.getTime() <
      Date.parse(body.startsAt),
  );

  const twoPlaceGiveaway = await fetch(baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      thirdPlacePrize: null,
      thirdPlacePoints: 0,
      isPublished: false,
    }),
  });
  assert.equal(twoPlaceGiveaway.status, 201);

  const onePlaceGiveaway = await fetch(baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      secondPlacePrize: null,
      secondPlacePoints: 0,
      thirdPlacePrize: null,
      thirdPlacePoints: 0,
      isPublished: false,
    }),
  });
  assert.equal(onePlaceGiveaway.status, 201);

  const invalidGap = await fetch(baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      secondPlacePrize: null,
      secondPlacePoints: 0,
      isPublished: false,
    }),
  });
  assert.equal(invalidGap.status, 400);

  const noRewards = await fetch(baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      firstPlacePrize: null,
      firstPlacePoints: 0,
      secondPlacePrize: null,
      secondPlacePoints: 0,
      thirdPlacePrize: null,
      thirdPlacePoints: 0,
      isPublished: false,
    }),
  });
  assert.equal(noRewards.status, 400);

  const invalidPromotion = await fetch(baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      type: "PROMOTION",
      firstPlacePrize: null,
      firstPlacePoints: 250,
    }),
  });
  assert.equal(invalidPromotion.status, 400);
});

test("administrators cannot create quiz offers", async (t) => {
  const harness = createHarness();
  await once(harness.server, "listening");
  t.after(() => harness.server.close());
  const address = harness.server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/admin/offers`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      type: "QUIZ",
      title: "Квиз ЕНОТА: не перегревай ноутбук",
      content: "Этот формат больше не поддерживается.",
      startsAt: new Date(Date.now() + 60_000).toISOString(),
      endsAt: new Date(Date.now() + 3_600_000).toISOString(),
      isPublished: false,
    }),
  });
  assert.equal(response.status, 400);
  assert.equal(
    harness.offers.filter((offer) => offer.type === "QUIZ").length,
    1,
  );
  assert.equal(harness.offers.length, 5);
});

test("publishing an offer queues one notification and unpublishing cancels it", async (t) => {
  const harness = createHarness();
  await once(harness.server, "listening");
  t.after(() => harness.server.close());
  const address = harness.server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/admin/offers/${unpublishedOfferId}`;
  const headers = {
    authorization: `Bearer ${adminToken}`,
    "content-type": "application/json",
  };

  const published = await fetch(baseUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ isPublished: true }),
  });
  assert.equal(published.status, 200);
  assert.equal(harness.offerPushDeliveries.length, 1);

  const unpublished = await fetch(baseUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ isPublished: false }),
  });
  assert.equal(unpublished.status, 200);
  assert.equal(harness.offerPushDeliveries.length, 0);
});

test("administrators can delete an offer and its participation records", async (t) => {
  const harness = createHarness();
  await once(harness.server, "listening");
  t.after(() => harness.server.close());
  const address = harness.server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/admin/offers/${giveawayId}`,
    { method: "DELETE", headers: { authorization: `Bearer ${adminToken}` } },
  );

  assert.equal(response.status, 204);
  assert.equal(
    harness.offers.some((offer) => offer.id === giveawayId),
    false,
  );
  assert.equal(
    harness.entries.some((entry) => entry.offerId === giveawayId),
    false,
  );
});
