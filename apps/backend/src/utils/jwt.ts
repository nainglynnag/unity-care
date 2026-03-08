import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "default_access_secret";
const REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "default_refresh_secret";

export interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function generateAccessToken(payload: Omit<JwtPayload, "iat" | "exp">) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: "15m" });
}


export function generateRefreshToken(payload: Omit<JwtPayload, "iat" | "exp">) {
  return jwt.sign(
    { ...payload, jti: randomUUID() },
    REFRESH_SECRET,
    { expiresIn: "7d" },
  );
}

export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// Detailed verification result for WebSocket auth.
// Distinguishes expired (4003 close code) from invalid (4001 close code).
export type VerifyResult =
  | { status: "valid"; payload: JwtPayload }
  | { status: "expired" }
  | { status: "invalid" };

export function verifyAccessTokenDetailed(token: string): VerifyResult {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as JwtPayload;
    return { status: "valid", payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return { status: "expired" };
    return { status: "invalid" };
  }
}
