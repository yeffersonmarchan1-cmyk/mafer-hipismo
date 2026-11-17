"use server";

import { createHmac } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { setSession } from "@/lib/auth";
import { normalizeCedula, normalizePhone } from "@/lib/auth-validation";

export type AuthFormState = {
  error?: string;
};

const passwordMinimumLength = 10;
const passwordMaximumBytes = 72;
const attemptWindowMilliseconds = 15 * 60 * 1000;
const maximumLoginAttempts = 5;
const lockDurationMilliseconds = 15 * 60 * 1000;

function validatePassword(password: string): string | null {
  if (password.length < passwordMinimumLength) {
    return `La contraseña debe tener al menos ${passwordMinimumLength} caracteres.`;
  }
  if (Buffer.byteLength(password, "utf8") > passwordMaximumBytes) {
    return "La contraseña no puede superar 72 bytes.";
  }
  return null;
}

function rateLimitKey(cedula: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Configura AUTH_SECRET con al menos 32 bytes aleatorios.");
  }
  return createHmac("sha256", secret).update(cedula).digest("hex");
}

async function dummyHash(): Promise<string> {
  return bcrypt.hash("MAFER.invalid.login.password.2026", 12);
}

async function recordFailedLogin(keyHash: string): Promise<void> {
  const now = new Date();
  const windowStartedAt = new Date(now.getTime() - attemptWindowMilliseconds);

  await prisma.$transaction(async (transaction) => {
    await transaction.loginRateLimit.updateMany({
      where: { keyHash, windowStartedAt: { lt: windowStartedAt } },
      data: { attempts: 0, windowStartedAt: now, lockedUntil: null },
    });
    await transaction.loginRateLimit.upsert({
      where: { keyHash },
      create: { keyHash, attempts: 1, windowStartedAt: now },
      update: { attempts: { increment: 1 } },
    });

    const current = await transaction.loginRateLimit.findUniqueOrThrow({
      where: { keyHash },
      select: { attempts: true, lockedUntil: true },
    });
    if (current.attempts >= maximumLoginAttempts) {
      await transaction.loginRateLimit.update({
        where: { keyHash },
        data: { lockedUntil: new Date(now.getTime() + lockDurationMilliseconds) },
      });
    }
  });
}

export async function register(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const cedulaInput = formData.get("cedula");
  const fullNameInput = formData.get("fullName");
  const phoneInput = formData.get("whatsappPhone");
  const passwordInput = formData.get("password");
  const cedula =
    typeof cedulaInput === "string" ? normalizeCedula(cedulaInput) : null;
  const fullName =
    typeof fullNameInput === "string" ? fullNameInput.trim().replace(/\s+/g, " ") : "";
  const whatsappPhone =
    typeof phoneInput === "string" ? normalizePhone(phoneInput) : null;
  const password = typeof passwordInput === "string" ? passwordInput : "";

  if (!cedula) return { error: "Ingresa una cédula válida, por ejemplo V-12345678." };
  if (fullName.length < 3 || fullName.length > 100) {
    return { error: "El nombre y apellido deben tener entre 3 y 100 caracteres." };
  }
  if (!whatsappPhone) {
    return { error: "Ingresa un teléfono WhatsApp válido con código de país." };
  }
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  rateLimitKey(cedula);

  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  try {
    user = await prisma.user.create({
      data: { cedula, fullName, whatsappPhone, passwordHash },
      select: { id: true, role: true, authVersion: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "No se pudo crear la cuenta. Verifica los datos o inicia sesión." };
    }
    throw error;
  }

  await setSession(user);
  redirect("/app");
}

export async function login(
  _previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const cedulaInput = formData.get("cedula");
  const passwordInput = formData.get("password");
  const cedula =
    typeof cedulaInput === "string" ? normalizeCedula(cedulaInput) : null;
  const password = typeof passwordInput === "string" ? passwordInput : "";
  if (!cedula || !password || Buffer.byteLength(password, "utf8") > passwordMaximumBytes) {
    return { error: "La cédula o la contraseña no son válidas." };
  }

  const keyHash = rateLimitKey(cedula);
  const now = new Date();
  const limit = await prisma.loginRateLimit.findUnique({
    where: { keyHash },
    select: { lockedUntil: true },
  });
  if (limit?.lockedUntil && limit.lockedUntil > now) {
    return { error: "Demasiados intentos. Espera 15 minutos antes de volver a intentarlo." };
  }

  const user = await prisma.user.findUnique({
    where: { cedula },
    select: {
      id: true,
      role: true,
      authVersion: true,
      isActive: true,
      passwordHash: true,
    },
  });
  const passwordHash = user?.passwordHash ?? (await dummyHash());
  const passwordIsValid = await bcrypt.compare(password, passwordHash);
  if (!user || !user.isActive || !passwordIsValid) {
    await recordFailedLogin(keyHash);
    return { error: "La cédula o la contraseña no son correctas." };
  }

  await prisma.loginRateLimit.deleteMany({ where: { keyHash } });
  await setSession(user);
  redirect(user.role === "ADMIN" ? "/admin" : "/app");
}

export async function logout(): Promise<void> {
  const { cookies } = await import("next/headers");
  (await cookies()).delete("mafer_session");
  redirect("/login");
}
