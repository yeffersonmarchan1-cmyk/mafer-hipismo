import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

const modules = [
  { href: "/admin/jornadas", label: "Jornadas e inscritos", detail: "Crear reuniones, importar Gaceta y administrar retirados.", icon: "01" },
  { href: "/admin/payments", label: "Validación de pagos", detail: "Revisar comprobantes, montos y tickets pendientes.", icon: "02" },
  { href: "/admin/settlement", label: "Resultados y liquidación", detail: "Registrar ganadores y calcular el pozo.", icon: "03" },
  { href: "/admin/settings", label: "Configuración", detail: "Pago móvil, tasa de cambio y mensajes.", icon: "04" },
  { href: "/admin/users", label: "Usuarios", detail: "Consultar cuentas y estado de acceso.", icon: "05" },
];

export default async function AdminDashboardPage() {
  await connection();
  const [pendingPayments, openRaceDay] = await Promise.all([
    prisma.ticket.count({ where: { status: "PENDING" } }),
    prisma.raceDay.findFirst({
      where: { status: "OPEN" },
      orderBy: { date: "asc" },
      select: { date: true, entries: { select: { id: true } } },
    }),
  ]);

  return (
    <div className="page-enter">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Administración · La Rinconada</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Centro de control</h1>
        <p className="mt-2 text-sm text-slate-400">Gestiona cada parte de MAFER Hipismo desde módulos independientes.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-white/[0.07] bg-[#0d151a] p-5">
          <p className="text-xs text-slate-500">Jornada abierta</p>
          <p className="mt-3 text-lg font-bold text-white">{openRaceDay ? new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(openRaceDay.date) : "Sin jornada"}</p>
          <p className="mt-1 text-xs text-slate-500">{openRaceDay?.entries.length ?? 0} ejemplares cargados</p>
        </article>
        <article className="rounded-2xl border border-amber-400/10 bg-[#0d151a] p-5">
          <p className="text-xs text-slate-500">Pagos por revisar</p>
          <p className="mt-3 text-3xl font-bold text-amber-200">{pendingPayments}</p>
          <p className="mt-1 text-xs text-slate-500">Tickets pendientes de validación</p>
        </article>
        <article className="rounded-2xl border border-white/[0.07] bg-[#0d151a] p-5">
          <p className="text-xs text-slate-500">Seguridad</p>
          <p className="mt-3 text-lg font-bold text-emerald-300">Roles protegidos</p>
          <p className="mt-1 text-xs text-slate-500">Sesión verificada en cada solicitud</p>
        </article>
      </section>
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Espacios de trabajo</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Módulos administrativos</h2>
          </div>
          <span className="text-[10px] text-slate-500">01 — 05</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {modules.map((module) => (
            <Link className="group flex items-start gap-4 rounded-2xl border border-white/[0.07] bg-[#0d151a] p-5 transition hover:border-emerald-500/25 hover:bg-[#111c20]" href={module.href} key={module.href}>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] text-[10px] font-bold text-emerald-300">{module.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-white">{module.label}</span>
                <span className="mt-1.5 block text-xs leading-5 text-slate-500">{module.detail}</span>
              </span>
              <span className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-emerald-300">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
