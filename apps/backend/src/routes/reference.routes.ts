import { Router } from "express";
import * as referenceController from "../controllers/reference.controller";

const agenciesRouter = Router();
agenciesRouter.get("/", referenceController.listAgencies);

const skillsRouter = Router();
skillsRouter.get("/", referenceController.listSkills);

export { agenciesRouter, skillsRouter };
