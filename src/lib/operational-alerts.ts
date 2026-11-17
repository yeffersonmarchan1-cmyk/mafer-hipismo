import "server-only";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

function safeErrorMetadata(error: unknown) {
  if (!(error instanceof Error)) return JSON.stringify({ errorName: "UnknownError" });
  const code =
    "code" in error && typeof error.code === "string" ? error.code : undefined;
  return JSON.stringify({
    errorName: error.name.slice(0, 100),
    ...(code ? { code: code.slice(0, 40) } : {}),
  });
}

export async function recordOperationalAlert(input: {
  source: string;
  fingerprint: string;
  message: string;
  severity?: "WARNING" | "ERROR";
  error?: unknown;
}) {
  const fingerprint = createHash("sha256")
    .update(input.fingerprint)
    .digest("hex");
  const now = new Date();
  try {
    await prisma.operationalAlert.upsert({
      where: { fingerprint },
      create: {
        fingerprint,
        source: input.source,
        severity: input.severity ?? "ERROR",
        message: input.message,
        metadataJson: input.error ? safeErrorMetadata(input.error) : null,
        firstSeenAt: now,
        lastSeenAt: now,
      },
      update: {
        severity: input.severity ?? "ERROR",
        message: input.message,
        metadataJson: input.error ? safeErrorMetadata(input.error) : null,
        occurrenceCount: { increment: 1 },
        lastSeenAt: now,
        acknowledgedAt: null,
        acknowledgedById: null,
      },
    });
  } catch (alertError) {
    console.error("Could not persist operational alert", {
      source: input.source,
      error:
        alertError instanceof Error ? alertError.name : "UnknownError",
    });
  }
}
