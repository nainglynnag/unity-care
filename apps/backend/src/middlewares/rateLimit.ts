import rateLimit, {
  type Options,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import type { Request, Response } from "express";
import { errorResponse } from "../utils/response";

// Key generator for authenticated routes: keyed by userId from JWT payload.
// More accurate than IP because multiple users behind NAT/VPN share one IP.
// Falls back to "unknown" if req.user is somehow missing (defensive — should never happen on routes behind authenticate middleware).
//
// IP-keyed limiters omit keyGenerator entirely so express-rate-limit uses its  built-in default, which normalises IPv6 addresses correctly.
const userKeyGenerator = (req: Request): string => req.user?.sub ?? "unknown";

// Handler
function rateLimitHandler(
  req: Request,
  res: Response,
  _next: unknown,
  options: Pick<Options, "message" | "statusCode">,
) {
  return errorResponse(
    res,
    "RATE_LIMIT_EXCEEDED",
    options.message as string,
    [],
    429,
  );
}

// Helper — shared defaults for all limiters
function createLimiter(options: Partial<Options>): RateLimitRequestHandler {
  return rateLimit({
    standardHeaders: "draft-7", // RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
    legacyHeaders: false, // disable deprecated X-RateLimit-* headers
    handler: rateLimitHandler,
    ...options,
  });
}

// Global fallback
// Applied to ALL routes in app.ts as a broad safety net.
// Catches anything not covered by a specific limiter below.
//
// NOTE: This runs before authenticate, so req.user is not available.
// SUPERADMIN is NOT skipped here because the JWT hasn't been decoded yet.
// 200 req/15 min per IP is generous enough for any role's normal usage.
export const globalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
  message: "Too many requests. Please slow down and try again in 15 minutes.",
});

// Auth: register
// Tightest limit — prevents automated fake account creation.
// 5 per IP per hour. Nobody registers 5 times in an hour legitimately.
export const registerLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5,
  message:
    "Too many registration attempts from this IP. Please try again in 1 hour.",
});

// Auth: login
// Stops credential stuffing and brute force.
// 10 per IP per 15 minutes — generous for fat-fingering, stops automation.
export const loginLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message:
    "Too many login attempts. Please wait 15 minutes before trying again.",
});

// Auth: refresh
// Stops token flood attacks (each refresh hits the DB).
// 30 per IP per 15 minutes — covers normal silent rotation + reconnect bursts.
export const refreshLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: "Too many token refresh attempts. Please wait 15 minutes.",
});

// Auth: signout / signout-all
// Per-user (not per-IP) because authenticate runs before this limiter,
// so req.user is available. Per-IP would incorrectly block multiple users behind the same NAT signing out around the same time.
export const signOutLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: userKeyGenerator,
  message: "Too many sign-out attempts. Please wait 15 minutes.",
});

// Auth: GET /me — per-user limit (60/15min). Added so volunteer layout/sidebar/dashboard and
// syncUserProfile on 401 don't exhaust the global 200/IP limit and cause 429 on auth/me.
export const authMeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: userKeyGenerator,
  message: "Too many profile requests. Please slow down.",
});

// Volunteer profile: GET /me — per-user limit (60/15min). Added so volunteer profile and
// availability checks don't exhaust the global 200/IP limit and cause 429 on volunteer-profiles/me.
export const volunteerProfileMeLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: userKeyGenerator,
  message: "Too many volunteer profile requests. Please slow down.",
});

// Incidents: create
// Per-user (authenticated) — more precise than per-IP.
// 10 per user per hour — a civilian in a genuine disaster might report 2-3.
export const createIncidentLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: userKeyGenerator,
  message:
    "You have reported too many incidents. Please wait before reporting again.",
});

// Incidents: submit verification
// Stops a volunteer submitting bulk fake verifications.
// Per-user. 20 per hour.
export const submitVerificationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: userKeyGenerator,
  message:
    "Too many verification submissions. Please wait before submitting again.",
});

// Applications: submit
// Business rule (one active application) already blocks real abuse at the service layer. This is a secondary defense against scripted submission loops.
// Per-user. 5 per hour.
export const submitApplicationLimiter = createLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: userKeyGenerator,
  message: "Too many application submissions. Please wait before trying again.",
});

// Account: self-service password change
// Requires current password in the body, making it a brute-force vector for an attacker with a stolen access token. Without its own limiter,
// the global 200/15min IP limit would allow ~200 guesses Per-user. Same strictness as login (10 per 15 min).
export const changePasswordLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: userKeyGenerator,
  message:
    "Too many password change attempts. Please wait 15 minutes before trying again.",
});

// SUPERADMIN: destructive actions
// Protects against compromised SUPERADMIN credentials being used for scripted mass account destruction or bulk password resets.
// Per-user. 20 per 15 minutes across all /users/* mutation routes.
export const superAdminActionLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: userKeyGenerator,
  message: "Too many administrative actions. Please wait 15 minutes.",
});

// Dashboard: insight queries
// Dashboard endpoints run multiple DB queries (raw SQL, groupBy, Promise.all).
// Per-user. 30 per 15 minutes — enough for page loads + period switching.
export const dashboardLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  keyGenerator: userKeyGenerator,
  message: "Too many dashboard requests. Please wait before refreshing again.",
});

// Notification polling: GET endpoints hit frequently by frontend.
// A frontend polling unread-count every 15s + list every 30s uses ~90 req/15min.
// Per-user. 120 per 15 minutes — generous headroom for polling.
export const notificationPollLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  keyGenerator: userKeyGenerator,
  message:
    "Too many notification requests. Please reduce your polling frequency.",
});

// Mission tracking: GPS push.
// HTTP-level guard against burst floods from a buggy client.
// The service also enforces 15s per-volunteer-per-mission at the DB level.
// 60 per 15 minutes per user = 4 per minute maximum at HTTP layer.
// A well-behaved client pushes ~1 per 30s = 2 per minute.
export const trackingPushLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: userKeyGenerator,
  message: "Too many GPS updates. Please reduce your update frequency.",
});
