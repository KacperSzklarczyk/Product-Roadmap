import { apiClient } from "@/api/client";
import type {
  Credentials,
  RegisterPayload,
  TokenResponse,
  User,
} from "@/types";

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<User>("/auth/register", payload);
  return data;
}

export async function login(payload: Credentials): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/login", payload);
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me");
  return data;
}
