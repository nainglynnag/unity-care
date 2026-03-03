import { z } from "zod";

// Shared boolean-from-query-string parser.
// z.coerce.boolean() is broken for query strings ("false" -> truthy string -> true).
const booleanFromQuery = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

// GET /notifications — list own inbox
export const listNotificationsQuerySchema = z.object({
  type: z
    .enum([
      "INCIDENT_CREATED",
      "INCIDENT_STATUS_UPDATED",
      "VERIFICATION_REQUESTED",
      "VERIFICATION_COMPLETED",
      "MISSION_CREATED",
      "MISSION_ASSIGNED",
      "MISSION_ACCEPTED",
      "MISSION_REJECTED",
      "MISSION_EN_ROUTE",
      "MISSION_ON_SITE",
      "MISSION_COMPLETED",
      "MISSION_FAILED",
      "MISSION_CLOSED",
      "APPLICATION_SUBMITTED",
      "APPLICATION_REVIEWED",
      "GENERAL",
    ])
    .optional(),

  unreadOnly: booleanFromQuery,

  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListNotificationsQuery = z.infer<
  typeof listNotificationsQuerySchema
>;

// DELETE /notifications — clear inbox.
// keepUnread defaults to true (safe) — only deletes read notifications.
// Pass keepUnread=false to wipe everything.
export const deleteAllNotificationsQuerySchema = z.object({
  keepUnread: booleanFromQuery,
});

export type DeleteAllNotificationsQuery = z.infer<
  typeof deleteAllNotificationsQuerySchema
>;
