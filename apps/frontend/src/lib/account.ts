import { API_BASE, authFetch } from "./api";

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
  refreshToken: string;
}): Promise<void> {
  const res = await authFetch(`${API_BASE}/account/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to change password");
  }
}

export async function updateProfile(data: {
  name?: string;
  profileImageUrl?: string;
}): Promise<{ id: string; name: string; email: string; phone: string; profileImageUrl?: string }> {
  const res = await authFetch(`${API_BASE}/account/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to update profile");
  return json?.data ?? json;
}

export async function deleteAccount(): Promise<void> {
  const res = await authFetch(`${API_BASE}/account`, { method: "DELETE" });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(json?.error?.message ?? "Failed to delete account");
  }
}

export async function signoutAll(): Promise<number> {
  const res = await authFetch(`${API_BASE}/auth/signout-all`, { method: "POST" });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to sign out all sessions");
  return json?.data?.revokedCount ?? 0;
}
