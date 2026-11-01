import { randomBytes } from "node:crypto";
import { z } from "zod";

export const REFERRAL_CODE_COUNT = 3;
export const REFERRAL_CODE_VALIDITY_MONTHS = 6;

export const generateReferralCode = (): string =>
  randomBytes(8).toString("hex").toUpperCase();

export const addCalendarMonths = (date: Date, months: number): Date => {
  const monthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const day = Math.min(
    date.getUTCDate(),
    new Date(Date.UTC(year, month + 1, 0)).getUTCDate(),
  );

  return new Date(
    Date.UTC(
      year,
      month,
      day,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
};

export const normalizeReferralCode = (value: string): string =>
  value.trim().toUpperCase();

export const referralCodeSchema = z
  .string()
  .trim()
  .max(16)
  .regex(/^[0-9A-F]{16}$/i)
  .transform(normalizeReferralCode)
  .optional();
