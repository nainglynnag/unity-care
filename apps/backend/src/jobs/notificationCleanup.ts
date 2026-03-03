import cron from "node-cron";
import { prisma } from "../lib/prisma";

// Daily cron: delete read notifications older than 90 days.
// Prevents the Notification table from growing unbounded.
// Batched to avoid locking the table (same pattern as tokenCleanup).

const BATCH_SIZE = 1000;
const BATCH_PAUSE_MS = 100;
const RETENTION_DAYS = 90;

async function cleanOldNotifications(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  let totalDeleted = 0;

  while (true) {
    const batch = await prisma.notification.findMany({
      where: {
        isRead: true,
        readAt: { lt: cutoff },
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const ids = batch.map((n) => n.id);
    const { count } = await prisma.notification.deleteMany({
      where: { id: { in: ids } },
    });

    totalDeleted += count;

    if (batch.length === BATCH_SIZE) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    } else {
      break;
    }
  }

  return totalDeleted;
}

export function scheduleNotificationCleanup(): void {
  // "30 3 * * *" = daily at 03:30 (offset from token cleanup to avoid overlap)
  cron.schedule("30 3 * * *", async () => {
    try {
      const deleted = await cleanOldNotifications();
      console.log(
        `[notification-cleanup] ${new Date().toISOString()} — deleted ${deleted} read notifications older than ${RETENTION_DAYS} days.`,
      );
    } catch (error) {
      console.error("[notification-cleanup] Error during cleanup:", error);
    }
  });

  console.log("[notification-cleanup] Scheduled daily at 03:30.");
}
