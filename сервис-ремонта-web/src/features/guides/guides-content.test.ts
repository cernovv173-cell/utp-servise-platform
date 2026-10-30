import { describe, expect, it } from "vitest";

import { guides } from "@/features/guides/guides-content";

describe("customer repair guides", () => {
  it("publishes three distinct guides with direct routes", () => {
    expect(guides.map((guide) => guide.href)).toEqual([
      "/guides/prepare-laptop",
      "/guides/thermal-paste",
      "/guides/what-to-bring",
    ]);
  });

  it("keeps the cooling advice clear that symptoms are not a paste diagnosis", () => {
    const coolingGuide = guides.find((guide) => guide.slug === "thermal-paste");

    expect(coolingGuide?.items).toHaveLength(5);
    expect(coolingGuide?.note.text).toContain("Причину определит диагностика");
  });
});
