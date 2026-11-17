import { connection } from "next/server";
import Link from "next/link";
import { formatBs } from "@/lib/currency";
import { requireUser } from "@/lib/auth";
import { formatVenezuelanPhone } from "@/lib/auth-validation";
import { prisma } from "@/lib/prisma";
import { raceDayVenueLabel } from "@/lib/race-day";

const ticketStatus = {
  PENDING: "Pendiente de validación",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
} as const;

export default async function TicketsPage() {
  await connection();
  const user = await requireUser();
  const tickets = await prisma.ticket.findMany({
    where: { userId: user.id },
    orderBy: { submittedAt: "desc" },
    take: 50,
    include: {
      raceDay: { select: { date: true, venue: true, status: true, closesAt: true } },
      selections: {
        orderBy: [{ legNumber: "asc" }, { currentHorse: { gazetteOrder: "asc" } }],
        include: { currentHorse: { select: { saddlecloth: true, name: true, status: true } } },
      },
      paymentProof: {
        select: {
          sourcePhone: true,
          uploadedAt: true,
          paymentReference: true,
          storageBucket: true,
          storageKey: true,
        },
      },
    },
  });

  return (
    <div className="page-enter mx-auto max-w-5xl">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 02 · Privado</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Mis tickets</h1>
        <p className="mt-2 text-sm text-slate-400">Solo tú puedes consultar tus jugadas y comprobantes.</p>
      </header>
      <section className="mt-7 space-y-4">
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-[#0d151a] p-8 text-center">
            <p className="text-sm font-semibold text-white">Aún no tienes tickets</p>
            <p className="mt-2 text-sm text-slate-400">Tus jugadas aparecerán aquí después de enviarlas.</p>
          </div>
        ) : tickets.map((ticket) => (
          <article key={ticket.id} className="rounded-2xl border border-white/[0.08] bg-[#0d151a] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Ticket #{ticket.ticketNumber}</p>
                <p className="mt-1 text-xs text-slate-400">{raceDayVenueLabel(ticket.raceDay.venue)}</p>
                <p className="mt-1 text-xs text-slate-500">{new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(ticket.raceDay.date)}</p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${ticket.status === "APPROVED" ? "bg-green-400/10 text-green-300" : ticket.status === "REJECTED" ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-200"}`}>
                {ticketStatus[ticket.status]}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => {
                const legNumber = index + 1;
                const selections = ticket.selections.filter((selection) => selection.legNumber === legNumber);
                return (
                  <div key={legNumber} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Válida {legNumber}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-200">
                      {selections.map((selection) => `${selection.currentHorse.saddlecloth} ${selection.currentHorse.name}${selection.wasSubstituted ? " · sustituto" : ""}`).join(", ") || "—"}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] text-slate-500">
              {ticket.paymentProof
                ? `Pago reportado · teléfono ${formatVenezuelanPhone(ticket.paymentProof.sourcePhone)}${ticket.paymentProof.paymentReference ? ` · referencia ${ticket.paymentProof.paymentReference}` : ""}`
                : "Sin comprobante asociado"}
              {ticket.status === "REJECTED" && ticket.rejectionReason ? ` · Motivo: ${ticket.rejectionReason}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
              <p className="text-[10px] text-slate-500">
                Importe: {formatBs(ticket.amountVes.toFixed(2))}
              </p>
              <div className="flex flex-wrap items-center gap-4">
                {ticket.raceDay.status === "OPEN" &&
                  (!ticket.raceDay.closesAt || ticket.raceDay.closesAt > new Date()) && (
                    <Link
                      className="text-[10px] font-semibold text-emerald-300 underline decoration-emerald-500/30 underline-offset-4 hover:text-emerald-200"
                      href={`/app/tickets/${ticket.id}/edit`}
                    >
                      Editar Jugada
                    </Link>
                  )}
                {ticket.paymentProof?.storageKey && ticket.paymentProof.storageBucket && (
                  <a
                    className="text-[10px] font-semibold text-red-300 underline decoration-red-500/30 underline-offset-4 hover:text-red-200"
                    href={`/api/payment-proofs/${ticket.id}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Ver mi comprobante
                  </a>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
