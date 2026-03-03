import { Router } from "express";
import * as ctrl from "../controllers/category.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

// R — all authenticated roles
router.get("/", ctrl.listCategories);
router.get("/:id", ctrl.getCategory);

// SUPERADMIN + VOLUNTEER (COORDINATOR/DIRECTOR scope enforced in service)
router.post("/", requireRoles("SUPERADMIN", "VOLUNTEER"), ctrl.createCategory);
router.patch(
  "/:id",
  requireRoles("SUPERADMIN", "VOLUNTEER"),
  ctrl.updateCategory,
);

// SUPERADMIN only (blocked in service if any incident uses it)
router.delete("/:id", requireRoles("SUPERADMIN"), ctrl.deleteCategory);

export default router;
