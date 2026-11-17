import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";

export const CLOSURE_ANNOUNCEMENT_SETTING_KEY = "closure_announcement";

const isCalendarDate = (value: string) => {
  const [yearText = "", monthText = "", dayText = ""] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    Number.isInteger(year) &&
    year >= 2000 &&
    year <= 2100 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine(isCalendarDate);

export const closureAnnouncementSchema = z
  .object({
    enabled: z.boolean(),
    title: z.string().trim().min(1).max(120),
    message: z.string().trim().min(1).max(1000),
    startDate: dateSchema,
    endDate: dateSchema,
    reopenTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/u),
    phoneNumber: z.string().trim().max(32),
  })
  .strict()
  .refine((settings) => settings.startDate <= settings.endDate, {
    message: "Дата окончания не может быть раньше даты начала.",
    path: ["endDate"],
  });

export type ClosureAnnouncementSettings = z.infer<
  typeof closureAnnouncementSchema
>;

export const DEFAULT_CLOSURE_ANNOUNCEMENT: ClosureAnnouncementSettings = {
  enabled: true,
  title: "НОВОГОДНИЙ ПЕРЕРЫВ",
  message: "Сервис временно не работает",
  startDate: "2026-12-31",
  endDate: "2027-01-10",
  reopenTime: "08:30",
  phoneNumber: "",
};

export const readClosureAnnouncement = async (
  database: Pick<DatabaseClient, "appSetting">,
): Promise<ClosureAnnouncementSettings> => {
  const setting = await database.appSetting.findUnique({
    where: { key: CLOSURE_ANNOUNCEMENT_SETTING_KEY },
  });
  if (!setting) return DEFAULT_CLOSURE_ANNOUNCEMENT;

  const parsed = closureAnnouncementSchema.safeParse(setting.value);
  if (!parsed.success) {
    throw new HttpError(
      500,
      "CLOSURE_ANNOUNCEMENT_SETTINGS_INVALID",
      "Не удалось прочитать настройки объявления о графике работы.",
    );
  }
  return parsed.data;
};

export const saveClosureAnnouncement = async (
  database: DatabaseClient,
  settings: ClosureAnnouncementSettings,
): Promise<void> => {
  await database.appSetting.upsert({
    where: { key: CLOSURE_ANNOUNCEMENT_SETTING_KEY },
    create: {
      key: CLOSURE_ANNOUNCEMENT_SETTING_KEY,
      value: settings as Prisma.InputJsonValue,
    },
    update: { value: settings as Prisma.InputJsonValue },
  });
};
