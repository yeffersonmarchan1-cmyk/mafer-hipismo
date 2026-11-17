import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatBs } from "@/lib/currency";
import { isRaceDayPlayable, raceDayVenueLabel } from "@/lib/race-day";

export default async function PlayerDashboardPage() {
  await connection();
  const raceDays = process.env.DATABASE_URL
    ? await prisma.raceDay.findMany({
        where: { status: "OPEN" },
        orderBy: [{ date: "asc" }, { venue: "asc" }],
        select: {
          id: true,
          date: true,
          venue: true,
          carryoverAmountVes: true,
          tickets: {
            where: { status: "APPROVED" },
            select: { amountVes: true },
          },
          entries: {
            where: { status: "ACTIVE" },
            select: { legNumber: true },
          },
        },
      })
    : [];
  const playableDays = raceDays.filter((raceDay) => isRaceDayPlayable(raceDay.entries));

  return (
    <div>
      <header className="page-enter mb-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Tu espacio</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Hola, jugador</h1>
        <p className="mt-2 text-sm text-slate-400">Todo lo que necesitas para tu Cuadro Perfecto, en un solo lugar.</p>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-red-400/15 bg-[linear-gradient(115deg,#261318,#15151c_58%,#111219)] p-6 shadow-2xl shadow-black/15 sm:p-8">
        <div className="absolute -right-10 -top-20 size-64 rounded-full border border-red-400/10" />
        <div className="absolute -right-2 -top-12 size-48 rounded-full border border-red-400/[0.08]" />
        <div className="relative max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {playableDays.length ? `${playableDays.length} jornada${playableDays.length === 1 ? "" : "s"} abierta${playableDays.length === 1 ? "" : "s"}` : "Próxima jornada"}
          </span>
          <h2 className="mt-5 text-2xl font-bold text-white sm:text-3xl">La carrera comienza aquí.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {playableDays.length
              ? "Elige el hipódromo y la jornada donde quieres jugar."
              : "Las próximas jornadas se publicarán aquí cuando administración las abra."}
          </p>
        </div>
      </section>

      {playableDays.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-bold text-white">Jornadas disponibles para jugar</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {playableDays.map((raceDay) => (
              <article className="rounded-2xl border border-white/[0.08] bg-[#14151c] p-5" key={raceDay.id}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">{raceDayVenueLabel(raceDay.venue)}</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {new Intl.DateTimeFormat("es-VE", { dateStyle: "long", timeZone: "UTC" }).format(raceDay.date)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Pozo acumulado: {formatBs(
                    raceDay.tickets.reduce(
                      (total, ticket) => total.add(ticket.amountVes),
                      raceDay.carryoverAmountVes,
                    ).toFixed(2),
                  )}
                </p>
                <Link className="mt-4 inline-flex min-h-10 items-center justify-center rounded-xl bg-emerald-400 px-4 text-xs font-extrabold text-white transition hover:bg-emerald-300" href={`/app/play?raceDayId=${raceDay.id}`}>
                  Jugar en este hipódromo
                  <span aria-hidden="true" className="ml-2">→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <DashboardModule href="/app/play" number="01" title="Jugar Cuadro Perfecto" detail="Selecciona tus ejemplares" />
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
