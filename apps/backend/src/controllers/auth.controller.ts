import { type NextFunction, type Request, type Response } from "express";
import * as authService from "../services/auth.service";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  googleAuthSchema,
} from "../validators/auth.validator";
import { successResponse } from "../utils/response";
import { verifyRefreshToken } from "../utils/jwt";
import { TokenInvalidError, UnauthorizedError } from "../utils/errors";

// Register a new user
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const parsedData = registerSchema.parse(req.body);
    const tokens = await authService.register(parsedData);

    return successResponse(res, tokens, 201);
  } catch (error) {
    next(error);
  }
}

// Login
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const parsedData = loginSchema.parse(req.body);
    const tokens = await authService.login(
      parsedData.email,
      parsedData.password,
    );

    return successResponse(res, tokens);
  } catch (error) {
    next(error);
  }
}

// Google: exchange Google ID token for app tokens (login or signup).
export async function googleAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { idToken } = googleAuthSchema.parse(req.body);
    const tokens = await authService.loginOrRegisterWithGoogle(idToken);
    return successResponse(res, tokens);
  } catch (error) {
    next(error);
  }
}

// Accepts a valid refresh token in the request body and issues a new token pair.
export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);

    if (!refreshToken) return next(new TokenInvalidError());

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) return next(new TokenInvalidError());

    const result = await authService.refreshTokens(payload.sub);
    return successResponse(res, result);
  } catch (error) {
    next(error);
  }
}

// Me (current user) — returns full profile from DB so UI can show name, email, profileImageUrl.
// Protected — requires authenticate middleware on the route.
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user?.sub) return next(new UnauthorizedError());
    const profile = await authService.getMe(req.user.sub);
    return successResponse(res, profile);
  } catch (error) {
    next(error);
  }
}
