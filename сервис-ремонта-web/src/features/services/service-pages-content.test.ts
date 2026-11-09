import { describe, expect, it } from "vitest";

import { servicePages } from "./service-pages-content";

describe("service page content", () => {
  it("covers the five requested services with unique paths", () => {
    expect(servicePages).toHaveLength(5);
    expect(new Set(servicePages.map((page) => page.slug)).size).toBe(servicePages.length);
    expect(new Set(servicePages.map((page) => page.path)).size).toBe(servicePages.length);
    expect(new Set(servicePages.map((page) => page.metaTitle)).size).toBe(servicePages.length);
  });

  it("provides search metadata and a city mention for every page", () => {
    for (const page of servicePages) {
      expect(page.metaTitle.length).toBeGreaterThan(20);
      expect(page.metaDescription.length).toBeGreaterThan(80);
      expect(`${page.metaTitle} ${page.metaDescription}`).toContain("Пушкино");
      expect(page.heading.length).toBeGreaterThan(10);
      expect(page.intro.length).toBeGreaterThan(60);
    }
  });

  it("provides price names, steps and FAQ for every page", () => {
    for (const page of servicePages) {
      expect(page.priceItems.length).toBeGreaterThan(0);
      expect(page.priceNotice.length).toBeGreaterThan(40);
      expect(page.steps.length).toBeGreaterThanOrEqual(3);
      expect(page.faq.length).toBeGreaterThanOrEqual(3);
      expect(page.includes.length).toBeGreaterThanOrEqual(4);
    }
  });
});
