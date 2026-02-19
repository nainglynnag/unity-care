import { AppError } from "../utils/appError";

// Auth
export class InvalidCredentialsError extends AppError {
  constructor() {
    super("INVALID_CREDENTIALS", "Invalid email or password.", 401);
  }
}

export class AccountInactiveError extends AppError {
  constructor() {
    super(
      "ACCOUNT_INACTIVE",
      "Your account has been deactivated. Please contact support.",
      403,
    );
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super(
      "TOKEN_EXPIRED",
      "Your session has expired. Please log in again.",
      401,
    );
  }
}

export class TokenInvalidError extends AppError {
  constructor() {
    super("INVALID_TOKEN", "The provided token is invalid.", 401);
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super(
      "UNAUTHORIZED",
      "Authentication is required to access this resource.",
      401,
    );
  }
}

export class ForbiddenError extends AppError {
  constructor(requiredRoles?: string[]) {
    super(
      "FORBIDDEN",
      requiredRoles
        ? `Access restricted to roles: ${requiredRoles.join(", ")}.`
        : "You do not have permission to access this resource.",
      403,
    );
  }
}

// User / Registration
export class DuplicateFieldError extends AppError {
  constructor(field: "email" | "phone" | "email or phone") {
    super(
      "DUPLICATE_FIELD",
      `An account with this ${field} already exists.`,
      409,
    );
  }
}

export class UserNotFoundError extends AppError {
  constructor() {
    super("USER_NOT_FOUND", "The requested user could not be found.", 404);
  }
}

export class UserAlreadyRegisteredError extends AppError {
  constructor() {
    super(
      "USER_ALREADY_REGISTERED",
      "This email has already been registered.",
      409,
    );
  }
}
