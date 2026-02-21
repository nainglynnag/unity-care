import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import {
  InvalidCredentialsError,
  AccountInactiveError,
  DuplicateFieldError,
  UserAlreadyRegisteredError,
} from "../utils/errors";

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Registration with email & password
export async function register(data: {
  name: string;
  email: string;
  password: string;
  phone: string;
}) {
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new UserAlreadyRegisteredError();
  }

  const hashedPassword = await bcrypt.hash(data.password, 10);

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

    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
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

  if (!user) throw new InvalidCredentialsError();
  if (!user.isActive) throw new AccountInactiveError();

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) throw new InvalidCredentialsError();

  const role = user.roles[0]?.role.name ?? "CIVILIAN";

  const payload = { sub: user.id, role };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    user: sanitizeUser(user, role),
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
    return {
      accessToken: generateAccessToken(payloadJwt),
      refreshToken: generateRefreshToken(payloadJwt),
      user: sanitizeUser(updated, role),
    };
  }

  const hashedPassword = await bcrypt.hash(
    randomBytes(32).toString("hex"),
    10,
  );
  const newUser = await prisma.user.create({
    data: {
      name,
      email,
      phone: `g-${googleId}`,
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
  return {
    accessToken: generateAccessToken(payloadJwt),
    refreshToken: generateRefreshToken(payloadJwt),
    user: sanitizeUser(
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
  return sanitizeUser(user, role);
}

// Refresh Tokens
export async function refreshTokens(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  });

  if (!user) throw new InvalidCredentialsError();
  if (!user.isActive) throw new AccountInactiveError();

  const role = user.roles[0]?.role.name ?? "CIVILIAN";
  const payload = { sub: user.id, role };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
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
