import { Router } from "express";
import * as incidentController from "../controllers/incident.controller";
import * as verificationController from "../controllers/incidentVerification.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import type { IncidentParams } from "../controllers/incident.controller";

const router = Router();
router.use(authenticate);

// CIVILIAN routes
// Post an incident by a civilian
router.post("/", requireRoles("CIVILIAN"), incidentController.createIncident);

// Get a reported incident by a civilian
router.get("/me", requireRoles("CIVILIAN"), incidentController.listMyIncidents);

// Get assigned incidents for a volunteer
router.get(
  "/assigned",
  requireRoles("VOLUNTEER"),
  incidentController.listAssignedIncidents,
);

// Get an incident by id
router.get<IncidentParams>("/:id", incidentController.getIncident);

// Close an incident by reporter
router.patch<IncidentParams>(
  "/:id/close",
  requireRoles("CIVILIAN"),
  incidentController.closeIncidentByReporter,
);

// VERIFICATION routes
// Assign a verifier to an incident (agency authority checked in service)
router.patch<IncidentParams>(
  "/:id/assign-verifier",
  verificationController.assignVerifier,
);

// Submit a verification result
router.post<IncidentParams>(
  "/:id/verification",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  verificationController.submitVerification,
);

// Confirm a verification result (agency authority checked in service)
router.patch<IncidentParams>(
  "/:id/verification/confirm",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  verificationController.confirmVerification,
);

// Retry verification with a new or same volunteer (agency authority checked in service)
router.patch<IncidentParams>(
  "/:id/verification/retry",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  verificationController.retryVerification,
);

// Get all verifications for an incident (scoped in service)
router.get<IncidentParams>(
  "/:id/verifications",
  requireRoles("SUPERADMIN", "ADMIN", "VOLUNTEER"),
  verificationController.getVerifications,
);

// ADMIN / AGENCY routes
// Get all reported incidents by all civilians
router.get(
  "/",
  requireRoles("SUPERADMIN", "ADMIN", "VOLUNTEER"),
  incidentController.listIncidents,
);

// Update an incident status
router.patch<IncidentParams>(
  "/:id/status",
  requireRoles("VOLUNTEER", "SUPERADMIN"),
  incidentController.updateIncidentStatus,
);

export default router;
