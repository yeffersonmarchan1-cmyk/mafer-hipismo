"use client";

import { useActionState, useMemo, useState } from "react";
import { submitTicket, type TicketSubmissionState } from "@/app/app/play/actions";
import { formatBs, formatBsFromCents } from "@/lib/currency";
import { formatVenezuelanPhone } from "@/lib/auth-validation";

type Horse = {
  id: string;
  legNumber: number;
  saddlecloth: number;
  name: string;
  gazetteOrder: number;
};

const money = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 0 });

export function PlayCardSelector({
  dateLabel,
  carryoverAmount,
  horses,
  raceDayId,
  venue,
  payment,
}: {
  dateLabel: string;
  carryoverAmount: string;
  horses: Horse[];
  raceDayId: string;
  venue: string;
  payment: {
    bank: string;
    cedula: string;
    phone: string;
    message: string;
  };
}) {
  const [state, formAction, pending] = useActionState<TicketSubmissionState, FormData>(
    submitTicket,
    {},
  );
  const [activeLeg, setActiveLeg] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [paymentReference, setPaymentReference] = useState("");
  const [hasProofFile, setHasProofFile] = useState(false);

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
  const combinations = counts.some((count) => count === 0)
    ? BigInt(0)
    : counts.reduce((total, count) => total * BigInt(count), BigInt(1));
  const amountCents = combinations * BigInt(500);
  const activeHorses = horses
    .filter((horse) => horse.legNumber === activeLeg)
    .sort((a, b) => a.gazetteOrder - b.gazetteOrder);
  const selectedCount = counts.reduce((total, count) => total + count, 0);
  const canSubmit = counts.every((count) => count > 0);

  function toggleHorse(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="page-enter mx-auto max-w-5xl pb-32">
      <input name="raceDayId" type="hidden" value={raceDayId} />
      <input
        name="selections"
        type="hidden"
        value={JSON.stringify(
          selectionsByLeg.map((selections) => selections.map((horse) => horse.id)),
        )}
      />
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-400">
          Módulo 01 · Jugador
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
          Jugar Cuadro Perfecto
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Arma tu cuadro con los ejemplares oficiales de La Rinconada.
        </p>
      </header>

      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#14151c] p-4 shadow-xl shadow-black/10 sm:px-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            Jornada · {venue === "Valencia" ? "Hipódromo de Valencia" : "Hipódromo La Rinconada"}
          </p>
          <p className="mt-1 text-sm font-semibold text-white">{dateLabel}</p>
        </div>
        <div className="rounded-xl border border-red-500/15 bg-red-500/[0.06] px-4 py-2.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">
            Pozo total
          </p>
          <p className="mt-0.5 text-lg font-black tabular-nums text-red-300">
            {formatBs(carryoverAmount)}
          </p>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#12131a] shadow-2xl shadow-black/15">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-sm font-bold text-white">Arma tu combinación</h2>
            <p className="mt-1 text-xs text-slate-500">
              Puedes marcar uno o varios ejemplares por válida.
            </p>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold text-slate-400">
            {selectedCount} {selectedCount === 1 ? "selección" : "selecciones"}
          </span>
        </header>

        <div className="grid grid-cols-6 gap-1.5 border-b border-white/[0.07] p-3 sm:gap-2 sm:p-4">
          {counts.map((count, index) => {
            const legNumber = index + 1;
            const active = legNumber === activeLeg;
            return (
              <button
                aria-pressed={active}
                className={`group flex min-h-14 flex-col items-center justify-center rounded-xl border transition sm:min-h-16 ${
                  active
                    ? "border-red-500/50 bg-red-500/[0.11] text-white shadow-lg shadow-red-950/20"
                    : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:border-white/[0.15] hover:bg-white/[0.05]"
                }`}
                key={legNumber}
                onClick={() => setActiveLeg(legNumber)}
                type="button"
              >
                <span
                  className={`text-xs font-black ${active ? "text-red-300" : "text-slate-300"}`}
                >
                  V{legNumber}
                </span>
                <span className="mt-0.5 text-[9px] text-slate-500">
                  {count ? `${count} marc.` : "Elegir"}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-400">
                Válida {activeLeg}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {activeHorses.length} ejemplares activos · orden de Gaceta
              </p>
            </div>
            <div className="flex gap-1.5">
              <button
                aria-label="Válida anterior"
                className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400 hover:border-red-500/30 hover:text-white disabled:opacity-30"
                disabled={activeLeg === 1}
                onClick={() => setActiveLeg((leg) => Math.max(1, leg - 1))}
                type="button"
              >
                ←
              </button>
              <button
                aria-label="Válida siguiente"
                className="flex size-9 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400 hover:border-red-500/30 hover:text-white disabled:opacity-30"
                disabled={activeLeg === 6}
                onClick={() => setActiveLeg((leg) => Math.min(6, leg + 1))}
                type="button"
              >
                →
              </button>
            </div>
          </div>

          {activeHorses.length ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {activeHorses.map((horse) => {
                const selected = selectedIds.has(horse.id);
                return (
                  <button
                    aria-pressed={selected}
                    className={`group flex min-h-14 items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition active:scale-[0.99] ${
                      selected
                        ? "border-red-500/70 bg-red-950/40 shadow-md shadow-red-950/20"
                        : "border-white/[0.07] bg-white/[0.025] hover:-translate-y-0.5 hover:border-red-500/35 hover:bg-red-950/15 hover:shadow-lg hover:shadow-red-950/15"
                    }`}
                    key={horse.id}
                    onClick={() => toggleHorse(horse.id)}
                    type="button"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-black tabular-nums transition ${
                        selected
                          ? "bg-red-500 text-white shadow-md shadow-red-950/30"
                          : "border border-white/[0.08] bg-[#1a1b23] text-slate-300 group-hover:border-red-500/30 group-hover:text-red-200"
                      }`}
                    >
                      {horse.saddlecloth}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">
                      {horse.name}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                        selected
                          ? "border-red-400 bg-red-500 text-white"
                          : "border-white/15 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-10 text-center">
              <p className="text-sm font-semibold text-slate-300">
                Inscritos pendientes
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Administración aún no publica ejemplares activos para esta válida.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mb-5 rounded-2xl border border-white/[0.08] bg-[#14151c] p-4 shadow-xl shadow-black/10 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-400">
              Pago móvil
            </p>
            <h2 className="mt-1 text-sm font-bold text-white">
              Datos para realizar tu pago
            </h2>
          </div>
          <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[9px] font-semibold text-slate-400">
            Bs. 5 por combinación
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["Banco", payment.bank || "Pendiente de configurar"],
            ["Cédula", payment.cedula || "—"],
            ["Teléfono", payment.phone ? formatVenezuelanPhone(payment.phone) : "—"],
          ].map(([label, value]) => (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2.5" key={label}>
              <dt className="text-[9px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
              <dd className="mt-1 break-all text-xs font-semibold text-slate-200">{value}</dd>
            </div>
          ))}
        </dl>
        {payment.message && (
          <p className="mt-3 text-xs leading-5 text-slate-400">{payment.message}</p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-slate-300">
            Teléfono origen del pago
            <input
              autoComplete="tel"
              className="field mt-2"
              inputMode="tel"
              maxLength={24}
              name="sourcePhone"
              placeholder="0412 123 4567"
              required
              type="tel"
            />
            <span className="mt-1 block text-[10px] text-slate-500">
              Número venezolano, sin código de país.
            </span>
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Imagen del comprobante
            <input
              accept="image/jpeg,image/png,image/webp"
              className="field mt-2 file:mr-3 file:rounded-md file:border-0 file:bg-red-500/15 file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-red-200"
              name="proof"
              onChange={(event) =>
                setHasProofFile(Boolean(event.currentTarget.files?.length))
              }
              required={!paymentReference.trim()}
              type="file"
            />
            <span className="mt-1 block text-[10px] text-slate-500">
              JPG, PNG o WebP · máximo 5 MB · guardado privado.
            </span>
          </label>
          <label className="block text-xs font-medium text-slate-300">
            O referencia del pago
            <input
              autoComplete="off"
              className="field mt-2"
              maxLength={100}
              name="paymentReference"
              onChange={(event) => setPaymentReference(event.currentTarget.value)}
              placeholder="Número de referencia"
              required={!hasProofFile}
            />
            <span className="mt-1 block text-[10px] text-slate-500">
              Puedes adjuntar la imagen, indicar la referencia o enviar ambos.
            </span>
          </label>
        </div>
      </section>

      {state.error && (
        <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-xs leading-5 text-rose-200" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="mb-4 rounded-xl border border-green-500/20 bg-green-500/[0.08] px-4 py-3 text-xs leading-5 text-green-200" role="status">
          {state.success}
        </p>
      )}

      <p className="mt-4 text-[11px] leading-5 text-slate-500">
        Solo aparecen caballos activos de la lista oficial. Los retirados quedan
        excluidos de nuevas jugadas.
      </p>

      <aside
        aria-label="Resumen de la jugada"
        className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 border-t border-white/[0.09] bg-[#111219]/95 px-3 py-3 shadow-[0_-16px_50px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:px-5 lg:inset-x-auto lg:bottom-5 lg:left-[calc(18rem+1.5rem)] lg:right-8 lg:rounded-2xl lg:border lg:px-5"
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 sm:gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Combinaciones</span>
              <span className="text-slate-700">× Bs. 5</span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-3">
              <span className="text-lg font-black tabular-nums text-white sm:text-xl">
                {money.format(combinations)}
              </span>
              <span className="text-xs font-bold tabular-nums text-red-300">
                {formatBsFromCents(amountCents)}
              </span>
            </div>
          </div>
          <button
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-red-700 px-4 text-xs font-extrabold text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:shadow-red-900/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:px-5 sm:text-sm"
            disabled={!canSubmit || pending}
            type="submit"
          >
            {pending && <span aria-hidden="true" className="spinner" />}
            {pending ? "Enviando..." : "Enviar jugada"}
            <span aria-hidden="true" className="text-base">→</span>
          </button>
        </div>
      </aside>
    </form>
  );
}
