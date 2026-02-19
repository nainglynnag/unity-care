import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import {
  InvalidCredentialsError,
  AccountInactiveError,
  DuplicateFieldError,
  UserAlreadyRegisteredError,
} from "../utils/errors";

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
