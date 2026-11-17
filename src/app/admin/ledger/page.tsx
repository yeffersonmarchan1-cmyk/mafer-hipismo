import Link from "next/link";
import { connection } from "next/server";
import { LedgerAdjustmentForm } from "@/app/admin/ledger/adjustment-form";
import { formatBsFromCents } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { raceDayVenueLabel } from "@/lib/race-day";

export default async function LedgerAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ raceDayId?: string }>;
}) {
  await connection();
  const { raceDayId } = await searchParams;
  const raceDays = await prisma.raceDay.findMany({
    orderBy: [{ date: "desc" }, { venue: "asc" }],
    take: 100,
    select: { id: true, date: true, venue: true, status: true },
  });
  const selected =
    raceDays.find((day) => day.id === raceDayId) ?? raceDays[0] ?? null;
  const [day, recentEntries, totals, recentAlerts] = await Promise.all([
    selected
      ? prisma.raceDay.findUnique({
          where: { id: selected.id },
          select: {
            id: true,
            date: true,
            venue: true,
            status: true,
            carryoverAmountVes: true,
            tickets: {
              where: { status: "APPROVED" },
              select: { amountVes: true },
            },
          },
        })
      : null,
    selected
      ? prisma.financialLedgerEntry.findMany({
          where: { raceDayId: selected.id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 250,
          select: {
            id: true,
            type: true,
            amountCents: true,
            reference: true,
            description: true,
            createdAt: true,
            ticketNumber: true,
            actorName: true,
          },
        })
      : [],
    selected
      ? prisma.financialLedgerEntry.aggregate({
          where: { raceDayId: selected.id },
          _sum: { amountCents: true },
          _count: { _all: true },
        })
      : null,
    prisma.operationalAlert.findMany({
      where: { acknowledgedAt: null },
      orderBy: { lastSeenAt: "desc" },
      take: 5,
      select: { id: true, message: true, source: true, lastSeenAt: true },
    }),
  ]);
  const ledgerBalanceCents = totals?._sum.amountCents ?? BigInt(0);
  const expectedBalanceCents =
    day?.status === "SETTLED"
      ? BigInt(0)
      : day
        ? day.tickets.reduce(
            (sum, ticket) =>
              sum +
              BigInt(
                ticket.amountVes
                  .mul(100)
                  .toDecimalPlaces(0)
                  .toFixed(0),
              ),
            BigInt(
              day.carryoverAmountVes
                .mul(100)
                .toDecimalPlaces(0)
                .toFixed(0),
            ),
          )
        : BigInt(0);
  const reconciled = ledgerBalanceCents === expectedBalanceCents;

  return (
    <section className="page-enter mx-auto max-w-6xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">
        Módulo 06 · Administración
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
        Libro contable
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Historial append-only de pagos aprobados, comisiones, premios,
        acumulados y ajustes. Cada jornada se concilia en centavos; los ajustes
        registrados no se pueden editar ni eliminar.
      </p>
      {recentAlerts.length > 0 && (
        <Link
          className="mt-5 block rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-sm text-amber-100"
          href="/admin/alerts"
        >
          Hay {recentAlerts.length} alerta(s) operativa(s) sin reconocer.
          Revisar alertas →
        </Link>
      )}
      {raceDays.length > 0 && (
        <nav aria-label="Seleccionar jornada" className="mt-6 flex flex-wrap gap-2">
          {raceDays.map((raceDay) => (
            <Link
              className={`rounded-lg border px-3 py-2 text-xs ${
                selected?.id === raceDay.id
                  ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-100"
                  : "border-white/10 text-slate-400 hover:text-white"
              }`}
              href={`/admin/ledger?raceDayId=${encodeURIComponent(raceDay.id)}`}
              key={raceDay.id}
            >
              {raceDayVenueLabel(raceDay.venue)} ·{" "}
              {new Intl.DateTimeFormat("es-VE", {
                dateStyle: "short",
                timeZone: "UTC",
              }).format(raceDay.date)}
            </Link>
          ))}
        </nav>
      )}
      {!day ? (
        <p className="mt-6 rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
          Aún no hay jornadas ni movimientos contables.
        </p>
      ) : (
        <>
          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-[#1a1d26] p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              {raceDayVenueLabel(day.venue)} ·{" "}
              {new Intl.DateTimeFormat("es-VE", {
                dateStyle: "long",
                timeZone: "UTC",
              }).format(day.date)}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Summary
                label="Saldo esperado en pozo"
                value={formatBsFromCents(expectedBalanceCents)}
              />
              <Summary
                label="Saldo según libro"
                value={formatBsFromCents(ledgerBalanceCents)}
              />
              <Summary
                label="Conciliación"
                value={reconciled ? "Conciliado" : "Diferencia por revisar"}
                good={reconciled}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {totals?._count._all ?? 0} movimiento(s).{" "}
              {recentEntries.length < (totals?._count._all ?? 0)
                ? `Mostrando los ${recentEntries.length} más recientes.`
                : "Se muestran todos los movimientos."}
            </p>
            {day.status === "OPEN" && (
              <>
                <h2 className="mt-6 text-sm font-bold text-white">
                  Registrar ajuste de acumulado
                </h2>
                <LedgerAdjustmentForm raceDayId={day.id} />
              </>
            )}
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08]">
            <div className="divide-y divide-white/[0.06]">
              {recentEntries.length === 0 ? (
                <p className="p-5 text-sm text-slate-400">
                  Esta jornada todavía no tiene movimientos.
                </p>
              ) : (
                recentEntries.map((entry) => (
                  <article
                    className="flex flex-wrap items-center justify-between gap-3 bg-[#111219] px-4 py-3"
                    key={entry.id}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">
                        {ledgerTypeLabel(entry.type)}
                        {entry.ticketNumber
                          ? ` · Ticket #${entry.ticketNumber}`
                          : ""}
                      </p>
                      <p className="mt-1 break-words text-[10px] text-slate-400">
                        {entry.description}
                      </p>
                      <p className="mt-1 text-[9px] text-slate-600">
                        {new Intl.DateTimeFormat("es-VE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(entry.createdAt)}
                        {entry.actorName ? ` · ${entry.actorName}` : ""}
                      </p>
                    </div>
                    <p
                      className={`text-sm font-bold tabular-nums ${
                        entry.amountCents < BigInt(0)
                          ? "text-rose-200"
                          : "text-emerald-200"
                      }`}
                    >
                      {entry.amountCents > BigInt(0) ? "+" : ""}
                      {formatBsFromCents(entry.amountCents)}
                    </p>
                  </article>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Summary({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good?: boolean;
}) {
  return (
    <article className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p
        className={`mt-1.5 text-lg font-black tabular-nums ${
          good === undefined
            ? "text-white"
            : good
              ? "text-emerald-300"
              : "text-rose-300"
        }`}
      >
        {value}
      </p>
    </article>
  );
}

function ledgerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    TICKET_APPROVED: "Pago aprobado",
    LOGISTICS_COMMISSION: "Comisión logística",
    PRIZE_PAYOUT: "Premio",
    CARRYOVER_IN: "Acumulado recibido",
    CARRYOVER_OUT: "Acumulado transferido",
    OPENING_BALANCE: "Saldo inicial",
    ADJUSTMENT: "Ajuste administrativo",
  };
  return labels[type] ?? "Movimiento contable";
}
