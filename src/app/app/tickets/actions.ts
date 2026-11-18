"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type TicketEditState = {
  error?: string;
  success?: string;
};

class TicketEditError extends Error {}

export async function saveTicketEdits(
  _previous: TicketEditState,
  formData: FormData,
): Promise<TicketEditState> {
  const user = await requireUser();
  const ticketId = formData.get("ticketId");
  const rawSelections = formData.get("selections");
  if (
    typeof ticketId !== "string" ||
    !ticketId ||
    ticketId.length > 64 ||
    typeof rawSelections !== "string" ||
    rawSelections.length > 100_000
  ) {
    return { error: "No se recibieron datos válidos para editar el ticket." };
  }

  let selectionsByLeg: string[][];
  try {
    const parsed: unknown = JSON.parse(rawSelections);
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
      return { error: "Selecciona al menos un caballo en cada una de las seis válidas." };
    }
    selectionsByLeg = parsed as string[][];
  } catch {
    return { error: "No se pudo interpretar la combinación seleccionada." };
  }

  const selectedIds = selectionsByLeg.flat();
  if (new Set(selectedIds).size !== selectedIds.length) {
    return { error: "La jugada contiene ejemplares duplicados." };
  }

  try {
    await prisma.$transaction(
      async (transaction) => {
        const ticket = await transaction.ticket.findFirst({
          where: { id: ticketId, userId: user.id },
          select: {
            id: true,
            combinations: true,
            amountVes: true,
            selectedHorseCount: true,
            selections: {
              orderBy: { id: "asc" },
              select: { id: true, legNumber: true },
            },
            raceDay: {
              select: {
                status: true,
                closesAt: true,
                entries: {
                  where: { status: "ACTIVE" },
                  select: { id: true, legNumber: true },
                },
              },
            },
          },
        });
        if (!ticket) {
          throw new TicketEditError("No se encontró el ticket o no tienes permiso para editarlo.");
        }
        if (
          ticket.raceDay.status !== "OPEN" ||
          (ticket.raceDay.closesAt && ticket.raceDay.closesAt <= new Date())
        ) {
          throw new TicketEditError("La jornada ya cerró; este ticket no se puede editar.");
        }
        if (
          selectedIds.length !== ticket.selectedHorseCount ||
          ticket.selections.length !== ticket.selectedHorseCount
        ) {
          throw new TicketEditError(
            `Debes mantener exactamente ${ticket.selectedHorseCount} ejemplares seleccionados.`,
          );
        }

        const originalCounts = Array.from({ length: 6 }, (_, index) =>
          ticket.selections.filter(
            (selection) => selection.legNumber === index + 1,
          ).length,
        );
        for (let index = 0; index < selectionsByLeg.length; index += 1) {
          if (selectionsByLeg[index].length !== originalCounts[index]) {
            throw new TicketEditError(
              `Debes mantener exactamente ${originalCounts[index]} ejemplares en la válida ${index + 1}.`,
            );
          }
        }

        const activeHorsesById = new Map(
          ticket.raceDay.entries.map((horse) => [horse.id, horse.legNumber]),
        );
        for (let index = 0; index < selectionsByLeg.length; index += 1) {
          if (
            selectionsByLeg[index].some(
              (horseId) => activeHorsesById.get(horseId) !== index + 1,
            )
          ) {
            throw new TicketEditError(
              `La válida ${index + 1} incluye un ejemplar retirado o que no corresponde a esa válida.`,
            );
          }
        }

        const combinations = selectionsByLeg.reduce(
          (total, leg) => total * BigInt(leg.length),
          BigInt(1),
        );
        const editAmountCents = combinations * BigInt(500);
        const paidAmountCents = BigInt(
          ticket.amountVes.mul(100).toDecimalPlaces(0).toFixed(0),
        );
        if (editAmountCents > paidAmountCents) {
          throw new TicketEditError(
            "El costo de la nueva jugada supera el monto pagado originalmente.",
          );
        }

        const nextSelections = selectionsByLeg.flatMap((leg, index) =>
          leg.map((horseId) => ({ legNumber: index + 1, horseId })),
        );
        for (const [index, selection] of ticket.selections.entries()) {
          await transaction.ticketSelection.update({
            where: { id: selection.id },
            data: {
              legNumber: nextSelections[index].legNumber,
              currentHorseId: nextSelections[index].horseId,
            },
          });
        }
        await transaction.ticket.update({
          where: { id: ticket.id },
          data: { combinations },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof TicketEditError) return { error: error.message };
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return { error: "La jornada cambió mientras editabas. Actualiza la página e intenta de nuevo." };
    }
    throw error;
  }

  revalidatePath("/app/tickets");
  revalidatePath("/app/board");
  revalidatePath("/admin");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/settlement");
  return { success: "Los cambios de tu jugada se guardaron correctamente." };
}
