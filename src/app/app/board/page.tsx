import { connection } from "next/server";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { closeDueRaceDays } from "@/lib/close-race-days";
import { formatBs, formatBsFromCents } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { raceDayVenueLabel } from "@/lib/race-day";

export default async function OfficialBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ raceDayId?: string }>;
}) {
  await connection();
  await closeDueRaceDays();
  const { raceDayId } = await searchParams;
  const availableDays = await prisma.raceDay.findMany({
    where: { status: { in: ["CLOSED", "SETTLED"] } },
    orderBy: [{ venue: "asc" }, { date: "desc" }],
    select: { id: true, date: true, venue: true },
  });
  const raceDay = raceDayId
    ? await prisma.raceDay.findFirst({
        where: { id: raceDayId, status: { in: ["CLOSED", "SETTLED"] } },
        include: {
      entries: {
        select: { legNumber: true, saddlecloth: true, name: true },
      },
      tickets: {
        where: { status: "APPROVED" },
        orderBy: { ticketNumber: "asc" },
        include: {
          user: { select: { fullName: true } },
          selections: {
            orderBy: { legNumber: "asc" },
            include: { currentHorse: { select: { saddlecloth: true, name: true } } },
          },
        },
      },
      winningSelections: { orderBy: { legNumber: "asc" } },
      settlement: {
        include: {
          ticketPayouts: {
            orderBy: { ticket: { ticketNumber: "asc" } },
            include: {
              ticket: { include: { user: { select: { fullName: true } } } },
            },
          },
        },
      },
        },
      })
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
      <section className="page-enter mx-auto max-w-4xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 03 · Transparencia</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Pizarra oficial</h1>
        <p className="mt-2 text-sm text-slate-400">Elige el hipódromo y la jornada cuya pizarra quieres consultar.</p>
        {availableDays.length ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {availableDays.map((day) => (
              <Link className="rounded-2xl border border-white/[0.08] bg-[#0d151a] p-4 hover:border-emerald-400/25" href={`/app/board?raceDayId=${day.id}`} key={day.id}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{raceDayVenueLabel(day.venue)}</p>
                <p className="mt-2 text-sm font-semibold text-white">{new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(day.date)}</p>
                <p className="mt-2 text-xs text-slate-400">Ver cuadros y acumulado →</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#0d151a] p-6 sm:p-8">
            <p className="font-semibold text-white">No hay jornadas cerradas</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">Las pizarras se publican al cerrar las apuestas de cada hipódromo.</p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="page-enter mx-auto max-w-5xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 03 · Transparencia</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Pizarra oficial</h1>
      <p className="mt-2 text-sm text-slate-400">
        {raceDayVenueLabel(raceDay.venue)} · {new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(raceDay.date)}
      </p>
      {availableDays.length > 1 && (
        <nav aria-label="Cambiar jornada de la pizarra" className="mt-4 flex flex-wrap gap-2">
          {availableDays.map((day) => (
            <Link
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold ${day.id === raceDay.id ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200" : "border-white/[0.08] text-slate-400 hover:text-white"}`}
              href={`/app/board?raceDayId=${day.id}`}
              key={day.id}
            >
              {raceDayVenueLabel(day.venue)} · {new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeZone: "UTC" }).format(day.date)}
            </Link>
          ))}
        </nav>
      )}
      <section className="mt-6 rounded-2xl border border-red-500/15 bg-[#0d151a] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-slate-500">
              {raceDay.status === "SETTLED" ? "Acumulado liquidado" : "Acumulado total recaudado"}
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-red-300">{formatBs(totalPool)}</p>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${raceDay.status === "SETTLED" ? "bg-sky-400/10 text-sky-200" : "bg-amber-400/10 text-amber-200"}`}>
            {raceDay.status === "SETTLED" ? "Finalizada" : "Cerrada · En curso"}
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Suma del arrastre y de {raceDay.tickets.length} ticket{raceDay.tickets.length === 1 ? "" : "s"} con pago aprobado.
        </p>
      </section>

      {raceDay.status === "SETTLED" && raceDay.settlement && (
        <section className="mt-5 rounded-2xl border border-sky-400/15 bg-[#0d151a] p-5 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-sky-200">Resultados oficiales</p>
          <h2 className="mt-1 text-lg font-bold text-white">
            {raceDay.settlement.isCarryover ? "Jornada desierta" : "Combinación ganadora"}
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {Array.from({ length: 6 }, (_, index) => {
              const leg = index + 1;
              const winning = raceDay.winningSelections.find((entry) => entry.legNumber === leg);
              const winnerHorse = winning
                ? raceDay.entries.find(
                    (entry) => entry.legNumber === leg && entry.saddlecloth === winning.horse,
                  )
                : null;
              return (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3 text-center" key={leg}>
                  <p className="text-[9px] font-bold uppercase text-slate-500">Válida {leg}</p>
                  <p className="mt-1 text-base font-black text-red-300">{winning ? `#${winning.horse}` : "—"}</p>
                  {winnerHorse && <p className="mt-1 truncate text-[9px] text-slate-300">{winnerHorse.name}</p>}
                </div>
              );
            })}
          </div>
          {raceDay.settlement.isCarryover ? (
            <p className="mt-4 text-sm text-amber-100">
              No hubo cuadros con seis aciertos. Comisión logística retenida:{" "}
              <strong>{formatBs(raceDay.settlement.commissionVes.toFixed(2))}</strong>.
              Saldo acumulado para la próxima jornada:{" "}
              <strong>
                {formatBs(
                  raceDay.settlement.distributableVes.gt(0)
                    ? raceDay.settlement.distributableVes.toFixed(2)
                    : totalPool,
                )}
              </strong>.
            </p>
          ) : (
            <>
              <p className="mt-4 text-sm text-slate-300">
                Premios pagados: <strong className="text-white">{formatBsFromCents(raceDay.settlement.distributableCents - raceDay.settlement.remainderCents)}</strong>
                {" · "}Comisión logística 10%: <strong className="text-white">{formatBs(raceDay.settlement.commissionVes.toFixed(2))}</strong>
                {" · "}Premio por cuadro: <strong className="text-green-300">{formatBsFromCents(raceDay.settlement.payoutEachCents)}</strong>
              </p>
              {raceDay.settlement.remainderCents > BigInt(0) && (
                <p className="mt-2 text-xs text-amber-200">
                  Residuo de {formatBsFromCents(raceDay.settlement.remainderCents)} agregado al acumulado de la próxima jornada.
                </p>
              )}
              <div className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {raceDay.settlement.ticketPayouts.map((payout) => (
                  <div className="flex items-center justify-between gap-3 px-4 py-3" key={payout.id}>
                    <div>
                      <p className="text-xs font-semibold text-white">{payout.ticket.user.fullName}</p>
                      <p className="mt-1 text-[10px] text-slate-500">Ticket #{payout.ticket.ticketNumber}</p>
                    </div>
                    <p className="text-sm font-black text-green-300">{formatBs(payout.amountVes.toFixed(2))}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <div className="mt-7">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-white">
            {raceDay.status === "SETTLED" ? "Cuadros aprobados de la jornada" : "Cuadros publicados"}
          </h2>
          <span className="text-[10px] text-slate-500">{raceDay.tickets.length} tickets aprobados</span>
        </div>
      <div className="space-y-3">
        {raceDay.tickets.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-sm font-semibold text-white">Aún no hay tickets aprobados</p>
            <p className="mt-2 text-xs text-slate-500">Los cuadros aparecerán aquí después de validar sus pagos.</p>
          </div>
        )}
        {raceDay.tickets.map((ticket) => (
          <article className="rounded-2xl border border-white/[0.08] bg-[#0d151a] p-5" key={ticket.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{ticket.user.fullName}</p>
              <span className="rounded-full bg-emerald-400/[0.08] px-3 py-1 text-[10px] font-bold text-emerald-300">
                Ticket #{ticket.ticketNumber}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, index) => {
                const legNumber = index + 1;
                const horses = ticket.selections.filter((selection) => selection.legNumber === legNumber);
                return (
                  <div className="rounded-lg bg-white/[0.03] p-3" key={legNumber}>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Válida {legNumber}</p>
                    <p className="mt-1.5 text-xs text-slate-200">
                      {horses.map(({ currentHorse }) => `${currentHorse.saddlecloth} ${currentHorse.name}`).join(", ") || "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      </div>
    </section>
  );
}
