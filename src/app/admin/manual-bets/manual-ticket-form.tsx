"use client";

import { useActionState, useMemo, useState } from "react";
import { formatBsFromCents } from "@/lib/currency";
import {
  TICKET_MINIMUM_AMOUNT_CENTS,
  TICKET_MINIMUM_AMOUNT_MESSAGE,
  TICKET_PRICE_PER_COMBINATION_CENTS,
} from "@/lib/ticket-pricing";
import {
  createManualTicket,
  type ManualTicketState,
} from "@/app/admin/manual-bets/actions";

type Horse = {
  id: string;
  legNumber: number;
  saddlecloth: number;
  name: string;
  gazetteOrder: number;
};

const initialState: ManualTicketState = {};

export function ManualTicketForm({
  dateLabel,
  horses,
  raceDayId,
  venue,
}: {
  dateLabel: string;
  horses: Horse[];
  raceDayId: string;
  venue: string;
}) {
  const [state, formAction, pending] = useActionState(createManualTicket, initialState);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectionsByLeg = useMemo(
    () =>
      Array.from({ length: 6 }, (_, index) =>
        horses.filter(
          (horse) =>
            horse.legNumber === index + 1 && selectedIds.has(horse.id),
        ),
      ),
    [horses, selectedIds],
  );
  const counts = selectionsByLeg.map((leg) => leg.length);
  const complete = counts.every((count) => count > 0);
  const combinations = complete
    ? counts.reduce((total, count) => total * BigInt(count), BigInt(1))
    : BigInt(0);
  const amountCents = combinations * TICKET_PRICE_PER_COMBINATION_CENTS;
  const belowMinimum = complete && amountCents < TICKET_MINIMUM_AMOUNT_CENTS;

  function toggleHorse(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      <input name="raceDayId" type="hidden" value={raceDayId} />
      <input
        name="selections"
        type="hidden"
        value={JSON.stringify(
          selectionsByLeg.map((leg) => leg.map((horse) => horse.id)),
        )}
      />
      <header>
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          {venue === "Valencia" ? "Hipódromo de Valencia" : "Hipódromo La Rinconada"}
        </p>
        <p className="mt-1 text-sm font-semibold text-white">{dateLabel}</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          Registra la jugada que recibes presencialmente. Se aprobará de inmediato y
          entrará en el pozo, la pizarra y la liquidación.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-300">
          Nombre del jugador
          <input
            autoComplete="name"
            className="field mt-2"
            maxLength={120}
            name="guestName"
            placeholder="Nombre y apellido"
            required
          />
        </label>
        <label className="text-xs font-medium text-slate-300">
          Teléfono (opcional)
          <input
            autoComplete="tel"
            className="field mt-2"
            inputMode="tel"
            maxLength={24}
            name="guestPhone"
            placeholder="0412 123 4567"
            type="tel"
          />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {selectionsByLeg.map((selections, index) => {
          const legNumber = index + 1;
          const legHorses = horses
            .filter((horse) => horse.legNumber === legNumber)
            .sort((a, b) => a.gazetteOrder - b.gazetteOrder);
          return (
            <fieldset
              className="rounded-xl border border-white/[0.07] bg-[#111219] p-3"
              key={legNumber}
            >
              <legend className="px-1 text-xs font-bold text-white">
                Válida {legNumber} · {selections.length} seleccionado(s)
              </legend>
              <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {legHorses.map((horse) => {
                  const checked = selectedIds.has(horse.id);
                  return (
                    <label
                      className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${
                        checked
                          ? "border-red-500/40 bg-red-500/[0.08] text-white"
                          : "border-white/[0.05] text-slate-300 hover:bg-white/[0.03]"
                      }`}
                      key={horse.id}
                    >
                      <input
                        checked={checked}
                        className="accent-red-500"
                        onChange={() => toggleHorse(horse.id)}
                        type="checkbox"
                      />
                      <span className="font-bold">{horse.saddlecloth}.</span>
                      <span className="truncate">{horse.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </div>

      {state.error && (
        <p className="rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-200" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="rounded-lg border border-green-500/20 bg-green-500/[0.08] px-3 py-2 text-xs text-green-200" role="status">
          {state.success}
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-4">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">
            {combinations.toString()} combinación(es) · Bs. 5 por combinación
          </p>
          <p className="mt-1 text-lg font-black text-white">
            {formatBsFromCents(amountCents)}
          </p>
          {belowMinimum && (
            <p className="mt-1 text-[10px] text-amber-300" role="alert">
              {TICKET_MINIMUM_AMOUNT_MESSAGE}
            </p>
          )}
        </div>
        <button
          className="button-primary min-h-11 px-5 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!complete || belowMinimum || pending}
          type="submit"
        >
          {pending ? "Registrando..." : "Registrar y aprobar jugada"}
        </button>
      </footer>
    </form>
  );
}
