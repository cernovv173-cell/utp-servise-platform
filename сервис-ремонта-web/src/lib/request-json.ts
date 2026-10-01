/** Fetch transport only; TanStack Query owns client-side caching and request state. */
export const requestJson = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
};
