import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http/http-error.js";

export const orderIdParams = z.object({ orderId: z.string().uuid() });
const itemInput = z
  .object({
    lineId: z.string().uuid(),
    orderItemId: z.string().uuid().nullable(),
    catalogItemId: z.string().uuid().nullable(),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();
export const saveWorkActBody = z
  .object({
    expectedRevision: z.number().int().min(0).max(2_147_483_647),
    items: z.array(itemInput).min(1).max(100),
  })
  .strict()
  .superRefine(({ items }, context) => {
    if (new Set(items.map((item) => item.lineId)).size !== items.length) {
      context.addIssue({
        code: "custom",
        message: "Повторяется строка акта.",
        path: ["items"],
      });
    }
    if (
      new Set(items.flatMap((item) => item.orderItemId ?? [])).size !==
      items.filter((item) => item.orderItemId).length
    ) {
      context.addIssue({
        code: "custom",
        message: "Повторяется строка заявки.",
        path: ["items"],
      });
    }
    if (
      items.some((item) =>
        item.orderItemId
          ? item.lineId !== item.orderItemId
          : !item.catalogItemId,
      )
    ) {
      context.addIssue({
        code: "custom",
        message: "Некорректная строка акта.",
        path: ["items"],
      });
    }
  });
export const revisionBody = z
  .object({ expectedRevision: z.number().int().min(1).max(2_147_483_647) })
  .strict();
export const reviewBody = z
  .object({
    expectedRevision: z.number().int().min(1).max(2_147_483_647),
    includedLineIds: z.array(z.string().uuid()).max(100),
  })
  .strict()
  .superRefine(({ includedLineIds }, context) => {
    if (new Set(includedLineIds).size !== includedLineIds.length) {
      context.addIssue({
        code: "custom",
        message: "Строка акта выбрана несколько раз.",
        path: ["includedLineIds"],
      });
    }
  });

const lineSnapshotSchema = z
  .object({
    lineId: z.string().uuid(),
    orderItemId: z.string().uuid().nullable(),
    catalogItemId: z.string().uuid().nullable(),
    type: z.enum(["SERVICE", "SPARE_PART", "PRODUCT"]),
    name: z.string().min(1).max(160),
    quantity: z.number().int().min(1).max(99),
    unitPriceRub: z.number().int().min(0).max(2_147_483_647),
  })
  .strict();
const snapshotSchema = z.array(lineSnapshotSchema).max(100);
export type WorkActLine = z.infer<typeof lineSnapshotSchema>;

export const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
export const orderIdOf = (response: { locals: { input?: unknown } }): string =>
  (response.locals.input as { readonly params: { readonly orderId: string } })
    .params.orderId;
export const parseSnapshot = (value: Prisma.JsonValue): WorkActLine[] => {
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(
      500,
      "WORK_ACT_SNAPSHOT_INVALID",
      "Не удалось прочитать строки акта.",
    );
  }
  return parsed.data;
};
export const totalForLines = (lines: readonly WorkActLine[]): number => {
  const total = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceRub,
    0,
  );
  if (total > 2_147_483_647) {
    throw new HttpError(
      400,
      "WORK_ACT_TOTAL_TOO_LARGE",
      "Итог акта превышает допустимое значение.",
    );
  }
  return total;
};

export const assertWorkActApproved = (
  required: boolean,
  status: "DRAFT" | "PENDING" | "APPROVED" | null | undefined,
): void => {
  if (required && status !== "APPROVED") {
    throw new HttpError(
      409,
      "WORK_ACT_APPROVAL_REQUIRED",
      "Сначала администратор должен подтвердить акт выполненных работ.",
    );
  }
};

export const updatedWorkActInclude = {
  createdBy: { select: { id: true, displayName: true } },
  approvedBy: { select: { id: true, displayName: true } },
} as const;
