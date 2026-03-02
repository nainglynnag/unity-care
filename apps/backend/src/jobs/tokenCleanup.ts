import cron from "node-cron";
import { prisma } from "../lib/prisma";

// Daily cron sweep: delete expired + revoked refresh tokens.
// Runs at 03:00 every day. Batched to avoid locking the table.
const BATCH_SIZE = 1000;
const BATCH_PAUSE_MS = 100;

async function cleanExpiredTokens(): Promise<number> {
  let totalDeleted = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const batch = await prisma.refreshToken.findMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }],
      },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const ids = batch.map((t) => t.id);
    const { count } = await prisma.refreshToken.deleteMany({
      where: { id: { in: ids } },
    });

    totalDeleted += count;

    // Pause between batches to reduce DB pressure.
    if (batch.length === BATCH_SIZE) {
      await new Promise((r) => setTimeout(r, BATCH_PAUSE_MS));
    } else {
      break;
    }
  }

  return totalDeleted;
}

export function scheduleTokenCleanup(): void {
  // "0 3 * * *" = daily at 03:00
  cron.schedule("0 3 * * *", async () => {
    try {
      const deleted = await cleanExpiredTokens();
      console.log(
        `[token-cleanup] ${new Date().toISOString()} — deleted ${deleted} expired/revoked tokens.`,
      );
    } catch (error) {
      console.error("[token-cleanup] Error during cleanup:", error);
    }
  });

  console.log("[token-cleanup] Scheduled daily at 03:00.");
}
