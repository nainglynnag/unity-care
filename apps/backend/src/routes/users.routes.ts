import { Router } from "express";
import * as accountController from "../controllers/account.controller";
import type { UserIdParams } from "../controllers/account.controller";
import { authenticate, requireRoles } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate, requireRoles("SUPERADMIN"));

// GET    /users — paginated list of all users
router.get("/", accountController.listUsers);

// PATCH  /users/:id/password/reset — privileged password override
router.patch<UserIdParams>(
  "/:id/password/reset",
  accountController.resetPassword,
);

// PATCH  /users/:id/status — activate / deactivate
router.patch<UserIdParams>(
  "/:id/status",
  accountController.updateAccountStatus,
);

// DELETE /users/:id — permanent hard delete
router.delete<UserIdParams>("/:id", accountController.hardDeleteAccount);

export default router;
