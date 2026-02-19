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

// List Incidents
export const listIncidentQuerySchema = z.object({
  status: z
    .enum([
      "REPORTED",
      "AWAITING_VERIFICATION",
      "VERIFIED",
      "UNREACHABLE",
      "FALSE_REPORT",
      "RESOLVED",
      "CLOSED",
    ])
    .optional(),
  categoryId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(10),
});

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
export type CloseIncidentByReporterInput = z.infer<
  typeof closeIncidentByReporterSchema
>;
export type UpdateIncidentStatusInput = z.infer<
  typeof updateIncidentStatusSchema
>;
export type ListIncidentQuery = z.infer<typeof listIncidentQuerySchema>;
