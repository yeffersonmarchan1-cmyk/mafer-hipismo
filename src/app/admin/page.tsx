import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { raceDayVenueLabel } from "@/lib/race-day";

const modules = [
  { href: "/admin/jornadas", label: "Jornadas e inscritos", detail: "Crear reuniones, importar Gaceta y administrar retirados.", icon: "01" },
  { href: "/admin/manual-bets", label: "Jugadas manuales", detail: "Registrar y aprobar tickets de personas sin cuenta.", icon: "02" },
  { href: "/admin/payments", label: "Validación de pagos", detail: "Revisar comprobantes, montos y tickets pendientes.", icon: "03" },
  { href: "/admin/settlement", label: "Resultados y liquidación", detail: "Registrar ganadores y calcular el pozo.", icon: "04" },
  { href: "/admin/settings", label: "Configuración", detail: "Pago móvil, tasa de cambio y mensajes.", icon: "05" },
  { href: "/admin/users", label: "Usuarios", detail: "Consultar cuentas y estado de acceso.", icon: "06" },
  { href: "/admin/ledger", label: "Libro contable", detail: "Conciliar pagos, comisiones, premios y acumulados.", icon: "07" },
  { href: "/admin/alerts", label: "Alertas operativas", detail: "Revisar errores del cron, Storage y liquidaciones.", icon: "08" },
];

export default async function AdminDashboardPage() {
  await connection();
  const [pendingPayments, openRaceDays, pendingAlerts] = await Promise.all([
    prisma.ticket.count({ where: { status: "PENDING" } }),
    prisma.raceDay.findMany({
      where: { status: "OPEN" },
      orderBy: [{ venue: "asc" }, { date: "asc" }],
      select: { id: true, date: true, venue: true, entries: { select: { id: true } } },
    }),
    prisma.operationalAlert.count({ where: { acknowledgedAt: null } }),
  ]);

  return (
    <div className="page-enter">
      <header className="mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Administración · Hipódromos</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Centro de control</h1>
        <p className="mt-2 text-sm text-slate-400">Gestiona cada parte de MAFER Hipismo desde módulos independientes.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="rounded-2xl border border-white/[0.07] bg-[#0d151a] p-5">
          <p className="text-xs text-slate-500">Jornadas abiertas</p>
          {openRaceDays.length ? openRaceDays.map((day) => (
            <p className="mt-2 text-xs font-semibold text-white" key={day.id}>
              {raceDayVenueLabel(day.venue)} · {new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeZone: "UTC" }).format(day.date)}
              <span className="ml-1 font-normal text-slate-500">({day.entries.length} ejemplares)</span>
            </p>
          )) : <p className="mt-3 text-lg font-bold text-white">Sin jornada</p>}
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
        <Link
          className="rounded-2xl border border-amber-400/10 bg-[#0d151a] p-5 transition hover:border-amber-400/30"
          href="/admin/alerts"
        >
          <p className="text-xs text-slate-500">Alertas operativas</p>
          <p className="mt-3 text-3xl font-bold text-amber-200">{pendingAlerts}</p>
          <p className="mt-1 text-xs text-slate-500">Pendientes de revisión</p>
        </Link>
      </section>
      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Espacios de trabajo</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Módulos administrativos</h2>
          </div>
          <span className="text-[10px] text-slate-500">01 — 08</span>
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
