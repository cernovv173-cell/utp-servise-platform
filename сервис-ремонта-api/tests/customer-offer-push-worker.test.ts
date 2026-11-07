import assert from "node:assert/strict";
import test from "node:test";

import { customerOfferPushRetryDelayMilliseconds } from "../src/features/customer-offers/customer-offer-push-worker.js";
import { customerOfferPublicationNotificationContent } from "../src/features/notifications/push-notifications.js";

test("customer offer push retries exponentially and caps the delay at one hour", () => {
  assert.equal(customerOfferPushRetryDelayMilliseconds(1), 10_000);
  assert.equal(customerOfferPushRetryDelayMilliseconds(2), 20_000);
  assert.equal(customerOfferPushRetryDelayMilliseconds(3), 40_000);
  assert.equal(customerOfferPushRetryDelayMilliseconds(10), 60 * 60 * 1_000);
});

test("promotion and giveaway notifications have distinct titles", () => {
  assert.deepEqual(
    customerOfferPublicationNotificationContent(
      "PROMOTION",
      "Скидка на ремонт",
    ),
    {
      title: "Опубликована новая акция ЕНОТ СЕРВИС",
      body: "Скидка на ремонт",
    },
  );
  assert.deepEqual(
    customerOfferPublicationNotificationContent(
      "GIVEAWAY",
      "Разыгрываем призы",
    ),
    {
      title: "Опубликован новый розыгрыш ЕНОТ СЕРВИС",
      body: "Разыгрываем призы",
    },
  );
});
