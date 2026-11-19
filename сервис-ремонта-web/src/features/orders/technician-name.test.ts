import { describe, expect, it } from "vitest";

import { shortTechnicianName } from "@/features/orders/technician-name";

describe("shortTechnicianName", () => {
  it("keeps the first part and shortens the remaining parts to initials", () => {
    expect(shortTechnicianName("Иванов Иван Иванович")).toBe("Иванов И. И.");
  });

  it("does not duplicate punctuation for an existing initial", () => {
    expect(shortTechnicianName("Иванов И.")).toBe("Иванов И.");
  });

  it("normalizes whitespace and keeps a single name unchanged", () => {
    expect(shortTechnicianName("  Александр  ")).toBe("Александр");
    expect(shortTechnicianName("Иванов   Пётр")).toBe("Иванов П.");
  });
});
