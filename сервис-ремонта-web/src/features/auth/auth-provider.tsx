import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useMemo, useSyncExternalStore } from "react";

import { type User, apiRequest } from "@/lib/api";
import { isRejectedSessionError } from "@/lib/request-json";

import { AuthContext, type AuthContextValue } from "./auth-context";
import {
  getSessionToken,
  subscribeToSessionToken,
  updateSessionToken,
} from "./session-token-store";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const token = useSyncExternalStore(subscribeToSessionToken, getSessionToken);
  const me = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: ({ signal }) => apiRequest<{ user: User }>("/auth/me", token, { signal }),
    enabled: Boolean(token),
    // A rejected session ends at once; temporary network or server failures may retry.
    retry: (failureCount, error) => !isRejectedSessionError(error) && failureCount < 2,
  });

  const sessionRejected = isRejectedSessionError(me.error);
  useEffect(() => {
    if (sessionRejected && token) {
      updateSessionToken(null);
      queryClient.clear();
    }
  }, [queryClient, sessionRejected, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user: token ? (me.data?.user ?? null) : null,
      ready: !token || !me.isLoading,
      setSession: (session) => {
        updateSessionToken(session.accessToken);
        queryClient.setQueryData(["auth", "me", session.accessToken], { user: session.user });
      },
      logout: () => {
        const activeToken = token;
        if (activeToken)
          void apiRequest<void>("/auth/logout", activeToken, { method: "POST" }).catch(
            () => undefined,
          );
        updateSessionToken(null);
        queryClient.clear();
      },
    }),
    [me.data?.user, me.isLoading, queryClient, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
