"use client";

import { useActionState } from "react";
import { saveSystemConfig, type AdminActionState } from "@/app/admin/actions";

export function SettingsForm({
  initial,
}: {
  initial: {
    paymentBank: string;
    paymentCedula: string;
    paymentPhone: string;
    infoMessage: string;
  };
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    saveSystemConfig,
    {},
  );
  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium text-slate-300">
          Banco
          <input
            autoComplete="organization"
            className="field mt-2"
            defaultValue={initial.paymentBank}
            maxLength={100}
            name="paymentBank"
            placeholder="Banco receptor"
            required
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Cédula o RIF receptor
          <input
            className="field mt-2"
            defaultValue={initial.paymentCedula}
            maxLength={24}
            name="paymentCedula"
            placeholder="V-12345678"
            required
          />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Teléfono Pago Móvil
          <input
            autoComplete="tel"
            className="field mt-2"
            defaultValue={initial.paymentPhone}
            inputMode="tel"
            maxLength={24}
            name="paymentPhone"
            placeholder="+58 412 123 4567"
            required
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-300">
        Mensaje para jugadores
        <textarea
          className="field mt-2 min-h-24 resize-y"
          defaultValue={initial.infoMessage}
          maxLength={1000}
          name="infoMessage"
          placeholder="Instrucciones adicionales para realizar el Pago Móvil."
        />
      </label>
      {state.error && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-200" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-500/20 bg-green-500/[0.08] px-4 py-3 text-sm text-green-200" role="status">
          {state.success}
        </p>
      )}
      <button className="button-primary" disabled={pending} type="submit">
        {pending && <span aria-hidden="true" className="spinner" />}
        {pending ? "Guardando..." : "Guardar configuración"}
      </button>
    </form>
  );
}
