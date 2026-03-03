import { prisma } from "../lib/prisma";
import { NotificationNotFoundError } from "../utils/errors";
import type { ListNotificationsQuery } from "../validators/notification.validator";

// Every function is scoped to userId — users read only their own inbox.
// No cross-user notification reading at any level, not even SUPERADMIN.

// List own notifications with filters + pagination.
// Ordered: unread first (isRead ASC), then by createdAt DESC within each group.
// Also returns unreadCount so the frontend can update the badge without
// a separate /unread-count call.
export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery,
) {
  const { type, unreadOnly, page, perPage } = query;
  const skip = (page - 1) * perPage;

  const where = {
    userId,
    ...(unreadOnly && { isRead: false }),
    ...(type && { type }),
  };

  const [notifications, totalRecords, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: [
        { isRead: "asc" }, // unread (false) sorts before read (true)
        { createdAt: "desc" },
      ],
      skip,
      take: perPage,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return {
    notifications,
    unreadCount,
    pagination: {
      totalRecords,
      totalPages: Math.ceil(totalRecords / perPage),
      currentPage: page,
      perPage,
    },
  };
}

// Lightweight endpoint for badge/tab count.
export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, isRead: false },
  });
  return { unreadCount: count };
}

// Mark a single notification as read. Idempotent.
// Ownership check: notification must belong to requesting user.
export async function markAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    throw new NotificationNotFoundError();
  }

  if (notification.isRead) return notification;

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });
}

// Bulk mark all unread notifications as read. Single DB round trip.
export async function markAllAsRead(userId: string) {
  const now = new Date();
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: now },
  });
  return { updated: result.count };
}

// Delete a single notification. Ownership enforced.
export async function deleteNotification(
  userId: string,
  notificationId: string,
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.userId !== userId) {
    throw new NotificationNotFoundError();
  }

  await prisma.notification.delete({ where: { id: notificationId } });
  return { message: "Notification deleted." };
}

// Delete notifications for this user.
// keepUnread defaults to true (safe) — only deletes read notifications.
// Pass keepUnread=false to wipe everything.
export async function deleteAllNotifications(
  userId: string,
  keepUnread: boolean,
) {
  const result = await prisma.notification.deleteMany({
    where: {
      userId,
      ...(keepUnread && { isRead: true }),
    },
  });
  return { deleted: result.count };
}
