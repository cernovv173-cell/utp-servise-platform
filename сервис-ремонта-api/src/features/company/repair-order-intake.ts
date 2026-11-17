import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";

export const REPAIR_ORDER_INTAKE_SETTING_KEY = "repair_order_intake";
export const repairOrderIntakeSchema = z
  .object({ acceptingNewOrders: z.boolean() })
  .strict();

export type RepairOrderIntake = {
  readonly acceptingNewOrders: boolean;
};

export const readRepairOrderIntake = async (
  database: Pick<DatabaseClient, "appSetting">,
): Promise<RepairOrderIntake> => {
  const setting = await database.appSetting.findUnique({
    where: { key: REPAIR_ORDER_INTAKE_SETTING_KEY },
  });
  if (!setting) return { acceptingNewOrders: true };

  const parsed = repairOrderIntakeSchema.safeParse(setting.value);
  if (!parsed.success) {
    throw new HttpError(
      500,
      "REPAIR_ORDER_INTAKE_SETTINGS_INVALID",
      "Не удалось прочитать настройки приёма заявок.",
    );
  }
  return parsed.data;
};

export const saveRepairOrderIntake = async (
  database: DatabaseClient,
  setting: RepairOrderIntake,
): Promise<void> => {
  await database.appSetting.upsert({
    where: { key: REPAIR_ORDER_INTAKE_SETTING_KEY },
    create: {
      key: REPAIR_ORDER_INTAKE_SETTING_KEY,
      value: setting as Prisma.InputJsonValue,
    },
    update: { value: setting as Prisma.InputJsonValue },
  });
};

export const assertRepairOrderIntakeOpen = async (
  database: Pick<DatabaseClient, "appSetting">,
): Promise<void> => {
  const setting = await readRepairOrderIntake(database);
  if (!setting.acceptingNewOrders) {
    throw new HttpError(
      503,
      "NEW_REPAIR_ORDERS_PAUSED",
      "Сейчас временно не принимаем новые заявки на ремонт. Уже созданные заявки остаются доступны.",
    );
  }
};
