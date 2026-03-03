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

export class ApplicationNotReviewableError extends AppError {
  constructor(currentStatus: string) {
    super(
      "APPLICATION_NOT_REVIEWABLE",
      `Application cannot be reviewed from its current status: ${currentStatus}.`,
      400,
    );
  }
}

export class ApplicationNotStartableError extends AppError {
  constructor(currentStatus: string) {
    super(
      "APPLICATION_NOT_STARTABLE",
      `Application cannot be started for review from its current status: ${currentStatus} or another reviewer is already in progress.`,
      400,
    );
  }
}

export class ReviewNotAllowedError extends AppError {
  constructor() {
    super(
      "REVIEW_NOT_ALLOWED",
      "You do not have permission to review applications.",
      403,
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

// Incident
export class IncidentNotFoundError extends AppError {
  constructor() {
    super(
      "INCIDENT_NOT_FOUND",
      "The requested incident could not be found.",
      404,
    );
  }
}

export class CategoryNotFoundError extends AppError {
  constructor() {
    super(
      "CATEGORY_NOT_FOUND",
      "The selected incident category does not exist.",
      404,
    );
  }
}

export class CategoryInactiveError extends AppError {
  constructor() {
    super(
      "CATEGORY_INACTIVE",
      "The selected incident category is no longer active.",
      400,
    );
  }
}

export class InvalidStatusTransitionError extends AppError {
  constructor(current: string, next: string) {
    super(
      "INVALID_STATUS_TRANSITION",
      `Cannot update incident status from ${current} to ${next}.`,
      400,
    );
  }
}

export class AgencyLocationRequiredError extends AppError {
  constructor() {
    super(
      "AGENCY_LOCATION_REQUIRED",
      "Distance sorting requires a reference location. Provide lat and long.",
      400,
    );
  }
}

// Incident Verification
export class IncidentNotAssignableError extends AppError {
  constructor(currentStatus: string) {
    super(
      "INCIDENT_NOT_ASSIGNABLE",
      `Incident cannot be assigned for verification from status: ${currentStatus}.`,
      400,
    );
  }
}

export class IncidentNotRetryableError extends AppError {
  constructor(currentStatus: string) {
    super(
      "INCIDENT_NOT_RETRYABLE",
      `Retry Verification is only allowed when incident is UNREACHABLE. Current status: ${currentStatus}.`,
      400,
    );
  }
}

export class IncidentNotAwaitingVerificationError extends AppError {
  constructor(currentStatus: string) {
    super(
      "INCIDENT_NOT_AWAITING_VERIFICATION",
      `Cannot submit verification: incident status is ${currentStatus}.`,
      400,
    );
  }
}

export class VerificationNotFoundError extends AppError {
  constructor() {
    super(
      "VERIFICATION_NOT_FOUND",
      "No active verification assignment found for this incident.",
      404,
    );
  }
}

export class VerificationAlreadyAssignedError extends AppError {
  constructor() {
    super(
      "VERIFICATION_ALREADY_ASSIGNED",
      "This incident already has an active verification assignment.",
      409,
    );
  }
}

export class VerificationAlreadySubmittedError extends AppError {
  constructor() {
    super(
      "VERIFICATION_ALREADY_SUBMITTED",
      "Verification result has already been submitted for this assignment.",
      400,
    );
  }
}

export class NotAssignedVerifierError extends AppError {
  constructor() {
    super(
      "NOT_ASSIGNED_VERIFIER",
      "You are not the volunteer assigned to verify this incident.",
      403,
    );
  }
}

export class VolunteerNotAvailableError extends AppError {
  constructor() {
    super(
      "VOLUNTEER_NOT_AVAILABLE",
      "The selected volunteer is not currently available for assignment.",
      400,
    );
  }
}

export class VolunteerNotInAgencyError extends AppError {
  constructor() {
    super(
      "VOLUNTEER_NOT_IN_AGENCY",
      "The selected volunteer does not belong to your agency.",
      400,
    );
  }
}

// ── Mission ────────────────────────────────────────────────────────────────

export class MissionNotFoundError extends AppError {
  constructor() {
    super(
      "MISSION_NOT_FOUND",
      "The requested mission could not be found.",
      404,
    );
  }
}

export class IncidentNotVerifiedError extends AppError {
  constructor() {
    super(
      "INCIDENT_NOT_VERIFIED",
      "A mission can only be created from a VERIFIED incident.",
      400,
    );
  }
}

export class LinkedIncidentInvalidError extends AppError {
  constructor(ids: string[]) {
    super(
      "LINKED_INCIDENT_INVALID",
      "One or more linked incidents are not valid for linking.",
      400,
      ids.map((id) => ({
        field: "linkedIncidentIds",
        value: id,
        message:
          "Incident not found, already closed/false, or is the primary incident.",
      })),
    );
  }
}

export class NoLeaderAssignedError extends AppError {
  constructor() {
    super(
      "NO_LEADER_ASSIGNED",
      "Every mission team must have exactly one LEADER.",
      400,
    );
  }
}

export class MultipleLeadersError extends AppError {
  constructor() {
    super(
      "MULTIPLE_LEADERS",
      "A mission can only have one LEADER. Assign additional volunteers as MEMBER.",
      400,
    );
  }
}

export class DuplicateVolunteerAssignmentError extends AppError {
  constructor(volunteerId: string) {
    super(
      "DUPLICATE_VOLUNTEER_ASSIGNMENT",
      `Volunteer ${volunteerId} appears more than once in the assignment list.`,
      400,
    );
  }
}

export class VolunteersNotAvailableError extends AppError {
  constructor(ids: string[]) {
    super(
      "VOLUNTEERS_NOT_AVAILABLE",
      "One or more selected volunteers are not currently available.",
      400,
      ids.map((id) => ({
        field: "volunteers",
        value: id,
        message: "Not available.",
      })),
    );
  }
}

export class VolunteersNotInAgencyError extends AppError {
  constructor(ids: string[]) {
    super(
      "VOLUNTEERS_NOT_IN_AGENCY",
      "One or more selected volunteers do not belong to your agency.",
      400,
      ids.map((id) => ({
        field: "volunteers",
        value: id,
        message: "Not in agency.",
      })),
    );
  }
}

export class InvalidMissionTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(
      "INVALID_MISSION_TRANSITION",
      `Cannot transition mission from ${from} to ${to}.`,
      400,
    );
  }
}

export class MissionNotActionableError extends AppError {
  constructor(action: string, currentStatus: string) {
    super(
      "MISSION_NOT_ACTIONABLE",
      `Cannot perform "${action}" on a mission with status: ${currentStatus}.`,
      400,
    );
  }
}

export class NotMissionLeaderError extends AppError {
  constructor() {
    super(
      "NOT_MISSION_LEADER",
      "Only the mission LEADER can perform this action.",
      403,
    );
  }
}

export class IncidentNotResolvableError extends AppError {
  constructor(reason: string) {
    super("INCIDENT_NOT_RESOLVABLE", reason, 400);
  }
}

// Account Management
export class AccountAlreadyDeletedError extends AppError {
  constructor() {
    super(
      "ACCOUNT_ALREADY_DELETED",
      "This account has already been deleted.",
      400,
    );
  }
}

export class CannotTargetSelfError extends AppError {
  constructor(action: string) {
    super(
      "CANNOT_TARGET_SELF",
      `You cannot perform "${action}" on your own account via this endpoint.`,
      400,
    );
  }
}

export class CannotTargetSuperAdminError extends AppError {
  constructor() {
    super(
      "CANNOT_TARGET_SUPERADMIN",
      "SUPERADMIN accounts cannot be targeted by privileged management operations.",
      403,
    );
  }
}

export class IncorrectPasswordError extends AppError {
  constructor() {
    super(
      "INCORRECT_PASSWORD",
      "The current password you provided is incorrect.",
      400,
    );
  }
}

export class SamePasswordError extends AppError {
  constructor() {
    super(
      "SAME_PASSWORD",
      "New password must be different from your current password.",
      400,
    );
  }
}

export class CannotDeleteVolunteerOnMissionError extends AppError {
  constructor() {
    super(
      "CANNOT_DELETE_VOLUNTEER_ON_MISSION",
      "Your account cannot be deleted while you are assigned to an active mission.",
      400,
    );
  }
}

// Reference Data (Skills / Categories / Agencies)

export class SkillNotFoundError extends AppError {
  constructor() {
    super("SKILL_NOT_FOUND", "The requested skill could not be found.", 404);
  }
}

export class SkillNameConflictError extends AppError {
  constructor() {
    super("SKILL_NAME_CONFLICT", "A skill with this name already exists.", 409);
  }
}

export class CategoryNameConflictError extends AppError {
  constructor() {
    super(
      "CATEGORY_NAME_CONFLICT",
      "A category with this name already exists.",
      409,
    );
  }
}

export class AgencyNameConflictError extends AppError {
  constructor() {
    super(
      "AGENCY_NAME_CONFLICT",
      "An agency with this name already exists.",
      409,
    );
  }
}

export class CannotDeactivateWithActiveDataError extends AppError {
  constructor(entity: "skill" | "category" | "agency") {
    super(
      "CANNOT_DEACTIVATE_WITH_ACTIVE_DATA",
      `This ${entity} cannot be deactivated because it has active records linked to it.`,
      400,
    );
  }
}

export class CannotDeleteWithLinkedDataError extends AppError {
  constructor(entity: "skill" | "category" | "agency") {
    super(
      "CANNOT_DELETE_WITH_LINKED_DATA",
      `This ${entity} cannot be deleted because it has records linked to it. Consider deactivating instead.`,
      400,
    );
  }
}

// Notifications

export class NotificationNotFoundError extends AppError {
  constructor() {
    super("NOTIFICATION_NOT_FOUND", "Notification not found.", 404);
  }
}

// Mission Tracking

export class NotAssignedToMissionError extends AppError {
  constructor() {
    super(
      "NOT_ASSIGNED_TO_MISSION",
      "You are not currently assigned to this mission.",
      403,
    );
  }
}

export class TrackingNotAllowedError extends AppError {
  constructor() {
    super(
      "TRACKING_NOT_ALLOWED",
      "GPS tracking can only be submitted while the mission is EN_ROUTE or ON_SITE.",
      400,
    );
  }
}

export class TrackingRateLimitError extends AppError {
  constructor() {
    super(
      "TRACKING_RATE_LIMIT",
      "GPS update submitted too recently. Please wait at least 15 seconds between updates.",
      429,
    );
  }
}
