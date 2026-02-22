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
  constructor() {
    super("FORBIDDEN", "Access Denied.", 403);
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

// Volunteer Application
export class AgencyNotFoundError extends AppError {
  constructor() {
    super("AGENCY_NOT_FOUND", "The selected agency could not be found.", 404);
  }
}

export class ApplicationAlreadyActiveError extends AppError {
  constructor(agencyName: string) {
    super(
      "APPLICATION_ALREADY_ACTIVE",
      `You already have an active application with ${agencyName}.`,
      409,
    );
  }
}

export class ApplicationNotFoundError extends AppError {
  constructor() {
    super(
      "APPLICATION_NOT_FOUND",
      "The requested application could not be found.",
      404,
    );
  }
}

export class ApplicationNotEditableError extends AppError {
  constructor() {
    super(
      "APPLICATION_NOT_EDITABLE",
      "This application can no longer be edited.",
      400,
    );
  }
}

export class CannotWithdrawError extends AppError {
  constructor() {
    super(
      "CANNOT_WITHDRAW_AFTER_REVIEW",
      "Applications cannot be withdrawn now. Contact the agency directly for your application.",
      400,
    );
  }
}

// Volunteer Profile
export class InvalidSkillIdsError extends AppError {
  constructor(unknownIds: string[]) {
    super(
      "INVALID_SKILL_IDS",
      "One or more skill IDs are invalid.",
      400,
      unknownIds.map((id) => ({
        field: "skillIds",
        value: id,
        message: "Skill not found.",
      })),
    );
  }
}

export class ProfileNotFoundError extends AppError {
  constructor() {
    super("PROFILE_NOT_FOUND", "Volunteer profile not found.", 404);
  }
}

export class NotAnApprovedVolunteerError extends AppError {
  constructor() {
    super(
      "NOT_AN_APPROVED_VOLUNTEER",
      "You must be an approved volunteer to perform this action.",
      403,
    );
  }
}
