"use client";

import { useActionState } from "react";
import { importInscriptions, type ImportState } from "./actions";

const initialState: ImportState = {};

export function InscriptionImporter({ initialDate }: { initialDate: string }) {
  const [state, action, pending] = useActionState(importInscriptions, initialState);

  return (
    <form action={action} className="space-y-5">
      <label className="block text-sm font-medium text-slate-200">
        Fecha del domingo
        <input
          className="field mt-2"
          type="date"
          name="raceDate"
          defaultValue={initialDate}
          required
        />
      </label>

      <label className="block max-w-sm text-sm font-medium text-slate-200">
        Hora de la primera válida
        <input
          className="field mt-2"
          name="firstRaceAt"
          required
          type="datetime-local"
        />
        <span className="mt-1.5 block text-xs font-normal text-slate-500">
          Hora de Caracas. El sistema programará el cierre 30 minutos antes.
        </span>
      </label>

      <div className="grid gap-4 lg:grid-cols-3">
        <label className="block text-sm font-medium text-slate-200">
          PDF oficial
          <input
            className="field mt-2 file:mr-3 file:rounded-md file:border-0 file:bg-red-500/15 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-red-200"
            type="file"
            name="file"
            accept="application/pdf,.pdf"
          />
          <span className="mt-1.5 block text-xs font-normal text-slate-500">
            Máximo 10 MB; debe permitir seleccionar texto.
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-200">
          Enlace digital
          <input
            className="field mt-2"
            type="url"
            name="sourceUrl"
            placeholder="https://revista.example/inscritos.pdf"
          />
          <span className="mt-1.5 block text-xs font-normal text-slate-500">
            Solo se descargan dominios configurados como autorizados.
          </span>
        </label>

        <label className="block text-sm font-medium text-slate-200">
          Texto copiado
          <textarea
            className="field mt-2 min-h-24 resize-y"
            name="sourceText"
            placeholder={"VÁLIDA 1\n1 NOMBRE DEL EJEMPLAR\n..."}
            maxLength={1_000_000}
          />
        </label>
      </div>

      {state.error && (
        <p role="alert" className="rounded-lg border border-rose-500/20 bg-rose-500/[0.08] px-4 py-3 text-sm text-rose-200">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-lg border border-green-500/20 bg-green-500/[0.08] px-4 py-3 text-sm text-green-200">
          {state.success}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-5">
        <p className="max-w-2xl text-xs leading-5 text-slate-500">
          La importación agrega o actualiza las gualdrapas del mismo domingo. Los ejemplares
          marcados como retirados no se reactivan al volver a importar.
        </p>
        <button className="button-primary" type="submit" disabled={pending}>
          {pending && <span aria-hidden="true" className="spinner" />}
          {pending ? "Procesando inscritos..." : "Importar jornada"}
        </button>
      </div>
    </form>
  );
}
