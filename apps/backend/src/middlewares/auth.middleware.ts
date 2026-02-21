import { type Request, type Response, type NextFunction } from "express";
import { verifyAccessToken, type JwtPayload } from "../utils/jwt";
import {
  UnauthorizedError,
  TokenInvalidError,
  ForbiddenError,
} from "../utils/errors";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return next(new UnauthorizedError());

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) return next(new UnauthorizedError());

  const payload = verifyAccessToken(token);

  if (!payload) return next(new TokenInvalidError());

  req.user = payload;
  next();
}

// Role guard middleware
// Usage: router.get("/admin", authenticate, requireRoles("ADMIN"), handler)
// Example: requireRoles("ADMIN", "COORDINATOR") allows either role through.
export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole || !allowedRoles.includes(userRole)) {
      return next(new ForbiddenError());
    }

    next();
  };
}
