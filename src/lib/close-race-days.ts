import "server-only";

import { prisma } from "@/lib/prisma";

export async function closeDueRaceDays(now = new Date()) {
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
}
