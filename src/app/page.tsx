import Link from "next/link";
import { redirect } from "next/navigation";
import { InstallAppButton } from "@/app/components/install-app-button";
import { getCurrentUser } from "@/lib/auth";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/app");

  return (
    <main className="page-enter relative flex min-h-screen items-center overflow-hidden bg-[radial-gradient(ellipse_at_55%_20%,rgba(127,29,29,0.2),transparent_38%),#090a0f] px-5 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.13]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-14 lg:grid-cols-[1.2fr_.8fr]">
        <section>
          <Link className="inline-flex items-center gap-3" href="/">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-400 to-red-700 text-lg font-black text-white shadow-lg shadow-red-950/40">M</span>
            <span>
              <span className="block text-sm font-black tracking-[0.18em]">MAFER HIPISMO</span>
              <span className="mt-1 block text-[10px] font-semibold tracking-[0.25em] text-emerald-400">LA RINCONADA · 5Y6</span>
            </span>
          </Link>
          <p className="mt-16 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            La emoción de cada válida
          </p>
          <h1 className="mt-6 max-w-2xl text-5xl font-black leading-[1.02] tracking-tight text-white sm:text-6xl">
            Tu 5y6.
            <span className="block text-emerald-400">Tu jugada.</span>
            La Rinconada.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
            Arma tu cuadro, envía tu pago móvil y sigue cada jornada con información oficial y transparencia.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <InstallAppButton />
            <Link className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-400 px-6 text-sm font-extrabold text-white shadow-lg shadow-red-950/30 transition hover:-translate-y-0.5 hover:bg-emerald-300 hover:shadow-red-900/30" href="/login">Iniciar sesión</Link>
            <Link className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]" href="/register">Crear cuenta</Link>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/[0.08] pt-6 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
            <span>Pagos verificados</span>
            <span>Tickets personales</span>
            <span>Resultados transparentes</span>
          </div>
        </section>
        <aside className="hidden lg:block">
          <div className="rounded-3xl border border-white/[0.09] bg-[#0c1419]/80 p-6 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">La Rinconada</p>
                <p className="mt-1 text-lg font-bold text-white">El 5y6</p>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-emerald-300">La Rinconada</span>
            </div>
            {[1, 2, 3, 4, 5, 6].map((leg) => (
              <div className="flex items-center gap-4 border-b border-white/[0.05] py-4 last:border-0" key={leg}>
                <span className="flex size-8 items-center justify-center rounded-lg bg-white/[0.04] text-xs font-bold text-emerald-300">{leg}</span>
                <div className="flex flex-1 gap-1.5">
                  {[0, 1, 2, 3].map((item) => (
                    <span className={`h-1.5 flex-1 rounded-full ${item < 3 ? "bg-emerald-400/70" : "bg-white/10"}`} key={item} />
                  ))}
                </div>
                <span className="text-[10px] font-medium text-slate-500">VÁLIDA {leg}</span>
              </div>
            ))}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-emerald-400/[0.07] p-4">
              <span className="text-xs font-medium text-slate-300">Un espacio. Seis válidas.</span>
              <span className="text-xs font-bold text-emerald-300">MAFER 5Y6</span>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
