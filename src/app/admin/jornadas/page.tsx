import Link from "next/link";
import { connection } from "next/server";
import { closeRaceDay } from "@/app/admin/actions";
import { closeDueRaceDays as closeScheduledRaceDays } from "@/lib/close-race-days";
import { InscriptionImporter } from "@/app/inscription-importer";
import {
  HorseManagementPanel,
  ManualRaceDayCreator,
} from "@/app/admin/jornadas/horse-management";
import { RaceDayDeleteAction } from "@/app/admin/jornadas/race-day-delete";
import { prisma } from "@/lib/prisma";
import { raceDayVenues, raceDayVenueLabel } from "@/lib/race-day";

function nextSunday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const getPart = (type: string) => {
    const value = parts.find((part) => part.type === type)?.value;
    if (!value) throw new Error(`No se pudo determinar el componente de fecha ${type}.`);
    return value;
  };
  const date = new Date(Date.UTC(
    Number(getPart("year")),
    Number(getPart("month")) - 1,
    Number(getPart("day")),
    12,
  ));
  date.setUTCDate(date.getUTCDate() + ((7 - date.getUTCDay()) % 7));
  return date.toISOString().slice(0, 10);
}

function formatRaceDate(date: Date): string {
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "full",
    timeZone: "UTC",
  }).format(date);
}

export default async function RaceDaysAdminPage() {
  await connection();
  await closeScheduledRaceDays();
  const raceDays = await prisma.raceDay.findMany({
    orderBy: [{ venue: "asc" }, { date: "desc" }],
    take: 30,
    include: {
      entries: {
        orderBy: [{ legNumber: "asc" }, { gazetteOrder: "asc" }],
      },
    },
  });
  const openDays = raceDays.filter((day) => day.status === "OPEN");
  const activeCount = openDays.reduce(
    (total, day) => total + day.entries.filter((horse) => horse.status === "ACTIVE").length,
    0,
  );
  const entryCount = openDays.reduce((total, day) => total + day.entries.length, 0);

  return (
    <div className="page-enter space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 01 · Administración</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Jornadas e inscritos</h1>
          <p className="mt-2 text-sm text-slate-400">Administra por separado las jornadas de La Rinconada y Valencia.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          PostgreSQL conectado
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Jornadas abiertas" value={String(openDays.length)} />
        <StatCard label="Ejemplares activos" value={String(activeCount)} />
        <StatCard label="Inscritos registrados" value={String(entryCount)} />
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#0d151a] p-5 sm:p-7">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Actualización semanal</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Importar inscritos oficiales</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Selecciona el hipódromo, luego sube el PDF oficial, pega texto o usa un enlace permitido. Cada jornada conserva su propia lista y orden de inscritos.
          </p>
        </div>
        <InscriptionImporter initialDate={nextSunday()} />
      </section>

      <ManualRaceDayCreator initialDate={nextSunday()} />

      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Archivo</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Jornadas registradas</h2>
        </div>
        {raceDays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-sm font-semibold text-white">Aún no hay jornadas</p>
            <p className="mt-2 text-sm text-slate-400">Importa o crea la jornada del hipódromo correspondiente.</p>
          </div>
        ) : raceDayVenues.map((venue) => {
          const venueDays = raceDays.filter((day) => day.venue === venue);
          if (!venueDays.length) return null;
          return (
          <section className="space-y-3" key={venue}>
          <h3 className="text-sm font-bold text-emerald-300">{raceDayVenueLabel(venue)}</h3>
          {venueDays.map((day) => (
          <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d151a]" key={day.id}>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">Jornada · {raceDayVenueLabel(day.venue)}</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{formatRaceDate(day.date)}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {day.inscriptionSource ?? "Origen no registrado"}
                  {day.inscriptionsUpdatedAt
                    ? ` · Actualizado ${new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" }).format(day.inscriptionsUpdatedAt)}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${day.status === "OPEN" ? "bg-emerald-400/10 text-emerald-300" : day.status === "SETTLED" ? "bg-sky-400/10 text-sky-200" : "bg-amber-400/10 text-amber-200"}`}>
                  {day.status === "OPEN" ? "Abierta · acepta apuestas" : day.status === "SETTLED" ? "Finalizada" : "Cerrada · en curso"}
                </span>
                <RaceDayDeleteAction
                  raceDayId={day.id}
                  raceDayLabel={formatRaceDate(day.date)}
                />
              </div>
            </header>

            <RaceDayPhases status={day.status} />

            {day.status === "OPEN" && (
              <form action={closeRaceDay} className="border-b border-white/[0.06] px-4 py-4 sm:px-6">
                <input name="raceDayId" type="hidden" value={day.id} />
                <button className="button-primary min-h-10 px-4 py-2 text-xs" type="submit">
                  Cerrar apuestas · iniciar carreras
                </button>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">
                  Al cerrar, no se aceptarán más cuadros y los tickets aprobados se publicarán en la pizarra.
                </p>
              </form>
            )}

            {day.status === "CLOSED" && (
              <div className="flex flex-wrap gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-6">
                <Link className="button-primary min-h-10 px-4 py-2 text-xs" href={`/admin/settlement?raceDayId=${day.id}`}>
                  Ingresar resultados y finalizar
                </Link>
                <Link className="min-h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-xs font-bold text-emerald-200" href={`/api/admin/race-days/${day.id}/report`}>
                  Descargar PDF de cuadros
                </Link>
              </div>
            )}
            {day.status === "SETTLED" && (
              <div className="border-b border-white/[0.06] px-4 py-4 sm:px-6">
                <Link className="min-h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2 text-xs font-bold text-emerald-200" href={`/api/admin/race-days/${day.id}/report`}>
                  Descargar PDF de cuadros y liquidación
                </Link>
              </div>
            )}

            {day.status !== "SETTLED" ? (
              <HorseManagementPanel
                horses={day.entries.map((horse) => ({
                  id: horse.id,
                  legNumber: horse.legNumber,
                  saddlecloth: horse.saddlecloth,
                  name: horse.name,
                  status: horse.status,
                }))}
                raceDayId={day.id}
              />
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, index) => {
                  const legNumber = index + 1;
                  const horses = day.entries.filter((horse) => horse.legNumber === legNumber);
                  return (
                    <section className="rounded-xl border border-white/[0.06] bg-[#091115] p-4" key={legNumber}>
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white">Válida {legNumber}</h4>
                        <span className="text-[10px] text-slate-500">{horses.filter((horse) => horse.status === "ACTIVE").length} activos</span>
                      </div>
                      {horses.length ? (
                        <ul className="space-y-2">
                          {horses.map((horse) => (
                            <li className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 text-xs text-slate-300" key={horse.id}>
                              <span className="mr-2 font-bold text-white">{horse.saddlecloth}.</span>
                              {horse.name}
                              <span className={`ml-2 text-[9px] font-bold uppercase ${horse.status === "ACTIVE" ? "text-green-300" : "text-rose-300"}`}>
                                {horse.status === "ACTIVE" ? "Activo" : "Retirado"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="py-2 text-xs text-slate-500">Sin ejemplares cargados.</p>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </article>
          ))}
          </section>
          );
        })}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-white/[0.07] bg-[#0d151a] p-4 sm:p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </article>
  );
}

function RaceDayPhases({ status }: { status: "OPEN" | "CLOSED" | "SETTLED" }) {
  const activePhase = status === "OPEN" ? 0 : status === "CLOSED" ? 1 : 2;
  const phases = [
    { title: "Abierta", detail: "Se reciben cuadros" },
    {title: "Cerrada / En curso", detail: "Pizarra y PDF de cuadros disponibles"},
    { title: "Finalizada", detail: "Resultados y ganadores" },
  ];
  return (
    <ol aria-label="Fases de la jornada" className="grid gap-2 border-b border-white/[0.06] p-4 sm:grid-cols-3 sm:p-5">
      {phases.map((phase, index) => {
        const complete = index < activePhase;
        const current = index === activePhase;
        return (
          <li
            aria-current={current ? "step" : undefined}
            className={`flex items-center gap-3 rounded-xl border p-3 ${current ? "border-red-500/25 bg-red-500/[0.07]" : complete ? "border-green-500/15 bg-green-500/[0.035]" : "border-white/[0.06] bg-white/[0.015]"}`}
            key={phase.title}
          >
            <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black ${current ? "bg-red-500 text-white" : complete ? "bg-green-500/15 text-green-300" : "bg-white/[0.06] text-slate-500"}`}>
              {index + 1}
            </span>
            <span>
              <span className={`block text-xs font-bold ${current ? "text-white" : complete ? "text-green-200" : "text-slate-400"}`}>
                {phase.title}
              </span>
              <span className="mt-1 block text-[9px] text-slate-500">{phase.detail}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
