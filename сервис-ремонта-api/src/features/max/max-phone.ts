import { normalizeMaxVcfInfo } from "./max-bot.js";

const MIN_LOCAL_DIGITS = 10;
const MAX_PHONE_DIGITS = 15;

/**
 * Returns a canonical phone number and the last ten digits used to match an
 * existing customer regardless of the formatting saved by administrators.
 */
export const normalizeMaxPhone = (
  value: string,
): { readonly phone: string; readonly nationalDigits: string } | null => {
  const digits = value.replace(/[^0-9]/gu, "");
  if (digits.length < MIN_LOCAL_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    return null;
  }

  const nationalDigits = digits.slice(-MIN_LOCAL_DIGITS);
  if (digits.length === MIN_LOCAL_DIGITS) {
    return { phone: `+7${nationalDigits}`, nationalDigits };
  }
  if (digits.length === 11 && digits.startsWith("8")) {
    return { phone: `+7${nationalDigits}`, nationalDigits };
  }
  return { phone: `+${digits}`, nationalDigits };
};

export const extractMaxContactPhone = (
  vcfInfo: string,
): { readonly phone: string; readonly nationalDigits: string } | null => {
  const lines = normalizeMaxVcfInfo(vcfInfo).split(/\r?\n/u);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!/^TEL(?:;[^:]*)?:/iu.test(trimmed)) continue;
    const separator = trimmed.indexOf(":");
    if (separator < 0) continue;
    const normalized = normalizeMaxPhone(trimmed.slice(separator + 1));
    if (normalized) return normalized;
  }
  return null;
};

export const maxDisplayName = (
  name: string | undefined,
  firstName: string | undefined,
  lastName: string | undefined,
  username: string | undefined,
): string => {
  const candidate = [
    name,
    [firstName, lastName].filter(Boolean).join(" "),
    username,
  ]
    .map((value) => value?.trim())
    .find((value) => Boolean(value && value.length >= 2));
  return (candidate ?? "Клиент МАКС").slice(0, 120);
};
