import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import * as accountController from "../controllers/account.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.get("/me", authenticate, authController.me);
router.post("/signout", authenticate, accountController.signOut);
router.post("/signout-all", authenticate, accountController.signOutAll);

export default router;
