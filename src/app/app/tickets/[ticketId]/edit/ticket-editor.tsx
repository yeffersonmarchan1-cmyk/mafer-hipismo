"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  saveTicketEdits,
  type TicketEditState,
} from "@/app/app/tickets/actions";
import { formatBsFromCents } from "@/lib/currency";

type Horse = {
  id: string;
  legNumber: number;
  saddlecloth: number;
  name: string;
  gazetteOrder: number;
};

export function TicketEditor({
  amountPaidCents,
  dateLabel,
  horses,
  initialSelections,
  requiredHorseCount,
  ticketId,
  ticketNumber,
}: {
  amountPaidCents: string;
  dateLabel: string;
  horses: Horse[];
  initialSelections: { legNumber: number; horseId: string }[];
  requiredHorseCount: number;
  ticketId: string;
  ticketNumber: number;
}) {
  const [state, formAction, pending] = useActionState<TicketEditState, FormData>(
    saveTicketEdits,
    {},
  );
  const [activeLeg, setActiveLeg] = useState(1);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(initialSelections.map((selection) => selection.horseId)),
  );
  const [selectionNotice, setSelectionNotice] = useState("");
  const originalCounts = Array.from({ length: 6 }, (_, index) =>
    initialSelections.filter((selection) => selection.legNumber === index + 1)
      .length,
  );

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
  const counts = selectionsByLeg.map((selections) => selections.length);
  const selectedCount = counts.reduce((total, count) => total + count, 0);
  const combinations = counts.some((count) => count === 0)
    ? BigInt(0)
    : counts.reduce((total, count) => total * BigInt(count), BigInt(1));
  const editCostCents = combinations * BigInt(500);
  const paidCents = BigInt(amountPaidCents);
  const costWithinPaidAmount = editCostCents <= paidCents;
  const canSave =
    selectedCount === requiredHorseCount &&
    counts.every((count, index) => count === originalCounts[index]) &&
    costWithinPaidAmount;
  const activeHorses = horses
    .filter((horse) => horse.legNumber === activeLeg)
    .sort((left, right) => left.gazetteOrder - right.gazetteOrder);

  function toggleHorse(id: string) {
    const horse = activeHorses.find((item) => item.id === id);
    if (!horse) return;

    if (
      !selectedIds.has(id) &&
      counts[horse.legNumber - 1] >= originalCounts[horse.legNumber - 1]
    ) {
      setSelectionNotice(
        `La válida ${horse.legNumber} ya tiene sus ${originalCounts[horse.legNumber - 1]} cupos. Desmarca un caballo de esta válida para reemplazarlo.`,
      );
      return;
    }

    setSelectionNotice("");
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="page-enter mx-auto max-w-5xl pb-24">
      <input name="ticketId" type="hidden" value={ticketId} />
      <input
        name="selections"
        type="hidden"
        value={JSON.stringify(
          selectionsByLeg.map((selections) =>
            selections.map((horse) => horse.id),
          ),
        )}
      />
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">
          Mis tickets · Edición
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Editar jugada #{ticketNumber}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Jornada del {dateLabel}. La edición solo está disponible mientras siga abierta.
        </p>
      </header>

      <section className="mb-5 grid gap-3 rounded-2xl border border-white/[0.08] bg-[#14151c] p-4 sm:grid-cols-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Ejemplares seleccionados
          </p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${selectedCount === requiredHorseCount ? "text-emerald-300" : "text-amber-200"}`}>
            {selectedCount} / {requiredHorseCount} requeridos
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Costo de la jugada editada
          </p>
          <p className={`mt-1 text-lg font-bold tabular-nums ${costWithinPaidAmount ? "text-white" : "text-rose-300"}`}>
            {formatBsFromCents(editCostCents)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Monto pagado originalmente
          </p>
          <p className="mt-1 text-lg font-bold tabular-nums text-white">
            {formatBsFromCents(paidCents)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12131a]">
        <header className="border-b border-white/[0.07] px-4 py-4">
          <h2 className="text-sm font-bold text-white">Selecciona tus ejemplares</h2>
          <p className="mt-1 text-xs text-slate-500">
            Mantén en cada válida la cantidad original de caballos. Para reemplazar uno, desmárcalo primero en esa misma válida. Solo aparecen ejemplares activos.
          </p>
        </header>

        <div className="grid grid-cols-6 gap-1.5 border-b border-white/[0.07] p-3 sm:gap-2 sm:p-4">
          {counts.map((count, index) => {
            const legNumber = index + 1;
            const active = legNumber === activeLeg;
            return (
              <button
                aria-pressed={active}
                className={`flex min-h-14 flex-col items-center justify-center rounded-xl border transition ${
                  active
                    ? "border-red-500/50 bg-red-500/[0.11] text-white"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:bg-white/[0.05]"
                }`}
                key={legNumber}
                onClick={() => setActiveLeg(legNumber)}
                type="button"
              >
                <span className="text-xs font-black">V{legNumber}</span>
                <span className="mt-0.5 text-[9px] text-slate-500">
                  {count} / {originalCounts[index]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-2 p-4 sm:grid-cols-2 sm:p-5">
          {activeHorses.map((horse) => {
            const selected = selectedIds.has(horse.id);
            return (
              <button
                aria-pressed={selected}
                className={`flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                  selected
                    ? "border-red-500/70 bg-red-950/40"
                    : "border-white/[0.07] bg-white/[0.025] hover:border-red-500/35"
                }`}
                key={horse.id}
                onClick={() => toggleHorse(horse.id)}
                type="button"
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-black tabular-nums ${selected ? "bg-red-500 text-white" : "border border-white/[0.08] bg-[#1a1b23] text-slate-300"}`}>
                  {horse.saddlecloth}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">
                  {horse.name}
                </span>
                <span className="text-xs text-slate-400">{selected ? "✓" : ""}</span>
              </button>
            );
          })}
          {activeHorses.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-400">
              No hay ejemplares activos en esta válida.
            </p>
          )}
        </div>
      </section>

      {selectionNotice && (
        <p role="status" className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-sm text-amber-200">
          {selectionNotice}
        </p>
      )}
      {selectedCount === requiredHorseCount && !costWithinPaidAmount && (
        <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-200">
          El costo calculado supera el monto pagado. Ajusta la combinación para continuar.
        </p>
      )}
      {state.error && (
        <p role="alert" className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-3 text-sm text-rose-200">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-sm text-emerald-200">
          {state.success}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
        <Link
          className="rounded-xl border border-white/[0.1] px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/[0.04]"
          href="/app/tickets"
        >
          Volver a Mis Tickets
        </Link>
        <button
          className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canSave || pending}
          type="submit"
        >
          {pending ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>
    </form>
  );
}
