import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSessionToken,
  verifySessionToken,
  type SessionRole,
} from "@/lib/session-token";

export const SESSION_COOKIE = "mafer_session";
const sessionMaxAge = 7 * 24 * 60 * 60;

export async function setSession(user: {
  id: string;
  role: SessionRole;
  authVersion: number;
}): Promise<void> {
  const token = await createSessionToken({
    userId: user.id,
    role: user.role,
    authVersion: user.authVersion,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionMaxAge,
    priority: "high",
  });
}

export async function getCurrentUserFromToken(token: string | undefined) {
  if (!token) return null;

  const claims = await verifySessionToken(token);
  if (!claims) return null;

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    select: {
      id: true,
      cedula: true,
      fullName: true,
      whatsappPhone: true,
      role: true,
      isActive: true,
      authVersion: true,
    },
  });

  if (
    !user ||
    !user.isActive ||
    user.authVersion !== claims.authVersion ||
    user.role !== claims.role
  ) {
    return null;
  }

  return user;
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getCurrentUserFromToken(token);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/app");
  return user;
}
