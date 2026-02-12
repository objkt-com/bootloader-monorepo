const AUTH_TOKEN_STORAGE_KEY = "bootloader_auth_token_v1";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return value && value.trim() ? value : null;
}

export function setAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function buildAuthHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = getAuthToken();
  if (!token) return headers;

  if (headers instanceof Headers) {
    const next = new Headers(headers);
    next.set("Authorization", `Bearer ${token}`);
    return next;
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}
