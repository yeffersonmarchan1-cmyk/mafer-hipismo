"use client";

import { useActionState } from "react";
import {
  addLedgerAdjustment,
  type AdminActionState,
} from "@/app/admin/actions";

export function LedgerAdjustmentForm({ raceDayId }: { raceDayId: string }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    addLedgerAdjustment,
    {},
  );
  return (
    <form action={formAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
      <input name="raceDayId" type="hidden" value={raceDayId} />
      <label className="text-xs text-slate-400">
        Ajuste en Bs. (negativo para reducir)
        <input
          className="field mt-2"
          inputMode="decimal"
          name="amount"
          placeholder="0,00"
          required
        />
      </label>
      <label className="text-xs text-slate-400">
        Motivo obligatorio
        <input
          className="field mt-2"
          maxLength={300}
          minLength={5}
          name="reason"
          placeholder="Describe y documenta el motivo"
          required
        />
      </label>
      <button className="button-primary self-end" disabled={pending} type="submit">
        {pending ? "Guardando..." : "Registrar ajuste"}
      </button>
      {state.error && (
        <p className="text-xs text-rose-300 sm:col-span-3" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-xs text-emerald-300 sm:col-span-3" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}
