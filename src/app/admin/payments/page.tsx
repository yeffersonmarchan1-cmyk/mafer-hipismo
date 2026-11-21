import Link from "next/link";
import { connection } from "next/server";
import { TicketReviewActions } from "@/app/admin/payments/ticket-review-actions";
import { PaymentProofViewer } from "@/app/components/payment-proof-viewer";
import { formatBs } from "@/lib/currency";
import { formatVenezuelanPhone } from "@/lib/auth-validation";
import { prisma } from "@/lib/prisma";
import { raceDayVenueLabel } from "@/lib/race-day";

export default async function PaymentsAdminPage() {
  await connection();
  const [tickets, openDays] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: "PENDING" },
      orderBy: { submittedAt: "asc" },
      take: 100,
      include: {
        user: { select: { fullName: true, cedula: true, whatsappPhone: true } },
        raceDay: { select: { date: true, venue: true, status: true } },
        paymentProof: true,
        selections: {
          orderBy: [{ legNumber: "asc" }, { currentHorse: { gazetteOrder: "asc" } }],
          include: {
            currentHorse: { select: { legNumber: true, saddlecloth: true, name: true } },
          },
        },
      },
    }),
    prisma.raceDay.findMany({
      where: { status: { in: ["OPEN", "CLOSED"] } },
      orderBy: [{ venue: "asc" }, { date: "desc" }],
      select: {
        id: true,
        date: true,
        venue: true,
        carryoverAmountVes: true,
        tickets: { where: { status: "APPROVED" }, select: { amountVes: true } },
      },
    }),
  ]);

  return (
    <section className="page-enter mx-auto max-w-6xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">Módulo 02 · Administración</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Validación de pagos</h1>
      <p className="mt-2 text-sm text-slate-400">Revisa comprobantes y confirma cada ticket antes de sumarlo al pozo.</p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-amber-400/15 bg-[#1a1d26] p-4">
          <p className="text-xs text-slate-500">Pendientes</p>
          <p className="mt-2 text-2xl font-black text-amber-200">{tickets.length}</p>
          <p className="mt-1 text-[10px] text-slate-500">Máximo 100 por página</p>
        </article>
      </section>
      <section className="mt-4 grid gap-3 sm:grid-cols-2">
        {openDays.map((day) => {
          const pool = day.tickets.reduce(
            (total, ticket) => total.add(ticket.amountVes),
            day.carryoverAmountVes,
          );
          return (
            <article className="rounded-2xl border border-red-500/15 bg-[#1a1d26] p-4" key={day.id}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{raceDayVenueLabel(day.venue)}</p>
              <p className="mt-1 text-xs text-slate-400">{new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(day.date)}</p>
              <p className="mt-2 text-2xl font-black tabular-nums text-red-300">{formatBs(pool.toFixed(2))}</p>
              <p className="mt-1 text-[10px] text-slate-500">Pozo: arrastre más pagos aprobados</p>
              <Link className="mt-1 inline-block text-[10px] font-semibold text-red-300 hover:text-red-200" href="/admin/jornadas">Administrar jornadas →</Link>
            </article>
          );
        })}
      </section>

      <div className="mt-6 space-y-4">
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
            <p className="text-sm font-semibold text-white">No hay pagos pendientes</p>
            <p className="mt-2 text-xs text-slate-500">Los tickets nuevos aparecerán aquí.</p>
          </div>
        ) : tickets.map((ticket) => (
          <article className="rounded-2xl border border-white/[0.08] bg-[#1a1d26] p-4 shadow-lg shadow-black/10 sm:p-5" key={ticket.id}>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
              <div>
                <p className="text-sm font-bold text-white">Ticket #{ticket.ticketNumber} · {ticket.user?.fullName ?? ticket.guestName ?? "Jugador presencial"}</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  {raceDayVenueLabel(ticket.raceDay.venue)} · {new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeZone: "UTC" }).format(ticket.raceDay.date)} · {ticket.user ? `C.I. ${ticket.user.cedula} · WhatsApp ${formatVenezuelanPhone(ticket.user.whatsappPhone)} · ` : ""}{new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" }).format(ticket.submittedAt)}
                </p>
              </div>
              <span className="rounded-full border border-amber-400/15 bg-amber-400/[0.07] px-3 py-1 text-[10px] font-bold text-amber-200">Pendiente</span>
            </header>
            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.65fr)]">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => {
                  const leg = index + 1;
                  const horses = ticket.selections.filter((selection) => selection.legNumber === leg);
                  return (
                    <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-2.5" key={leg}>
                      <p className="text-[9px] font-bold uppercase text-slate-500">Válida {leg}</p>
                      <p className="mt-1 text-[10px] leading-4 text-slate-200">
                        {horses.map(({ currentHorse }) => `${currentHorse.saddlecloth} ${currentHorse.name}`).join(", ") || "—"}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-[#111219] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Monto esperado</p>
                    <p className="mt-1 text-sm font-black text-white">{formatBs(ticket.amountVes.toFixed(2))}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{ticket.combinations.toString()} combinaciones</p>
                    {ticket.paymentProof && <p className="mt-2 text-[10px] text-slate-400">Origen: {formatVenezuelanPhone(ticket.paymentProof.sourcePhone)}</p>}
                    {ticket.paymentProof?.paymentReference && <p className="mt-1 break-all text-[10px] text-slate-400">Referencia: {ticket.paymentProof.paymentReference}</p>}
                  </div>
                  {ticket.paymentProof?.storageKey && ticket.paymentProof.storageBucket ? (
                    <PaymentProofViewer
                      label="Ver comprobante"
                      ticketId={ticket.id}
                    />
                  ) : ticket.paymentProof?.paymentReference ? (
                    <span className="text-[10px] text-emerald-300">Referencia recibida</span>
                  ) : <span className="text-[10px] text-rose-300">Sin comprobante</span>}
                </div>
              </div>
            </div>
            <TicketReviewActions ticketId={ticket.id} />
          </article>
        ))}
      </div>
    </section>
  );
}
