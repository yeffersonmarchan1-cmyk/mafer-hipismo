import "server-only";

import { recordOperationalAlert } from "@/lib/operational-alerts";
import { prisma } from "@/lib/prisma";

export async function closeDueRaceDays(now = new Date()) {
  try {
    const result = await prisma.raceDay.updateMany({
      where: {
        status: "OPEN",
        closesAt: { lte: now },
      },
      data: {
        status: "CLOSED",
        closedAt: now,
      },
    });
    return result.count;
  } catch (error) {
    await recordOperationalAlert({
      source: "cron-close-race-days",
      fingerprint: "cron-close-race-days",
      message: "Falló el proceso que cierra las jornadas vencidas.",
      error,
    });
    console.error("Could not close due race days", {
      error: error instanceof Error ? error.name : "UnknownError",
    });
    throw error;
  }
}
