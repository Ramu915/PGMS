import { apiRequest, setAuthTokens, removeToken, setStoredUser, getRefreshToken } from "./client";
import type { AuthResponse, GoogleAuthPayload, LoginPayload, RegisterPayload, User } from "@/types";

export const authApi = {
  async login(payload: LoginPayload): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    console.log("login", res);
    const accToken = res.accessToken || res.token;
    if (accToken) {
      setAuthTokens(accToken, res.refreshToken);
      setStoredUser(res.user);
    }
    return res;
  },

  async googleAuth(payload: GoogleAuthPayload): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>("/auth/google", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const accToken = res.accessToken || res.token;
    if (accToken) {
      setAuthTokens(accToken, res.refreshToken);
      setStoredUser(res.user);
    }
    return res;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const accToken = res.accessToken || res.token;
    if (accToken) {
      setAuthTokens(accToken, res.refreshToken);
      setStoredUser(res.user);
    }
    return res;
  },

  async getMe(): Promise<User> {
    const user = await apiRequest<User>("/auth/me");
    setStoredUser(user);
    return user;
  },

  async logout(): Promise<void> {
    const refreshToken = getRefreshToken();
    removeToken();
    if (refreshToken) {
      try {
        await apiRequest("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
      } catch {
        // ignore network errors on logout
      }
    }
  },

  async forgotPassword(email: string): Promise<{ message: string; resetToken?: string }> {
    return apiRequest<{ message: string; resetToken?: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, token, newPassword }),
    });
  },
};
