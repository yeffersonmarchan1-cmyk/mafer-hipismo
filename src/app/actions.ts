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

export type HorseManagementState = {
  error?: string;
  success?: string;
};

function revalidateHorseManagement() {
  revalidatePath("/admin/jornadas");
  revalidatePath("/app/play");
  revalidatePath("/app/tickets");
  revalidatePath("/app/board");
  revalidatePath("/admin/payments");
}

function readManualRaceDayId(formData: FormData) {
  const raceDayId = formData.get("raceDayId");
  if (typeof raceDayId !== "string" || !raceDayId || raceDayId.length > 64) {
    throw new Error("Selecciona una jornada válida.");
  }
  return raceDayId;
}

function readManualLegNumber(formData: FormData) {
  const legNumber = Number(formData.get("legNumber"));
  if (!Number.isInteger(legNumber) || legNumber < 1 || legNumber > 6) {
    throw new Error("Selecciona una válida entre la 1 y la 6.");
  }
  return legNumber;
}

function validateManualHorse(saddlecloth: number, name: string) {
  if (
    !Number.isInteger(saddlecloth) ||
    saddlecloth < 1 ||
    saddlecloth > 99 ||
    !name ||
    name.length > 120
  ) {
    throw new Error("El número debe estar entre 1 y 99 y el nombre entre 1 y 120 caracteres.");
  }
}

function expectedHorseWriteError(error: unknown): HorseManagementState | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return { error: "Ese número de gualdrapa ya existe en esta válida." };
  }
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return { error: "La lista cambió al mismo tiempo. Actualiza la página e intenta de nuevo." };
  }
  return null;
}

function parseManualHorseList(text: string) {
  const lines = text.split(/\r?\n/);
  const horses: { saddlecloth: number; name: string }[] = [];
  const seen = new Set<number>();
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const match =
      line.match(/^(\d{1,2})\s*(?:[.)]|[-–—])\s*(.+)$/) ??
      line.match(/^(\d{1,2})\s+(.+)$/);
    if (!match) {
      throw new Error(`No se pudo interpretar la línea ${index + 1}: "${line.slice(0, 60)}".`);
    }
    const saddlecloth = Number(match[1]);
    const name = match[2].trim();
    validateManualHorse(saddlecloth, name);
    if (seen.has(saddlecloth)) {
      throw new Error(`La gualdrapa ${saddlecloth} está repetida en la lista.`);
    }
    seen.add(saddlecloth);
    horses.push({ saddlecloth, name });
  }
  if (!horses.length) throw new Error("Pega al menos un ejemplar para cargar.");
  if (horses.length > 99) throw new Error("Una válida no puede tener más de 99 ejemplares.");
  return horses;
}

export async function createManualRaceDay(
  _previousState: HorseManagementState,
  formData: FormData,
): Promise<HorseManagementState> {
  await requireAdmin();
  const dateValue = formData.get("raceDate");
  const firstRaceValue = formData.get("firstRaceAt");
  if (
    typeof dateValue !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
    typeof firstRaceValue !== "string" ||
    !/^\d{2}:\d{2}$/.test(firstRaceValue)
  ) {
    return { error: "Indica una fecha y la hora de la primera válida." };
  }
  const date = new Date(`${dateValue}T12:00:00.000Z`);
  const firstRaceAt = new Date(`${dateValue}T${firstRaceValue}:00-04:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== dateValue ||
    Number.isNaN(firstRaceAt.getTime())
  ) {
    return { error: "La fecha u hora de la jornada no es válida." };
  }

  const existing = await prisma.raceDay.findUnique({
    where: { date_venue: { date, venue: "La Rinconada" } },
    select: { status: true },
  });
  if (existing) {
    return {
      error:
        existing.status === "OPEN"
          ? "Ya existe una jornada abierta para esa fecha."
          : "Ya existe una jornada cerrada para esa fecha.",
    };
  }
  try {
    await prisma.raceDay.create({
      data: {
        date,
        venue: "La Rinconada",
        firstRaceAt,
        closesAt: new Date(firstRaceAt.getTime() - 30 * 60 * 1000),
        inscriptionSource: "Carga manual",
        inscriptionsUpdatedAt: new Date(),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Ya se creó una jornada para esa fecha. Actualiza la página." };
    }
    throw error;
  }
  revalidateHorseManagement();
  return { success: "Jornada creada. Ya puedes cargar los ejemplares de sus seis válidas." };
}

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

export async function addHorse(
  _previousState: HorseManagementState,
  formData: FormData,
): Promise<HorseManagementState> {
  await requireAdmin();
  let raceDayId: string;
  let legNumber: number;
  try {
    raceDayId = readManualRaceDayId(formData);
    legNumber = readManualLegNumber(formData);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  const saddlecloth = Number(formData.get("saddlecloth"));
  const name = String(formData.get("name") ?? "").trim();
  try {
    validateManualHorse(saddlecloth, name);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  try {
    await prisma.$transaction(
      async (transaction) => {
        const day = await transaction.raceDay.findUnique({
          where: { id: raceDayId },
          select: { status: true },
        });
        if (!day || day.status !== "OPEN") throw new Error("La jornada no está abierta para cambios.");
        const lastEntry = await transaction.raceDayHorse.findFirst({
          where: { raceDayId, legNumber },
          orderBy: { gazetteOrder: "desc" },
          select: { gazetteOrder: true },
        });
        await transaction.raceDayHorse.create({
          data: {
            raceDayId,
            legNumber,
            saddlecloth,
            name,
            gazetteOrder: (lastEntry?.gazetteOrder ?? 0) + 1,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    const knownError = expectedHorseWriteError(error);
    if (knownError) return knownError;
    if (error instanceof Error && error.message === "La jornada no está abierta para cambios.") {
      return { error: error.message };
    }
    throw error;
  }
  revalidateHorseManagement();
  return { success: `${name} agregado a la válida ${legNumber}.` };
}

export async function addHorsesBulk(
  _previousState: HorseManagementState,
  formData: FormData,
): Promise<HorseManagementState> {
  await requireAdmin();
  let raceDayId: string;
  let legNumber: number;
  let horses: ReturnType<typeof parseManualHorseList>;
  try {
    raceDayId = readManualRaceDayId(formData);
    legNumber = readManualLegNumber(formData);
    const rawList = formData.get("horseList");
    if (typeof rawList !== "string" || rawList.length > 20_000) {
      throw new Error("La lista no es válida o supera el límite permitido.");
    }
    horses = parseManualHorseList(rawList);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }

  let added = 0;
  let updated = 0;
  try {
    await prisma.$transaction(
      async (transaction) => {
        const day = await transaction.raceDay.findUnique({
          where: { id: raceDayId },
          select: { status: true },
        });
        if (!day || day.status !== "OPEN") throw new Error("La jornada no está abierta para cambios.");
        const lastEntry = await transaction.raceDayHorse.findFirst({
          where: { raceDayId, legNumber },
          orderBy: { gazetteOrder: "desc" },
          select: { gazetteOrder: true },
        });
        let nextOrder = lastEntry?.gazetteOrder ?? 0;
        for (const horse of horses) {
          const existing = await transaction.raceDayHorse.findUnique({
            where: {
              raceDayId_legNumber_saddlecloth: {
                raceDayId,
                legNumber,
                saddlecloth: horse.saddlecloth,
              },
            },
            select: { id: true },
          });
          if (existing) {
            await transaction.raceDayHorse.update({
              where: { id: existing.id },
              data: { name: horse.name },
            });
            updated += 1;
          } else {
            nextOrder += 1;
            await transaction.raceDayHorse.create({
              data: {
                raceDayId,
                legNumber,
                saddlecloth: horse.saddlecloth,
                name: horse.name,
                gazetteOrder: nextOrder,
              },
            });
            added += 1;
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    const knownError = expectedHorseWriteError(error);
    if (knownError) return knownError;
    if (error instanceof Error && error.message === "La jornada no está abierta para cambios.") {
      return { error: error.message };
    }
    throw error;
  }
  revalidateHorseManagement();
  return { success: `Lista cargada: ${added} nuevos y ${updated} actualizados; los estados de retiro se conservaron.` };
}

export async function updateHorse(
  _previousState: HorseManagementState,
  formData: FormData,
): Promise<HorseManagementState> {
  await requireAdmin();
  const id = formData.get("id");
  const name = String(formData.get("name") ?? "").trim();
  const saddlecloth = Number(formData.get("saddlecloth"));
  if (typeof id !== "string" || !id || id.length > 64) {
    return { error: "El ejemplar seleccionado no es válido." };
  }
  try {
    validateManualHorse(saddlecloth, name);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  try {
    const horse = await prisma.raceDayHorse.findUnique({
      where: { id },
      select: { raceDay: { select: { status: true } } },
    });
    if (!horse || horse.raceDay.status !== "OPEN") {
      return { error: "No se puede editar un ejemplar de una jornada cerrada." };
    }
    await prisma.raceDayHorse.update({ where: { id }, data: { name, saddlecloth } });
  } catch (error) {
    const knownError = expectedHorseWriteError(error);
    if (knownError) return knownError;
    throw error;
  }
  revalidateHorseManagement();
  return { success: "Datos del ejemplar actualizados." };
}

export async function deleteHorse(
  _previousState: HorseManagementState,
  formData: FormData,
): Promise<HorseManagementState> {
  await requireAdmin();
  const id = formData.get("id");
  if (typeof id !== "string" || !id || id.length > 64) {
    return { error: "El ejemplar seleccionado no es válido." };
  }
  const result = await prisma.$transaction(async (transaction) => {
    const horse = await transaction.raceDayHorse.findUnique({
      where: { id },
      select: { raceDayId: true, raceDay: { select: { status: true } } },
    });
    if (!horse || horse.raceDay.status !== "OPEN") return "CLOSED" as const;
    const selectionCount = await transaction.ticketSelection.count({
      where: { OR: [{ originalHorseId: id }, { currentHorseId: id }] },
    });
    const replacementCount = await transaction.horseReplacement.count({
      where: { OR: [{ fromHorseId: id }, { toHorseId: id }] },
    });
    if (selectionCount || replacementCount) return "IN_USE" as const;
    await transaction.raceDayHorse.delete({ where: { id } });
    return "DELETED" as const;
  });
  if (result === "CLOSED") return { error: "No se puede eliminar un ejemplar de una jornada cerrada." };
  if (result === "IN_USE") {
    return { error: "Este ejemplar está vinculado a tickets. Márcalo como retirado para conservar el historial." };
  }
  revalidateHorseManagement();
  return { success: "Ejemplar eliminado." };
}

export async function clearRaceLeg(
  _previousState: HorseManagementState,
  formData: FormData,
): Promise<HorseManagementState> {
  await requireAdmin();
  let raceDayId: string;
  let legNumber: number;
  try {
    raceDayId = readManualRaceDayId(formData);
    legNumber = readManualLegNumber(formData);
  } catch (error) {
    if (error instanceof Error) return { error: error.message };
    throw error;
  }
  const result = await prisma.$transaction(async (transaction) => {
    const day = await transaction.raceDay.findUnique({
      where: { id: raceDayId },
      select: { status: true },
    });
    if (!day || day.status !== "OPEN") return "CLOSED" as const;
    const entries = await transaction.raceDayHorse.findMany({
      where: { raceDayId, legNumber },
      select: { id: true },
    });
    const ids = entries.map((entry) => entry.id);
    if (!ids.length) return "EMPTY" as const;
    const selectionCount = await transaction.ticketSelection.count({
      where: {
        OR: [{ originalHorseId: { in: ids } }, { currentHorseId: { in: ids } }],
      },
    });
    const replacementCount = await transaction.horseReplacement.count({
      where: {
        OR: [{ fromHorseId: { in: ids } }, { toHorseId: { in: ids } }],
      },
    });
    if (selectionCount || replacementCount) return "IN_USE" as const;
    await transaction.raceDayHorse.deleteMany({ where: { raceDayId, legNumber } });
    return "CLEARED" as const;
  });
  if (result === "CLOSED") return { error: "La jornada no está abierta para cambios." };
  if (result === "IN_USE") {
    return { error: "Hay ejemplares de esta válida vinculados a tickets. No se eliminó ningún registro." };
  }
  if (result === "EMPTY") return { success: "La válida ya estaba vacía." };
  revalidateHorseManagement();
  return { success: `Se limpiaron los ejemplares de la válida ${legNumber}.` };
}

export async function toggleHorseStatus(
  _previousState: HorseManagementState,
  formData: FormData,
): Promise<HorseManagementState> {
  await requireAdmin();
  const id = formData.get("id");
  const status = formData.get("status");
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 64 ||
    (status !== "ACTIVE" && status !== "WITHDRAWN")
  ) {
    return { error: "La solicitud de cambio de estado no es válida." };
  }
  try {
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

      if (horse.status === status) return;
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
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "No se puede cambiar el estado de una jornada cerrada." ||
        error.message === "No se puede retirar el último ejemplar activo de la válida.")
    ) {
      return { error: error.message };
    }
    throw error;
  }
  revalidateHorseManagement();
  return { success: status === "WITHDRAWN" ? "Ejemplar retirado y tickets actualizados." : "Ejemplar reactivado." };
}
