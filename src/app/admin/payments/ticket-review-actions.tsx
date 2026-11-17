"use client";

import { useActionState } from "react";
import { reviewTicket, type AdminActionState } from "@/app/admin/actions";

export function TicketReviewActions({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    reviewTicket,
    {},
  );
  return (
    <form action={formAction} className="mt-4 border-t border-white/[0.07] pt-4">
      <input name="ticketId" type="hidden" value={ticketId} />
      {state.error && (
        <p className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-200" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-3 rounded-lg border border-green-500/20 bg-green-500/[0.08] px-3 py-2 text-xs text-green-200" role="status">
          {state.success}
        </p>
      )}
      <label className="block text-[10px] font-medium text-slate-400">
        Motivo (opcional si rechazas)
        <input
          className="field mt-1.5"
          maxLength={500}
          name="rejectionReason"
          placeholder="Referencia ilegible, monto diferente..."
        />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          className="min-h-10 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 text-xs font-bold text-rose-200 transition hover:bg-rose-500/15 disabled:opacity-50"
          disabled={pending}
          name="decision"
          type="submit"
          value="REJECTED"
        >
          {pending ? "Procesando..." : "Rechazar"}
        </button>
        <button
          className="min-h-10 rounded-lg border border-green-500/20 bg-green-500/[0.08] px-3 text-xs font-bold text-green-200 transition hover:bg-green-500/15 disabled:opacity-50"
          disabled={pending}
          name="decision"
          type="submit"
          value="APPROVED"
        >
          {pending ? "Procesando..." : "Aprobar pago"}
        </button>
      </div>
    </form>
  );
}
