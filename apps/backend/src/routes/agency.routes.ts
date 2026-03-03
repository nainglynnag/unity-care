import { Router } from "express";
import * as ctrl from "../controllers/agency.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

// all authenticated roles (civilians need this for volunteer application form)
router.get("/", ctrl.listAgencies);
router.get("/:id", ctrl.getAgency);

// SUPERADMIN only
router.post("/", requireRoles("SUPERADMIN"), ctrl.createAgency);

// SUPERADMIN + VOLUNTEER (COORDINATOR/DIRECTOR scope enforced in service)
router.patch(
  "/:id",
  requireRoles("SUPERADMIN", "VOLUNTEER"),
  ctrl.updateAgency,
);

// SUPERADMIN only
router.delete("/:id", requireRoles("SUPERADMIN"), ctrl.deleteAgency);

// Available volunteers for mission assignment
// SUPERADMIN, ADMIN, VOLUNTEER (COORDINATOR/DIRECTOR only — enforced in service)
router.get(
  "/:id/volunteers",
  requireRoles("SUPERADMIN", "ADMIN", "VOLUNTEER"),
  ctrl.listAvailableVolunteers,
);

// Update a member's agency role (MEMBER/COORDINATOR/DIRECTOR)
// SUPERADMIN: any agency.  DIRECTOR: own agency only.
router.patch(
  "/:id/volunteers/:volunteerId/role",
  requireRoles("SUPERADMIN", "VOLUNTEER"),
  ctrl.updateMemberRole,
);

export default router;
