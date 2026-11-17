"use client";

import { useActionState, useState, type FormEvent } from "react";
import {
  addHorse,
  addHorsesBulk,
  clearRaceLeg,
  createManualRaceDay,
  deleteHorse,
  toggleHorseStatus,
  updateHorse,
  type HorseManagementState,
} from "@/app/actions";

type Horse = {
  id: string;
  legNumber: number;
  saddlecloth: number;
  name: string;
  status: "ACTIVE" | "WITHDRAWN";
};

const initialState: HorseManagementState = {};

function ActionMessage({ state }: { state: HorseManagementState }) {
  if (state.error) {
    return (
      <p className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-3 py-2 text-xs text-rose-200" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p className="mt-3 rounded-lg border border-green-500/20 bg-green-500/[0.08] px-3 py-2 text-xs text-green-200" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}

export function ManualRaceDayCreator({ initialDate }: { initialDate: string }) {
  const [state, formAction, pending] = useActionState(createManualRaceDay, initialState);
  return (
    <section className="rounded-2xl border border-red-500/15 bg-[#0d151a] p-5 sm:p-7">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Carga sin importador</p>
      <h2 className="mt-2 text-xl font-semibold text-white">Crear jornada para carga manual</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Programa la primera válida y luego carga cada carrera individualmente o pega sus inscritos.
      </p>
      <form action={formAction} className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-xs font-medium text-slate-300">
          Fecha de la jornada
          <input className="field mt-2" defaultValue={initialDate} name="raceDate" required type="date" />
        </label>
        <label className="text-xs font-medium text-slate-300">
          Primera válida (hora de Caracas)
          <input className="field mt-2" defaultValue="14:00" name="firstRaceAt" required type="time" />
        </label>
        <button className="button-primary" disabled={pending} type="submit">
          {pending ? "Creando..." : "Crear jornada"}
        </button>
      </form>
      <ActionMessage state={state} />
    </section>
  );
}

function HorseEntry({ horse }: { horse: Horse }) {
  const [editState, editAction, editPending] = useActionState(updateHorse, initialState);
  const [statusState, statusAction, statusPending] = useActionState(toggleHorseStatus, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteHorse, initialState);

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`¿Eliminar a ${horse.saddlecloth}. ${horse.name}?`)) {
      event.preventDefault();
    }
  }

  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:p-4">
      <form action={editAction} className="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center">
        <input name="id" type="hidden" value={horse.id} />
        <label className="sr-only" htmlFor={`horse-number-${horse.id}`}>Número de gualdrapa</label>
        <input
          className="field !py-2 text-center font-bold"
          defaultValue={horse.saddlecloth}
          id={`horse-number-${horse.id}`}
          max={99}
          min={1}
          name="saddlecloth"
          required
          type="number"
        />
        <label className="sr-only" htmlFor={`horse-name-${horse.id}`}>Nombre del ejemplar</label>
        <input
          className="field !py-2"
          defaultValue={horse.name}
          id={`horse-name-${horse.id}`}
          maxLength={120}
          name="name"
          required
        />
        <button className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-red-400/40 hover:text-white disabled:opacity-50" disabled={editPending} type="submit">
          {editPending ? "Guardando..." : "Guardar"}
        </button>
      </form>
      <ActionMessage state={editState} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${horse.status === "ACTIVE" ? "bg-green-400/10 text-green-300" : "bg-rose-400/10 text-rose-300"}`}>
          {horse.status === "ACTIVE" ? "Activo" : "Retirado"}
        </span>
        <div className="flex flex-wrap gap-3">
          <form action={statusAction}>
            <input name="id" type="hidden" value={horse.id} />
            <input name="status" type="hidden" value={horse.status === "ACTIVE" ? "WITHDRAWN" : "ACTIVE"} />
            <button className="text-[10px] font-semibold text-slate-300 underline underline-offset-2 hover:text-white disabled:opacity-50" disabled={statusPending} type="submit">
              {statusPending ? "Actualizando..." : horse.status === "ACTIVE" ? "Marcar retirado" : "Reactivar"}
            </button>
          </form>
          <form action={deleteAction} onSubmit={confirmDelete}>
            <input name="id" type="hidden" value={horse.id} />
            <button className="text-[10px] font-semibold text-rose-300 underline underline-offset-2 hover:text-rose-200 disabled:opacity-50" disabled={deletePending} type="submit">
              {deletePending ? "Eliminando..." : "Eliminar"}
            </button>
          </form>
        </div>
      </div>
      <ActionMessage state={statusState} />
      <ActionMessage state={deleteState} />
    </li>
  );
}

export function HorseManagementPanel({
  raceDayId,
  horses,
}: {
  raceDayId: string;
  horses: Horse[];
}) {
  const [selectedLeg, setSelectedLeg] = useState(1);
  const [singleState, singleAction, singlePending] = useActionState(addHorse, initialState);
  const [bulkState, bulkAction, bulkPending] = useActionState(addHorsesBulk, initialState);
  const [clearState, clearAction, clearPending] = useActionState(clearRaceLeg, initialState);
  const selectedHorses = horses
    .filter((horse) => horse.legNumber === selectedLeg)
    .sort((a, b) => a.saddlecloth - b.saddlecloth);

  function confirmClear(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(`¿Limpiar todos los ejemplares de la válida ${selectedLeg}?`)) {
      event.preventDefault();
    }
  }

  return (
    <section className="border-b border-white/[0.06] p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">Administrar carreras</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Carga manual de ejemplares</h3>
          <p className="mt-1 text-xs text-slate-500">Agrega, edita, retira o limpia una válida. Los cambios se guardan en la base de datos.</p>
        </div>
        <span className="rounded-full border border-white/[0.08] px-3 py-1.5 text-[10px] font-semibold text-slate-300">
          {selectedHorses.length} ejemplares
        </span>
      </div>

      <div aria-label="Seleccionar válida" className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6" role="group">
        {Array.from({ length: 6 }, (_, index) => {
          const leg = index + 1;
          const count = horses.filter((horse) => horse.legNumber === leg).length;
          return (
            <button
              aria-pressed={selectedLeg === leg}
              className={`rounded-xl border px-3 py-3 text-left transition ${selectedLeg === leg ? "border-red-500/40 bg-red-500/10 text-white shadow-lg shadow-red-950/20" : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-white"}`}
              key={leg}
              onClick={() => setSelectedLeg(leg)}
              type="button"
            >
              <span className="block text-xs font-bold">{leg}ª válida</span>
              <span className="mt-1 block text-[9px] opacity-70">{count} caballos</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <form action={singleAction} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <input name="raceDayId" type="hidden" value={raceDayId} />
            <input name="legNumber" type="hidden" value={selectedLeg} />
            <h4 className="text-xs font-bold text-white">Agregar un ejemplar</h4>
            <div className="mt-3 grid grid-cols-[5rem_minmax(0,1fr)_auto] gap-2">
              <label className="sr-only" htmlFor="manual-saddlecloth">Número de gualdrapa</label>
              <input className="field !py-2 text-center" id="manual-saddlecloth" max={99} min={1} name="saddlecloth" placeholder="#" required type="number" />
              <label className="sr-only" htmlFor="manual-horse-name">Nombre del caballo</label>
              <input className="field !py-2" id="manual-horse-name" maxLength={120} name="name" placeholder="Nombre del caballo" required />
              <button className="button-primary !min-h-0 px-3 py-2 text-xs" disabled={singlePending} type="submit">
                {singlePending ? "..." : "Agregar"}
              </button>
            </div>
            <ActionMessage state={singleState} />
          </form>

          <form action={bulkAction} className="rounded-xl border border-red-500/10 bg-red-500/[0.025] p-4">
            <input name="raceDayId" type="hidden" value={raceDayId} />
            <input name="legNumber" type="hidden" value={selectedLeg} />
            <h4 className="text-xs font-bold text-white">Pegado masivo — {selectedLeg}ª válida</h4>
            <p className="mt-1 text-[10px] leading-5 text-slate-500">Un ejemplar por línea: <span className="text-slate-300">1. Pecadora</span> o <span className="text-slate-300">1 - Pecadora</span>. Se actualizan coincidencias sin reactivar retirados.</p>
            <textarea className="field mt-3 min-h-36 resize-y font-mono text-xs" maxLength={20_000} name="horseList" placeholder={"1. Pecadora\n2 - Relámpago\n3 Estrella"} required />
            <button className="button-primary mt-3" disabled={bulkPending} type="submit">
              {bulkPending && <span aria-hidden="true" className="spinner" />}
              {bulkPending ? "Cargando lista..." : "Cargar lista"}
            </button>
            <ActionMessage state={bulkState} />
          </form>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xs font-bold text-white">Ejemplares de la {selectedLeg}ª válida</h4>
            <form action={clearAction} onSubmit={confirmClear}>
              <input name="raceDayId" type="hidden" value={raceDayId} />
              <input name="legNumber" type="hidden" value={selectedLeg} />
              <button className="rounded-lg border border-rose-500/20 px-3 py-2 text-[10px] font-bold text-rose-200 transition hover:bg-rose-500/10 disabled:opacity-50" disabled={clearPending || selectedHorses.length === 0} type="submit">
                {clearPending ? "Limpiando..." : "Limpiar válida"}
              </button>
            </form>
          </div>
          <ActionMessage state={clearState} />
          {selectedHorses.length ? (
            <ul className="mt-3 max-h-[34rem] space-y-2 overflow-y-auto pr-1">
              {selectedHorses.map((horse) => <HorseEntry horse={horse} key={horse.id} />)}
            </ul>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-500">
              Esta válida todavía no tiene ejemplares.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
