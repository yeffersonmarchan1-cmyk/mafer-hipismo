"use client";

import { useActionState, type FormEvent } from "react";
import {
  deleteRaceDay,
  type AdminActionState,
} from "@/app/admin/actions";

const initialState: AdminActionState = {};

export function RaceDayDeleteAction({
  raceDayId,
  raceDayLabel,
}: {
  raceDayId: string;
  raceDayLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    deleteRaceDay,
    initialState,
  );

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (
      !window.confirm(
        `¿Eliminar permanentemente la jornada del ${raceDayLabel} y todos sus tickets, apuestas, resultados y pagos? Esta acción no se puede deshacer.`,
      )
    ) {
      event.preventDefault();
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <form action={formAction} onSubmit={confirmDelete}>
        <input name="raceDayId" type="hidden" value={raceDayId} />
        <button
          className="rounded-lg border border-rose-500/25 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:border-rose-400/50 hover:bg-rose-500/[0.08] hover:text-rose-200 disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Eliminando..." : "Eliminar jornada y datos"}
        </button>
      </form>
      {state.error && (
        <p className="max-w-sm text-xs text-rose-200" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-xs text-green-200" role="status">
          {state.success}
        </p>
      )}
    </div>
  );
}
