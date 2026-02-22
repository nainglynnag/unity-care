import { type NextFunction, type Request, type Response } from "express";
import * as volunteerProfileService from "../services/volunteerProfile.service";
import {
  updateVolunteerProfileSchema,
  updateAvailabilitySchema,
} from "../validators/volunteerProfile.validator";
import { successResponse } from "../utils/response";

// GET /volunteer-profiles/me
export async function getProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await volunteerProfileService.getVolunteerProfile(
      req.user!.sub,
    );

    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// PATCH /volunteer-profiles
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateVolunteerProfileSchema.parse(req.body);
    const result = await volunteerProfileService.updateVolunteerProfile(
      req.user!.sub,
      data,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// PATCH /volunteer-profiles/availability
export async function updateAvailability(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateAvailabilitySchema.parse(req.body);
    const result = await volunteerProfileService.updateAvailability(
      req.user!.sub,
      data,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}
