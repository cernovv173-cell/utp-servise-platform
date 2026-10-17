import { describe, expect, it } from "vitest";

import { getRaccoonGuideHint } from "./raccoon-guide-hints";

describe("getRaccoonGuideHint", () => {
  it("explains how a customer starts a repair from the home page", () => {
    expect(getRaccoonGuideHint("/", "CUSTOMER")).toMatchObject({
      title: "Я рядом",
      action: { href: "/orders" },
    });
  });

  it("uses an administrator-specific order hint", () => {
    expect(getRaccoonGuideHint("/admin/orders", "ADMIN").message).toContain("статус");
  });

  it("keeps the guide useful on an unknown route", () => {
    expect(getRaccoonGuideHint("/about", "CUSTOMER").title).toBe("Я помогу сориентироваться");
  });
});
