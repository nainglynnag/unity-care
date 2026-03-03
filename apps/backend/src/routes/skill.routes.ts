import { Router } from "express";
import * as ctrl from "../controllers/skill.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

// all authenticated roles
router.get("/", ctrl.listSkills);
router.get("/:id", ctrl.getSkill);

// SUPERADMIN + VOLUNTEER (COORDINATOR/DIRECTOR scope enforced in service)
router.post("/", requireRoles("SUPERADMIN", "VOLUNTEER"), ctrl.createSkill);
router.patch("/:id", requireRoles("SUPERADMIN", "VOLUNTEER"), ctrl.updateSkill);

// SUPERADMIN only (blocked in service if skill is in use)
router.delete("/:id", requireRoles("SUPERADMIN"), ctrl.deleteSkill);

export default router;
