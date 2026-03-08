import { API_BASE, authFetch } from "./api";

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
};

export type NotificationsResult = {
  notifications: Notification[];
  totalRecords: number;
  unreadCount: number;
};

export async function getNotifications(params?: {
  unreadOnly?: boolean;
  page?: number;
  perPage?: number;
}): Promise<NotificationsResult> {
  const search = new URLSearchParams();
  search.set("page", String(params?.page ?? 1));
  search.set("perPage", String(params?.perPage ?? 20));
  if (params?.unreadOnly) search.set("unreadOnly", "true");

  const res = await authFetch(`${API_BASE}/notifications?${search.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Failed to load notifications");
  }
  const data = json?.data;
  const list: Notification[] = Array.isArray(data) ? data : [];
  const pagination = json?.meta?.pagination;
  return {
    notifications: list,
    totalRecords: pagination?.totalRecords ?? list.length,
    unreadCount: json?.meta?.unreadCount ?? list.filter((n) => !n.isRead).length,
  };
}

export async function getUnreadCount(): Promise<number> {
  const res = await authFetch(`${API_BASE}/notifications/unread-count`);
  const json = await res.json();
  if (!res.ok) return 0;
  return json?.data?.unreadCount ?? 0;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await authFetch(`${API_BASE}/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export async function markAllAsRead(): Promise<void> {
  await authFetch(`${API_BASE}/notifications/read-all`, {
    method: "PATCH",
  });
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await authFetch(`${API_BASE}/notifications/${notificationId}`, {
    method: "DELETE",
  });
}

export async function bulkDeleteNotifications(keepUnread = true): Promise<number> {
  const url = `${API_BASE}/notifications${keepUnread ? "" : "?keepUnread=false"}`;
  const res = await authFetch(url, { method: "DELETE" });
  if (!res.ok) return 0;
  const json = await res.json();
  return json?.data?.deletedCount ?? 0;
}
