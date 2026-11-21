import Link from "next/link";
import { connection } from "next/server";
import { ManualTicketForm } from "@/app/admin/manual-bets/manual-ticket-form";
import { closeDueRaceDays } from "@/lib/close-race-days";
import { prisma } from "@/lib/prisma";
import { isRaceDayPlayable, raceDayVenueLabel } from "@/lib/race-day";

export default async function ManualBetsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ raceDayId?: string }>;
}) {
  await connection();
  await closeDueRaceDays();
  const { raceDayId } = await searchParams;
  const now = new Date();
  const openDays = await prisma.raceDay.findMany({
    where: { status: "OPEN", OR: [{ closesAt: null }, { closesAt: { gt: now } }] },
    orderBy: [{ date: "asc" }, { venue: "asc" }],
    select: {
      id: true,
      date: true,
      venue: true,
      entries: {
        where: { status: "ACTIVE" },
        orderBy: [{ legNumber: "asc" }, { gazetteOrder: "asc" }],
        select: {
          id: true,
          legNumber: true,
          saddlecloth: true,
          name: true,
          gazetteOrder: true,
        },
      },
    },
  });
  const playableDays = openDays.filter((day) => isRaceDayPlayable(day.entries));
  const selectedDay =
    playableDays.find((day) => day.id === raceDayId) ?? playableDays[0] ?? null;

  return (
    <section className="page-enter mx-auto max-w-6xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">
        Administración · Atención presencial
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
        Jugadas manuales
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
        Carga las jugadas de personas que no utilizan la web. No necesitan crear
        una cuenta; sus tickets quedan registrados en el mismo sistema.
      </p>

      {playableDays.length ? (
        <>
          <nav aria-label="Seleccionar jornada" className="mt-6 flex flex-wrap gap-2">
            {playableDays.map((day) => (
              <Link
                className={`rounded-lg border px-3 py-2 text-xs ${
                  selectedDay?.id === day.id
                    ? "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-100"
                    : "border-white/10 text-slate-400 hover:text-white"
                }`}
                href={`/admin/manual-bets?raceDayId=${encodeURIComponent(day.id)}`}
                key={day.id}
              >
                {raceDayVenueLabel(day.venue)} ·{" "}
                {new Intl.DateTimeFormat("es-VE", {
                  dateStyle: "short",
                  timeZone: "UTC",
                }).format(day.date)}
              </Link>
            ))}
          </nav>
          {selectedDay && (
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-[#0d151a] p-5 sm:p-7">
              <ManualTicketForm
                dateLabel={new Intl.DateTimeFormat("es-VE", {
                  dateStyle: "long",
                  timeZone: "UTC",
                }).format(selectedDay.date)}
                horses={selectedDay.entries}
                raceDayId={selectedDay.id}
                venue={selectedDay.venue}
              />
            </div>
          )}
        </>
      ) : (
        <div className="mt-7 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
          <p className="text-sm font-semibold text-white">No hay jornadas abiertas para jugar</p>
          <p className="mt-2 text-sm text-slate-400">
            Publica una jornada con inscritos activos en sus seis válidas para registrar jugadas.
          </p>
          <Link className="mt-4 inline-block text-xs font-semibold text-emerald-300" href="/admin/jornadas">
            Ir a jornadas e inscritos →
          </Link>
        </div>
      )}
    </section>
  );
}
