import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import * as authApi from "@/api/auth";
import { getErrorMessage } from "@/api/client";
import { useAuthStore } from "@/store/auth";
import type { Credentials, RegisterPayload } from "@/types";

/** Log in, fetch the profile, persist auth, then route to the dashboard. */
export function useLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (credentials: Credentials) => {
      const { access_token } = await authApi.login(credentials);
      // Set the token first so the request interceptor authorizes /me.
      useAuthStore.getState().setToken(access_token);
      const user = await authApi.getMe();
      setAuth(access_token, user);
      return user;
    },
    onSuccess: (user) => {
      toast.success(`Welcome back, ${user.full_name ?? user.email}`);
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      useAuthStore.getState().clear();
      toast.error(getErrorMessage(error, "Login failed"));
    },
  });
}

/** Register, then auto-login for a seamless first experience. */
export function useRegister() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      await authApi.register(payload);
      const { access_token } = await authApi.login({
        email: payload.email,
        password: payload.password,
      });
      useAuthStore.getState().setToken(access_token);
      const user = await authApi.getMe();
      setAuth(access_token, user);
      return user;
    },
    onSuccess: (user) => {
      toast.success(`Account created — welcome, ${user.full_name ?? user.email}`);
      navigate("/dashboard", { replace: true });
    },
    onError: (error) => {
      useAuthStore.getState().clear();
      toast.error(getErrorMessage(error, "Registration failed"));
    },
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const clear = useAuthStore((s) => s.clear);
  return () => {
    clear();
    toast("Signed out");
    navigate("/login", { replace: true });
  };
}
