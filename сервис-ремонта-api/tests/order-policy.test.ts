import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canTransitionRepairStatus,
  canViewRepairOrder,
} from "../src/features/orders/order-policy.js";

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
    canTransitionRepairStatus("TECHNICIAN", "IN_PROGRESS", "COMPLETED"),
    true,
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
