/** Fetch transport only; TanStack Query owns client-side caching and request state. */
export const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: unknown };
    } | null;
    const message = payload?.error?.message;
    throw new Error(
      typeof message === "string" && message.trim()
        ? message
        : `Request failed (${response.status})`,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};
