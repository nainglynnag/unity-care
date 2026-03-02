import { Router } from "express";
import * as accountController from "../controllers/account.controller";
import type { UserIdParams } from "../controllers/account.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";
import { superAdminActionLimiter } from "../middlewares/rateLimit";

const router = Router();
router.use(authenticate, requireRoles("SUPERADMIN"));

// GET    /users — paginated list of all users
router.get("/", accountController.listUsers);

// PATCH  /users/:id/password/reset — 20 per user per 15 minutes
router.patch<UserIdParams>(
  "/:id/password/reset",
  superAdminActionLimiter,
  accountController.resetPassword,
);

// PATCH  /users/:id/status — 20 per user per 15 minutes
router.patch<UserIdParams>(
  "/:id/status",
  superAdminActionLimiter,
  accountController.updateAccountStatus,
);

// DELETE /users/:id — 20 per user per 15 minutes
router.delete<UserIdParams>(
  "/:id",
  superAdminActionLimiter,
  accountController.hardDeleteAccount,
);

export default router;
