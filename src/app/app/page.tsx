import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";

export default async function PlayerDashboardPage() {
  await connection();
  const raceDay = process.env.DATABASE_URL
    ? await prisma.raceDay.findFirst({
        where: { status: "OPEN" },
        orderBy: { date: "asc" },
        select: { date: true, carryoverAmount: true },
      })
    : null;

  return (
    <div>
      <header className="page-enter mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Tu espacio</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Hola, jugador</h1>
        <p className="mt-2 text-sm text-slate-400">Todo lo que necesitas para tu 5y6, en un solo lugar.</p>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-red-400/15 bg-[linear-gradient(115deg,#261318,#15151c_58%,#111219)] p-6 shadow-2xl shadow-black/15 sm:p-8">
        <div className="absolute -right-10 -top-20 size-64 rounded-full border border-red-400/10" />
        <div className="absolute -right-2 -top-12 size-48 rounded-full border border-red-400/[0.08]" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {raceDay ? "Jornada abierta" : "Próxima jornada"}
          </span>
          <h2 className="mt-5 text-2xl font-bold text-white sm:text-3xl">La carrera comienza aquí.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {raceDay
              ? `La Rinconada · ${new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(raceDay.date)}`
              : "Las próximas válidas y el pozo se publicarán al abrir la jornada."}
          </p>
          <Link className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-400 px-5 text-sm font-extrabold text-white shadow-lg shadow-red-950/25 transition hover:-translate-y-0.5 hover:bg-emerald-300" href="/app/play">
            Armar mi 5y6
            <span aria-hidden="true" className="ml-3 text-lg">→</span>
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <DashboardModule href="/app/play" number="01" title="Jugar 5y6" detail="Selecciona tus ejemplares" />
        <DashboardModule href="/app/tickets" number="02" title="Mis tickets" detail="Consulta y sigue tus jugadas" />
        <DashboardModule href="/app/board" number="03" title="Pizarra oficial" detail="Transparencia de la jornada" />
      </section>
    </div>
  );
}

function DashboardModule({
  href,
  number,
  title,
  detail,
}: {
  href: string;
  number: string;
  title: string;
  detail: string;
}) {
  return (
    <Link className="group rounded-2xl border border-white/[0.07] bg-[#14151c] p-5 shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-red-500/30 hover:bg-[#191a22] hover:shadow-red-950/15" href={href}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-[0.15em] text-emerald-400">{number} / MÓDULO</span>
        <span className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-emerald-300">→</span>
      </div>
      <h2 className="mt-7 font-semibold text-white">{title}</h2>
      <p className="mt-1.5 text-xs text-slate-500">{detail}</p>
    </Link>
  );
}
