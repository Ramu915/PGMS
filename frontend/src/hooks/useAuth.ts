/**
 * useAuth — Standard Reactive JWT Auth Hook for PGMS (Go Backend Ready)
 * ------------------------------------------------------------------
 * Manages user state, JWT tokens in localStorage, login, register,
 * and logout logic with global event reactivity across all components.
 * ------------------------------------------------------------------
 */
import { useEffect, useState, useCallback } from "react";
import { authApi, getToken, getStoredUser, removeToken } from "@/api";
import type { User, UserRole } from "@/types";

export type AppRole = UserRole;

export function getRoleHomePath(role?: AppRole) {
  switch (role) {
    case "admin":
      return "/admin";
    case "department":
      return "/dashboard";
    case "citizen":
    default:
      return "/submit";
  }
}

export function getUserRole(value: unknown): AppRole {
  if (value === "admin" || value === "department" || value === "citizen") {
    return value;
  }
  return "citizen";
}

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("pgms_auth_change"));
  }
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);

  const syncUser = useCallback(() => {
    const token = getToken();
    const cachedUser = getStoredUser();

    if (token && cachedUser) {
      setUser(cachedUser);
    } else {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    syncUser();
    setMounted(true);

    const handleAuthChange = () => {
      syncUser();
    };

    window.addEventListener("pgms_auth_change", handleAuthChange);
    window.addEventListener("storage", handleAuthChange);

    return () => {
      window.removeEventListener("pgms_auth_change", handleAuthChange);
      window.removeEventListener("storage", handleAuthChange);
    };
  }, [syncUser]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const res = await authApi.login({ email, password });
      setUser(res.user);
      notifyAuthChange();
      return res;
    } finally {
      setLoading(false);
    }
  }, []);

  const googleLogin = useCallback(
    async (payload: { email?: string; name?: string; googleId?: string; avatarUrl?: string; idToken?: string }) => {
      setLoading(true);
      try {
        const res = await authApi.googleAuth(payload);
        setUser(res.user);
        notifyAuthChange();
        return res;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const register = useCallback(
    async (data: { email: string; password: string; name: string; phone?: string }) => {
      setLoading(true);
      try {
        const res = await authApi.register({
          email: data.email,
          password: data.password,
          name: data.name,
          phone: data.phone,
          role: "citizen",
        });
        // Do NOT auto-login user on register per requirements. Clear token and force sign in.
        removeToken();
        setUser(null);
        notifyAuthChange();
        return res;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    removeToken();
    setUser(null);
    notifyAuthChange();
    authApi.logout();
  }, []);

  return {
    user,
    loading,
    mounted,
    login,
    googleLogin,
    register,
    logout,
    isAuthenticated: !!user,
    role: getUserRole(user?.role),
  };
}
