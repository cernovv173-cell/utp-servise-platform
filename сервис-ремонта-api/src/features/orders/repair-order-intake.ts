import { z } from "zod";

import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http/http-error.js";
import { supportedRepairDeviceTypes } from "../catalog/repair-device-types.js";

export const repairOrderContactPhone = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .refine((value) => (value.match(/\d/g)?.length ?? 0) >= 7);

const optionalAddressField = (minimumLength: number, maximumLength: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(minimumLength).max(maximumLength).optional(),
  );

const repairOrderIntakeFieldsBody = z
  .object({
    deviceType: z.enum(supportedRepairDeviceTypes),
    deviceBrand: z.string().trim().max(120).optional(),
    deviceModel: z.string().trim().max(160).optional(),
    deviceSerialNumber: z.string().trim().max(160).optional(),
    problem: z.string().trim().min(5).max(2000),
    repairLocation: z.enum(["CUSTOMER_ADDRESS", "SERVICE_CENTER"]).optional(),
    useNewRepairScenario: z.literal(true).optional(),
    visitIsWithinCity: z.boolean().optional(),
    visitCustomerDistanceKm: z.number().int().min(1).max(10000).optional(),
    city: optionalAddressField(2, 120),
    street: optionalAddressField(2, 180),
    house: optionalAddressField(1, 30),
    apartment: z.string().trim().max(30).optional(),
    entrance: z.string().trim().max(30).optional(),
    hasBarrier: z.boolean().optional(),
    floor: z.string().trim().max(20).optional(),
    additionalPhone: z.string().trim().max(32).optional(),
    additionalInfo: z.string().trim().max(500).optional(),
    preferredAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export const createOrderBody = repairOrderIntakeFieldsBody
  .extend({
    customerDeviceId: z.string().uuid().optional(),
    contactPhone: repairOrderContactPhone,
    businessOrder: z.boolean().optional(),
  })
  .strict();

export const createAdminOrderBody = repairOrderIntakeFieldsBody
  .extend({
    customerId: z.string().uuid(),
    contactPhone: repairOrderContactPhone.optional(),
  })
  .strict();

type RepairOrderIntakeInput =
  z.infer<typeof createOrderBody> | z.infer<typeof createAdminOrderBody>;
type SupportedDeviceType = (typeof supportedRepairDeviceTypes)[number];

type SavedDevice = {
  id: string;
  deviceType: SupportedDeviceType;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
};

export const assertRepairOrderScenarioIsComplete = (
  input: Pick<
    RepairOrderIntakeInput,
    | "useNewRepairScenario"
    | "repairLocation"
    | "visitIsWithinCity"
    | "visitCustomerDistanceKm"
    | "city"
    | "street"
    | "house"
  >,
): void => {
  if (
    input.useNewRepairScenario &&
    (!input.repairLocation ||
      (input.repairLocation === "CUSTOMER_ADDRESS" &&
        (input.visitIsWithinCity === undefined ||
          (!input.visitIsWithinCity &&
            input.visitCustomerDistanceKm === undefined) ||
          !input.city ||
          !input.street ||
          !input.house)))
  ) {
    throw new HttpError(
      400,
      "VISIT_DISTANCE_REQUIRED",
      "Для нового сценария выберите место ремонта; для выезда укажите полный адрес и отметьте, находится ли он в Пушкино. За городом добавьте примерное расстояние от границы.",
    );
  }
};

export const addressFromFields = (input: {
  city?: string | null;
  street?: string | null;
  house?: string | null;
  apartment?: string | null;
  entrance?: string | null;
  hasBarrier?: boolean | null;
  floor?: string | null;
  additionalInfo?: string | null;
}): string =>
  [
    [input.city, input.street, input.house ? `д. ${input.house}` : null]
      .filter(Boolean)
      .join(", "),
    input.apartment ? `кв. ${input.apartment}` : null,
    input.entrance ? `подъезд ${input.entrance}` : null,
    input.hasBarrier ? "шлагбаум: да" : null,
    input.floor ? `этаж ${input.floor}` : null,
    input.additionalInfo,
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 500);

export const createRepairOrderWithinTransaction = async (
  transaction: Prisma.TransactionClient,
  options: {
    actorId: string;
    customerId: string;
    contactPhone: string;
    input: RepairOrderIntakeInput;
    statusNote: string;
    savedDevice?: SavedDevice | null;
    businessProfileId?: string | null;
  },
) => {
  const {
    actorId,
    customerId,
    contactPhone,
    input,
    statusNote,
    savedDevice,
    businessProfileId,
  } = options;
  const sequence = await transaction.$queryRaw<Array<{ value: bigint }>>`
    SELECT nextval('repair_service_number_seq') AS value
  `;
  const number = String(sequence[0]?.value ?? "1").padStart(6, "0");
  const created = await transaction.repairOrder.create({
    data: {
      serviceNumber: `SRV-${new Date().getUTCFullYear()}-${number}`,
      customerId,
      businessProfileId: businessProfileId ?? null,
      workActRequired: true,
      customerDeviceId: savedDevice?.id ?? null,
      deviceType: savedDevice?.deviceType ?? input.deviceType,
      deviceBrand: savedDevice?.brand ?? (input.deviceBrand || null),
      deviceModel: savedDevice?.model ?? (input.deviceModel || null),
      deviceSerialNumber:
        savedDevice?.serialNumber ?? (input.deviceSerialNumber || null),
      problem: input.problem,
      address: addressFromFields(input),
      repairLocation: input.repairLocation ?? null,
      visitScenarioVersion: input.useNewRepairScenario ? 1 : 0,
      visitIsWithinCity:
        input.repairLocation === "CUSTOMER_ADDRESS"
          ? (input.visitIsWithinCity ?? null)
          : null,
      visitCustomerDistanceKm:
        input.repairLocation === "CUSTOMER_ADDRESS" &&
        input.visitIsWithinCity === false
          ? (input.visitCustomerDistanceKm ?? null)
          : null,
      contactPhone,
      city: input.city ?? null,
      street: input.street ?? null,
      house: input.house ?? null,
      apartment: input.apartment || null,
      entrance: input.entrance || null,
      hasBarrier: input.hasBarrier ?? false,
      floor: input.floor || null,
      additionalPhone: input.additionalPhone || null,
      additionalInfo: input.additionalInfo || null,
      preferredAt: input.preferredAt ? new Date(input.preferredAt) : null,
    },
  });
  await transaction.repairStatusEvent.create({
    data: {
      orderId: created.id,
      actorId,
      from: null,
      to: "REQUESTED",
      note: statusNote,
    },
  });
  return created;
};
