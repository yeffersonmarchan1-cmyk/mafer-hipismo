import { connection } from "next/server";
import { SettlementForm } from "@/app/admin/settlement/settlement-form";
import { PrintButton } from "@/app/components/print-button";
import { formatBs, formatBsFromCents } from "@/lib/currency";
import { prisma } from "@/lib/prisma";

export default async function SettlementAdminPage() {
  await connection();
  const raceDay = await prisma.raceDay.findFirst({
    where: { status: { in: ["CLOSED", "SETTLED"] } },
    orderBy: { date: "desc" },
    include: {
      entries: {
        where: { status: "ACTIVE" },
        orderBy: [{ legNumber: "asc" }, { gazetteOrder: "asc" }],
      },
      winningSelections: true,
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

  return (
    <section className="page-enter mx-auto max-w-4xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 03 · Administración</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Resultados y liquidación</h1>
      {!raceDay ? (
        <div className="mt-7 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm font-semibold text-white">No hay una jornada cerrada para liquidar</p>
          <p className="mt-2 text-xs text-slate-500">Cierra las apuestas desde Jornadas e inscritos cuando corresponda.</p>
        </div>
      ) : (
        <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#1a1d26] p-5 shadow-xl shadow-black/10 sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-400">
            Jornada · {new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(raceDay.date)}
          </p>
          {raceDay.settlement ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="mt-2 text-xl font-bold text-white">
                  {raceDay.settlement.isCarryover ? "Jornada desierta" : "Liquidación completada"}
                </h2>
                <PrintButton />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Summary label="Pozo total" value={formatBs(raceDay.settlement.totalPoolVes.toFixed(2))} />
                <Summary label="Comisión · 10%" value={formatBs(raceDay.settlement.commissionVes.toFixed(2))} />
                <Summary label="Ganadores" value={String(raceDay.settlement.winnerCount)} />
              </div>
              <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Combinación ganadora</p>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {Array.from({ length: 6 }, (_, index) => {
                    const leg = index + 1;
                    const winning = raceDay.winningSelections.find((entry) => entry.legNumber === leg);
                    return (
                      <div className="rounded-lg bg-[#111219] p-2 text-center" key={leg}>
                        <p className="text-[9px] text-slate-500">V{leg}</p>
                        <p className="mt-1 text-sm font-black text-red-300">{winning?.horse ?? "—"}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
              {raceDay.settlement.isCarryover ? (
                <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4 text-xs leading-5 text-amber-100">
                  No hubo cuadros con seis aciertos. El pozo completo se trasladó a la siguiente jornada.
                </p>
              ) : (
                <div className="mt-5">
                  <p className="text-sm font-semibold text-white">Ganadores y premios</p>
                  <div className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
                    {raceDay.settlement.ticketPayouts.map((payout) => (
                      <div className="flex items-center justify-between gap-3 px-4 py-3" key={payout.id}>
                        <div>
                          <p className="text-xs font-semibold text-white">{payout.ticket.user.fullName}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">Ticket #{payout.ticket.ticketNumber}</p>
                        </div>
                        <p className="text-sm font-black text-green-300">{formatBs(payout.amountVes.toFixed(2))}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500">
                    Premio por ticket: {formatBsFromCents(raceDay.settlement.payoutEachCents)} · remanente indivisible: {raceDay.settlement.remainderCents.toString()} centavos.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="mt-2 text-xl font-bold text-white">Liquidación exacta de seis válidas</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Selecciona los seis ganadores. Se considerarán únicamente tickets aprobados.
              </p>
              <SettlementForm
                entries={raceDay.entries}
                raceDayId={raceDay.id}
              />
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-1.5 text-lg font-black tabular-nums text-white">{value}</p>
    </article>
  );
}
