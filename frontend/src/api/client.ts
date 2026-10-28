/**
 * Production API Client for PGMS Frontend -> Go (Golang) Backend
 * ------------------------------------------------------------------
 * Supports Dual-Token (Short-Lived Access Token + Long-Lived Refresh Token).
 * Handles automatic token refresh on 401 Unauthorized errors.
 * ------------------------------------------------------------------
 */

const getDynamicApiUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }
  if (typeof window !== "undefined" && window.location.hostname && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
    // If running in production browser but env var is missing, give a helpful console notice
    console.warn("[PGMS] VITE_API_URL environment variable is not set. Defaulting to local backend.");
  }
  return "http://localhost:8080/api/v1";
};

export const API_BASE_URL = getDynamicApiUrl();
const ACCESS_TOKEN_KEY = "pgms_access_token";
const REFRESH_TOKEN_KEY = "pgms_refresh_token";
const USER_KEY = "pgms_user_data";

export const getToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const setAuthTokens = (accessToken: string, refreshToken?: string): void => {
  if (typeof window !== "undefined") {
    // Store in sessionStorage so closing the browser window/tab forces login on next session
    sessionStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    if (refreshToken) {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    // Clean up persistent localStorage to enforce session authentication requirements
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
};

export const removeToken = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
};

export const getStoredUser = (): any | null => {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setStoredUser = (user: any): void => {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.removeItem(USER_KEY);
  }
};

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit & { params?: Record<string, string>; _isRetry?: boolean } = {}
): Promise<T> {
  const { params, _isRetry, ...fetchOptions } = options;
  const token = getToken();
  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (fetchOptions.body && !(fetchOptions.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...fetchOptions,
      headers,
    });
  } catch (netErr: any) {
    if (netErr?.name === "AbortError") throw netErr;
    throw new Error(`Unable to connect to backend server at ${API_BASE_URL}. Please verify backend is running on port 8080.`);
  }

  // Handle Token Refresh on 401 Unauthorized
  if (response.status === 401 && !_isRetry && !endpoint.includes("/auth/")) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          setAuthTokens(refreshData.accessToken, refreshData.refreshToken);
          headers["Authorization"] = `Bearer ${refreshData.accessToken}`;

          // Retry original request with new access token
          response = await fetch(url, {
            ...fetchOptions,
            headers,
          });
        } else {
          removeToken();
        }
      } catch {
        removeToken();
      }
    }
  }

  if (!response.ok) {
    let errorMessage = `Unable to complete request (${response.status}).`;
    try {
      const errData = await response.json();
      const rawMsg = errData?.message || errData?.error;
      if (rawMsg) errorMessage = sanitizeErrorMessage(rawMsg);
    } catch {
      // fallback
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export function getFileUrl(pathOrFilename?: string): string {
  if (!pathOrFilename) return "";
  if (pathOrFilename.startsWith("http://") || pathOrFilename.startsWith("https://")) {
    return pathOrFilename;
  }
  return `${API_BASE_URL}/uploads/${pathOrFilename}`;
}

export function isAbortError(err: any): boolean {
  if (!err) return false;
  return err.name === "AbortError" || /aborted|cancelled/i.test(err.message ?? "");
}

export function sanitizeErrorMessage(msg?: string): string {
  if (!msg) return "An unexpected error occurred. Please try again.";

  const lower = msg.toLowerCase();
  if (
    lower.includes("pq:") ||
    lower.includes("sql:") ||
    lower.includes("22p02") ||
    lower.includes("invalid input syntax") ||
    lower.includes("foreign key") ||
    lower.includes("constraint") ||
    lower.includes("column") ||
    lower.includes("relation") ||
    lower.includes("database") ||
    lower.includes("failed to insert")
  ) {
    if (lower.includes("status") || lower.includes("update")) {
      return "Unable to save resolution update. Please verify input fields.";
    }
    return "Action failed due to a system processing error. Please try again.";
  }

  return msg;
}
