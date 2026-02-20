const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const CURRENT_USER_KEY = "currentUser";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAuthTokens(tokens: {
  accessToken?: string;
  refreshToken?: string;
}) {
  if (tokens.accessToken) {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  }
  if (tokens.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(CURRENT_USER_KEY);
}

export type StoredUser = {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
  profileImageUrl?: string | null;
};

export function setCurrentUser(user: StoredUser | null) {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_KEY);
    return;
  }
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
}

export function getCurrentUser(): StoredUser | null {
  const raw = localStorage.getItem(CURRENT_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    localStorage.removeItem(CURRENT_USER_KEY);
    return null;
  }
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return false;

    const json = await res.json();
    const payload = json?.data;
    if (!payload?.accessToken || !payload?.refreshToken) return false;

    setAuthTokens(payload);
    return true;
  } catch {
    return false;
  }
}

export async function authFetch(
  input: string,
  init: RequestInit = {},
  retryOnUnauthorized = true,
) {
  const accessToken = getAccessToken();
  const headers = new Headers(init.headers ?? {});

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status !== 401 || !retryOnUnauthorized) {
    return res;
  }

  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    clearAuthTokens();
    return res;
  }

  const nextAccessToken = getAccessToken();
  const retryHeaders = new Headers(init.headers ?? {});
  if (nextAccessToken) {
    retryHeaders.set("Authorization", `Bearer ${nextAccessToken}`);
  }

  return fetch(input, { ...init, headers: retryHeaders });
}

export { API_BASE };
