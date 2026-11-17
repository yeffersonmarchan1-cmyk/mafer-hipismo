"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  extractLinkText,
  extractPdfText,
  parseInscriptionText,
} from "@/lib/inscriptions";

export type ImportState = {
  error?: string;
  success?: string;
};

function readDate(formData: FormData): Date {
  const value = formData.get("raceDate");
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Selecciona una fecha válida para la jornada.");
  }
  const date = new Date(`${value}T12:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new Error("La fecha de jornada no es válida.");
  }
  return date;
}

function readFirstRaceAt(formData: FormData, raceDate: Date): Date {
  const value = formData.get("firstRaceAt");
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
    value.slice(0, 10) !== raceDate.toISOString().slice(0, 10)
  ) {
    throw new Error("Indica la hora de la primera válida en la fecha de esta jornada.");
  }
  const date = new Date(`${value}:00-04:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("La hora de la primera válida no es válida.");
  }
  return date;
}

class ClosedRaceDayError extends Error {}

export async function importInscriptions(
  _previousState: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireAdmin();
  if (!process.env.DATABASE_URL) {
    return { error: "Configura DATABASE_URL con la conexión PostgreSQL antes de importar." };
  }

  let horses;
  let source: string;
  let date: Date;
  let firstRaceAt: Date;
  try {
    const sourceUrl = formData.get("sourceUrl");
    const file = formData.get("file");
    const pastedText = formData.get("sourceText");
    let text: string;

    if (typeof sourceUrl === "string" && sourceUrl.trim()) {
      const url = new URL(sourceUrl.trim());
      text = await extractLinkText(url.toString());
      source = `Enlace: ${url.hostname}`;
    } else if (file instanceof File && file.size > 0) {
      if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        return { error: "El archivo debe ser un PDF." };
      }
      if (file.size > 10 * 1024 * 1024) {
        return { error: "El PDF supera el límite permitido de 10 MB." };
      }
      text = await extractPdfText(file);
      source = `PDF: ${file.name.slice(0, 120)}`;
    } else if (typeof pastedText === "string" && pastedText.trim()) {
      if (pastedText.length > 1_000_000) {
        return { error: "El texto pegado supera el límite de 1 MB." };
      }
      text = pastedText;
      source = "Texto pegado";
    } else {
      return { error: "Sube un PDF, pega el texto o proporciona un enlace autorizado." };
    }

    horses = parseInscriptionText(text);
    date = readDate(formData);
    firstRaceAt = readFirstRaceAt(formData, date);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.raceDay.findUnique({
        where: { date_venue: { date, venue: "La Rinconada" } },
        select: { id: true, status: true },
      });
      if (existing?.status !== undefined && existing.status !== "OPEN") {
        throw new ClosedRaceDayError(
          "La jornada ya está cerrada y no admite cambios en los inscritos.",
        );
      }

      const raceDay = await transaction.raceDay.upsert({
        where: { date_venue: { date, venue: "La Rinconada" } },
        create: {
          date,
          firstRaceAt,
          closesAt: new Date(firstRaceAt.getTime() - 30 * 60 * 1000),
          inscriptionSource: source,
          inscriptionsUpdatedAt: new Date(),
        },
        update: {
          firstRaceAt,
          closesAt: new Date(firstRaceAt.getTime() - 30 * 60 * 1000),
          inscriptionSource: source,
          inscriptionsUpdatedAt: new Date(),
        },
        select: { id: true },
      });

      for (const horse of horses) {
        await transaction.raceDayHorse.upsert({
          where: {
            raceDayId_legNumber_saddlecloth: {
              raceDayId: raceDay.id,
              legNumber: horse.legNumber,
              saddlecloth: horse.saddlecloth,
            },
          },
          create: { raceDayId: raceDay.id, ...horse },
          update: { name: horse.name, gazetteOrder: horse.gazetteOrder },
        });
      }
    });
  } catch (error) {
    if (error instanceof ClosedRaceDayError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/jornadas");
  return {
    success: `Jornada actualizada con ${horses.length} ejemplares. Los retirados existentes se conservaron.`,
  };
}

export async function addHorse(formData: FormData): Promise<void> {
  await requireAdmin();
  const raceDayId = formData.get("raceDayId");
  const legNumber = Number(formData.get("legNumber"));
  const saddlecloth = Number(formData.get("saddlecloth"));
  const name = String(formData.get("name") ?? "").trim();
  if (
    typeof raceDayId !== "string" ||
    !Number.isInteger(legNumber) ||
    legNumber < 1 ||
    legNumber > 6 ||
    !Number.isInteger(saddlecloth) ||
    saddlecloth < 1 ||
    saddlecloth > 99 ||
    !name ||
    name.length > 120
  ) {
    throw new Error("Revisa la válida, el número de gualdrapa y el nombre del ejemplar.");
  }

  const day = await prisma.raceDay.findUnique({
    where: { id: raceDayId },
    select: { status: true },
  });
  if (!day || day.status !== "OPEN") throw new Error("La jornada no está abierta para cambios.");

  const lastEntry = await prisma.raceDayHorse.findFirst({
    where: { raceDayId, legNumber },
    orderBy: { gazetteOrder: "desc" },
    select: { gazetteOrder: true },
  });
  await prisma.raceDayHorse.create({
    data: {
      raceDayId,
      legNumber,
      saddlecloth,
      name,
      gazetteOrder: (lastEntry?.gazetteOrder ?? 0) + 1,
    },
  });
  revalidatePath("/admin/jornadas");
}

export async function updateHorse(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get("id");
  const name = String(formData.get("name") ?? "").trim();
  const saddlecloth = Number(formData.get("saddlecloth"));
  if (
    typeof id !== "string" ||
    !id ||
    !name ||
    name.length > 120 ||
    !Number.isInteger(saddlecloth) ||
    saddlecloth < 1 ||
    saddlecloth > 99
  ) {
    throw new Error("Revisa el nombre y el número de gualdrapa.");
  }
  const horse = await prisma.raceDayHorse.findUnique({
    where: { id },
    select: { raceDay: { select: { status: true } } },
  });
  if (!horse || horse.raceDay.status !== "OPEN") {
    throw new Error("No se puede editar un ejemplar de una jornada cerrada.");
  }

  await prisma.raceDayHorse.update({ where: { id }, data: { name, saddlecloth } });
  revalidatePath("/admin/jornadas");
}

export async function toggleHorseStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = formData.get("id");
  const status = formData.get("status");
  if (
    typeof id !== "string" ||
    (status !== "ACTIVE" && status !== "WITHDRAWN")
  ) {
    throw new Error("La solicitud de cambio de estado no es válida.");
  }
  await prisma.$transaction(
    async (transaction) => {
      const horse = await transaction.raceDayHorse.findUnique({
        where: { id },
        include: {
          raceDay: {
            select: {
              id: true,
              status: true,
              entries: {
                where: { status: "ACTIVE" },
                orderBy: { gazetteOrder: "asc" },
                select: { id: true, gazetteOrder: true },
              },
            },
          },
        },
      });
      if (!horse || horse.raceDay.status !== "OPEN") {
        throw new Error("No se puede cambiar el estado de una jornada cerrada.");
      }

      if (status === "ACTIVE") {
        await transaction.raceDayHorse.update({ where: { id }, data: { status } });
        return;
      }

      const activeAfterWithdrawal = horse.raceDay.entries.filter(
        (entry) => entry.id !== horse.id,
      );
      if (activeAfterWithdrawal.length === 0) {
        throw new Error("No se puede retirar el último ejemplar activo de la válida.");
      }
      const replacement =
        activeAfterWithdrawal.find(
          (entry) => entry.gazetteOrder > horse.gazetteOrder,
        ) ?? activeAfterWithdrawal[0];
      await transaction.raceDayHorse.update({ where: { id }, data: { status } });

      const selections = await transaction.ticketSelection.findMany({
        where: {
          currentHorseId: horse.id,
          ticket: {
            raceDayId: horse.raceDayId,
            status: { in: ["PENDING", "APPROVED"] },
          },
        },
        select: { id: true },
      });
      for (const selection of selections) {
        await transaction.ticketSelection.update({
          where: { id: selection.id },
          data: {
            currentHorseId: replacement.id,
            wasSubstituted: true,
            replacements: {
              create: {
                fromHorseId: horse.id,
                toHorseId: replacement.id,
              },
            },
          },
        });
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  revalidatePath("/admin/jornadas");
  revalidatePath("/app/play");
  revalidatePath("/app/tickets");
  revalidatePath("/app/board");
  revalidatePath("/admin/payments");
}
