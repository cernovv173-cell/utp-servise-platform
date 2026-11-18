export const supportedRepairDeviceTypes = [
  "COMPUTER",
  "LAPTOP",
  "MONOBLOCK",
] as const;

export const storedRepairDeviceTypes = [
  "COMPUTER",
  "LAPTOP",
  "PHONE",
  "TABLET",
  "MONOBLOCK",
] as const;

export const isSupportedRepairDeviceType = (
  value: string,
): value is (typeof supportedRepairDeviceTypes)[number] =>
  supportedRepairDeviceTypes.includes(
    value as (typeof supportedRepairDeviceTypes)[number],
  );
