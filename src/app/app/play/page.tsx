import { connection } from "next/server";
import { Prisma } from "@prisma/client";
import { PlayCardSelector } from "@/app/app/play/play-card-selector";
import { closeDueRaceDays } from "@/lib/close-race-days";
import { prisma } from "@/lib/prisma";

export default async function PlayPage() {
  await connection();
  await closeDueRaceDays();
  const raceDay = process.env.DATABASE_URL
    ? await prisma.raceDay.findFirst({
        where: { status: "OPEN" },
        orderBy: { date: "asc" },
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
    : new Prisma.Decimal(0).toFixed(2);

  if (!raceDay) {
    return (
      <div className="page-enter mx-auto max-w-5xl">
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">
            Módulo 01 · Jugador
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Jugar 5y6
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Arma tu cuadro con los ejemplares oficiales de La Rinconada.
          </p>
        </header>
        <section className="mt-7 rounded-2xl border border-white/[0.08] bg-[#14151c] p-8 text-center shadow-xl shadow-black/10">
          <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.08] text-xl text-red-300">
            5
          </span>
          <p className="mt-4 text-sm font-semibold text-white">
            No hay una jornada abierta
          </p>
          <p className="mt-2 text-sm text-slate-400">
            El cuadro estará disponible cuando administración publique los inscritos.
          </p>
        </section>
      </div>
    );
  }

  return (
    <PlayCardSelector
      carryoverAmount={totalPool}
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
