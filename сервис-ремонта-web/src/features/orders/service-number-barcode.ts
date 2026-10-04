import JsBarcode from "jsbarcode";

export const encodeServiceNumberBarcode = (serviceNumber: string) => {
  if (!serviceNumber.trim()) throw new Error("Service number is required to create a barcode.");

  const target: { encodings?: Array<{ data: string; text?: string }> } = {};
  JsBarcode(target).CODE128(serviceNumber, {}).render();
  const bars = target.encodings?.[0]?.data;
  if (!bars) throw new Error("Could not encode the service number as Code 128.");
  return bars;
};
