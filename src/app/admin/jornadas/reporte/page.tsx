import { connection } from "next/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { AutoDownload } from "@/app/admin/jornadas/reporte/auto-download";
import { PrintButton } from "@/app/components/print-button";
import { requireAdmin } from "@/lib/auth";
import { formatBsFromCents } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { raceDayVenueLabel } from "@/lib/race-day";

function toCents(amount: Prisma.Decimal) {
  return BigInt(
    amount.mul(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toFixed(0),
  );
}

export default async function RaceDayReportPage({
  searchParams,
}: {
  searchParams: Promise<{ raceDayId?: string; download?: string }>;
}) {
  await connection();
  await requireAdmin();
  const { raceDayId, download } = await searchParams;
  if (!raceDayId) notFound();

  const raceDay = await prisma.raceDay.findUnique({
    where: { id: raceDayId },
    include: {
      entries: {
        orderBy: [{ legNumber: "asc" }, { gazetteOrder: "asc" }],
        select: { id: true, legNumber: true, saddlecloth: true, name: true },
      },
      tickets: {
        where: { status: "APPROVED" },
        orderBy: { ticketNumber: "asc" },
        include: {
          user: { select: { fullName: true } },
          selections: {
            orderBy: { legNumber: "asc" },
            include: {
              currentHorse: { select: { saddlecloth: true, name: true } },
            },
          },
        },
      },
      settlement: {
        select: {
          winnerCount: true,
          isCarryover: true,
          commissionCents: true,
          distributableCents: true,
          remainderCents: true,
        },
      },
    },
  });
  if (!raceDay || raceDay.status === "OPEN") notFound();

  const approvedCents = raceDay.tickets.reduce(
    (total, ticket) => total + toCents(ticket.amountVes),
    BigInt(0),
  );
  const totalPoolCents = toCents(raceDay.carryoverAmountVes) + approvedCents;
  const estimatedCommissionCents = totalPoolCents / BigInt(10);
  const estimatedDistributableCents = totalPoolCents - estimatedCommissionCents;
  const actualSettlement = raceDay.settlement;

  return (
    <main className="page-enter mx-auto max-w-5xl p-4 sm:p-8">
      <AutoDownload enabled={download === "1"} raceDayId={raceDay.id} />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-400">Reporte administrativo · solo tickets con pago aprobado</p>
        <div className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-[10px] font-bold text-emerald-200 hover:bg-emerald-500/15"
            href={`/api/admin/race-days/${raceDay.id}/report`}
          >
            Descargar PDF
          </Link>
          <PrintButton label="Imprimir / Guardar PDF" />
        </div>
      </div>
      <div className="rounded-2xl border border-white/[0.1] bg-[#0d151a] p-5 sm:p-8 print:border-0 print:bg-white print:p-0">
        <div className="border-b border-slate-300 pb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Cuadro Perfecto · Reporte de jornada</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{raceDayVenueLabel(raceDay.venue)}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {new Intl.DateTimeFormat("es-VE", { dateStyle: "full", timeZone: "UTC" }).format(raceDay.date)}
            {" · "}Estado: {raceDay.status === "CLOSED" ? "Apuestas cerradas / carreras en curso" : "Jornada finalizada"}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Generado {new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short", timeZone: "America/Caracas" }).format(new Date())}
          </p>
        </div>

        <section className="mt-5 grid gap-3 sm:grid-cols-3">
          <Summary label="Pozo total · arrastre + aprobados" value={formatBsFromCents(totalPoolCents)} />
          {actualSettlement ? (
            <>
              <Summary label="Comisión liquidada" value={formatBsFromCents(actualSettlement.commissionCents)} />
              <Summary
                label={actualSettlement.isCarryover ? "Arrastre neto · jornada desierta" : "Premios pagados"}
                value={formatBsFromCents(
                  actualSettlement.distributableCents -
                    (actualSettlement.isCarryover
                      ? BigInt(0)
                      : actualSettlement.remainderCents),
                )}
              />
            </>
          ) : (
            <>
              <Summary label="Comisión logística estimada · 10%" value={formatBsFromCents(estimatedCommissionCents)} />
              <Summary label="Premio o arrastre estimado · 90%" value={formatBsFromCents(estimatedDistributableCents)} />
            </>
          )}
        </section>
        <p className="mt-3 text-xs leading-5 text-slate-600">
          {actualSettlement?.isCarryover
            ? `No hubo tickets ganadores: se retuvo ${formatBsFromCents(actualSettlement.commissionCents)} de comisión logística y ${formatBsFromCents(actualSettlement.distributableCents)} queda como arrastre para la próxima jornada de este mismo hipódromo.`
            : actualSettlement
              ? actualSettlement.remainderCents > BigInt(0)
                ? `Resultado liquidado con ${actualSettlement.winnerCount} ticket(s) ganador(es). El residuo de ${formatBsFromCents(actualSettlement.remainderCents)} se conserva en el acumulado de la próxima jornada.`
                : `Resultado liquidado con ${actualSettlement.winnerCount} ticket(s) ganador(es).`
              : "Al liquidar se retendrá el 10% como comisión logística. El 90% restante se repartirá entre los ganadores o, si no hay ganadores, pasará como arrastre a la próxima jornada del mismo hipódromo."}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Summary label="Cuadros aprobados" value={String(raceDay.tickets.length)} />
          <Summary label="Recaudación aprobada" value={formatBsFromCents(approvedCents)} />
        </div>

        <h2 className="mt-7 border-b border-slate-300 pb-2 text-lg font-bold text-slate-950">Cuadros jugados y aprobados</h2>
        {raceDay.tickets.length === 0 ? (
          <p className="mt-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-600">No hay tickets aprobados para esta jornada.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {raceDay.tickets.map((ticket) => (
              <article className="break-inside-avoid rounded-lg border border-slate-300 p-3" key={ticket.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-950">
                    Ticket #{ticket.ticketNumber} · {ticket.user.fullName}
                  </p>
                  <p className="text-xs font-semibold text-slate-700">
                    {ticket.combinations.toString()} combinación(es) · {formatBsFromCents(toCents(ticket.amountVes))}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Array.from({ length: 6 }, (_, index) => {
                    const leg = index + 1;
                    const selections = ticket.selections.filter((selection) => selection.legNumber === leg);
                    return (
                      <p className="text-xs text-slate-700" key={leg}>
                        <strong>V{leg}:</strong>{" "}
                        {selections.map(({ currentHorse }) => `${currentHorse.saddlecloth} ${currentHorse.name}`).join(", ") || "—"}
                      </p>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
        <p className="mt-6 border-t border-slate-300 pt-3 text-[10px] text-slate-500">
          Documento administrativo. El pozo incluye únicamente el arrastre y pagos aprobados.
        </p>
      </div>
    </main>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-300 p-3">
      <p className="text-[10px] text-slate-600">{label}</p>
      <p className="mt-1.5 text-lg font-black tabular-nums text-slate-950">{value}</p>
    </article>
  );
}
