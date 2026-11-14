import { describe, expect, it } from "vitest";

import { encodeServiceNumberBarcode } from "./service-number-barcode";

describe("service number barcode", () => {
  it("encodes the service number as a visible Code 128 barcode", () => {
    const bars = encodeServiceNumberBarcode("SRV-2026-000001");

    expect(bars).toMatch(/^[01]+$/u);
    expect(bars).toContain("1");
  });

  it("rejects an empty service number", () => {
    expect(() => encodeServiceNumberBarcode(" ")).toThrow(
      "Для создания штрихкода нужен номер заявки.",
    );
  });
});
