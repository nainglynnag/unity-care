import { Router } from "express";
import * as accountController from "../controllers/account.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();
router.use(authenticate);

// PATCH /account/profile — update name / profileImageUrl
router.patch("/profile", accountController.updateProfile);

// PATCH /account/password — self-service password change
router.patch("/password", accountController.updatePassword);

// DELETE /account — soft delete own account
router.delete("/", accountController.softDeleteAccount);

export default router;
