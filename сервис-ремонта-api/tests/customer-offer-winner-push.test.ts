import assert from "node:assert/strict";
import test from "node:test";

import { customerOfferWinnerNotificationContent } from "../src/features/customer-offers/customer-offer-winner-push-notifications.js";
import { runCustomerOfferWinnerPushWorkerOnce } from "../src/features/customer-offers/customer-offer-winner-push-worker.js";
import type { DatabaseClient } from "../src/lib/database/database.js";

test("winner push congratulates the recipient with their place, prize, and points", () => {
  assert.deepEqual(
    customerOfferWinnerNotificationContent("Охота за баллами", {
      place: 1,
      prize: "Смартфон",
      bonusPoints: 400,
    }),
    {
      title: "Поздравляем с победой! 🎉",
      body: "Вы заняли 1-е место в розыгрыше «Охота за баллами» — поздравляем! Ваш приз: Смартфон. Вам начислено +400 бонусных баллов.",
    },
  );
});

test("winner push still congratulates a recipient when the prize is points only", () => {
  assert.deepEqual(
    customerOfferWinnerNotificationContent("Тройной куш", {
      place: 2,
      prize: null,
      bonusPoints: 200,
    }),
    {
      title: "Поздравляем с победой! 🎉",
      body: "Вы заняли 2-е место в розыгрыше «Тройной куш» — поздравляем! Вам начислено +200 бонусных баллов.",
    },
  );
});

test("quiz winner notifications identify the quiz", () => {
  assert.equal(
    customerOfferWinnerNotificationContent(
      "Квиз ЕНОТА",
      { place: 1, prize: null, bonusPoints: 100 },
      "QUIZ",
    ).body,
    "Вы заняли 1-е место в квизе «Квиз ЕНОТА» — поздравляем! Вам начислено +100 бонусных баллов.",
  );
});

test("winner push stays queued until the recipient registers a device", async () => {
  const delivery = {
    id: "delivery-1",
    offer_id: "offer-1",
    customer_id: "customer-1",
    attempt_count: 1,
  };
  const updates: Array<Record<string, unknown>> = [];
  const database = {
    $transaction: async (run: (transaction: unknown) => Promise<unknown>) =>
      run({ $queryRaw: async () => [delivery] }),
    customerOffer: {
      findUnique: async () => ({
        id: "offer-1",
        type: "QUIZ",
        title: "Квиз ЕНОТА",
        isPublished: true,
        resultsPublishedAt: new Date(),
        firstPlacePrize: "Смартфон",
        firstPlacePoints: 400,
        secondPlacePrize: null,
        secondPlacePoints: 200,
        thirdPlacePrize: null,
        thirdPlacePoints: 100,
      }),
    },
    customerOfferParticipation: {
      findUnique: async () => ({
        place: 1,
        customer: { active: true },
      }),
    },
    pushDeviceToken: { findFirst: async () => null },
    customerOfferWinnerPushDelivery: {
      updateMany: async (input: Record<string, unknown>) => {
        updates.push(input);
        return { count: 1 };
      },
    },
  } as unknown as DatabaseClient;

  await runCustomerOfferWinnerPushWorkerOnce(database);

  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0]?.where, { id: delivery.id, sentAt: null });
  const data = updates[0]?.data as Record<string, unknown>;
  assert.equal(data.lockedUntil, null);
  assert.match(String(data.lastError), /No registered device/);
  assert.ok((data.nextAttemptAt as Date).getTime() > Date.now());
});
