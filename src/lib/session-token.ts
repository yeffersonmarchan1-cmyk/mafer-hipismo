import { errors, SignJWT, jwtVerify } from "jose";

export type SessionRole = "USER" | "ADMIN";

export type SessionClaims = {
  userId: string;
  role: SessionRole;
  authVersion: number;
};

const issuer = "mafer-hipismo";
const audience = "mafer-hipismo-app";
const sessionLifetime = "7d";

function signingKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || new TextEncoder().encode(secret).byteLength < 32) {
    throw new Error("AUTH_SECRET debe contener al menos 32 bytes aleatorios.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    userId: claims.userId,
    role: claims.role,
    authVersion: claims.authVersion,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(sessionLifetime)
    .sign(signingKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer,
      audience,
    });
    if (
      typeof payload.userId !== "string" ||
      (payload.role !== "USER" && payload.role !== "ADMIN") ||
      typeof payload.authVersion !== "number" ||
      !Number.isInteger(payload.authVersion)
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: payload.role,
      authVersion: payload.authVersion,
    };
  } catch (error) {
    if (error instanceof errors.JOSEError) return null;
    throw error;
  }
}
