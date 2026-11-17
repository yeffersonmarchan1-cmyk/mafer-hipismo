import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/actions/auth";
import { BrandMark } from "@/app/components/brand-mark";
import { InstallAppButton } from "@/app/components/install-app-button";
import { ModuleNavigation } from "@/app/components/module-navigation";

type ModuleShellProps = {
  children: ReactNode;
  fullName: string;
  role: "USER" | "ADMIN";
};

const playerModules = [
  { href: "/app/play", label: "Jugar Cuadro Perfecto", icon: "trophy" },
  { href: "/app/tickets", label: "Mis tickets", icon: "ticket" },
  { href: "/app/board", label: "Pizarra oficial", icon: "clipboard" },
] as const;

const adminModules = [
  { href: "/admin", label: "Panel general", icon: "shield" },
  { href: "/admin/jornadas", label: "Jornadas e inscritos", icon: "calendar" },
  { href: "/admin/payments", label: "Validación de pagos", icon: "badge-check" },
  { href: "/admin/settlement", label: "Resultados", icon: "trophy" },
  { href: "/admin/settings", label: "Configuración", icon: "settings" },
  { href: "/admin/users", label: "Usuarios", icon: "users" },
] as const;

export function ModuleShell({ children, fullName, role }: ModuleShellProps) {
  const modules = role === "ADMIN" ? adminModules : playerModules;

  return (
    <div className="min-h-screen bg-[#090a0f] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 flex-col border-r border-white/[0.07] bg-[#0d0e14] lg:flex">
        <Link className="flex items-center gap-3 border-b border-white/[0.07] px-6 py-6" href={role === "ADMIN" ? "/admin" : "/app"}>
          <BrandMark className="size-11 rounded-xl shadow-lg shadow-red-950/40" size={44} />
          <span>
            <span className="block text-sm font-bold tracking-[0.14em]">MAFER</span>
            <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.25em] text-red-400">
              HIPISMO · LA RINCONADA
            </span>
          </span>
        </Link>

        <div className="px-4 pt-7">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            {role === "ADMIN" ? "Administración" : "Mi espacio"}
          </p>
          <ModuleNavigation modules={modules} />
        </div>

        <div className="mt-auto border-t border-white/[0.07] p-5">
          <div className="flex items-center gap-3 px-2">
            <span className="flex size-9 items-center justify-center rounded-full border border-red-500/20 bg-red-950/40 text-xs font-bold text-red-200">
              {fullName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-slate-200">{fullName}</span>
              <span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-500">
                {role === "ADMIN" ? "Administrador" : "Jugador"}
              </span>
            </span>
          </div>
          <form action={logout} className="mt-4">
            <button className="w-full rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-rose-500/30 hover:text-rose-300" type="submit">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/[0.07] bg-[#090a0f]/90 px-5 backdrop-blur-xl sm:px-8">
          <Link className="flex items-center gap-2.5 lg:hidden" href={role === "ADMIN" ? "/admin" : "/app"}>
            <BrandMark className="size-8 rounded-lg" size={32} />
            <span className="text-xs font-bold tracking-[0.14em]">MAFER HIPISMO</span>
          </Link>
          <div className="hidden text-xs text-slate-500 sm:block">
            LA RINCONADA <span className="mx-2 text-slate-700">/</span>
            <span className="text-slate-300">{role === "ADMIN" ? "CENTRO DE CONTROL" : "CUADRO PERFECTO"}</span>
          </div>
          <div className="ml-auto">
            <InstallAppButton />
          </div>
          <div className="hidden items-center gap-2 rounded-full border border-green-900/60 bg-green-950/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-green-300 sm:flex">
            <span className="size-1.5 animate-pulse rounded-full bg-green-400" />
            En línea
          </div>
          <form action={logout} className="ml-3 lg:hidden">
            <button className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400" type="submit">
              Salir
            </button>
          </form>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 pb-24 pt-7 sm:px-8 sm:pt-9 lg:px-10 lg:pb-10">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 overflow-x-auto border-t border-white/[0.09] bg-[#0d0e14]/95 backdrop-blur-xl lg:hidden">
        <ModuleNavigation modules={modules} mobile />
      </nav>
    </div>
  );
}
