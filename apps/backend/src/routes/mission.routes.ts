import { Router } from "express";
import * as missionController from "../controllers/mission.controller";
import * as trackingController from "../controllers/tracking.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import { trackingPushLimiter } from "../middlewares/rateLimit";
import type { MissionParams } from "../controllers/mission.controller";

const router = Router();
router.use(authenticate);

// POST   /missions — create + assign team (COORDINATOR/DIRECTOR/SUPERADMIN)
// No requireRoles guard — service resolves authority via AgencyMember lookup
router.post("/", missionController.createMission);

// GET    /missions — list all (ADMIN/SUPERADMIN/COORDINATOR/DIRECTOR)
router.get(
  "/",
  requireRoles("ADMIN", "SUPERADMIN", "VOLUNTEER"),
  missionController.listMissions,
);

// GET    /missions/assigned — volunteer's own assigned missions
router.get(
  "/assigned",
  requireRoles("VOLUNTEER"),
  missionController.listMyMissions,
);

// GPS Tracking routes (must be before /:id catch-all)

// POST /missions/:id/tracking — volunteer pushes GPS position
router.post<MissionParams>(
  "/:id/tracking",
  requireRoles("VOLUNTEER"),
  trackingPushLimiter,
  trackingController.pushTracking,
);

// GET /missions/:id/tracking/latest — most recent point per volunteer (live map)
router.get<MissionParams>(
  "/:id/tracking/latest",
  requireRoles("VOLUNTEER", "ADMIN", "SUPERADMIN"),
  trackingController.getLatestTracking,
);

// GET /missions/:id/tracking — full history with filters
router.get<MissionParams>(
  "/:id/tracking",
  requireRoles("VOLUNTEER", "ADMIN", "SUPERADMIN"),
  trackingController.getTrackingHistory,
);

// GET    /missions/:id — full mission detail (scoped by role in service)
router.get<MissionParams>("/:id", missionController.getMission);

// Volunteer actions
// PATCH  /missions/:id/accept
router.patch<MissionParams>(
  "/:id/accept",
  requireRoles("VOLUNTEER"),
  missionController.acceptMission,
);

// PATCH  /missions/:id/reject
router.patch<MissionParams>(
  "/:id/reject",
  requireRoles("VOLUNTEER"),
  missionController.rejectMission,
);

// PATCH  /missions/:id/start-travel
router.patch<MissionParams>(
  "/:id/start-travel",
  requireRoles("VOLUNTEER"),
  missionController.startTravel,
);

// PATCH  /missions/:id/arrive
router.patch<MissionParams>(
  "/:id/arrive",
  requireRoles("VOLUNTEER"),
  missionController.arriveOnSite,
);

// PATCH  /missions/:id/start-work
router.patch<MissionParams>(
  "/:id/start-work",
  requireRoles("VOLUNTEER"),
  missionController.startWork,
);

// POST   /missions/:id/completion-report — LEADER submits report
router.post<MissionParams>(
  "/:id/completion-report",
  requireRoles("VOLUNTEER"),
  missionController.submitCompletionReport,
);

// PATCH  /missions/:id/report-failure — volunteer or coordinator reports failure
router.patch<MissionParams>(
  "/:id/report-failure",
  missionController.reportFailure,
);

// Coordinator actions
// PATCH  /missions/:id/agency-decision — after volunteer rejection
router.patch<MissionParams>(
  "/:id/agency-decision",
  missionController.agencyDecision,
);

// PATCH  /missions/:id/confirm-completion
router.patch<MissionParams>(
  "/:id/confirm-completion",
  missionController.confirmCompletion,
);

// PATCH  /missions/:id/cancel
router.patch<MissionParams>("/:id/cancel", missionController.cancelMission);

export default router;
