import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDisplayedSeason, persistSeasonPreviewSetting } from "./use-seasonal-theme";

describe("seasonal theme preview", () => {
  const values = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };

  const setLocation = (hostname: string, search: string) => {
    vi.stubGlobal("window", { location: { hostname, search }, sessionStorage });
  };

  beforeEach(() => values.clear());
  afterEach(() => vi.unstubAllGlobals());

  it.each(["SPRING", "SUMMER", "AUTUMN", "WINTER", "NONE"] as const)(
    "can preview %s without changing the saved season",
    (season) => {
      setLocation("example.preview.amazi.pro", `?season-preview=${season}`);

      expect(getDisplayedSeason("WINTER")).toBe(season);
      expect(values.size).toBe(0);
    },
  );

  it("persists a valid season only for the current preview-browser session", () => {
    setLocation("example.preview.amazi.pro", "?season-preview=AUTUMN");
    persistSeasonPreviewSetting();
    setLocation("example.preview.amazi.pro", "");

    expect(getDisplayedSeason("SPRING")).toBe("AUTUMN");
  });

  it("keeps the former winter preview links working", () => {
    setLocation("example.preview.amazi.pro", "?winter-preview=1");
    expect(getDisplayedSeason("SPRING")).toBe("WINTER");

    setLocation("example.preview.amazi.pro", "?winter-preview=0");
    expect(getDisplayedSeason("SPRING")).toBe("SPRING");
  });

  it("ignores seasonal preview parameters on the production host", () => {
    setLocation("service.example.com", "?season-preview=SUMMER");

    expect(getDisplayedSeason("AUTUMN")).toBe("AUTUMN");
    expect(values.size).toBe(0);
  });
});
