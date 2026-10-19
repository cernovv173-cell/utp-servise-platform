import { afterEach, describe, expect, it, vi } from "vitest";

import { deleteOwnAccount } from "./api";

describe("deleteOwnAccount", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends an authenticated DELETE request and accepts success", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ deleted: true }));
    vi.stubGlobal("fetch", fetch);

    await expect(deleteOwnAccount("session-token")).resolves.toEqual({ deleted: true });

    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/customer\/account$/u);
    expect(init.method).toBe("DELETE");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer session-token");
  });

  it.each([401, 409, 503])("surfaces a failed deletion response (%i)", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));

    await expect(deleteOwnAccount("session-token")).rejects.toThrow(`Request failed (${status})`);
  });
});
