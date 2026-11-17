"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { normalizePhone } from "@/lib/auth-validation";
import { formatBs } from "@/lib/currency";
import { deletePaymentProof } from "@/lib/payment-storage";
import { prisma } from "@/lib/prisma";

export type AdminActionState = {
  error?: string;
  success?: string;
};

function decimalFromCents(cents: bigint) {
  return new Prisma.Decimal(cents.toString()).dividedBy(100);
}

function toCents(value: Prisma.Decimal) {
  return BigInt(
    value.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toFixed(0),
  );
}

function revalidateOperationalPages() {
  revalidatePath("/admin");
  revalidatePath("/admin/jornadas");
  revalidatePath("/admin/payments");
  revalidatePath("/admin/settlement");
  revalidatePath("/app");
  revalidatePath("/app/play");
  revalidatePath("/app/board");
  revalidatePath("/app/tickets");
}

export async function closeRaceDay(formData: FormData) {
  await requireAdmin();
  const raceDayId = formData.get("raceDayId");
  if (typeof raceDayId !== "string" || !raceDayId) {
    throw new Error("La jornada seleccionada no es válida.");
  }
  const result = await prisma.raceDay.updateMany({
    where: { id: raceDayId, status: "OPEN" },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  if (!result.count) {
    throw new Error("La jornada ya no está abierta o no existe.");
  }
  revalidateOperationalPages();
}

export async function deleteRaceDay(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const raceDayId = formData.get("raceDayId");
  if (typeof raceDayId !== "string" || !raceDayId) {
    return { error: "La jornada seleccionada no es válida." };
  }

  const result = await prisma.$transaction(
    async (transaction) => {
      const day = await transaction.raceDay.findUnique({
        where: { id: raceDayId },
        select: {
          id: true,
          settlement: {
            select: { id: true, totalPoolCents: true, totalPoolVes: true, isCarryover: true },
          },
          rolloverTo: {
            select: { id: true, carryoverAmountVes: true, carryoverCents: true },
          },
          tickets: {
            select: {
              paymentProof: {
                select: { storageBucket: true, storageKey: true },
              },
            },
          },
        },
      });
      if (!day) return "NOT_FOUND" as const;

      if (day.rolloverTo && day.settlement?.isCarryover) {
        const remainingCarryover = Prisma.Decimal.max(
          new Prisma.Decimal(0),
          day.rolloverTo.carryoverAmountVes.minus(day.settlement.totalPoolVes),
        );
        const remainingCarryoverCents =
          day.rolloverTo.carryoverCents - day.settlement.totalPoolCents;
        await transaction.raceDay.update({
          where: { id: day.rolloverTo.id },
          data: {
            rolloverFromId: null,
            carryoverAmountVes: remainingCarryover,
            carryoverCents:
              remainingCarryoverCents > BigInt(0) ? remainingCarryoverCents : BigInt(0),
          },
        });
      }

      const settlementId = day.settlement?.id;
      await transaction.ticketPayout.deleteMany({
        where: {
          OR: [
            { ticket: { raceDayId } },
            ...(settlementId ? [{ settlementId }] : []),
          ],
        },
      });
      await transaction.payout.deleteMany({
        where: {
          OR: [
            { bet: { raceDayId } },
            ...(settlementId ? [{ settlementId }] : []),
          ],
        },
      });
      await transaction.settlement.deleteMany({ where: { raceDayId } });
      await transaction.ticket.deleteMany({ where: { raceDayId } });
      await transaction.bet.deleteMany({ where: { raceDayId } });
      await transaction.winningSelection.deleteMany({ where: { raceDayId } });
      await transaction.horseReplacement.deleteMany({
        where: {
          OR: [
            { fromHorse: { raceDayId } },
            { toHorse: { raceDayId } },
          ],
        },
      });
      await transaction.raceDayHorse.deleteMany({ where: { raceDayId } });
      await transaction.raceDay.delete({ where: { id: raceDayId } });

      return {
        kind: "DELETED" as const,
        proofs: day.tickets.flatMap((ticket) => {
          const proof = ticket.paymentProof;
          return proof?.storageBucket && proof.storageKey
            ? [{ bucket: proof.storageBucket, key: proof.storageKey }]
            : [];
        }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (result === "NOT_FOUND") return { error: "No se encontró la jornada." };

  const failedProofDeletes: string[] = [];
  for (const proof of result.proofs) {
    try {
      await deletePaymentProof(proof.bucket, proof.key);
    } catch (error) {
      console.error("Could not delete payment proof for deleted race day:", error);
      failedProofDeletes.push(proof.key);
    }
  }

  revalidateOperationalPages();
  if (failedProofDeletes.length) {
    return {
      error: "La jornada y sus registros fueron eliminados, pero no se pudieron borrar uno o más comprobantes de Supabase Storage. Revisa los registros del servidor.",
    };
  }
  return { success: "Jornada eliminada correctamente." };
}

export async function reviewTicket(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const ticketId = formData.get("ticketId");
  const decision = formData.get("decision");
  const reason = String(formData.get("rejectionReason") ?? "").trim();
  if (
    typeof ticketId !== "string" ||
    !ticketId ||
    (decision !== "APPROVED" && decision !== "REJECTED")
  ) {
    return { error: "La solicitud de revisión no es válida." };
  }
  if (decision === "REJECTED" && reason.length > 500) {
    return { error: "El motivo de rechazo no puede exceder 500 caracteres." };
  }

  const result = await prisma.$transaction(async (transaction) => {
    const ticket = await transaction.ticket.findUnique({
      where: { id: ticketId },
      select: {
        status: true,
        raceDay: { select: { status: true, settlement: { select: { id: true } } } },
      },
    });
    if (!ticket || ticket.status !== "PENDING") return "REVIEWED" as const;
    if (ticket.raceDay.status === "SETTLED" || ticket.raceDay.settlement) {
      return "SETTLED" as const;
    }

    await transaction.ticket.update({
      where: { id: ticketId },
      data: {
        status: decision,
        rejectionReason: decision === "REJECTED" && reason ? reason : null,
        reviewedAt: new Date(),
        reviewedById: admin.id,
      },
    });
    return "UPDATED" as const;
  });

  if (result === "REVIEWED") {
    return { error: "Este ticket ya fue revisado." };
  }
  if (result === "SETTLED") {
    return { error: "No se puede modificar un ticket de una jornada ya liquidada." };
  }
  revalidateOperationalPages();
  return {
    success:
      decision === "APPROVED"
        ? "Pago aprobado. El importe ya forma parte del pozo."
        : "Ticket rechazado.",
  };
}

export async function saveSystemConfig(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const paymentBank = String(formData.get("paymentBank") ?? "").trim();
  const paymentCedula = String(formData.get("paymentCedula") ?? "").trim();
  const rawPhone = String(formData.get("paymentPhone") ?? "").trim();
  const infoMessage = String(formData.get("infoMessage") ?? "").trim();
  const paymentPhone = normalizePhone(rawPhone);

  if (!paymentBank || paymentBank.length > 100) {
    return { error: "Indica el banco de Pago Móvil (máximo 100 caracteres)." };
  }
  if (!paymentCedula || paymentCedula.length > 24) {
    return { error: "Indica una cédula o RIF válido para recibir pagos." };
  }
  if (!paymentPhone) {
    return { error: "Indica un teléfono venezolano de Pago Móvil, por ejemplo 0412 123 4567." };
  }
  if (infoMessage.length > 1000) {
    return { error: "El mensaje no puede exceder 1000 caracteres." };
  }

  await prisma.systemConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      paymentBank,
      paymentCedula,
      paymentPhone,
      infoMessage: infoMessage || null,
    },
    update: {
      paymentBank,
      paymentCedula,
      paymentPhone,
      infoMessage: infoMessage || null,
    },
  });
  revalidateOperationalPages();
  return { success: "Configuración de Pago Móvil guardada." };
}

export async function setUserActive(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const userId = formData.get("userId");
  const activeValue = formData.get("active");
  if (
    typeof userId !== "string" ||
    !userId ||
    (activeValue !== "true" && activeValue !== "false")
  ) {
    return { error: "La solicitud para cambiar el acceso no es válida." };
  }
  const isActive = activeValue === "true";
  if (!isActive && userId === admin.id) {
    return { error: "No puedes desactivar tu propia cuenta de administrador." };
  }

  const result = await prisma.$transaction(
    async (transaction) => {
      const target = await transaction.user.findUnique({
        where: { id: userId },
        select: { role: true, isActive: true },
      });
      if (!target) return "NOT_FOUND" as const;
      if (!isActive && target.role === "ADMIN" && target.isActive) {
        const activeAdmins = await transaction.user.count({
          where: { role: "ADMIN", isActive: true },
        });
        if (activeAdmins <= 1) return "LAST_ADMIN" as const;
      }
      await transaction.user.update({
        where: { id: userId },
        data: { isActive, authVersion: { increment: 1 } },
      });
      return "UPDATED" as const;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (result === "NOT_FOUND") return { error: "No se encontró el usuario." };
  if (result === "LAST_ADMIN") {
    return { error: "Debe permanecer al menos una cuenta de administrador activa." };
  }
  revalidatePath("/admin/users");
  return {
    success: isActive
      ? "Cuenta activada. El usuario puede iniciar sesión nuevamente."
      : "Cuenta desactivada y sesiones existentes invalidadas.",
  };
}

export async function resetUserPassword(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const userId = formData.get("userId");
  const password = formData.get("password");
  const confirmation = formData.get("confirmPassword");
  if (
    typeof userId !== "string" ||
    !userId ||
    typeof password !== "string" ||
    typeof confirmation !== "string"
  ) {
    return { error: "La solicitud para restablecer la contraseña no es válida." };
  }
  if (password !== confirmation) {
    return { error: "Las contraseñas no coinciden." };
  }
  const passwordBytes = Buffer.byteLength(password, "utf8");
  if (passwordBytes < 10 || passwordBytes > 72) {
    return { error: "La contraseña debe tener entre 10 y 72 bytes UTF-8." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await prisma.user.updateMany({
    where: { id: userId },
    data: { passwordHash, authVersion: { increment: 1 } },
  });
  if (!result.count) return { error: "No se encontró el usuario." };
  revalidatePath("/admin/users");
  return {
    success: "Contraseña actualizada. Las sesiones anteriores quedaron invalidadas.",
  };
}

export async function settleRaceDay(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const raceDayId = formData.get("raceDayId");
  const winnerIds = Array.from({ length: 6 }, (_, index) =>
    String(formData.get(`winner-${index + 1}`) ?? ""),
  );
  if (
    typeof raceDayId !== "string" ||
    !raceDayId ||
    winnerIds.some((id) => !id) ||
    new Set(winnerIds).size !== 6
  ) {
    return { error: "Selecciona un caballo ganador distinto para cada una de las seis válidas." };
  }

  const result = await prisma.$transaction(async (transaction) => {
    const day = await transaction.raceDay.findUnique({
      where: { id: raceDayId },
      include: {
        entries: { select: { id: true, legNumber: true, saddlecloth: true, status: true } },
        settlement: { select: { id: true } },
      },
    });
    if (!day || day.status !== "CLOSED" || day.settlement) {
      return { kind: "NOT_SETTLEABLE" as const };
    }
    for (let index = 0; index < 6; index += 1) {
      const horse = day.entries.find(
        (entry) =>
          entry.id === winnerIds[index] &&
          entry.legNumber === index + 1 &&
          entry.status === "ACTIVE",
      );
      if (!horse) return { kind: "INVALID_WINNER" as const, leg: index + 1 };
    }

    const approved = await transaction.ticket.findMany({
      where: { raceDayId, status: "APPROVED" },
      select: {
        id: true,
        amountVes: true,
        selections: { select: { legNumber: true, currentHorseId: true } },
      },
    });
    const approvedCents = approved.reduce(
      (total, ticket) => total + toCents(ticket.amountVes),
      BigInt(0),
    );
    const totalPoolCents = approvedCents + toCents(day.carryoverAmountVes);
    const maximumPoolCents = BigInt("999999999999999999");
    if (totalPoolCents > maximumPoolCents) {
      return { kind: "POOL_TOO_LARGE" as const };
    }

    const winningTickets = approved.filter((ticket) =>
      winnerIds.every((horseId, index) =>
        ticket.selections.some(
          (selection) =>
            selection.legNumber === index + 1 &&
            selection.currentHorseId === horseId,
        ),
      ),
    );
    const winnerCount = winningTickets.length;
    const commissionCents =
      winnerCount === 0 ? BigInt(0) : totalPoolCents / BigInt(10);
    const distributableCents =
      winnerCount === 0 ? BigInt(0) : totalPoolCents - commissionCents;
    const payoutEachCents =
      winnerCount === 0
        ? BigInt(0)
        : distributableCents / BigInt(winnerCount);
    const remainderCents =
      winnerCount === 0
        ? BigInt(0)
        : distributableCents % BigInt(winnerCount);
    if (payoutEachCents > maximumPoolCents) {
      return { kind: "POOL_TOO_LARGE" as const };
    }

    let rolloverDay:
      | {
          id: string;
          carryoverAmountVes: Prisma.Decimal;
          rolloverFromId: string | null;
          carryoverCents: bigint;
        }
      | null = null;
    let createRolloverDate: Date | null = null;
    if (winnerCount === 0) {
      const nextDate = new Date(day.date);
      nextDate.setUTCDate(nextDate.getUTCDate() + 7);
      rolloverDay = await transaction.raceDay.findFirst({
        where: { date: { gt: day.date }, status: "OPEN", venue: day.venue },
        orderBy: { date: "asc" },
        select: {
          id: true,
          carryoverAmountVes: true,
          rolloverFromId: true,
          carryoverCents: true,
        },
      });
      if (rolloverDay) {
        const newCarryoverCents =
          toCents(rolloverDay.carryoverAmountVes) + totalPoolCents;
        if (newCarryoverCents > maximumPoolCents) {
          return { kind: "POOL_TOO_LARGE" as const };
        }
      } else {
        createRolloverDate = nextDate;
      }
    }

    const settlement = await transaction.settlement.create({
      data: {
        raceDayId,
        totalPoolCents,
        commissionCents,
        distributableCents,
        payoutEachCents,
        remainderCents,
        winnerCount,
        totalPoolVes: decimalFromCents(totalPoolCents),
        commissionVes: decimalFromCents(commissionCents),
        distributableVes: decimalFromCents(distributableCents),
        isCarryover: winnerCount === 0,
      },
    });

    await transaction.winningSelection.createMany({
      data: winnerIds.map((horseId, index) => ({
        raceDayId,
        legNumber: index + 1,
        horse: day.entries.find((entry) => entry.id === horseId)!.saddlecloth,
      })),
    });
    if (winnerCount > 0) {
      await transaction.ticketPayout.createMany({
        data: winningTickets.map((ticket) => ({
          settlementId: settlement.id,
          ticketId: ticket.id,
          amountVes: decimalFromCents(payoutEachCents),
        })),
      });
    } else {
      const targetDay =
        rolloverDay ??
        (await transaction.raceDay.upsert({
          where: {
            date_venue: {
              date: createRolloverDate!,
              venue: day.venue,
            },
          },
          create: {
            date: createRolloverDate!,
            venue: day.venue,
            rolloverFromId: day.id,
            carryoverAmountVes: decimalFromCents(totalPoolCents),
            carryoverCents: totalPoolCents,
          },
          update: {},
          select: {
            id: true,
            carryoverAmountVes: true,
            rolloverFromId: true,
            carryoverCents: true,
          },
        }));
      if (rolloverDay) {
        const newCarryoverCents =
          toCents(targetDay.carryoverAmountVes) + totalPoolCents;
        await transaction.raceDay.update({
          where: { id: targetDay.id },
          data: {
            carryoverAmountVes: { increment: decimalFromCents(totalPoolCents) },
            carryoverCents: newCarryoverCents,
            ...(targetDay.rolloverFromId ? {} : { rolloverFromId: day.id }),
          },
        });
      } else if (targetDay.rolloverFromId !== day.id) {
        await transaction.raceDay.update({
          where: { id: targetDay.id },
          data: { rolloverFromId: day.id },
        });
      }
    }

    await transaction.raceDay.update({
      where: { id: raceDayId },
      data: { status: "SETTLED" },
    });
    return {
      kind: "SETTLED" as const,
      winnerCount,
      totalPoolCents,
      commissionCents,
      distributableCents,
      payoutEachCents,
    };
  });

  if (result.kind === "NOT_SETTLEABLE") {
    return { error: "La jornada debe estar cerrada y sin liquidación previa." };
  }
  if (result.kind === "INVALID_WINNER") {
    return { error: `El caballo seleccionado para la válida ${result.leg} no está activo en esta jornada.` };
  }
  if (result.kind === "POOL_TOO_LARGE") {
    return { error: "El pozo excede el límite contable configurado. No se realizó la liquidación." };
  }

  revalidateOperationalPages();
  return result.winnerCount === 0
    ? {
        success: `Jornada desierta. El pozo de ${formatBs(decimalFromCents(result.totalPoolCents).toFixed(2))} pasó a la siguiente jornada.`,
      }
    : {
        success: `Liquidación completada: ${result.winnerCount} cuadro(s), ${formatBs(decimalFromCents(result.payoutEachCents).toFixed(2))} por ticket ganador y comisión de ${formatBs(decimalFromCents(result.commissionCents).toFixed(2))}.`,
      };
}
