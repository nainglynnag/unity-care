import { type NextFunction, type Request, type Response } from "express";
import * as authService from "../services/auth.service";
import { registerSchema, loginSchema } from "../validators/auth.validator";
import { successResponse } from "../utils/response";

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
