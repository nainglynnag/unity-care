import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma";
import { generateAccessToken, generateRefreshToken } from "../utils/jwt";
import { AppError } from "../utils/appError";

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
    throw new Error("Email has already registerd");
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

    const primaryRole = user.roles[0]?.role.name || "CIVILIAN";

    const payload = {
      sub: user.id,
      role: primaryRole,
    };

    return {
      accessToken: generateAccessToken(payload),
      refreshToken: generateRefreshToken(payload),
    };
  } catch (error: any) {
    if (error.code === "P2002") {
      throw new AppError(
        "DUPLICATE_FIELD",
        "Email or phone number already exists.",
        409,
      );
    }

    throw error;
  }
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { roles: { include: { role: true } } },
  });

  if (!user)
    throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid)
    throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);

  const primaryRole = user.roles[0]?.role.name || "CIVILIAN";

  const payload = {
    sub: user.id,
    role: primaryRole,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
  };
}
