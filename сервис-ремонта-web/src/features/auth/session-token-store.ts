const TOKEN_STORAGE_KEY = "utp-web-token";
const listeners = new Set<() => void>();

let sessionToken =
  typeof window === "undefined" ? null : window.sessionStorage.getItem(TOKEN_STORAGE_KEY);

export const getSessionToken = () => sessionToken;

export const subscribeToSessionToken = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const updateSessionToken = (token: string | null) => {
  if (typeof window !== "undefined") {
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  if (sessionToken === token) return;
  sessionToken = token;
  listeners.forEach((listener) => listener());
};
