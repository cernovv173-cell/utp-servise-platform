import assert from "node:assert/strict";
import test from "node:test";

import { isActiveOnsiteRepairOrder } from "../src/features/orders/repair-visit-policy.js";

test("only current home-visit orders use the onsite-completion path", () => {
  assert.equal(
    isActiveOnsiteRepairOrder({
      visitScenarioVersion: 1,
      repairLocation: "CUSTOMER_ADDRESS",
    }),
    true,
  );
  assert.equal(
    isActiveOnsiteRepairOrder({
      visitScenarioVersion: 1,
      repairLocation: "SERVICE_CENTER",
    }),
    false,
  );
  assert.equal(
    isActiveOnsiteRepairOrder({
      visitScenarioVersion: 0,
      repairLocation: "CUSTOMER_ADDRESS",
    }),
    false,
  );
});
