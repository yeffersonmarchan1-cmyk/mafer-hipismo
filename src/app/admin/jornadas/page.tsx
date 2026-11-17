import { connection } from "next/server";
import { addHorse, toggleHorseStatus, updateHorse } from "@/app/actions";
import { closeRaceDay } from "@/app/admin/actions";
import { closeDueRaceDays as closeScheduledRaceDays } from "@/lib/close-race-days";
import { InscriptionImporter } from "@/app/inscription-importer";
import { prisma } from "@/lib/prisma";

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
    orderBy: { date: "desc" },
    take: 8,
    include: {
      entries: {
        orderBy: [{ legNumber: "asc" }, { gazetteOrder: "asc" }],
      },
    },
  });
  const openDay = raceDays.find((day) => day.status === "OPEN");
  const entries = openDay?.entries ?? [];
  const activeCount = entries.filter((horse) => horse.status === "ACTIVE").length;

  return (
    <div className="page-enter space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 01 · Administración</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Jornadas e inscritos</h1>
          <p className="mt-2 text-sm text-slate-400">Importa el programa y mantén al día las seis válidas.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          PostgreSQL conectado
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Jornada abierta" value={openDay ? formatRaceDate(openDay.date) : "Sin jornada"} />
        <StatCard label="Ejemplares activos" value={String(activeCount)} />
        <StatCard label="Inscritos registrados" value={String(entries.length)} />
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-[#0d151a] p-5 sm:p-7">
        <div className="mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">Actualización semanal</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Importar inscritos oficiales</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            Sube el PDF de La Gaceta Hípica o del INH, pega texto o usa un enlace permitido. El orden de la lista se conserva para los cambios por retirados.
          </p>
        </div>
        <InscriptionImporter initialDate={nextSunday()} />
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Archivo</p>
          <h2 className="mt-1 text-lg font-semibold text-white">Jornadas registradas</h2>
        </div>
        {raceDays.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
            <p className="text-sm font-semibold text-white">Aún no hay jornadas</p>
            <p className="mt-2 text-sm text-slate-400">Importa los inscritos para abrir la jornada del domingo.</p>
          </div>
        ) : raceDays.map((day) => (
          <article className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d151a]" key={day.id}>
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">Jornada · {day.venue}</p>
                <h3 className="mt-1 text-lg font-semibold text-white">{formatRaceDate(day.date)}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {day.inscriptionSource ?? "Origen no registrado"}
                  {day.inscriptionsUpdatedAt
                    ? ` · Actualizado ${new Intl.DateTimeFormat("es-VE", { dateStyle: "short", timeStyle: "short" }).format(day.inscriptionsUpdatedAt)}`
                    : ""}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${day.status === "OPEN" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.06] text-slate-400"}`}>
                {day.status === "OPEN" ? "Apuestas abiertas" : day.status === "SETTLED" ? "Liquidada" : "Jornada cerrada"}
              </span>
              {day.status === "OPEN" && (
                <form action={closeRaceDay}>
                  <input name="raceDayId" type="hidden" value={day.id} />
                  <button className="button-primary min-h-9 px-3 py-1 text-[10px]" type="submit">
                    Cerrar apuestas
                  </button>
                </form>
              )}
            </header>

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
                          <li className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-3" key={horse.id}>
                            <form action={updateHorse} className="flex items-center gap-2">
                              <label className="sr-only" htmlFor={`cloth-${horse.id}`}>Gualdrapa de {horse.name}</label>
                              <input className="w-12 rounded-md border border-white/[0.08] bg-[#0b1418] px-2 py-1.5 text-center text-xs font-semibold text-slate-200" disabled={day.status !== "OPEN"} id={`cloth-${horse.id}`} max="99" min="1" name="saddlecloth" type="number" defaultValue={horse.saddlecloth} />
                              <label className="sr-only" htmlFor={`name-${horse.id}`}>Nombre de ejemplar</label>
                              <input className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1.5 text-xs text-slate-200 focus:border-emerald-400/40 focus:outline-none" disabled={day.status !== "OPEN"} id={`name-${horse.id}`} maxLength={120} name="name" defaultValue={horse.name} />
                              <input type="hidden" name="id" value={horse.id} />
                              {day.status === "OPEN" && (
                                <button className="text-[10px] font-semibold text-emerald-300 hover:text-emerald-200" type="submit">Guardar</button>
                              )}
                            </form>
                            <div className="mt-2 flex items-center justify-between">
                              <span className={`text-[9px] font-bold uppercase tracking-wider ${horse.status === "ACTIVE" ? "text-green-400" : "text-rose-300"}`}>
                                {horse.status === "ACTIVE" ? "Activo" : "Retirado"}
                              </span>
                              {day.status === "OPEN" && (
                                <form action={toggleHorseStatus}>
                                  <input type="hidden" name="id" value={horse.id} />
                                  <input type="hidden" name="status" value={horse.status === "ACTIVE" ? "WITHDRAWN" : "ACTIVE"} />
                                  <button className="text-[10px] text-slate-500 underline underline-offset-2 hover:text-slate-300" type="submit">
                                    {horse.status === "ACTIVE" ? "Marcar retirado" : "Reactivar"}
                                  </button>
                                </form>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="py-2 text-xs text-slate-500">Sin ejemplares cargados.</p>
                    )}
                    {day.status === "OPEN" && (
                      <form action={addHorse} className="mt-3 flex items-center gap-2 border-t border-white/[0.06] pt-3">
                        <input type="hidden" name="raceDayId" value={day.id} />
                        <input type="hidden" name="legNumber" value={legNumber} />
                        <input aria-label={`Gualdrapa válida ${legNumber}`} className="w-12 rounded-md border border-white/[0.08] bg-[#0b1418] px-2 py-1.5 text-center text-xs text-white" max="99" min="1" name="saddlecloth" placeholder="#" required type="number" />
                        <input aria-label={`Nombre válida ${legNumber}`} className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#0b1418] px-2 py-1.5 text-xs text-white placeholder:text-slate-600" maxLength={120} name="name" placeholder="Agregar ejemplar" required />
                        <button className="rounded-md bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300" type="submit">Agregar</button>
                      </form>
                    )}
                  </section>
                );
              })}
            </div>
          </article>
        ))}
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
