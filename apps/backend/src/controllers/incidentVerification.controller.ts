import { type Request, type Response, type NextFunction } from "express";
import * as verificationService from "../services/incidentVerification.service";
import {
  assignVerifierSchema,
  submitVerificationSchema,
  confirmVerificationSchema,
  retryVerificationSchema,
} from "../validators/incidentVerification.validator";
import { successResponse } from "../utils/response";
import type { IncidentParams } from "./incident.controller";

// PATCH /incidents/:id/assign-verifier
export async function assignVerifier(
  req: Request<IncidentParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = assignVerifierSchema.parse(req.body);
    const result = await verificationService.assignVerifier(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
}

// POST /incidents/:id/verification
export async function submitVerification(
  req: Request<IncidentParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = submitVerificationSchema.parse(req.body);
    const result = await verificationService.submitVerification(
      req.params.id,
      req.user!.sub,
      data,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// PATCH /incidents/:id/verification/confirm
export async function confirmVerification(
  req: Request<IncidentParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = confirmVerificationSchema.parse(req.body);
    const result = await verificationService.confirmVerification(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// PATCH /incidents/:id/verification/retry
export async function retryVerification(
  req: Request<IncidentParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = retryVerificationSchema.parse(req.body);
    const result = await verificationService.retryVerification(
      req.params.id,
      req.user!.sub,
      req.user!.role,
      data,
    );
    return successResponse(res, result, 201);
  } catch (error) {
    next(error);
  }
}

// GET /incidents/:id/verifications
export async function getVerifications(
  req: Request<IncidentParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await verificationService.getVerificationsByIncident(
      req.params.id,
      req.user!.sub,
      req.user!.role,
    );
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}
