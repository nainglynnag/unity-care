import { z } from "zod";

// Shared period query param used by all dashboard endpoints.
export const periodSchema = z.object({
  period: z.enum(["7d", "30d", "90d", "1y", "all"]).default("30d"),
});

export type PeriodQuery = z.infer<typeof periodSchema>;

// Volunteer personal dashboard endpoints use period only.
// No agencyId needed — always scoped to req.user.sub.
export const volunteerDashboardSchema = periodSchema;

// Agency endpoints — period only.
// agencyId resolved from AgencyMember table using requesterId.
// Not taken from query params — prevents scope bypass.
export const agencyDashboardSchema = periodSchema;

// Admin / SUPERADMIN — period + optional agencyId for cross-agency drill-down.
// SUPERADMIN can pass agencyId to see a specific agency's data.
// ADMIN always sees platform-wide data (agencyId ignored).
export const adminDashboardSchema = z.object({
  period: z.enum(["7d", "30d", "90d", "1y", "all"]).default("30d"),
  agencyId: z.uuid().optional(),
});

export type AdminDashboardQuery = z.infer<typeof adminDashboardSchema>;
