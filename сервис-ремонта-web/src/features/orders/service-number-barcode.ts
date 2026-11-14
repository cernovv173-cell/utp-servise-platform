import Code128Auto from "jsbarcode/bin/barcodes/CODE128/CODE128_AUTO.js";

export const encodeServiceNumberBarcode = (serviceNumber: string) => {
  if (!serviceNumber.trim()) throw new Error("Для создания штрихкода нужен номер заявки.");

  const encoder = new Code128Auto(serviceNumber, { text: serviceNumber });
  if (!encoder.valid()) throw new Error("В номере заявки есть неподдерживаемые символы.");
  const bars = encoder.encode().data;
  if (!bars) throw new Error("Не удалось создать штрихкод для этой заявки.");
  return bars;
};
