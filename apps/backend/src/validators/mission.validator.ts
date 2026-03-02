import { z } from "zod";

// Create Mission
// COORDINATOR or DIRECTOR creates a mission from a VERIFIED incident and
// assigns the full team in one atomic request.
export const createMissionSchema = z
  .object({
    primaryIncidentId: z.uuid("primaryIncidentId must be a valid UUID."),

    linkedIncidentIds: z
      .array(z.uuid("Each linkedIncidentId must be a valid UUID."))
      .max(20, "Cannot link more than 20 incidents to one mission.")
      .default([]),

    missionType: z
      .string()
      .min(2, "missionType must be at least 2 characters.")
      .max(100, "missionType cannot exceed 100 characters."),

    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"], {
      message: "priority must be LOW, MEDIUM, HIGH, or CRITICAL.",
    }),

    volunteers: z
      .array(
        z.object({
          volunteerId: z.uuid("volunteerId must be a valid UUID."),
          role: z.enum(["LEADER", "MEMBER"], {
            message: "role must be LEADER or MEMBER.",
          }),
        }),
      )
      .min(1, "At least one volunteer must be assigned at mission creation."),
  })
  // Exactly one LEADER
  .refine((d) => d.volunteers.filter((v) => v.role === "LEADER").length === 1, {
    message: "Exactly one volunteer must be assigned as LEADER.",
    path: ["volunteers"],
  })
  // No duplicate volunteer IDs
  .refine(
    (d) => {
      const ids = d.volunteers.map((v) => v.volunteerId);
      return new Set(ids).size === ids.length;
    },
    {
      message: "Duplicate volunteerIds found in assignment list.",
      path: ["volunteers"],
    },
  )
  // primaryIncidentId cannot also be in linkedIncidentIds
  .refine((d) => !d.linkedIncidentIds.includes(d.primaryIncidentId), {
    message: "primaryIncidentId cannot also appear in linkedIncidentIds.",
    path: ["linkedIncidentIds"],
  })
  // No duplicate linked incident IDs
  .refine(
    (d) => new Set(d.linkedIncidentIds).size === d.linkedIncidentIds.length,
    {
      message: "Duplicate IDs found in linkedIncidentIds.",
      path: ["linkedIncidentIds"],
    },
  );

// Reject Mission
// Volunteer rejects an assigned mission. Note is REQUIRED.
export const rejectMissionSchema = z.object({
  note: z.string().min(5, "Rejection note must be at least 5 characters."),
});

// Agency Decision (after volunteer rejection)
// COORDINATOR/DIRECTOR decides: reassign (CONTINUE) or close (FAIL).
export const agencyDecisionSchema = z
  .object({
    decision: z.enum(["CONTINUE", "FAIL"], {
      message: "decision must be CONTINUE or FAIL.",
    }),
    volunteerId: z.uuid().optional(),
    note: z.string().min(5).optional(),
  })
  .refine((d) => d.decision !== "CONTINUE" || d.volunteerId !== undefined, {
    message:
      "volunteerId is required when decision is CONTINUE (reassign to new volunteer).",
    path: ["volunteerId"],
  });

// Reusable GPS location fields — required for all volunteer field actions
// from start-travel through completion/failure.
const locationFields = {
  latitude: z
    .number({ error: "latitude is required." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  longitude: z
    .number({ error: "longitude is required." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
};

// Start Travel — volunteer enables GPS and begins traveling
export const startTravelSchema = z.object(locationFields);

// Arrive On Site — volunteer confirms arrival with GPS
export const arriveOnSiteSchema = z.object(locationFields);

// Start Work — volunteer begins active work on site
export const startWorkSchema = z.object(locationFields);

// Submit Completion Report
// Submitted by the mission LEADER when task is finished on site.
export const submitCompletionReportSchema = z.object({
  ...locationFields,
  summary: z.string().min(10, "Summary must be at least 10 characters."),
  actionsTaken: z.string().optional(),
  resourcesUsed: z.string().optional(),
  casualties: z.number().int().min(0).optional(),
  propertyDamage: z.string().optional(),
});

// Confirm/Reject Completion
// COORDINATOR/DIRECTOR reviews the completion report.
export const confirmCompletionSchema = z
  .object({
    confirmed: z.boolean({
      message: "confirmed is required.",
    }),
    note: z.string().min(5).optional(),
  })
  .refine((d) => d.confirmed || (d.note !== undefined && d.note.length >= 5), {
    message: "A note is required when rejecting a completion report.",
    path: ["note"],
  });

// Cancel Mission
// COORDINATOR/DIRECTOR/SUPERADMIN cancels an active mission.
export const cancelMissionSchema = z.object({
  note: z.string().min(5, "Cancellation note must be at least 5 characters."),
});

// Report Failure
// Volunteer or COORDINATOR reports mission failure (e.g. access blocked).
// GPS is optional — coordinator may report remotely without location.
export const reportFailureSchema = z.object({
  reason: z.string().min(5, "Failure reason must be at least 5 characters."),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// Resolve Incident
// COORDINATOR/DIRECTOR explicitly resolves a VERIFIED incident.
export const resolveIncidentSchema = z.object({
  note: z
    .string()
    .min(5, "Please provide a resolution note (min 5 characters)."),
});

// List Missions Query
export const listMissionsQuerySchema = z.object({
  status: z
    .enum([
      "CREATED",
      "ASSIGNED",
      "ACCEPTED",
      "EN_ROUTE",
      "ON_SITE",
      "IN_PROGRESS",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
      "CLOSED",
    ])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  agencyId: z.uuid().optional(),
  incidentId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

// Exported Types
export type CreateMissionInput = z.infer<typeof createMissionSchema>;
export type RejectMissionInput = z.infer<typeof rejectMissionSchema>;
export type AgencyDecisionInput = z.infer<typeof agencyDecisionSchema>;
export type StartTravelInput = z.infer<typeof startTravelSchema>;
export type ArriveOnSiteInput = z.infer<typeof arriveOnSiteSchema>;
export type StartWorkInput = z.infer<typeof startWorkSchema>;
export type SubmitCompletionReportInput = z.infer<
  typeof submitCompletionReportSchema
>;
export type ConfirmCompletionInput = z.infer<typeof confirmCompletionSchema>;
export type CancelMissionInput = z.infer<typeof cancelMissionSchema>;
export type ReportFailureInput = z.infer<typeof reportFailureSchema>;
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>;
export type ListMissionsQuery = z.infer<typeof listMissionsQuerySchema>;
