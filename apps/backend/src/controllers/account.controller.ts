import { type NextFunction, type Request, type Response } from "express";
import * as accountService from "../services/account.service";
import {
  updateProfileSchema,
  updatePasswordSchema,
  signOutSchema,
  resetPasswordSchema,
  updateAccountStatusSchema,
  listUsersQuerySchema,
} from "../validators/account.validator";
import { successResponse, paginatedResponse } from "../utils/response";

// Self-service (authenticated user)

// GET /auth/me
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await accountService.getMe(req.user!.sub);
    return successResponse(res, user);
  } catch (error) {
    next(error);
  }
}

// PATCH /account/profile
export async function updateProfile(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await accountService.updateProfile(req.user!.sub, data);
    return successResponse(res, user);
  } catch (error) {
    next(error);
  }
}

// PATCH /account/password
export async function updatePassword(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updatePasswordSchema.parse(req.body);
    await accountService.updatePassword(req.user!.sub, data);
    return successResponse(res, { message: "Password updated successfully." });
  } catch (error) {
    next(error);
  }
}

// POST /auth/signout
export async function signOut(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = signOutSchema.parse(req.body);
    const result = await accountService.signOut(req.user!.sub, refreshToken);
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// POST /auth/signout-all
export async function signOutAll(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const result = await accountService.signOutAll(req.user!.sub);
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// DELETE /account
export async function softDeleteAccount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await accountService.softDeleteAccount(req.user!.sub);
    return successResponse(res, { message: "Account deleted." });
  } catch (error) {
    next(error);
  }
}

// SUPERADMIN Management───

export interface UserIdParams {
  id: string;
}

// GET /users
export async function listUsers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const query = listUsersQuerySchema.parse(req.query);
    const { data, pagination, links } = await accountService.listUsers(query);
    return paginatedResponse(res, data, pagination, links);
  } catch (error) {
    next(error);
  }
}

// PATCH /users/:id/password/reset
export async function resetPassword(
  req: Request<UserIdParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = resetPasswordSchema.parse(req.body);
    await accountService.resetPassword(req.user!.sub, req.params.id, data);
    return successResponse(res, { message: "Password reset successfully." });
  } catch (error) {
    next(error);
  }
}

// PATCH /users/:id/status
export async function updateAccountStatus(
  req: Request<UserIdParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = updateAccountStatusSchema.parse(req.body);
    await accountService.updateAccountStatus(
      req.user!.sub,
      req.params.id,
      data,
    );
    return successResponse(res, {
      message: data.isActive ? "Account activated." : "Account deactivated.",
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /users/:id
export async function hardDeleteAccount(
  req: Request<UserIdParams>,
  res: Response,
  next: NextFunction,
) {
  try {
    await accountService.hardDeleteAccount(req.user!.sub, req.params.id);
    return successResponse(res, { message: "Account permanently deleted." });
  } catch (error) {
    next(error);
  }
}
