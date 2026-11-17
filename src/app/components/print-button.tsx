"use client";

export function PrintButton({ label = "Imprimir / Guardar PDF" }: { label?: string }) {
  return (
    <button
      className="print:hidden rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 py-2 text-[10px] font-bold text-red-200 transition hover:bg-red-500/15"
      onClick={() => window.print()}
      type="button"
    >
      {label}
    </button>
  );
}
