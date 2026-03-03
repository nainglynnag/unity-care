import { prisma } from "../lib/prisma";
import type { NotificationType } from "../../generated/prisma/client";

// Fire-and-forget notification creator.
// Call this from any service when an event occurs. The function
// never throws — errors are logged silently so the caller's main
// flow is not disrupted by a notification failure.

interface EmitOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
}

export async function emitNotification(opts: EmitOptions): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        referenceType: opts.referenceType ?? null,
        referenceId: opts.referenceId ?? null,
      },
    });
  } catch (err) {
    console.error("[notification-emitter] Failed to create notification:", err);
  }
}

// Convenience: emit the same notification to multiple users.
export async function emitToMany(
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  ref?: { type: string; id: string },
): Promise<void> {
  if (userIds.length === 0) return;

  try {
    await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type,
        title,
        message,
        referenceType: ref?.type ?? null,
        referenceId: ref?.id ?? null,
      })),
    });
  } catch (err) {
    console.error(
      "[notification-emitter] Failed to create bulk notifications:",
      err,
    );
  }
}
