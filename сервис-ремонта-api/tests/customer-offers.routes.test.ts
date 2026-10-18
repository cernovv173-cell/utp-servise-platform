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
const technicianToken = "T".repeat(48);
const promotionId = "11111111-1111-4111-8111-111111111111";
const giveawayId = "22222222-2222-4222-8222-222222222222";
const scheduledGiveawayId = "33333333-3333-4333-8333-333333333333";

const makeOffer = (
  id: string,
  values: Partial<{
    type: "PROMOTION" | "GIVEAWAY";
    prize: string | null;
    bonusPoints: number;
    startsAt: Date;
    endsAt: Date;
    isPublished: boolean;
    drawnAt: Date | null;
  }> = {},
) => ({
  id,
  type: "PROMOTION" as const,
  title: "Весенняя акция",
  content: "Запишитесь на участие в предложении.",
  prize: null,
  bonusPoints: 0,
  isPublished: true,
  startsAt: new Date(Date.now() - 60_000),
  endsAt: new Date(Date.now() + 3_600_000),
  drawnAt: null,
  createdById: "admin-user",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...values,
});

const createHarness = () => {
  const users = [
    { id: "admin-user", email: "admin@test.invalid", displayName: "Администратор", role: "ADMIN" as const, token: adminToken },
    { id: "customer-user", email: "customer@test.invalid", displayName: "Клиент Один", role: "CUSTOMER" as const, token: customerToken },
    { id: "customer-two", email: "second@test.invalid", displayName: "Клиент Два", role: "CUSTOMER" as const, token: secondCustomerToken },
    { id: "tech-user", email: "tech@test.invalid", displayName: "Мастер", role: "TECHNICIAN" as const, token: technicianToken },
  ];
  const offers = [
    makeOffer(promotionId),
    makeOffer(giveawayId, {
      type: "GIVEAWAY",
      title: "Розыгрыш баллов",
      prize: "Призовой набор",
      bonusPoints: 400,
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() - 60_000),
    }),
    makeOffer(scheduledGiveawayId, {
      type: "GIVEAWAY",
      prize: "Подарок",
      startsAt: new Date(Date.now() + 3_600_000),
      endsAt: new Date(Date.now() + 7_200_000),
    }),
  ];
  const entries: Array<{
    id: string;
    offerId: string;
    customerId: string;
    joinedAt: Date;
    isWinner: boolean;
  }> = [
    { id: "entry-one", offerId: giveawayId, customerId: "customer-user", joinedAt: new Date(), isWinner: false },
    { id: "entry-two", offerId: giveawayId, customerId: "customer-two", joinedAt: new Date(), isWinner: false },
  ];
  const loyaltyTransactions: Array<Record<string, unknown>> = [];
  let entryNumber = 3;
  let offerNumber = 4;

  const includeOffer = (offer: (typeof offers)[number], include: Record<string, any>) => {
    const offerEntries = entries.filter((entry) => entry.offerId === offer.id);
    const entryFilter = include.entries?.where ?? {};
    const selectedEntries = offerEntries.filter((entry) =>
      Object.entries(entryFilter).every(([key, value]) => entry[key as keyof typeof entry] === value),
    );
    const selected = selectedEntries.map((entry) => {
      if (include.entries?.select?.customer) {
        const customer = users.find((user) => user.id === entry.customerId)!;
        return {
          customerId: entry.customerId,
          joinedAt: entry.joinedAt,
          customer: { displayName: customer.displayName },
        };
      }
      return { id: entry.id, joinedAt: entry.joinedAt, isWinner: entry.isWinner };
    });
    return { ...offer, _count: { entries: offerEntries.length }, entries: selected };
  };

  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find((candidate) => hashSessionToken(candidate.token) === where.tokenHash);
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
      findMany: async ({ where, include }: { where?: { isPublished?: boolean }; include: Record<string, any> }) =>
        offers
          .filter((offer) => where?.isPublished === undefined || offer.isPublished === where.isPublished)
          .map((offer) => includeOffer(offer, include)),
      findUnique: async ({ where }: { where: { id: string } }) =>
        offers.find((offer) => offer.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where, include }: { where: { id: string }; include: Record<string, any> }) => {
        const offer = offers.find((candidate) => candidate.id === where.id);
        assert.ok(offer);
        return includeOffer(offer, include);
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const offer = makeOffer(`44444444-4444-4444-8444-${String(offerNumber++).padStart(12, "0")}`, data as Parameters<typeof makeOffer>[1]);
        offers.push(offer);
        return offer;
      },
      update: async ({ where, data }: { where: { id: string }; data: { isPublished: boolean } }) => {
        const offer = offers.find((candidate) => candidate.id === where.id);
        assert.ok(offer);
        offer.isPublished = data.isPublished;
        return offer;
      },
      updateMany: async ({ where, data }: { where: { id: string; drawnAt: null }; data: { drawnAt: Date } }) => {
        const offer = offers.find((candidate) => candidate.id === where.id && candidate.drawnAt === null);
        if (!offer) return { count: 0 };
        offer.drawnAt = data.drawnAt;
        return { count: 1 };
      },
    },
    customerOfferParticipation: {
      findUnique: async ({ where }: { where: { offerId_customerId: { offerId: string; customerId: string } } }) =>
        entries.find((entry) => entry.offerId === where.offerId_customerId.offerId && entry.customerId === where.offerId_customerId.customerId) ?? null,
      findMany: async ({ where }: { where: { offerId: string } }) => entries.filter((entry) => entry.offerId === where.offerId),
      create: async ({ data }: { data: { offerId: string; customerId: string } }) => {
        const entry = { id: `entry-${entryNumber++}`, ...data, joinedAt: new Date(), isWinner: false };
        entries.push(entry);
        return entry;
      },
      updateMany: async ({ where }: { where: { id: string; offerId: string } }) => {
        const entry = entries.find((candidate) => candidate.id === where.id && candidate.offerId === where.offerId);
        if (!entry) return { count: 0 };
        entry.isWinner = true;
        return { count: 1 };
      },
    },
    loyaltyTransaction: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        loyaltyTransactions.push(data);
        return data;
      },
    },
  };
  Object.assign(client, {
    $transaction: async <T>(operation: (transaction: typeof client) => Promise<T>) => operation(client),
  });

  const app = express();
  app.use(express.json());
  app.use("/api", createCustomerOffersRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);

  return {
    app,
    offers,
    entries,
    loyaltyTransactions,
    users,
    server,
  };
};

test("customers participate once, and an administrator awards the giveaway reward once", async (t) => {
  const harness = createHarness();
  await once(harness.server, "listening");
  t.after(() => harness.server.close());
  const address = harness.server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });

  const listing = await fetch(`${baseUrl}/offers`, { headers: headers(customerToken) });
  assert.equal(listing.status, 200);
  const listingBody = await listing.json();
  assert.equal(listingBody.offers.length, 3);
  assert.equal(listingBody.offers[0].participantCount, 0);

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
  assert.equal(harness.entries.filter((entry) => entry.offerId === promotionId).length, 1);

  const notYetOpen = await fetch(`${baseUrl}/offers/${scheduledGiveawayId}/participate`, {
    method: "POST",
    headers: headers(customerToken),
  });
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
  assert.equal(drawBody.offer.winners.length, 1);
  const winner = harness.entries.find((entry) => entry.isWinner);
  assert.ok(winner);
  assert.equal(harness.loyaltyTransactions.length, 1);
  assert.equal(harness.loyaltyTransactions[0]?.customerId, winner.customerId);
  assert.equal(harness.loyaltyTransactions[0]?.customerOfferId, giveawayId);
  assert.equal(harness.loyaltyTransactions[0]?.actorId, "admin-user");
  assert.equal(harness.loyaltyTransactions[0]?.type, "OFFER_REWARD");
  assert.equal(harness.loyaltyTransactions[0]?.points, 400);

  const repeatedDraw = await fetch(`${baseUrl}/admin/offers/${giveawayId}/draw`, {
    method: "POST",
    headers: headers(adminToken),
  });
  assert.equal(repeatedDraw.status, 409);
  assert.equal(harness.loyaltyTransactions.length, 1);
});

test("only administrators can create an offer and promotions cannot award giveaway points", async (t) => {
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
    prize: "Призовой набор",
    bonusPoints: 250,
    startsAt: new Date(Date.now() - 60_000).toISOString(),
    endsAt: new Date(Date.now() + 3_600_000).toISOString(),
    isPublished: true,
  };

  const customerCreate = await fetch(baseUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${customerToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(customerCreate.status, 403);

  const adminCreate = await fetch(baseUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(adminCreate.status, 201);
  const created = await adminCreate.json();
  assert.equal(created.offer.bonusPoints, 250);
  assert.equal(created.offer.isPublished, true);

  const invalidPromotion = await fetch(baseUrl, {
    method: "POST",
    headers: { authorization: `Bearer ${adminToken}`, "content-type": "application/json" },
    body: JSON.stringify({ ...body, type: "PROMOTION", prize: null, bonusPoints: 250 }),
  });
  assert.equal(invalidPromotion.status, 400);
});
