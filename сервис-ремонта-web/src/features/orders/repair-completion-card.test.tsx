import { describe, expect, it } from "vitest";

import { buildRepairCompletionCardContent } from "@/features/orders/repair-completion-card-content";

import type { RepairOrder } from "@/lib/api";

describe("buildRepairCompletionCardContent", () => {
  it("shows the recorded work summary and warranty", () => {
    const order = {
      items: [],
      warranty: {
        id: "warranty-1",
        orderId: "order-1",
        warrantyNumber: "W-2026-001",
        customerName: "Клиент",
        deviceType: "Компьютер",
        repairSummary: "Замена блока питания",
        warrantyDays: 30,
        terms: "На выполненные работы",
        issuedAt: "2026-10-01T10:00:00.000Z",
        expiresAt: "2026-10-31T10:00:00.000Z",
      },
    } satisfies Pick<RepairOrder, "items" | "warranty">;

    expect(buildRepairCompletionCardContent(order)).toEqual({
      repairSummary: "Замена блока питания",
      warrantyNumber: "W-2026-001",
      warrantyDuration: "30 дней · до 31.10.2026",
      warrantyTerms: "На выполненные работы",
    });
  });

  it("uses service lines when no warranty summary is available", () => {
    const order = {
      items: [
        { id: "service-1", type: "SERVICE", name: "Диагностика", quantity: 1, unitPriceRub: 500 },
        { id: "part-1", type: "SPARE_PART", name: "Блок питания", quantity: 1, unitPriceRub: 2500 },
      ],
      warranty: null,
    } satisfies Pick<RepairOrder, "items" | "warranty">;

    expect(buildRepairCompletionCardContent(order)).toEqual({
      repairSummary: "Диагностика",
      warrantyNumber: null,
      warrantyDuration: null,
      warrantyTerms: null,
    });
  });
});
