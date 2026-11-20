import { repairDeviceTypeLabel } from "@/features/catalog/catalog-model";

import { type RepairOrder, type RepairOrderIntake, type RepairWarranty } from "@/lib/api";

export type OrderDocumentKind = "intake" | "work-order" | "warranty";

const escapeHtml = (value: string | number | null | undefined) =>
  String(value ?? "—").replace(
    /[&<>"']/gu,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );

const date = (value: string) => new Date(value).toLocaleString("ru-RU");

export const printOrderDocument = async (
  kind: OrderDocumentKind,
  order: RepairOrder,
  intake: RepairOrderIntake | null,
  warranty: RepairWarranty | null,
) => {
  const isOnsiteVisit =
    (order.visitScenarioVersion ?? 0) > 0 && order.repairLocation === "CUSTOMER_ADDRESS";
  if (kind === "intake" && isOnsiteVisit) {
    throw new Error("Акт приёма-передачи для выездной заявки не оформляется.");
  }
  const printWindow = window.open("", "_blank");
  if (!printWindow) throw new Error("Разрешите открытие окна печати в браузере.");
  printWindow.opener = null;
  printWindow.document.write(
    "<!doctype html><title>Готовим документ…</title><p>Готовим документ…</p>",
  );
  const heading =
    kind === "intake"
      ? "Акт приёма устройства"
      : kind === "work-order"
        ? "Заказ-наряд"
        : "Гарантийный талон";
  let body = "";

  try {
    if (kind === "intake" && intake) {
      body = `<p>Клиент: ${escapeHtml(order.customer?.displayName)} · ${escapeHtml(order.contactPhone)}</p><p>Устройство: ${escapeHtml(repairDeviceTypeLabel(order.deviceType))} · серийный номер: ${escapeHtml(intake.serialNumber)}</p><p>Заявленная неисправность: ${escapeHtml(order.problem)}</p><h2>Состояние при приёме</h2><p>${escapeHtml(intake.conditionSummary)}</p><p>Комплектность: ${escapeHtml(intake.includedAccessories)}</p><p>Дополнительные отметки: ${escapeHtml(intake.intakeNotes)}</p>`;
    } else if (kind === "work-order") {
      const rows = order.items
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.unitPriceRub)} ₽</td><td>${escapeHtml(item.quantity * item.unitPriceRub)} ₽</td></tr>`,
        )
        .join("");
      const isVisitOrder = (order.visitScenarioVersion ?? 0) > 0;
      const deviceDetails = isVisitOrder
        ? `<p>Устройство: ${escapeHtml(repairDeviceTypeLabel(order.deviceType))}</p><p>Согласие клиента на перевозку в сервис: ${order.visitPickupAgreedAt ? "подтверждено" : "не зафиксировано"}.</p>`
        : `<p>Устройство: ${escapeHtml(repairDeviceTypeLabel(order.deviceType))} · серийный номер: ${escapeHtml(intake?.serialNumber)}</p><p>Состояние при приёме: ${escapeHtml(intake?.conditionSummary ?? "Акт приёма ещё не заполнен")}</p>`;
      body = `<p>Клиент: ${escapeHtml(order.customer?.displayName)} · ${escapeHtml(order.contactPhone)}</p>${deviceDetails}<p>Адрес: ${escapeHtml(order.address)}</p><p>Неисправность со слов клиента: ${escapeHtml(order.problem)}</p><p>Диагностика / выполненные работы: ${escapeHtml(order.items.map((item) => item.name).join(", ") || "Заполните состав работ в карточке заявки")}</p><table><thead><tr><th>Работа / материал</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table>`;
    } else if (kind === "warranty" && warranty) {
      const warrantyPeriod =
        warranty.warrantyDays === 365 || warranty.warrantyDays === 366
          ? "1 год"
          : `${warranty.warrantyDays} дней`;
      body = `<p>Номер талона: ${escapeHtml(warranty.warrantyNumber)}</p><p>Клиент: ${escapeHtml(warranty.customerName)}</p><p>Устройство: ${escapeHtml(repairDeviceTypeLabel(warranty.deviceType))}</p><p>Работы по заявке: ${escapeHtml(warranty.repairSummary)}</p><p>Срок гарантии: ${escapeHtml(warrantyPeriod)}</p><p>Выдан: ${escapeHtml(date(warranty.issuedAt))}</p><p>Действует до: ${escapeHtml(date(warranty.expiresAt))}</p><h2>Условия</h2><p style="white-space:pre-wrap">${escapeHtml(warranty.terms)}</p>`;
    } else {
      throw new Error("Этот документ пока не сформирован.");
    }
  } catch (error) {
    printWindow.close();
    throw error;
  }

  let printScheduled = false;
  const schedulePrint = () => {
    if (printScheduled || printWindow.closed) return;
    printScheduled = true;
    window.setTimeout(() => {
      if (!printWindow.closed) printWindow.print();
    }, 200);
  };
  printWindow.addEventListener("load", schedulePrint, { once: true });
  printWindow.document.open();
  printWindow.document.write(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${heading} · ${escapeHtml(order.serviceNumber)}</title><style>@page{size:A4;margin:16mm}body{font:14px Arial,sans-serif;color:#162033;line-height:1.5}h1{font-size:24px}h2{font-size:17px;margin-top:24px}.meta{color:#526078;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccd3df;padding:7px;text-align:left}.signatures{display:flex;justify-content:space-between;margin-top:48px}.signatures span{width:42%;border-top:1px solid #333;padding-top:6px}</style></head><body><h1>${heading}</h1><p class="meta">Сервисный номер ${escapeHtml(order.serviceNumber)} · дата ${escapeHtml(date(new Date().toISOString()))}</p>${body}<div class="signatures"><span>Клиент · подпись</span><span>Представитель сервиса · подпись</span></div></body></html>`,
  );
  printWindow.document.close();
  if (printWindow.document.readyState === "complete") schedulePrint();
};
