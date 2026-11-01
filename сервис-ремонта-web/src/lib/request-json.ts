export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

/** True only when the server rejected the session itself, not for a temporary network or server failure. */
export const isRejectedSessionError = (error: unknown) =>
  error instanceof ApiRequestError && (error.status === 401 || error.status === 403);

/** Fetch transport only; TanStack Query owns client-side caching and request state. */
export const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: unknown; message?: unknown };
    } | null;
    const error = payload?.error;
    throw new ApiRequestError(
      typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
      response.status,
      typeof error?.message === "string" && error.message.trim()
        ? error.message
        : `Не удалось выполнить запрос (${response.status}).`,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};
