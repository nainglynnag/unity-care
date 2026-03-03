import { Router } from "express";
import * as dash from "../controllers/dashboard.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import { dashboardLimiter } from "../middlewares/rateLimit";

const router = Router();

// All dashboard routes require authentication + rate limiting
router.use(authenticate);
router.use(dashboardLimiter);

// Volunteer personal dashboard (VOLUNTEER role only)
// All three scoped to req.user.sub — no userId param needed or accepted.
router.get(
  "/volunteer/summary",
  requireRoles("VOLUNTEER"),
  dash.volunteerSummary,
);

router.get(
  "/volunteer/missions",
  requireRoles("VOLUNTEER"),
  dash.volunteerMissions,
);

router.get(
  "/volunteer/verifications",
  requireRoles("VOLUNTEER"),
  dash.volunteerVerifications,
);

// Agency dashboard (VOLUNTEER=coordinator/director + SUPERADMIN)
// VOLUNTEER JWT role covers COORDINATOR and DIRECTOR agency staff.
// Agency scope resolved inside service via AgencyMember table.
// SUPERADMIN must pass ?agencyId=<uuid> query param.
router.get(
  "/agency/live",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  dash.agencyLive,
);

router.get(
  "/agency/incidents",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  dash.agencyIncidents,
);

router.get(
  "/agency/missions",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  dash.agencyMissions,
);

router.get(
  "/agency/volunteers",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  dash.agencyVolunteers,
);

router.get(
  "/agency/categories",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  dash.agencyCategories,
);

router.get(
  "/agency/applications",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  dash.agencyApplications,
);

// Admin / SUPERADMIN platform dashboard
router.get(
  "/admin/overview",
  requireRoles("ADMIN", "SUPERADMIN"),
  dash.adminOverview,
);

router.get(
  "/admin/retention",
  requireRoles("ADMIN", "SUPERADMIN"),
  dash.adminRetention,
);

router.get(
  "/admin/health",
  requireRoles("ADMIN", "SUPERADMIN"),
  dash.adminHealth,
);

router.get(
  "/admin/agencies",
  requireRoles("ADMIN", "SUPERADMIN"),
  dash.adminAgencies,
);

router.get(
  "/admin/applications",
  requireRoles("ADMIN", "SUPERADMIN"),
  dash.adminApplications,
);

export default router;
