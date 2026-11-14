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

export const russianErrorMessage = (message: unknown, status?: number) => {
  const text = typeof message === "string" ? message.trim() : "";
  if (text && /[\u0400-\u04ff]/u.test(text)) return text;

  const normalized = text.toLowerCase();
  if (
    [
      "failed to fetch",
      "failed to connect",
      "network",
      "timed out",
      "timeout",
      "connection refused",
      "unable to resolve",
    ].some((phrase) => normalized.includes(phrase))
  ) {
    return "Не удалось подключиться к серверу. Проверьте интернет и повторите попытку.";
  }
  if (status === 401) return "Сеанс завершён. Войдите в аккаунт и повторите действие.";
  if (status === 403) return "Недостаточно прав для этого действия.";
  if (status === 404)
    return "Запрошенные данные не найдены. Обновите страницу и попробуйте ещё раз.";
  if (status === 409) return "Данные уже изменились. Обновите страницу и повторите действие.";
  if (status === 429) return "Слишком много запросов. Подождите немного и попробуйте снова.";
  if (status !== undefined && status >= 500)
    return "Сервис временно недоступен. Попробуйте повторить действие позже.";
  if (normalized.includes("forbidden") || normalized.includes("access denied"))
    return "Недостаточно прав для этого действия.";
  if (normalized.includes("not found"))
    return "Запрошенные данные не найдены. Обновите страницу и попробуйте ещё раз.";
  if (normalized.includes("invalid") || normalized.includes("required"))
    return "Проверьте введённые данные и попробуйте ещё раз.";
  return "Не удалось выполнить запрос. Проверьте данные и попробуйте ещё раз.";
};

/** Fetch transport only; TanStack Query owns client-side caching and request state. */
export const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === "AbortError") throw failure;
    throw new ApiRequestError(
      "NETWORK_ERROR",
      0,
      russianErrorMessage(failure instanceof Error ? failure.message : failure),
    );
  }
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: unknown; message?: unknown };
    } | null;
    const error = payload?.error;
    throw new ApiRequestError(
      typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
      response.status,
      russianErrorMessage(error?.message, response.status),
    );
  }
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiRequestError(
      "INVALID_RESPONSE",
      response.status,
      "Не удалось прочитать ответ сервера. Обновите страницу и попробуйте ещё раз.",
    );
  }
};
