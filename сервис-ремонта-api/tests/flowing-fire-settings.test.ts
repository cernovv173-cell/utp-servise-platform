import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_FLOWING_FIRE_SETTINGS,
  FLOWING_FIRE_SETTINGS_KEY,
  flowingFireSettingsSchema,
  readFlowingFireSettings,
  saveFlowingFireSettings,
} from "../src/features/company/flowing-fire-settings.js";
import type { DatabaseClient } from "../src/lib/database/database.js";

const createDatabase = () => {
  let value: unknown;
  const database = {
    appSetting: {
      findUnique: async ({ where }: { where: { key: string } }) =>
        where.key === FLOWING_FIRE_SETTINGS_KEY && value !== undefined
          ? { value }
          : null,
      upsert: async ({ update }: { update: { value: unknown } }) => {
        value = update.value;
        return { key: FLOWING_FIRE_SETTINGS_KEY, value };
      },
    },
  } as unknown as DatabaseClient;
  return database;
};

test("fire frame settings default to independent enabled color presets", async () => {
  const database = createDatabase();
  assert.deepEqual(
    await readFlowingFireSettings(database),
    DEFAULT_FLOWING_FIRE_SETTINGS,
  );
});

test("fire frame palettes and switches validate independently", () => {
  const parsed = flowingFireSettingsSchema.safeParse({
    closure: { enabled: false, palette: "VIOLET" },
    giveaway: { enabled: true, palette: "CYAN" },
  });

  assert.equal(parsed.success, true);
  assert.equal(
    flowingFireSettingsSchema.safeParse({
      closure: { enabled: true, palette: "ORANGE" },
      giveaway: { enabled: true, palette: "CYAN" },
    }).success,
    false,
  );
});

test("fire frame settings persist through the existing app settings store", async () => {
  const database = createDatabase();
  const settings = {
    closure: { enabled: true, palette: "EMBER" as const },
    giveaway: { enabled: false, palette: "ROSE" as const },
  };

  await saveFlowingFireSettings(database, settings);
  assert.deepEqual(await readFlowingFireSettings(database), settings);
});
