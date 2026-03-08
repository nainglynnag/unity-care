import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import {
  InvalidCredentialsError,
  AccountInactiveError,
  DuplicateFieldError,
  UserAlreadyRegisteredError,
  TokenInvalidError,
} from "../utils/errors";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// SHA-256 hash of the raw refresh token.
// Raw token is never persisted. SHA-256 is sufficient (tokens are high-entropy).
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// 7 days in milliseconds — mirrors JWT refresh token expiry
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Registration with email & password
export async function register(data: {
  name: string;
  email: string;
  password: string;
  phone: string;
}) {
  // Explicit email check — keeps the USER_ALREADY_REGISTERED error code
  // that the frontend relies on. P2002 catch below handles the phone race.
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new UserAlreadyRegisteredError();
  }

  const hashedPassword = await bcrypt.hash(data.password, 12);

  try {
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: hashedPassword,
        phone: data.phone,
        roles: {
          create: {
            role: {
              connect: { name: "CIVILIAN" },
            },
          },
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    const role = user.roles[0]?.role.name ?? "CIVILIAN";
    const payload = { sub: user.id, role };
    const rawRefreshToken = generateRefreshToken(payload);

    // Store refresh token so the first session is server-side revocable.
    // lastLoginAt is NOT set — registration is not a login.
    // null lastLoginAt correctly signals "registered but never logged in."
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return {
      accessToken: generateAccessToken(payload),
      refreshToken: rawRefreshToken,
      user: sanitizeUser(user, role),
    };
  } catch (error: any) {
    if (error.code === "P2002") {
      const field = (error.meta?.target as string[])?.includes("phone")
        ? "phone"
        : "email";
      throw new DuplicateFieldError(field);
    }

    throw error;
  }
}

// Login with email & password
export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  // Treat soft-deleted accounts identically to "not found".
  // Same error, same timing — prevents email enumeration and deletion probing.
  if (!user || user.deletedAt !== null) throw new InvalidCredentialsError();

  // isActive checked before bcrypt — inactive accounts fail fast.
  if (!user.isActive) throw new AccountInactiveError();

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) throw new InvalidCredentialsError();

  const role = user.roles[0]?.role.name ?? "CIVILIAN";
  const payload = { sub: user.id, role };
  const rawRefreshToken = generateRefreshToken(payload);
  const now = new Date();

  // Atomic: store refresh token + update lastLoginAt.
  await prisma.$transaction([
    prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawRefreshToken),
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { updatedAt: now },
    }),
  ]);

  const volunteerProfile = await prisma.volunteerProfile.findUnique({
    where: { userId: user.id },
  });
  return {
    accessToken: generateAccessToken(payload),
    refreshToken: rawRefreshToken,
    user: {
      ...sanitizeUser(user, role),
      hasVolunteerProfile: !!volunteerProfile,
    },
  };
}

// Login or register with Google ID token
export async function loginOrRegisterWithGoogle(idToken: string) {
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload?.sub) {
    throw new InvalidCredentialsError();
  }

  const googleId = payload.sub;
  const email = payload.email as string;
  const name = (payload.name ?? email.split("@")[0]) as string;
  const profileImageUrl = payload.picture ?? null;

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId }, { email }] },
    include: { roles: { include: { role: true } } },
  });

  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        ...(profileImageUrl != null && { profileImageUrl }),
        ...(!user.googleId && { googleId }),
      },
    });
    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      include: { roles: { include: { role: true } } },
    });
    if (!updated || !updated.isActive) throw new AccountInactiveError();
    const role = updated.roles[0]?.role.name ?? "CIVILIAN";
    const payloadJwt = { sub: updated.id, role };
    const volunteerProfile = await prisma.volunteerProfile.findUnique({
      where: { userId: updated.id },
    });
    return {
      accessToken: generateAccessToken(payloadJwt),
      refreshToken: generateRefreshToken(payloadJwt),
      user: {
        ...sanitizeUser(updated, role),
        hasVolunteerProfile: !!volunteerProfile,
      },
    };
  }

  const hashedPassword = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      phone: "",
      passwordHash: hashedPassword,
      googleId,
      ...(profileImageUrl != null ? { profileImageUrl } : {}),
      roles: {
        create: {
          role: { connect: { name: "CIVILIAN" } },
        },
      },
    },
  });
  const newRole = "CIVILIAN";
  const payloadJwt = { sub: newUser.id, role: newRole };
  const volunteerProfile = await prisma.volunteerProfile.findUnique({
    where: { userId: newUser.id },
  });
  return {
    accessToken: generateAccessToken(payloadJwt),
    refreshToken: generateRefreshToken(payloadJwt),
    user: {
      ...sanitizeUser(
        {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          profileImageUrl: newUser.profileImageUrl,
          createdAt: newUser.createdAt,
        },
        newRole,
      ),
      hasVolunteerProfile: !!volunteerProfile,
    },
  };
}

// Get current user profile from DB (for GET /auth/me)
export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });

  if (!user) throw new InvalidCredentialsError();
  if (!user.isActive) throw new AccountInactiveError();

  const role = user.roles[0]?.role.name ?? "CIVILIAN";
  const volunteerProfile = await prisma.volunteerProfile.findUnique({
    where: { userId: user.id },
  });
  return {
    ...sanitizeUser(user, role),
    hasVolunteerProfile: !!volunteerProfile,
  };
}

// Refresh Tokens
// Accepts rawRefreshToken for DB validation (single-use rotation).
export async function refreshTokens(userId: string, rawRefreshToken: string) {
  const tokenHash = hashToken(rawRefreshToken);

  return prisma.$transaction(
    async (tx) => {
      // 1. Validate token exists in DB
      const stored = await tx.refreshToken.findUnique({ where: { tokenHash } });

      // All three rejection cases return the same error — no information leak.
      if (!stored || stored.revokedAt !== null || stored.expiresAt < new Date()) {
        throw new TokenInvalidError();
      }

      // 2. Validate user — must be active and not soft-deleted.
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });

      if (!user || user.deletedAt !== null) throw new TokenInvalidError();
      if (!user.isActive) throw new AccountInactiveError();

      const role = user.roles[0]?.role.name ?? "CIVILIAN";
      const payload = { sub: user.id, role };
      const newRawRefreshToken = generateRefreshToken(payload);
      const newTokenHash = hashToken(newRawRefreshToken);

      // 3. Revoke old token (rotation — each refresh token is single-use).
      await tx.refreshToken.update({
        where: { tokenHash },
        data: { revokedAt: new Date() },
      });

      // 4. Issue and store the new refresh token.
      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash: newTokenHash,
          expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
        },
      });

      // 5. Lazy cleanup — delete this user's truly expired tokens only.
      await tx.refreshToken.deleteMany({
        where: {
          userId,
          revokedAt: null,
          expiresAt: { lt: new Date() },
        },
      });

      return {
        accessToken: generateAccessToken(payload),
        refreshToken: newRawRefreshToken,
      };
    },
    {
      maxWait: 10_000,
      timeout: 15_000,
    },
  );
}

// Strips passwordHash — never expose it to the client.
function sanitizeUser(
  user: {
    id: string;
    name: string;
    email: string;
    phone: string;
    profileImageUrl: string | null;
    createdAt: Date;
  },
  role: string,
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    profileImageUrl: user.profileImageUrl,
    role,
    createdAt: user.createdAt,
  };
}
