import { createContext, useContext } from "react";

import type { AuthResponse, User } from "@/lib/api";

export type AuthContextValue = {
  token: string | null;
  user: User | null;
  ready: boolean;
  setSession: (session: AuthResponse) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth можно использовать только внутри AuthProvider.");
  return value;
};
