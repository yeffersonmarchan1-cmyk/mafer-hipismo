import { connection } from "next/server";
import { closeDueRaceDays } from "@/lib/close-race-days";
import { prisma } from "@/lib/prisma";

export default async function OfficialBoardPage() {
  await connection();
  await closeDueRaceDays();
  const raceDay = await prisma.raceDay.findFirst({
    orderBy: { date: "desc" },
    include: {
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
    },
  });

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
        Jornada {new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(raceDay.date)} · {raceDay.tickets.length} tickets aprobados
      </p>
      <div className="mt-7 space-y-3">
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
    </section>
  );
}
