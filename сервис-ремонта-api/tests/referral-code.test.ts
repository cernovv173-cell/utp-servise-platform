import assert from "node:assert/strict";
import test from "node:test";

import {
  addCalendarMonths,
  generateReferralCode,
} from "../src/features/referrals/referral-code.js";

test("referral codes are random 16-character hexadecimal values", () => {
  assert.match(generateReferralCode(), /^[0-9A-F]{16}$/);
});

test("six-month validity follows calendar months and clamps month-end dates", () => {
  const issuedAt = new Date("2026-08-31T13:45:12.345Z");

  assert.equal(
    addCalendarMonths(issuedAt, 6).toISOString(),
    "2027-02-28T13:45:12.345Z",
  );
  assert.equal(issuedAt.toISOString(), "2026-08-31T13:45:12.345Z");
});
