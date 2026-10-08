import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateEarnedPoints,
  calculateMaxBonusDiscount,
  calculateServiceBonusEligibleRub,
  canAddRepairOrderItem,
  canTransitionRepairStatus,
  canViewRepairOrder,
} from "../src/features/orders/order-policy.js";

test("loyalty limits redemption to the smaller of balance and 30% of the receipt", () => {
  assert.equal(calculateMaxBonusDiscount(1_000, 1_000), 300);
  assert.equal(calculateMaxBonusDiscount(1_000, 125), 125);
  assert.equal(calculateMaxBonusDiscount(999, 1_000), 299);
  assert.equal(calculateMaxBonusDiscount(1_000, -20), 0);
});

test("only service lines qualify for bonus redemption", () => {
  const serviceTotalRub = calculateServiceBonusEligibleRub([
    { type: "SERVICE", quantity: 2, unitPriceRub: 1_000 },
    { type: "SPARE_PART", quantity: 1, unitPriceRub: 5_000 },
    { type: "PRODUCT", quantity: 1, unitPriceRub: 2_000 },
  ]);

  assert.equal(serviceTotalRub, 2_000);
  assert.equal(calculateMaxBonusDiscount(serviceTotalRub, 10_000), 600);
});

test("bonus redemption is calculated from service lines only, excluding parts and products", () => {
  const eligibleServices = calculateServiceBonusEligibleRub([
    { type: "SERVICE", quantity: 2, unitPriceRub: 1_000 },
    { type: "SPARE_PART", quantity: 1, unitPriceRub: 5_000 },
    { type: "PRODUCT", quantity: 1, unitPriceRub: 2_000 },
  ]);

  assert.equal(eligibleServices, 2_000);
  assert.equal(calculateMaxBonusDiscount(eligibleServices, 10_000), 600);
});

test("loyalty earns 10% of cash actually paid after redemption", () => {
  assert.equal(calculateEarnedPoints(1_000), 100);
  assert.equal(calculateEarnedPoints(700), 70);
  assert.equal(calculateEarnedPoints(0), 0);
});

test("administrators can add order items to any order, technicians only to their assignment", () => {
  assert.equal(
    canAddRepairOrderItem("ADMIN", "admin-1", {
      assignedTechnicianId: "tech-1",
    }),
    true,
  );
  assert.equal(
    canAddRepairOrderItem("ADMIN", "admin-1", {
      assignedTechnicianId: null,
    }),
    true,
  );
  assert.equal(
    canAddRepairOrderItem("TECHNICIAN", "tech-1", {
      assignedTechnicianId: "tech-1",
    }),
    true,
  );
  assert.equal(
    canAddRepairOrderItem("TECHNICIAN", "tech-2", {
      assignedTechnicianId: "tech-1",
    }),
    false,
  );
  assert.equal(
    canAddRepairOrderItem("CUSTOMER", "customer-1", {
      assignedTechnicianId: "tech-1",
    }),
    false,
  );
});

test("customers can only cancel their own not-yet-assigned orders", () => {
  assert.equal(
    canTransitionRepairStatus("CUSTOMER", "REQUESTED", "CANCELLED"),
    true,
  );
  assert.equal(
    canTransitionRepairStatus("CUSTOMER", "ASSIGNED", "CANCELLED"),
    false,
  );
  assert.equal(
    canTransitionRepairStatus("CUSTOMER", "REQUESTED", "ASSIGNED"),
    false,
  );
  assert.equal(
    canViewRepairOrder("CUSTOMER", "customer-1", {
      customerId: "customer-1",
      assignedTechnicianId: "tech-1",
    }),
    true,
  );
  assert.equal(
    canViewRepairOrder("CUSTOMER", "customer-2", {
      customerId: "customer-1",
      assignedTechnicianId: "tech-1",
    }),
    false,
  );
});

test("technicians can only progress assigned work and cannot access another technician's order", () => {
  assert.equal(
    canTransitionRepairStatus("TECHNICIAN", "ASSIGNED", "IN_PROGRESS"),
    true,
  );
  assert.equal(
    canTransitionRepairStatus("TECHNICIAN", "IN_PROGRESS", "READY_FOR_PICKUP"),
    true,
  );
  assert.equal(
    canTransitionRepairStatus("TECHNICIAN", "IN_PROGRESS", "COMPLETED"),
    false,
  );
  assert.equal(
    canTransitionRepairStatus("TECHNICIAN", "REQUESTED", "COMPLETED"),
    false,
  );
  assert.equal(
    canTransitionRepairStatus("TECHNICIAN", "IN_PROGRESS", "CANCELLED"),
    false,
  );
  assert.equal(
    canViewRepairOrder("TECHNICIAN", "tech-1", {
      customerId: "customer-1",
      assignedTechnicianId: "tech-1",
    }),
    true,
  );
  assert.equal(
    canViewRepairOrder("TECHNICIAN", "tech-2", {
      customerId: "customer-1",
      assignedTechnicianId: "tech-1",
    }),
    false,
  );
});

test("administrators may make forward changes without reopening terminal orders", () => {
  assert.equal(
    canTransitionRepairStatus("ADMIN", "REQUESTED", "ASSIGNED"),
    true,
  );
  assert.equal(
    canTransitionRepairStatus("ADMIN", "IN_PROGRESS", "CANCELLED"),
    true,
  );
  assert.equal(
    canTransitionRepairStatus("ADMIN", "COMPLETED", "IN_PROGRESS"),
    false,
  );
  assert.equal(
    canTransitionRepairStatus("ADMIN", "CANCELLED", "REQUESTED"),
    false,
  );
  assert.equal(
    canViewRepairOrder("ADMIN", "admin-1", {
      customerId: "customer-1",
      assignedTechnicianId: "tech-1",
    }),
    true,
  );
});
