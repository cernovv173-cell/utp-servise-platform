import { randomBytes } from "node:crypto";
import { z } from "zod";

export const generateReferralCode = (): string =>
  randomBytes(8).toString("hex").toUpperCase();

export const normalizeReferralCode = (value: string): string =>
  value.trim().toUpperCase();

export const referralCodeSchema = z
  .string()
  .trim()
  .max(16)
  .regex(/^[0-9A-F]{16}$/i)
  .transform(normalizeReferralCode)
  .optional();
