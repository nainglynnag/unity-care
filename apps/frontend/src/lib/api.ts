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
  phone?: string | null;
  hasVolunteerProfile?: boolean;
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

let _refreshPromise: Promise<boolean> | null = null;
let _redirecting = false;

async function refreshAccessToken(): Promise<boolean> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
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
  })();

  try {
    return await _refreshPromise;
  } finally {
    _refreshPromise = null;
  }
}

async function syncUserProfile() {
  try {
    const token = getAccessToken();
    if (!token) return;
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const json = await res.json();
    const data = json?.data;
    if (!data) return;

    const prev = getCurrentUser();
    setCurrentUser({
      id: data.id ?? prev?.id,
      name: data.name ?? prev?.name,
      email: data.email ?? prev?.email,
      role: data.role ?? prev?.role,
      profileImageUrl: data.profileImageUrl ?? prev?.profileImageUrl,
      phone: data.phone ?? prev?.phone,
      hasVolunteerProfile:
        data.hasVolunteerProfile ??
        (data.role === "VOLUNTEER" || !!prev?.hasVolunteerProfile),
    });
  } catch {
    // best-effort
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

  if ((res.status === 401 || res.status === 403) && retryOnUnauthorized && !_redirecting) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      _redirecting = true;
      const user = getCurrentUser();
      const role = user?.role;
      clearAuthTokens();
      const signInPath =
        role === "ADMIN" || role === "SUPERADMIN"
          ? "/admin-signin"
          : role === "VOLUNTEER" || user?.hasVolunteerProfile
            ? "/volunteer-signin"
            : "/signin";
      window.location.href = signInPath;
      return res;
    }

    if (res.status === 403) {
      await syncUserProfile();
    }

    const nextAccessToken = getAccessToken();
    const retryHeaders = new Headers(init.headers ?? {});
    if (nextAccessToken) {
      retryHeaders.set("Authorization", `Bearer ${nextAccessToken}`);
    }

    return fetch(input, { ...init, headers: retryHeaders });
  }

  return res;
}

export { API_BASE };
