import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";

export const FLOWING_FIRE_SETTINGS_KEY = "flowing_fire_settings";

const flowingFirePaletteSchema = z.enum([
  "EMBER",
  "CYAN",
  "VIOLET",
  "ROSE",
  "EMERALD",
  "GOLD",
]);

const flowingFireEffectSchema = z
  .object({
    enabled: z.boolean(),
    palette: flowingFirePaletteSchema,
  })
  .strict();

export const flowingFireSettingsSchema = z
  .object({
    closure: flowingFireEffectSchema,
    giveaway: flowingFireEffectSchema,
  })
  .strict();

export type FlowingFireSettings = z.infer<typeof flowingFireSettingsSchema>;

export const DEFAULT_FLOWING_FIRE_SETTINGS: FlowingFireSettings = {
  closure: { enabled: true, palette: "EMBER" },
  giveaway: { enabled: true, palette: "CYAN" },
};

export const readFlowingFireSettings = async (
  database: Pick<DatabaseClient, "appSetting">,
): Promise<FlowingFireSettings> => {
  const setting = await database.appSetting.findUnique({
    where: { key: FLOWING_FIRE_SETTINGS_KEY },
  });
  if (!setting) return DEFAULT_FLOWING_FIRE_SETTINGS;

  const parsed = flowingFireSettingsSchema.safeParse(setting.value);
  if (!parsed.success) {
    throw new HttpError(
      500,
      "FLOWING_FIRE_SETTINGS_INVALID",
      "Не удалось прочитать настройки анимированных рамок.",
    );
  }
  return parsed.data;
};

export const saveFlowingFireSettings = async (
  database: DatabaseClient,
  settings: FlowingFireSettings,
): Promise<void> => {
  await database.appSetting.upsert({
    where: { key: FLOWING_FIRE_SETTINGS_KEY },
    create: {
      key: FLOWING_FIRE_SETTINGS_KEY,
      value: settings as Prisma.InputJsonValue,
    },
    update: { value: settings as Prisma.InputJsonValue },
  });
};
