import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types";

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      clear: () => set({ token: null, user: null }),
    }),
    { name: "roadmap-auth" },
  ),
);

export const isAuthenticated = (): boolean =>
  Boolean(useAuthStore.getState().token);
