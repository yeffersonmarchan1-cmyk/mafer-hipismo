import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/app/components/brand-mark";
import { AuthForm } from "@/app/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/app");

  return (
    <main className="page-enter flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_50%_-20%,rgba(127,29,29,0.25),transparent_55%),#090a0f] px-4 py-10">
      <section className="w-full max-w-md">
        <Link className="mb-9 flex items-center justify-center gap-3" href="/">
          <BrandMark className="size-12 rounded-2xl shadow-lg shadow-red-950/40" size={48} />
          <span>
            <span className="block text-base font-black tracking-[0.18em]">MAFER HIPISMO</span>
            <span className="mt-1 block text-center text-[10px] font-semibold tracking-[0.25em] text-emerald-400">
              LA RINCONADA · CUADRO PERFECTO
            </span>
          </span>
        </Link>
        <div className="rounded-2xl border border-white/[0.09] bg-[#0c1419]/95 p-6 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-7">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Acceso seguro</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Bienvenido de vuelta</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Ingresa con la cédula y contraseña de tu cuenta.
            </p>
          </div>
          <AuthForm mode="login" />
          <p className="mt-6 text-center text-sm text-slate-400">
            ¿Primera vez?{" "}
            <Link className="font-semibold text-emerald-300 hover:text-emerald-200" href="/register">
              Crea tu cuenta
            </Link>
          </p>
        </div>
        <p className="mt-5 text-center text-[11px] leading-5 text-slate-600">
          Tus datos y jugadas se mantienen privados y protegidos.
        </p>
      </section>
    </main>
  );
}
