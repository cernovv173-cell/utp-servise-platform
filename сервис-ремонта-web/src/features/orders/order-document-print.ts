import {
  type RepairOrder,
  type RepairOrderIntake,
  type RepairWarranty,
  fetchProtectedMedia,
} from "@/lib/api";

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

const dataUrl = async (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const date = (value: string) => new Date(value).toLocaleString("ru-RU");

export const printOrderDocument = async (
  kind: OrderDocumentKind,
  order: RepairOrder,
  intake: RepairOrderIntake | null,
  warranty: RepairWarranty | null,
  token: string,
) => {
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
      const views = [
        ["Передняя сторона", intake.frontCondition, intake.frontPhotoObjectId],
        ["Задняя сторона", intake.backCondition, intake.backPhotoObjectId],
        ["Левая сторона", intake.leftCondition, intake.leftPhotoObjectId],
        ["Правая сторона", intake.rightCondition, intake.rightPhotoObjectId],
      ] as const;
      const photos = await Promise.all(
        views.map(async ([label, condition, objectId]) => {
          if (!objectId)
            return `<div class="side"><b>${label}</b><p>${escapeHtml(condition)}</p></div>`;
          const image = await fetchProtectedMedia(token, objectId);
          return `<div class="side"><b>${label}</b><p>${escapeHtml(condition)}</p><img alt="${label}" src="${escapeHtml(await dataUrl(image))}"></div>`;
        }),
      );
      body = `<p>Клиент: ${escapeHtml(order.customer?.displayName)} · ${escapeHtml(order.contactPhone)}</p><p>Устройство: ${escapeHtml(order.deviceType)} · серийный номер: ${escapeHtml(intake.serialNumber)}</p><p>Заявленная неисправность: ${escapeHtml(order.problem)}</p><h2>Видимые повреждения по сторонам</h2><div class="sides">${photos.join("")}</div><p>Комплектность: ${escapeHtml(intake.includedAccessories)}</p><p>Дополнительные отметки: ${escapeHtml(intake.intakeNotes)}</p>`;
    } else if (kind === "work-order") {
      const rows = order.items
        .map(
          (item) =>
            `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(item.unitPriceRub)} ₽</td><td>${escapeHtml(item.quantity * item.unitPriceRub)} ₽</td></tr>`,
        )
        .join("");
      body = `<p>Клиент: ${escapeHtml(order.customer?.displayName)} · ${escapeHtml(order.contactPhone)}</p><p>Устройство: ${escapeHtml(order.deviceType)} · серийный номер: ${escapeHtml(intake?.serialNumber)}</p><p>Адрес: ${escapeHtml(order.address)}</p><p>Неисправность со слов клиента: ${escapeHtml(order.problem)}</p><p>Диагностика / выполненные работы: ${escapeHtml(order.items.map((item) => item.name).join(", ") || "Заполните состав работ в карточке заявки")}</p><table><thead><tr><th>Работа / материал</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table><p>Состояние при приёме: ${escapeHtml(intake ? [intake.frontCondition, intake.backCondition, intake.leftCondition, intake.rightCondition].join("; ") : "Акт приёма ещё не заполнен")}</p>`;
    } else if (kind === "warranty" && warranty) {
      const warrantyPeriod =
        warranty.warrantyDays === 365 || warranty.warrantyDays === 366
          ? "1 год"
          : `${warranty.warrantyDays} дней`;
      body = `<p>Номер талона: ${escapeHtml(warranty.warrantyNumber)}</p><p>Клиент: ${escapeHtml(warranty.customerName)}</p><p>Устройство: ${escapeHtml(warranty.deviceType)}</p><p>Работы по заявке: ${escapeHtml(warranty.repairSummary)}</p><p>Срок гарантии: ${escapeHtml(warrantyPeriod)}</p><p>Выдан: ${escapeHtml(date(warranty.issuedAt))}</p><p>Действует до: ${escapeHtml(date(warranty.expiresAt))}</p><h2>Условия</h2><p style="white-space:pre-wrap">${escapeHtml(warranty.terms)}</p>`;
    } else {
      throw new Error("Этот документ пока не сформирован.");
    }
  } catch (error) {
    printWindow.close();
    throw error;
  }

  printWindow.document.open();
  printWindow.document.write(
    `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${heading} · ${escapeHtml(order.serviceNumber)}</title><style>@page{size:A4;margin:16mm}body{font:14px Arial,sans-serif;color:#162033;line-height:1.5}h1{font-size:24px}h2{font-size:17px;margin-top:24px}.meta{color:#526078;font-size:12px}.sides{display:grid;grid-template-columns:1fr 1fr;gap:12px}.side{break-inside:avoid;border:1px solid #ccd3df;padding:10px}.side img{display:block;width:100%;height:180px;object-fit:contain}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccd3df;padding:7px;text-align:left}.signatures{display:flex;justify-content:space-between;margin-top:48px}.signatures span{width:42%;border-top:1px solid #333;padding-top:6px}</style></head><body><h1>${heading}</h1><p class="meta">Сервисный номер ${escapeHtml(order.serviceNumber)} · дата ${escapeHtml(date(new Date().toISOString()))}</p>${body}<div class="signatures"><span>Клиент · подпись</span><span>Представитель сервиса · подпись</span></div><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),200));</script></body></html>`,
  );
  printWindow.document.close();
};
