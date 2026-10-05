import Code128Auto from "jsbarcode/bin/barcodes/CODE128/CODE128_AUTO.js";

export const encodeServiceNumberBarcode = (serviceNumber: string) => {
  if (!serviceNumber.trim()) throw new Error("Service number is required to create a barcode.");

  const encoder = new Code128Auto(serviceNumber, { text: serviceNumber });
  if (!encoder.valid()) throw new Error("The service number contains unsupported characters.");
  const bars = encoder.encode().data;
  if (!bars) throw new Error("Could not encode the service number as Code 128.");
  return bars;
};
