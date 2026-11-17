"use client";

import { useActionState } from "react";
import {
  resetUserPassword,
  setUserActive,
  type AdminActionState,
} from "@/app/admin/actions";

function ActionMessage({ state }: { state: AdminActionState }) {
  if (state.error) {
    return (
      <p className="mt-2 text-[10px] text-rose-200" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="mt-2 text-[10px] text-green-200" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}

export function UserActiveAction({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    setUserActive,
    {},
  );
  return (
    <form action={formAction}>
      <input name="userId" type="hidden" value={userId} />
      <input name="active" type="hidden" value={String(!isActive)} />
      <button
        className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-slate-200 transition hover:border-red-400/40 hover:text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Guardando..." : isActive ? "Desactivar" : "Activar"}
      </button>
      <ActionMessage state={state} />
    </form>
  );
}

export function UserPasswordAction({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    resetUserPassword,
    {},
  );
  return (
    <details className="group">
      <summary className="cursor-pointer text-[10px] font-semibold text-red-200 hover:text-red-100">
        Restablecer contraseña
      </summary>
      <form action={formAction} className="mt-3 grid gap-2 sm:grid-cols-2">
        <input name="userId" type="hidden" value={userId} />
        <label className="text-[10px] text-slate-400">
          Nueva contraseña (mín. 10 caracteres)
          <input
            autoComplete="new-password"
            className="field mt-1"
            maxLength={72}
            minLength={10}
            name="password"
            required
            type="password"
          />
        </label>
        <label className="text-[10px] text-slate-400">
          Confirmar contraseña
          <input
            autoComplete="new-password"
            className="field mt-1"
            maxLength={72}
            minLength={10}
            name="confirmPassword"
            required
            type="password"
          />
        </label>
        <div className="sm:col-span-2">
          <ActionMessage state={state} />
          <button
            className="mt-2 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-[10px] font-bold text-red-100 transition hover:bg-red-500/15 disabled:opacity-50"
            disabled={pending}
            type="submit"
          >
            {pending ? "Actualizando..." : "Guardar contraseña nueva"}
          </button>
        </div>
      </form>
    </details>
  );
}
