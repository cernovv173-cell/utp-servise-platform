import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getNewsWithNextTechnologyFact } from "./technology-fact-query";

const { getNewsMock } = vi.hoisted(() => ({ getNewsMock: vi.fn() }));

vi.mock("@/lib/api", () => ({ getNews: getNewsMock }));

describe("getNewsWithNextTechnologyFact", () => {
  const values = new Map<string, string>();
  const sessionStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  beforeEach(() => {
    values.clear();
    getNewsMock.mockReset();
    vi.stubGlobal("window", { sessionStorage });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("sends the last shown ID and saves the newly returned fact for the next page load", async () => {
    getNewsMock
      .mockResolvedValueOnce({ technologyFact: { id: "battery-charge-cycle" } })
      .mockResolvedValueOnce({ technologyFact: { id: "usb-c-is-a-connector" } });

    await getNewsWithNextTechnologyFact("session-token");
    await getNewsWithNextTechnologyFact("session-token");

    expect(getNewsMock).toHaveBeenNthCalledWith(1, "session-token", undefined, undefined);
    expect(getNewsMock).toHaveBeenNthCalledWith(
      2,
      "session-token",
      undefined,
      "battery-charge-cycle",
    );
    expect(values.get("utp-servise:last-shown-technology-fact")).toBe("usb-c-is-a-connector");
  });
});
