import { type Request, type Response, type NextFunction } from "express";
import { errorResponse } from "../utils/response";
import { ZodError } from "zod";
import { AppError } from "../utils/appError";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.error("Error:", err);

  if (err instanceof ZodError) {
    return errorResponse(
      res,
      "VALIDATION_ERROR",
      "The request failed validation rules.",
      err.issues.map((e) => ({
        field: e.path.join("."),
        message: e.message,
        location: "body",
      })),
      400,
    );
  }

  if (err instanceof AppError) {
    return errorResponse(
      res,
      err.code,
      err.message,
      err.details || [],
      err.statusCode,
    );
  }

  return errorResponse(
    res,
    err.code || "INTERNAL_SERVER_ERROR",
    err.message || "An unexpected error occurred. Please try again later.",
    [],
    500,
  );
}
