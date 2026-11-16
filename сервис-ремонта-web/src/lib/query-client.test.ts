import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "./query-client";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

afterEach(() => vi.clearAllMocks());

describe("query client notifications", () => {
  it("shows a query failure once and clears the notice after a successful retry", async () => {
    const client = createQueryClient();
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("Сервер недоступен"))
      .mockResolvedValueOnce("Данные загружены");

    try {
      await expect(
        client.fetchQuery({ queryKey: ["notification-test"], queryFn, retry: false }),
      ).rejects.toThrow("Сервер недоступен");
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("Сервер недоступен");

      await expect(
        client.fetchQuery({
          queryKey: ["notification-test"],
          queryFn,
          retry: false,
          staleTime: 0,
        }),
      ).resolves.toBe("Данные загружены");
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("Сервер недоступен");
    } finally {
      client.clear();
    }
  });

  it("shows mutation failures unless the mutation already handles its own error", async () => {
    const client = createQueryClient();

    try {
      const unhandled = client.getMutationCache().build(client, {
        mutationFn: async () => {
          throw new Error("Не удалось сохранить изменения");
        },
      });
      await expect(unhandled.execute(undefined)).rejects.toThrow("Не удалось сохранить изменения");
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("Не удалось сохранить изменения");

      vi.clearAllMocks();
      const handled = client.getMutationCache().build(client, {
        mutationFn: async () => {
          throw new Error("Локальная ошибка");
        },
        onError: () => toast.error("Уведомление уже показано"),
      });
      await expect(handled.execute(undefined)).rejects.toThrow("Локальная ошибка");
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith("Уведомление уже показано");
    } finally {
      client.clear();
    }
  });
});
