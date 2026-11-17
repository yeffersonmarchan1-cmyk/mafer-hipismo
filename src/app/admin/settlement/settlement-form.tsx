"use client";

import { useActionState } from "react";
import { settleRaceDay, type AdminActionState } from "@/app/admin/actions";

type Entry = { id: string; legNumber: number; saddlecloth: number; name: string };

export function SettlementForm({
  raceDayId,
  entries,
}: {
  raceDayId: string;
  entries: Entry[];
}) {
  const [state, formAction, pending] = useActionState<AdminActionState, FormData>(
    settleRaceDay,
    {},
  );
  return (
    <form action={formAction} className="mt-5 space-y-4">
      <input name="raceDayId" type="hidden" value={raceDayId} />
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => {
          const leg = index + 1;
          const horses = entries.filter((entry) => entry.legNumber === leg);
          return (
            <label className="block text-xs font-medium text-slate-300" key={leg}>
              Ganador · Válida {leg}
              <select className="field mt-2" defaultValue="" name={`winner-${leg}`} required>
                <option disabled value="">Selecciona el caballo ganador</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.saddlecloth} · {horse.name}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
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
        {pending ? "Liquidando..." : "Registrar resultados y liquidar"}
      </button>
      <p className="text-[10px] leading-5 text-slate-500">
        Solo se premian tickets aprobados con seis aciertos. En cada jornada se
        retiene el 10% de comisión logística; si no hay ganadores, el 90%
        restante se traslada a la siguiente jornada.
      </p>
    </form>
  );
}
