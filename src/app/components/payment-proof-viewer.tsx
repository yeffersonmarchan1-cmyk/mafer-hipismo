"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function PaymentProofViewer({
  ticketId,
  label = "Ver comprobante",
}: {
  ticketId: string;
  label?: string;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) return;
    return () => URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  async function viewProof() {
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch(
        `/api/payment-proofs/${encodeURIComponent(ticketId)}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        },
      );
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const message =
          body &&
          typeof body === "object" &&
          "error" in body &&
          typeof body.error === "string"
            ? body.error
            : `No se pudo cargar el comprobante (HTTP ${response.status}).`;
        throw new Error(message);
      }
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) {
        throw new Error("El servidor no devolvió una imagen válida.");
      }
      setImageUrl(URL.createObjectURL(blob));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudo abrir el comprobante.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        className="text-[10px] font-semibold text-red-300 underline decoration-red-500/30 underline-offset-4 hover:text-red-200 disabled:opacity-50"
        disabled={loading}
        onClick={viewProof}
        type="button"
      >
        {loading ? "Cargando comprobante..." : label}
      </button>
      {errorMessage && (
        <p className="mt-2 basis-full text-xs text-rose-300" role="alert">
          {errorMessage}
        </p>
      )}
      {imageUrl && (
        <div
          aria-label="Comprobante de pago"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
          role="dialog"
          onClick={(event) => {
            if (event.target === event.currentTarget) setImageUrl(null);
          }}
        >
          <div className="relative h-[85vh] w-[min(90vw,64rem)] rounded-xl bg-[#111219] p-3">
            <button
              aria-label="Cerrar comprobante"
              className="absolute right-2 top-2 z-10 rounded-lg bg-black/75 px-3 py-2 text-sm font-bold text-white"
              onClick={() => setImageUrl(null)}
              type="button"
            >
              Cerrar
            </button>
            <Image
              alt="Comprobante de pago del ticket"
              className="rounded-lg object-contain"
              fill
              unoptimized
              src={imageUrl}
            />
          </div>
        </div>
      )}
    </>
  );
}
