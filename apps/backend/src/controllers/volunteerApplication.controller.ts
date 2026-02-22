import { type NextFunction, type Request, type Response } from "express";
import * as volunteerApplicationService from "../services/volunteerApplication.service";
import {
  submitApplicationSchema,
  updateApplicationSchema,
} from "../validators/volunteerApplication.validator";
import { successResponse } from "../utils/response";

export interface ApplicationParams extends Record<string, string> {
  id: string;
}

// POST /applications
export async function submitApplication(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = submitApplicationSchema.parse(req.body);
    const result = await volunteerApplicationService.submitApplication(
      req.user!.sub,
      data,
    );
    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
}

// GET /applications/me
export async function getMyApplications(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await volunteerApplicationService.getMyApplications(
      req.user!.sub,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// GET /applications/:id
export async function getApplication(
  req: Request<ApplicationParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await volunteerApplicationService.getApplicationById(
      req.params.id,
      req.user!.sub,
      req.user!.role,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// PATCH /applications/:id
export async function updateApplication(
  req: Request<ApplicationParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateApplicationSchema.parse(req.body);
    const result = await volunteerApplicationService.updateApplication(
      req.params.id,
      req.user!.sub,
      data,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// PATCH /applications/:id/withdraw
export async function withdrawApplication(
  req: Request<ApplicationParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await volunteerApplicationService.withdrawApplication(
      req.params.id,
      req.user!.sub,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}
