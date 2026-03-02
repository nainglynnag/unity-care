import { z } from "zod";

// Create Incident
export const createIncidentSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters."),
    description: z.string().optional(),
    categoryId: z.uuid("categoryId must be a valid UUID."),
    latitude: z
      .number({ error: "Latitude is required." })
      .min(-90, "Latitude must be between -90 and 90.")
      .max(90, "Latitude must be between -90 and 90."),
    longitude: z
      .number({ error: "Longitude is required." })
      .min(-180, "Longitude must be between -180 and 180.")
      .max(180, "Longitude must be between -180 and 180."),

    addressText: z.string().optional(),
    landmark: z.string().optional(),
    accuracy: z.enum(["GPS", "MANUAL", "VERIFIED"]).optional(),
    forSelf: z.boolean({ error: "forSelf is required." }),
    reporterNote: z.string().optional(),
    media: z
      .array(
        z.object({
          url: z.url("Each media item must have a valid URL."),
          mediaType: z.enum<readonly ["IMAGE", "VIDEO", "AUDIO"]>(
            ["IMAGE", "VIDEO", "AUDIO"],
            {
              error: () => ({
                message: "mediaType must be IMAGE, VIDEO, or AUDIO.",
              }),
            },
          ),
        }),
      )
      .max(5, "You can attach up to 5 media files per incident.")
      .optional(),
  })
  .refine(
    (data) =>
      data.forSelf || (data.reporterNote && data.reporterNote.length > 0),
    {
      message: "reporterNote is required when reporting for someone else.",
      path: ["reporterNote"],
    },
  );

// Update Incident Status
// Close Incident by Reporter
export const closeIncidentByReporterSchema = z.object({
  note: z.string().min(5, "Please provide a reason for closing this incident."),
});

// By Admin
export const updateIncidentStatusSchema = z.object({
  status: z.enum([
    "REPORTED",
    "AWAITING_VERIFICATION",
    "VERIFIED",
    "UNREACHABLE",
    "FALSE_REPORT",
    "RESOLVED",
    "CLOSED",
  ]),
});

// Incident status enum values — shared across query schemas
const INCIDENT_STATUS_VALUES = [
  "REPORTED",
  "AWAITING_VERIFICATION",
  "VERIFIED",
  "UNREACHABLE",
  "FALSE_REPORT",
  "RESOLVED",
  "CLOSED",
] as const;

// List My Incidents (CIVILIAN — GET /incidents/me)
// No categoryId, no geo — civilians see their own incidents only.
export const listMyIncidentQuerySchema = z.object({
  status: z.enum(INCIDENT_STATUS_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

// List Incidents (ADMIN/SUPERADMIN/VOLUNTEER — GET /incidents)
// Supports optional Haversine distance filtering.
// All three geo params must be provided together or not at all.
// sortBy=distance requires lat+lng+radiusKm.
// Default sort: createdAt desc (no change to existing behaviour).
export const listIncidentQuerySchema = z
  .object({
    status: z.enum(INCIDENT_STATUS_VALUES).optional(),
    categoryId: z.uuid().optional(),

    // Haversine distance filter
    // lat + lng define the center point (agency's location or user's GPS).
    // If omitted, the requester's agency location is used automatically.
    // radiusKm limits results to incidents within that radius (optional).
    // sortBy=distance re-orders results nearest first.
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radiusKm: z.coerce.number().min(0.1).max(500).optional(),
    sortBy: z.enum(["distance", "createdAt"]).default("createdAt"),

    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(10),
  })
  // lat and lng must be both or neither
  .refine((data) => (data.lat === undefined) === (data.lng === undefined), {
    message: "latitude and longitude are required.",
    path: ["lat"],
  });

// List Assigned Incidents (VOLUNTEER — GET /incidents/assigned)
// Returns only incidents the volunteer is assigned to verify.
// No distance filter — volunteer is dispatched to specific locations,
// not browsing by proximity.
export const listAssignedIncidentsQuerySchema = z.object({
  status: z.enum(INCIDENT_STATUS_VALUES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type CloseIncidentByReporterInput = z.infer<
  typeof closeIncidentByReporterSchema
>;
export type UpdateIncidentStatusInput = z.infer<
  typeof updateIncidentStatusSchema
>;
export type ListMyIncidentQuery = z.infer<typeof listMyIncidentQuerySchema>;
export type ListIncidentQuery = z.infer<typeof listIncidentQuerySchema>;
export type ListAssignedIncidentsQuery = z.infer<
  typeof listAssignedIncidentsQuerySchema
>;
