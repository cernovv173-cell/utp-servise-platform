import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCustomerOffersRouter } from "../src/features/customer-offers/customer-offers.routes.js";
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
const unpublishedOfferId = "55555555-5555-4555-8555-555555555555";

const makeOffer = (
  id: string,
  values: Partial<{
    type: "PROMOTION" | "GIVEAWAY";
    firstPlacePrize: string | null;
    firstPlacePoints: number;
    secondPlacePrize: string | null;
    secondPlacePoints: number;
    thirdPlacePrize: string | null;
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
  firstPlacePoints: 0,
  secondPlacePrize: null,
  secondPlacePoints: 0,
  thirdPlacePrize: null,
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

const createHarness = () => {
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
    makeOffer(unpublishedOfferId, { isPublished: false }),
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
      findMany: async ({
        where,
        include,
        select,
      }: {
        where?: {
          isPublished?: boolean;
          startsAt?: { lte: Date };
          endsAt?: { gt: Date };
        };
        include?: Record<string, any>;
        select?: Record<string, true>;
      }) =>
        offers
          .filter(
            (offer) =>
              (where?.isPublished === undefined ||
                offer.isPublished === where.isPublished) &&
              (!where?.startsAt?.lte || offer.startsAt <= where.startsAt.lte) &&
              (!where?.endsAt?.gt || offer.endsAt > where.endsAt.gt),
          )
          .map((offer) =>
            select
              ? Object.fromEntries(
                  Object.keys(select).map((key) => [
                    key,
                    offer[key as keyof typeof offer],
                  ]),
                )
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
        data: { isPublished: boolean };
      }) => {
        const offer = offers.find((candidate) => candidate.id === where.id);
        assert.ok(offer);
        offer.isPublished = data.isPublished;
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
    customerOfferParticipation: {
      findUnique: async ({
        where,
      }: {
        where: { offerId_customerId: { offerId: string; customerId: string } };
      }) =>
        entries.find(
          (entry) =>
            entry.offerId === where.offerId_customerId.offerId &&
            entry.customerId === where.offerId_customerId.customerId,
        ) ?? null,
      findMany: async ({ where }: { where: { offerId: string } }) =>
        entries.filter((entry) => entry.offerId === where.offerId),
      create: async ({
        data,
      }: {
        data: { offerId: string; customerId: string };
      }) => {
        const entry = {
          id: `entry-${entryNumber++}`,
          ...data,
          joinedAt: new Date(),
          place: null,
        };
        entries.push(entry);
        return entry;
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
    createCustomerOffersRouter(client as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);

  return { offers, entries, loyaltyTransactions, offerPushDeliveries, server };
};

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

  const repeatedPublish = await fetch(
    `${baseUrl}/admin/offers/${giveawayId}/publish-results`,
    {
      method: "POST",
      headers: headers(adminToken),
    },
  );
  assert.equal(repeatedPublish.status, 200);
  assert.equal(harness.loyaltyTransactions.length, 3);
});

test("only administrators create offers and each giveaway place requires a prize or points", async (t) => {
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

  const invalidGiveaway = await fetch(baseUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      ...body,
      thirdPlacePrize: null,
      thirdPlacePoints: 0,
    }),
  });
  assert.equal(invalidGiveaway.status, 400);

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
