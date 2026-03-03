import { z } from "zod";

// POST /missions/:id/tracking — volunteer pushes GPS position.
// recordedAt is optional — server uses NOW() if omitted.
// Clamped: must be within the last 5 minutes and not in the future
// to prevent replaying stale coordinates as current.
export const pushTrackingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  recordedAt: z
    .string()
    .datetime()
    .optional()
    .transform((s) => (s ? new Date(s) : new Date()))
    .refine(
      (d) => {
        const now = Date.now();
        const fiveMinMs = 5 * 60 * 1000;
        return d.getTime() <= now && d.getTime() >= now - fiveMinMs;
      },
      {
        message:
          "recordedAt must be within the last 5 minutes and not in the future.",
      },
    ),
});

// GET /missions/:id/tracking — history query.
// volunteerId: filter to a specific volunteer (coordinator use case).
// since: only return points after this ISO timestamp (incremental polling).
// limit: max points to return, ordered by recordedAt asc.
export const getTrackingQuerySchema = z.object({
  volunteerId: z.string().uuid().optional(),
  since: z
    .string()
    .datetime()
    .optional()
    .transform((s) => (s ? new Date(s) : undefined)),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type PushTrackingInput = z.infer<typeof pushTrackingSchema>;
export type GetTrackingQuery = z.infer<typeof getTrackingQuerySchema>;
