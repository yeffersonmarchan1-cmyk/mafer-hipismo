"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { normalizePhone } from "@/lib/auth-validation";
import { appendFinancialLedgerEntry } from "@/lib/financial-ledger";
import { prisma } from "@/lib/prisma";
import { recordOperationalAlert } from "@/lib/operational-alerts";
import {
  TICKET_MINIMUM_AMOUNT_CENTS,
  TICKET_MINIMUM_AMOUNT_MESSAGE,
  TICKET_PRICE_PER_COMBINATION_CENTS,
} from "@/lib/ticket-pricing";

export type ManualTicketState = {
  error?: string;
  success?: string;
};

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

function decimalFromCents(cents: bigint) {
  return new Prisma.Decimal(cents.toString()).dividedBy(100);
}

function parseSelections(value: FormDataEntryValue | null): string[][] | null {
  if (typeof value !== "string" || value.length > 64_000) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      parsed.length !== 6 ||
      parsed.some(
        (leg) =>
          !Array.isArray(leg) ||
          leg.length === 0 ||
          leg.length > 99 ||
          leg.some((id) => typeof id !== "string" || id.length === 0 || id.length > 64),
      )
    ) {
      return null;
    }
    const selections = parsed as string[][];
    if (selections.some((leg) => new Set(leg).size !== leg.length)) return null;
    return selections;
  } catch {
    return null;
  }
}

export async function createManualTicket(
  _previous: ManualTicketState,
  formData: FormData,
): Promise<ManualTicketState> {
  const admin = await requireAdmin();
  const raceDayId = formData.get("raceDayId");
  const rawName = formData.get("guestName");
  const rawPhone = formData.get("guestPhone");
  const selectionsByLeg = parseSelections(formData.get("selections"));

  if (
    typeof raceDayId !== "string" ||
    raceDayId.length === 0 ||
    raceDayId.length > 64
  ) {
    return { error: "Selecciona una jornada válida." };
  }
  if (
    typeof rawName !== "string" ||
    !rawName.trim() ||
    rawName.trim().length > 120 ||
    /[\u0000-\u001f\u007f]/.test(rawName)
  ) {
    return { error: "Escribe el nombre del jugador (máximo 120 caracteres)." };
  }
  if (!selectionsByLeg) {
    return { error: "Selecciona al menos un caballo en cada una de las seis válidas." };
  }

  const guestName = rawName.trim();
  const phoneInput = typeof rawPhone === "string" ? rawPhone.trim() : "";
  const guestPhone = phoneInput ? normalizePhone(phoneInput) : null;
  if (phoneInput && !guestPhone) {
    return { error: "El teléfono debe ser un número venezolano válido." };
  }

  const combinations = selectionsByLeg.reduce(
    (total, leg) => total * BigInt(leg.length),
    BigInt(1),
  );
  const amountCents = combinations * TICKET_PRICE_PER_COMBINATION_CENTS;
  if (amountCents < TICKET_MINIMUM_AMOUNT_CENTS) {
    return { error: TICKET_MINIMUM_AMOUNT_MESSAGE };
  }
  if (amountCents > BigInt("999999999999999999")) {
    return { error: "El importe de esta combinación supera el máximo permitido." };
  }

  let ticketNumber: number | null = null;
  try {
    for (let attempt = 0; attempt < 3 && ticketNumber === null; attempt += 1) {
      try {
        const result = await prisma.$transaction(
          async (transaction) => {
            const day = await transaction.raceDay.findUnique({
              where: { id: raceDayId },
              select: {
                id: true,
                date: true,
                venue: true,
                status: true,
                closesAt: true,
                entries: {
                  where: { status: "ACTIVE" },
                  select: { id: true, legNumber: true },
                },
              },
            });
            if (
              !day ||
              day.status !== "OPEN" ||
              (day.closesAt && day.closesAt <= new Date())
            ) {
              return { kind: "CLOSED" as const };
            }

            const activeEntries = new Map(
              day.entries.map((entry) => [entry.id, entry.legNumber]),
            );
            for (let index = 0; index < selectionsByLeg.length; index += 1) {
              if (
                selectionsByLeg[index].some(
                  (id) => activeEntries.get(id) !== index + 1,
                )
              ) {
                return { kind: "INVALID_SELECTION" as const };
              }
            }

            const previousTicket = await transaction.ticket.findFirst({
              where: { raceDayId },
              orderBy: { ticketNumber: "desc" },
              select: { ticketNumber: true },
            });
            const nextTicketNumber = (previousTicket?.ticketNumber ?? 0) + 1;
            const now = new Date();
            const ticket = await transaction.ticket.create({
              data: {
                ticketNumber: nextTicketNumber,
                raceDayId,
                guestName,
                guestPhone,
                combinations,
                selectedHorseCount: selectionsByLeg.reduce(
                  (total, leg) => total + leg.length,
                  0,
                ),
                amountVes: decimalFromCents(amountCents),
                status: "APPROVED",
                submittedAt: now,
                reviewedAt: now,
                reviewedById: admin.id,
                selections: {
                  create: selectionsByLeg.flatMap((leg, index) =>
                    leg.map((horseId) => ({
                      legNumber: index + 1,
                      originalHorseId: horseId,
                      currentHorseId: horseId,
                    })),
                  ),
                },
              },
              select: { id: true, ticketNumber: true },
            });
            await appendFinancialLedgerEntry(transaction, {
              raceDay: day,
              type: "TICKET_APPROVED",
              amountCents,
              reference: `ticket-approved:${ticket.id}`,
              description: "Jugada presencial registrada por administración",
              actorUserId: admin.id,
              actorName: admin.fullName,
              ticketId: ticket.id,
              ticketNumber: ticket.ticketNumber,
            });
            return { kind: "CREATED" as const, ticketNumber: ticket.ticketNumber };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );

        if (result.kind === "CLOSED") {
          return { error: "Las apuestas para esta jornada ya están cerradas." };
        }
        if (result.kind === "INVALID_SELECTION") {
          return {
            error: "La jugada incluye un caballo retirado o de otra válida. Actualiza la página.",
          };
        }
        ticketNumber = result.ticketNumber;
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) continue;
        throw error;
      }
    }
  } catch (error) {
    await recordOperationalAlert({
      source: "manual-ticket-creation",
      fingerprint: `manual-ticket-creation:${raceDayId}`,
      message: "Falló el registro administrativo de una jugada presencial.",
      error,
    });
    console.error("Could not create manual ticket", {
      raceDayId,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      error: "No se pudo registrar la jugada. La alerta quedó registrada.",
    };
  }

  if (ticketNumber === null) {
    return { error: "No se pudo reservar un número de ticket. Intenta nuevamente." };
  }

  for (const path of [
    "/admin",
    "/admin/jornadas",
    "/admin/manual-bets",
    "/admin/payments",
    "/admin/ledger",
    "/admin/settlement",
    "/app",
    "/app/play",
    "/app/board",
  ]) {
    revalidatePath(path);
  }
  return {
    success: `Ticket #${ticketNumber} registrado y aprobado para ${guestName}.`,
  };
}
