import { connection } from "next/server";
import { PlayCardSelector } from "@/app/app/play/play-card-selector";
import { closeDueRaceDays } from "@/lib/close-race-days";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { isRaceDayPlayable, raceDayVenueLabel } from "@/lib/race-day";
import { formatBs } from "@/lib/currency";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ raceDayId?: string }>;
}) {
  await connection();
  await closeDueRaceDays();
  const { raceDayId } = await searchParams;
  const openDays = process.env.DATABASE_URL
    ? await prisma.raceDay.findMany({
        where: { status: "OPEN" },
        orderBy: [{ date: "asc" }, { venue: "asc" }],
        select: {
          id: true,
          date: true,
          venue: true,
          carryoverAmountVes: true,
          tickets: {
            where: { status: "APPROVED" },
            select: { amountVes: true },
          },
          entries: {
            where: { status: "ACTIVE" },
            select: { legNumber: true },
          },
        },
      })
    : [];
  const selectedDay = raceDayId
    ? await prisma.raceDay.findFirst({
        where: { id: raceDayId, status: "OPEN" },
        include: {
          entries: {
            where: { status: "ACTIVE" },
            orderBy: [{ legNumber: "asc" }, { gazetteOrder: "asc" }],
          },
          tickets: {
            where: { status: "APPROVED" },
            select: { amountVes: true },
          },
        },
      })
    : null;
  const raceDay =
    selectedDay && isRaceDayPlayable(selectedDay.entries) ? selectedDay : null;
  if (!raceDay) {
    const playableDays = openDays.filter((day) => isRaceDayPlayable(day.entries));
    return (
      <div className="page-enter mx-auto max-w-5xl">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">Módulo 01 · Jugador</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Elige dónde jugar</h1>
          <p className="mt-2 text-sm text-slate-400">Selecciona una jornada abierta de La Rinconada o Valencia.</p>
        </header>
        {playableDays.length ? (
          <section className="mt-6 grid gap-3 md:grid-cols-2">
            {playableDays.map((day) => (
              <article className="rounded-2xl border border-white/[0.08] bg-[#14151c] p-5" key={day.id}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{raceDayVenueLabel(day.venue)}</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(day.date)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Pozo acumulado: {formatBs(day.tickets.reduce(
                    (total, ticket) => total.add(ticket.amountVes),
                    day.carryoverAmountVes,
                  ).toFixed(2))}
                </p>
                <Link className="button-primary mt-4 inline-flex min-h-10 items-center px-4 py-2 text-xs" href={`/app/play?raceDayId=${day.id}`}>
                  Jugar en esta jornada
                </Link>
              </article>
            ))}
          </section>
        ) : (
          <section className="mt-7 rounded-2xl border border-white/[0.08] bg-[#14151c] p-8 text-center">
            <p className="text-sm font-semibold text-white">No hay jornadas abiertas</p>
            <p className="mt-2 text-sm text-slate-400">Las jornadas disponibles aparecerán aquí cuando administración las publique.</p>
          </section>
        )}
      </div>
    );
  }

  const paymentConfig = raceDay
    ? await prisma.systemConfig.findUnique({ where: { id: 1 } })
    : null;
  const totalPool = raceDay
    ? raceDay.tickets
        .reduce(
          (total, ticket) => total.add(ticket.amountVes),
          raceDay.carryoverAmountVes,
        )
        .toFixed(2)
    : "0.00";

  return (
    <PlayCardSelector
      carryoverAmount={totalPool}
      venue={raceDay.venue}
      dateLabel={new Intl.DateTimeFormat("es-VE", {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(raceDay.date)}
      horses={raceDay.entries}
      raceDayId={raceDay.id}
      payment={{
        bank: paymentConfig?.paymentBank ?? "",
        cedula: paymentConfig?.paymentCedula ?? "",
        phone: paymentConfig?.paymentPhone ?? "",
        message: paymentConfig?.infoMessage ?? "",
      }}
    />
  );
}
