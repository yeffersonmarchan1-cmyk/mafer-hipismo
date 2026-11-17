"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppButton() {
  const [installed, setInstalled] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (installed) return null;

  async function handleInstall() {
    if (!installPrompt) {
      setIsIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
      setShowInstructions(true);
      return;
    }
    const prompt = installPrompt;
    setInstallPrompt(null);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    else {
      setIsIos(/iPhone|iPad|iPod/i.test(navigator.userAgent));
      setShowInstructions(true);
    }
  }

  return (
    <>
      <button
        aria-label="Instalar MAFER Hipismo en este dispositivo"
        className="pwa-install-control inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/[0.08] px-2.5 text-[10px] font-bold text-red-200 transition hover:border-red-400/50 hover:bg-red-500/15 sm:px-3 sm:text-xs"
        onClick={handleInstall}
        type="button"
      >
        <svg aria-hidden="true" className="size-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 16v4h14v-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
        </svg>
        <span className="sm:hidden">App</span>
        <span className="hidden sm:inline">Instalar app</span>
      </button>

      {showInstructions && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowInstructions(false);
          }}
        >
          <section
            aria-labelledby="install-title"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#15161e] p-5 shadow-2xl shadow-black/50 sm:p-6"
            role="dialog"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">MAFER Hipismo</p>
                <h2 className="mt-2 text-lg font-bold text-white" id="install-title">Instala la app</h2>
              </div>
              <button
                aria-label="Cerrar instrucciones"
                className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-slate-400 hover:text-white"
                onClick={() => setShowInstructions(false)}
                type="button"
              >
                Cerrar
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {isIos
                ? "En Safari, toca Compartir y luego “Agregar a pantalla de inicio”. Confirma con “Agregar” para tener MAFER Hipismo junto a tus aplicaciones."
                : "Abre el menú de tu navegador y elige “Instalar aplicación” o “Agregar a pantalla de inicio”. Si no aparece esa opción, abre esta página en Chrome o en el navegador principal de tu dispositivo."}
            </p>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              La instalación requiere conexión segura HTTPS. La app necesita internet para consultar jornadas y guardar tus jugadas.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
