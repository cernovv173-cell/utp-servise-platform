import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

import { type AuthResponse, type User, apiRequest } from "@/lib/api";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  ready: boolean;
  setSession: (session: AuthResponse) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem("utp-web-token"));
  const me = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: ({ signal }) => apiRequest<{ user: User }>("/auth/me", token, { signal }),
    enabled: Boolean(token),
    retry: false,
  });

  useEffect(() => {
    if (me.isError && token) {
      sessionStorage.removeItem("utp-web-token");
      setToken(null);
      queryClient.clear();
    }
  }, [me.isError, queryClient, token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user: token ? (me.data?.user ?? null) : null,
      ready: !token || !me.isLoading,
      setSession: (session) => {
        sessionStorage.setItem("utp-web-token", session.accessToken);
        setToken(session.accessToken);
        queryClient.setQueryData(["auth", "me", session.accessToken], { user: session.user });
      },
      logout: () => {
        const activeToken = token;
        if (activeToken)
          void apiRequest<void>("/auth/logout", activeToken, { method: "POST" }).catch(
            () => undefined,
          );
        sessionStorage.removeItem("utp-web-token");
        setToken(null);
        queryClient.clear();
      },
    }),
    [me.data?.user, me.isLoading, queryClient, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
};
