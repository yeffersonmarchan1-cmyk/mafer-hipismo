"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { deletePaymentProof, uploadPaymentProof } from "@/lib/payment-storage";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/auth-validation";

export type TicketSubmissionState = {
  error?: string;
  success?: string;
};

function decimalFromCents(cents: bigint) {
  const whole = cents / BigInt(100);
  const fraction = (cents % BigInt(100)).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

function rateToScaledInteger(rate: Prisma.Decimal) {
  return BigInt(rate.toFixed(4).replace(".", ""));
}

function isRetryableTransactionError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2034" || error.code === "P2002")
  );
}

export async function submitTicket(
  _previous: TicketSubmissionState,
  formData: FormData,
): Promise<TicketSubmissionState> {
  const user = await requireUser();
  const raceDayId = formData.get("raceDayId");
  const rawSelections = formData.get("selections");
  const sourcePhone = formData.get("sourcePhone");
  const proof = formData.get("proof");

  if (
    typeof raceDayId !== "string" ||
    typeof rawSelections !== "string" ||
    typeof sourcePhone !== "string" ||
    !(proof instanceof File)
  ) {
    return { error: "Completa la jugada, el teléfono de origen y adjunta el comprobante." };
  }
  const phone = normalizePhone(sourcePhone);
  if (!phone) {
    return { error: "Escribe un teléfono de origen válido con código de país." };
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
          leg.some((id) => typeof id !== "string" || id.length > 64),
      )
    ) {
      return { error: "Selecciona al menos un caballo en cada una de las seis válidas." };
    }
    selectionsByLeg = parsed as string[][];
    if (selectionsByLeg.some((leg) => new Set(leg).size !== leg.length)) {
      return { error: "La jugada contiene ejemplares duplicados." };
    }
  } catch {
    return { error: "No se pudo interpretar la combinación seleccionada." };
  }

  const now = new Date();
  const day = await prisma.raceDay.findUnique({
    where: { id: raceDayId },
    select: {
      id: true,
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
    (day.closesAt && day.closesAt <= now)
  ) {
    return { error: "Las apuestas para esta jornada ya están cerradas." };
  }

  const validIds = new Set(day.entries.map((horse) => horse.id));
  const chosenIds = selectionsByLeg.flat();
  if (chosenIds.some((id) => !validIds.has(id))) {
    return { error: "La jugada incluye un caballo retirado o que no pertenece a esta jornada. Actualiza la página." };
  }
  for (let index = 0; index < 6; index += 1) {
    const legIds = new Set(
      day.entries
        .filter((horse) => horse.legNumber === index + 1)
        .map((horse) => horse.id),
    );
    if (selectionsByLeg[index].some((id) => !legIds.has(id))) {
      return { error: `Hay un ejemplar que no corresponde a la válida ${index + 1}.` };
    }
  }

  const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  if (
    !config ||
    !config.paymentBank?.trim() ||
    !config.paymentCedula?.trim() ||
    !config.paymentPhone?.trim() ||
    config.vesPerUsd.lte(0)
  ) {
    return { error: "Administración aún no configuró los datos de Pago Móvil y la tasa del día." };
  }

  let uploaded: Awaited<ReturnType<typeof uploadPaymentProof>>;
  try {
    uploaded = await uploadPaymentProof(proof, user.id);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  const combinations = selectionsByLeg.reduce(
    (total, leg) => total * BigInt(leg.length),
    BigInt(1),
  );
  const amountUsdCents = combinations * BigInt(500);
  const amountVesCents =
    (amountUsdCents * rateToScaledInteger(config.vesPerUsd) + BigInt(5000)) /
    BigInt(10000);
  if (amountUsdCents > BigInt("9999999999999999") || amountVesCents > BigInt("999999999999999999")) {
    try {
      await deletePaymentProof(uploaded.bucket, uploaded.key);
    } catch (cleanupError) {
      throw new Error(
        `El importe de la jugada supera el límite permitido y no se pudo eliminar el archivo temporal: ${cleanupError instanceof Error ? cleanupError.message : "error desconocido"}`,
      );
    }
    return { error: "El importe de esta combinación supera el máximo permitido." };
  }

  const createdAt = new Date();
  let created = false;
  try {
    for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
      try {
        await prisma.$transaction(
          async (transaction) => {
            const currentDay = await transaction.raceDay.findUnique({
              where: { id: raceDayId },
              select: {
                status: true,
                closesAt: true,
                entries: {
                  where: { status: "ACTIVE" },
                  select: { id: true, legNumber: true },
                },
              },
            });
            if (
              !currentDay ||
              currentDay.status !== "OPEN" ||
              (currentDay.closesAt && currentDay.closesAt <= new Date())
            ) {
              throw new Error("Las apuestas se cerraron mientras se preparaba el ticket.");
            }
            const currentIds = new Set(currentDay.entries.map((horse) => horse.id));
            if (chosenIds.some((id) => !currentIds.has(id))) {
              throw new Error("Un caballo fue retirado mientras se preparaba el ticket. Actualiza y revisa tu jugada.");
            }
            for (let index = 0; index < 6; index += 1) {
              const legIds = new Set(
                currentDay.entries
                  .filter((horse) => horse.legNumber === index + 1)
                  .map((horse) => horse.id),
              );
              if (selectionsByLeg[index].some((id) => !legIds.has(id))) {
                throw new Error(`La válida ${index + 1} cambió; actualiza y revisa tu jugada.`);
              }
            }

            const previousTicket = await transaction.ticket.findFirst({
              where: { raceDayId },
              orderBy: { ticketNumber: "desc" },
              select: { ticketNumber: true },
            });
            const ticketNumber = (previousTicket?.ticketNumber ?? 0) + 1;
            await transaction.ticket.create({
              data: {
                ticketNumber,
                raceDayId,
                userId: user.id,
                combinations,
                amountUsd: decimalFromCents(amountUsdCents),
                vesPerUsd: config.vesPerUsd,
                amountVes: decimalFromCents(amountVesCents),
                submittedAt: createdAt,
                selections: {
                  create: selectionsByLeg.flatMap((leg, index) =>
                    leg.map((horseId) => ({
                      legNumber: index + 1,
                      originalHorseId: horseId,
                      currentHorseId: horseId,
                    })),
                  ),
                },
                paymentProof: {
                  create: {
                    storageBucket: uploaded.bucket,
                    storageKey: uploaded.key,
                    contentType: uploaded.contentType,
                    fileSizeBytes: uploaded.fileSizeBytes,
                    sourcePhone: phone,
                    expectedAmountVes: decimalFromCents(amountVesCents),
                  },
                },
              },
            });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        created = true;
      } catch (error) {
        if (isRetryableTransactionError(error) && attempt < 2) continue;
        throw error;
      }
    }
  } catch (error) {
    try {
      await deletePaymentProof(uploaded.bucket, uploaded.key);
    } catch (cleanupError) {
      throw new Error(
        `No se guardó el ticket y falló la limpieza del comprobante temporal: ${cleanupError instanceof Error ? cleanupError.message : "error desconocido"}`,
      );
    }
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  if (!created) {
    await deletePaymentProof(uploaded.bucket, uploaded.key);
    return { error: "No se pudo reservar un número de ticket. Intenta nuevamente." };
  }

  revalidatePath("/app");
  revalidatePath("/app/play");
  revalidatePath("/app/tickets");
  revalidatePath("/admin/payments");
  return {
    success:
      "Ticket enviado para validación. El monto se sumará al pozo cuando administración apruebe el pago.",
  };
}
