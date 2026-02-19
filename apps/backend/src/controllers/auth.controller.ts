import { type NextFunction, type Request, type Response } from "express";
import * as authService from "../services/auth.service";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
} from "../validators/auth.validator";
import { successResponse } from "../utils/response";
import { verifyRefreshToken } from "../utils/jwt";
import { TokenInvalidError } from "../utils/errors";

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

// Me (current user)
// Returns the decoded token payload attached by the authenticate middleware.
// Protected — requires authenticate middleware on the route.
export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    return successResponse(res, req.user);
  } catch (error) {
    next(error);
  }
}
