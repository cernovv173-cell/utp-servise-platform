import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";

export const CATALOG_VISIBILITY_SETTING_KEY = "catalog_visibility";

export const catalogVisibilitySchema = z
  .object({
    servicesVisible: z.boolean(),
    productsVisible: z.boolean(),
  })
  .strict();

export type CatalogVisibilitySettings = z.infer<typeof catalogVisibilitySchema>;

export const DEFAULT_CATALOG_VISIBILITY: CatalogVisibilitySettings = {
  servicesVisible: true,
  productsVisible: true,
};

export const readCatalogVisibility = async (
  database: Pick<DatabaseClient, "appSetting">,
): Promise<CatalogVisibilitySettings> => {
  const setting = await database.appSetting.findUnique({
    where: { key: CATALOG_VISIBILITY_SETTING_KEY },
  });
  if (!setting) return DEFAULT_CATALOG_VISIBILITY;

  const parsed = catalogVisibilitySchema.safeParse(setting.value);
  if (!parsed.success) {
    throw new HttpError(
      500,
      "CATALOG_VISIBILITY_SETTINGS_INVALID",
      "Не удалось прочитать настройки видимости каталога.",
    );
  }
  return parsed.data;
};

export const saveCatalogVisibility = async (
  database: DatabaseClient,
  settings: CatalogVisibilitySettings,
): Promise<void> => {
  await database.appSetting.upsert({
    where: { key: CATALOG_VISIBILITY_SETTING_KEY },
    create: {
      key: CATALOG_VISIBILITY_SETTING_KEY,
      value: settings as Prisma.InputJsonValue,
    },
    update: { value: settings as Prisma.InputJsonValue },
  });
};
