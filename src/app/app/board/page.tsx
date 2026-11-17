import { connection } from "next/server";
import { Prisma } from "@prisma/client";
import { closeDueRaceDays } from "@/lib/close-race-days";
import { prisma } from "@/lib/prisma";

export default async function OfficialBoardPage() {
  await connection();
  await closeDueRaceDays();
  const raceDay = await prisma.raceDay.findFirst({
    orderBy: { date: "desc" },
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
  });
  const totalPool = raceDay
    ? raceDay.tickets
        .reduce(
          (total, ticket) => total.add(ticket.amountUsd),
          raceDay.carryoverAmount,
        )
        .toFixed(2)
    : new Prisma.Decimal(0).toFixed(2);

  if (!raceDay || raceDay.status === "OPEN") {
    return (
      <section className="page-enter mx-auto max-w-4xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 03 · Transparencia</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Pizarra oficial</h1>
        <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#0d151a] p-6 sm:p-8">
          <p className="font-semibold text-white">Apuestas abiertas</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Los cuadros se harán públicos al cierre de apuestas. La jornada se cierra a la hora programada (30 minutos antes de la primera válida), o antes si administración lo hace manualmente.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="page-enter mx-auto max-w-5xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 03 · Transparencia</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Pizarra oficial</h1>
      <p className="mt-2 text-sm text-slate-400">
        Jornada {new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(raceDay.date)}
      </p>
      <section className="mt-6 rounded-2xl border border-red-500/15 bg-[#0d151a] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-slate-500">
              {raceDay.status === "SETTLED" ? "Acumulado liquidado" : "Acumulado total recaudado"}
            </p>
            <p className="mt-1 text-3xl font-black tabular-nums text-red-300">${totalPool}</p>
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
              No hubo cuadros con seis aciertos. El pozo completo se trasladó a la próxima jornada.
            </p>
          ) : (
            <>
              <p className="mt-4 text-sm text-slate-300">
                Pozo repartido: <strong className="text-white">${raceDay.settlement.distributableUsd.toFixed(2)}</strong>
                {" · "}Premio por cuadro: <strong className="text-green-300">${(raceDay.settlement.payoutEachCents / 100).toFixed(2)}</strong>
              </p>
              <div className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                {raceDay.settlement.ticketPayouts.map((payout) => (
                  <div className="flex items-center justify-between gap-3 px-4 py-3" key={payout.id}>
                    <div>
                      <p className="text-xs font-semibold text-white">{payout.ticket.user.fullName}</p>
                      <p className="mt-1 text-[10px] text-slate-500">Ticket #{payout.ticket.ticketNumber}</p>
                    </div>
                    <p className="text-sm font-black text-green-300">${payout.amountUsd.toFixed(2)}</p>
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
