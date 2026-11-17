import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/app/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/app");

  return (
    <main className="page-enter flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_50%_-20%,rgba(127,29,29,0.25),transparent_55%),#090a0f] px-4 py-10">
      <section className="w-full max-w-md">
        <Link className="mb-8 flex items-center justify-center gap-3" href="/">
          <span className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-400 to-red-700 text-base font-black text-white shadow-lg shadow-red-950/40">M</span>
          <span>
            <span className="block text-sm font-black tracking-[0.18em]">MAFER HIPISMO</span>
            <span className="mt-1 block text-center text-[9px] font-semibold tracking-[0.25em] text-emerald-400">LA RINCONADA · 5Y6</span>
          </span>
        </Link>
        <div className="rounded-2xl border border-white/[0.09] bg-[#0c1419]/95 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-6">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Nuevo jugador</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Crea tu cuenta</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Completa tus datos para guardar y consultar tus tickets.
            </p>
          </div>
          <AuthForm mode="register" />
          <p className="mt-6 text-center text-sm text-slate-400">
            ¿Ya tienes cuenta?{" "}
            <Link className="font-semibold text-emerald-300 hover:text-emerald-200" href="/login">
              Inicia sesión
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
