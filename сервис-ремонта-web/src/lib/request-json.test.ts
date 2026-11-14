import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ApiRequestError,
  isRejectedSessionError,
  requestJson as request,
  russianErrorMessage,
} from "./request-json";

describe("request transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("passes the abort signal and request options to fetch", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ id: 1 }));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    const init = { signal, method: "POST", body: JSON.stringify({ label: "Example" }) };
    await expect(request("/api/items", init)).resolves.toEqual({ id: 1 });
    expect(fetch).toHaveBeenCalledWith("/api/items", init);
  });

  it("rejects HTTP errors instead of caching an error response as successful data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unavailable", { status: 503 })));
    await expect(request("/api/items")).rejects.toThrow(
      "Сервис временно недоступен. Попробуйте повторить действие позже.",
    );
  });

  it("shows a safe server-provided error message for rejected requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "CONFLICT", message: "Сначала завершите заказ." } },
            { status: 409 },
          ),
        ),
    );
    await expect(request("/api/items")).rejects.toThrow("Сначала завершите заказ.");
  });

  it("translates non-Russian server errors while preserving Russian details", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { code: "FAILED", message: "Invalid request" } }, { status: 400 }),
        ),
    );
    await expect(request("/api/items")).rejects.toThrow(
      "Проверьте введённые данные и попробуйте ещё раз.",
    );
    expect(russianErrorMessage("Сначала завершите заказ.", 409)).toBe("Сначала завершите заказ.");
  });

  it("shows network failures in Russian", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(request("/api/items")).rejects.toThrow(
      "Не удалось подключиться к серверу. Проверьте интернет и повторите попытку.",
    );
  });

  it("keeps the HTTP status and server error code on rejected requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { code: "CONFLICT", message: "Сначала завершите заказ." } },
            { status: 409 },
          ),
        ),
    );
    const failure = await request("/api/items").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiRequestError);
    expect(failure).toMatchObject({ code: "CONFLICT", status: 409 });
  });

  it("treats only rejected sessions as sign-out events", () => {
    expect(
      isRejectedSessionError(new ApiRequestError("AUTHENTICATION_REQUIRED", 401, "Войдите.")),
    ).toBe(true);
    expect(isRejectedSessionError(new ApiRequestError("FORBIDDEN", 403, "Нет доступа."))).toBe(
      true,
    );
    expect(isRejectedSessionError(new ApiRequestError("REQUEST_FAILED", 503, "Недоступно."))).toBe(
      false,
    );
    expect(isRejectedSessionError(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("accepts mutations with no response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request<void>("/api/items/1", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
