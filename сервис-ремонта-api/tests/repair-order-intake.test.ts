import assert from "node:assert/strict";
import test from "node:test";

import {
  assertRepairOrderIntakeOpen,
  readRepairOrderIntake,
  saveRepairOrderIntake,
} from "../src/features/company/repair-order-intake.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { HttpError } from "../src/lib/http/http-error.js";

test("repair order intake defaults to open and can be paused and resumed", async () => {
  let storedValue: unknown = null;
  const databaseClient = {
    appSetting: {
      findUnique: async () =>
        storedValue === null ? null : { value: storedValue },
      upsert: async ({
        create,
        update,
      }: {
        create: { value: unknown };
        update: { value: unknown };
      }) => {
        storedValue = update.value ?? create.value;
        return { value: storedValue };
      },
    },
  } as unknown as DatabaseClient;

  assert.deepEqual(await readRepairOrderIntake(databaseClient), {
    acceptingNewOrders: true,
  });
  await assertRepairOrderIntakeOpen(databaseClient);

  await saveRepairOrderIntake(databaseClient, { acceptingNewOrders: false });
  assert.deepEqual(await readRepairOrderIntake(databaseClient), {
    acceptingNewOrders: false,
  });
  await assert.rejects(
    assertRepairOrderIntakeOpen(databaseClient),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 503 &&
      error.code === "NEW_REPAIR_ORDERS_PAUSED",
  );

  await saveRepairOrderIntake(databaseClient, { acceptingNewOrders: true });
  await assertRepairOrderIntakeOpen(databaseClient);
});

test("invalid repair order intake settings fail with a safe error", async () => {
  const databaseClient = {
    appSetting: {
      findUnique: async () => ({ value: { acceptingNewOrders: "false" } }),
    },
  } as unknown as DatabaseClient;

  await assert.rejects(
    readRepairOrderIntake(databaseClient),
    (error: unknown) =>
      error instanceof HttpError &&
      error.status === 500 &&
      error.code === "REPAIR_ORDER_INTAKE_SETTINGS_INVALID",
  );
});
