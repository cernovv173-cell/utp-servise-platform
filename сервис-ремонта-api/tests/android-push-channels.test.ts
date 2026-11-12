import assert from "node:assert/strict";
import test from "node:test";

import {
  ANDROID_SHOP_PUSH_CHANNEL_ID,
  ANDROID_UPDATES_PUSH_CHANNEL_ID,
  ANDROID_WINNER_PUSH_CHANNEL_ID,
  androidPushChannelIdForType,
} from "../src/features/notifications/android-push-channels.js";

test("winner push notifications use the celebration channel", () => {
  assert.equal(
    androidPushChannelIdForType("customer_offer_winner"),
    ANDROID_WINNER_PUSH_CHANNEL_ID,
  );
});

test("all other push notifications use the brand updates channel", () => {
  assert.equal(
    androidPushChannelIdForType("repair_order_update"),
    ANDROID_UPDATES_PUSH_CHANNEL_ID,
  );
  assert.equal(
    androidPushChannelIdForType(undefined),
    ANDROID_UPDATES_PUSH_CHANNEL_ID,
  );
});

test("shop order notifications use their dedicated channel", () => {
  assert.equal(
    androidPushChannelIdForType("shop_order_created"),
    ANDROID_SHOP_PUSH_CHANNEL_ID,
  );
  assert.equal(
    androidPushChannelIdForType("shop_delivery_response"),
    ANDROID_SHOP_PUSH_CHANNEL_ID,
  );
  assert.equal(
    androidPushChannelIdForType("shop_order_updated"),
    ANDROID_SHOP_PUSH_CHANNEL_ID,
  );
});
