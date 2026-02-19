import { Router } from "express";
import * as incidentController from "../controllers/incident.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import type { IncidentParams } from "../controllers/incident.controller";

const router = Router();
router.use(authenticate);

// CIVILIAN routes
// Post an incident by a civilian
router.post("/", requireRoles("CIVILIAN"), incidentController.createIncident);

// Get a reported incident by a civilian
router.get("/me", requireRoles("CIVILIAN"), incidentController.listMyIncidents);

// Get an incident by id
router.get<IncidentParams>("/:id", incidentController.getIncident);

// Close an incident by reporter
router.patch<IncidentParams>(
  "/:id/close",
  requireRoles("CIVILIAN"),
  incidentController.closeIncidentByReporter,
);

// ADMIN / AGENCY routes
// Get all reported incidents by all civilians
router.get(
  "/",
  requireRoles("ADMIN", "VOLUNTEER"),
  incidentController.listIncidents,
);

// Update an incident status
router.patch<IncidentParams>(
  "/:id/status",
  requireRoles("ADMIN"),
  incidentController.updateIncidentStatus,
);

export default router;
