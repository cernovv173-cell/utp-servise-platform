import { Router } from "express";
import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import {
  type Season,
  type SeasonChoice,
  getSeasonCalendar,
} from "./seasonal-calendar.js";

const SETTING_KEY = "seasonal_theme";
const seasonChoiceSchema = z.enum([
  "SPRING",
  "SUMMER",
  "AUTUMN",
  "WINTER",
  "NONE",
]);
const seasonRequestSchema = z.object({ season: seasonChoiceSchema }).strict();
const storedSeasonSchema = z
  .object({
    season: seasonChoiceSchema,
    activatedAt: z.string().datetime().nullable(),
  })
  .strict()
  .refine(
    ({ season, activatedAt }) => (season === "NONE") === (activatedAt === null),
  );

type StoredSeason = z.infer<typeof storedSeasonSchema>;
type SeasonalThemeClock = () => Date;

const seasonName: Record<Season, string> = {
  SPRING: "весны",
  SUMMER: "лета",
  AUTUMN: "осени",
  WINTER: "зимы",
};

const readStoredSeason = async (
  database: DatabaseClient,
): Promise<StoredSeason> => {
  const setting = await database.appSetting.findUnique({
    where: { key: SETTING_KEY },
  });
  if (!setting) return { season: "NONE", activatedAt: null };

  const parsed = storedSeasonSchema.safeParse(setting.value);
  if (!parsed.success) {
    throw new HttpError(
      500,
      "SEASONAL_THEME_SETTINGS_INVALID",
      "Не удалось прочитать настройки сезонного оформления.",
    );
  }
  return parsed.data;
};

const saveStoredSeason = async (
  database: DatabaseClient,
  setting: StoredSeason,
): Promise<void> => {
  await database.appSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: setting as Prisma.InputJsonValue },
    update: { value: setting as Prisma.InputJsonValue },
  });
};

export const createSeasonalThemeRouter = (
  database: DatabaseClient,
  now: SeasonalThemeClock = () => new Date(),
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get("/seasonal-theme", async (_request, response) => {
    response.set("Cache-Control", "no-store");
    const calendar = getSeasonCalendar(now());
    const setting = await readStoredSeason(database);
    const activeSeason: SeasonChoice =
      setting.season === calendar.calendarSeason ? setting.season : "NONE";
    response.json({
      ...calendar,
      activeSeason,
      activatedAt: activeSeason === "NONE" ? null : setting.activatedAt,
    });
  });

  router.put(
    "/seasonal-theme",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: seasonRequestSchema }),
    async (_request, response) => {
      const { body } = response.locals.input as {
        readonly body: z.infer<typeof seasonRequestSchema>;
      };
      const instant = now();
      const calendar = getSeasonCalendar(instant);
      if (body.season !== "NONE" && body.season !== calendar.calendarSeason) {
        throw new HttpError(
          409,
          "SEASON_NOT_AVAILABLE",
          `Сейчас доступно оформление ${seasonName[calendar.calendarSeason]}. ` +
            `Следующее сезонное оформление откроется ${calendar.nextSeasonStartsOn}.`,
        );
      }

      const setting: StoredSeason =
        body.season === "NONE"
          ? { season: "NONE", activatedAt: null }
          : { season: body.season, activatedAt: instant.toISOString() };
      await saveStoredSeason(database, setting);
      response.set("Cache-Control", "no-store");
      response.json({
        ...calendar,
        activeSeason: setting.season,
        activatedAt: setting.activatedAt,
      });
    },
  );

  return router;
};
