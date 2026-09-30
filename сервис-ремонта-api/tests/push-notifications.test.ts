import assert from "node:assert/strict";
import test from "node:test";

import { getChatMessageRecipientIds } from "../src/features/notifications/push-notifications.js";

test("chat push targets the other participants and an already-joined admin", () => {
  assert.deepEqual(
    getChatMessageRecipientIds({
      customerId: "customer",
      assignedTechnicianId: "technician",
      joinedAdministratorId: "administrator",
      senderId: "technician",
    }),
    ["customer", "administrator"],
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
