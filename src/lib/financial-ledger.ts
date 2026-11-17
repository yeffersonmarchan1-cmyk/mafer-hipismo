import "server-only";

import type { FinancialLedgerType, Prisma } from "@prisma/client";

type LedgerRaceDay = {
  id: string;
  date: Date;
  venue: string;
};

export async function appendFinancialLedgerEntry(
  transaction: Prisma.TransactionClient,
  input: {
    raceDay: LedgerRaceDay;
    type: FinancialLedgerType;
    amountCents: bigint;
    reference: string;
    description: string;
    actorUserId?: string | null;
    actorName?: string | null;
    ticketId?: string | null;
    ticketNumber?: number | null;
    settlementId?: string | null;
  },
) {
  if (input.amountCents === BigInt(0)) return;
  await transaction.financialLedgerEntry.create({
    data: {
      raceDayId: input.raceDay.id,
      raceDayDate: input.raceDay.date,
      venue: input.raceDay.venue,
      type: input.type,
      amountCents: input.amountCents,
      reference: input.reference,
      description: input.description,
      actorUserId: input.actorUserId ?? null,
      actorName: input.actorName ?? null,
      ticketId: input.ticketId ?? null,
      ticketNumber: input.ticketNumber ?? null,
      settlementId: input.settlementId ?? null,
    },
  });
}
