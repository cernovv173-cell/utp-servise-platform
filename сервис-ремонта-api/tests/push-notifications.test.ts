import assert from "node:assert/strict";
import test from "node:test";

import {
  getChatMessageRecipientIds,
  getRepairOrderNotificationRecipientIds,
} from "../src/features/notifications/push-notifications.js";

test("chat push targets chat participants and all administrators for a new customer message", () => {
  assert.deepEqual(
    getChatMessageRecipientIds({
      customerId: "customer",
      assignedTechnicianId: "technician",
      joinedAdministratorId: "administrator",
      administratorIds: ["administrator", "another-admin"],
      senderId: "technician",
    }),
    ["customer", "administrator", "another-admin"],
  );
});

test("chat push excludes the sender and deduplicates overlapping participants", () => {
  assert.deepEqual(
    getChatMessageRecipientIds({
      customerId: "same-user",
      assignedTechnicianId: "same-user",
      joinedAdministratorId: null,
      senderId: "other-user",
    }),
    ["same-user"],
  );
});

test("order push targets the customer, assigned technician and admins except the actor", () => {
  assert.deepEqual(
    getRepairOrderNotificationRecipientIds({
      id: "order",
      customerId: "customer",
      assignedTechnicianId: "technician",
      administratorIds: ["admin-1", "admin-2", "technician"],
      actorId: "admin-1",
    }),
    ["customer", "technician", "admin-2"],
  );
});

test("a newly created order notifies administrators but not its customer actor", () => {
  assert.deepEqual(
    getRepairOrderNotificationRecipientIds({
      id: "order",
      customerId: "customer",
      assignedTechnicianId: null,
      administratorIds: ["admin"],
      actorId: "customer",
    }),
    ["admin"],
  );
});
