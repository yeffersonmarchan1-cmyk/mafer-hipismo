import { connection } from "next/server";
import { acknowledgeOperationalAlert } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";

export default async function OperationalAlertsPage() {
  await connection();
  const [unacknowledged, acknowledged] = await Promise.all([
    prisma.operationalAlert.findMany({
      where: { acknowledgedAt: null },
      orderBy: { lastSeenAt: "desc" },
      take: 100,
    }),
    prisma.operationalAlert.findMany({
      where: { acknowledgedAt: { not: null } },
      orderBy: { acknowledgedAt: "desc" },
      take: 20,
      include: { acknowledgedBy: { select: { fullName: true } } },
    }),
  ]);

  return (
    <section className="page-enter mx-auto max-w-5xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
        Módulo 07 · Administración
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
        Alertas operativas
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-400">
        Las fallas se registran en la base de datos para revisión. Esta bandeja
        no envía notificaciones externas; configura alertas del proveedor de
        hosting para recibir avisos fuera del panel.
      </p>
      <h2 className="mt-7 text-sm font-bold text-white">
        Pendientes ({unacknowledged.length})
      </h2>
      <div className="mt-3 space-y-3">
        {unacknowledged.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
            No hay alertas pendientes.
          </p>
        ) : (
          unacknowledged.map((alert) => (
            <article
              className="rounded-xl border border-amber-400/15 bg-[#1a1d26] p-4"
              key={alert.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-amber-200">
                    {alert.source} · {alert.severity}
                  </p>
                  <p className="mt-2 text-sm text-white">{alert.message}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {alert.occurrenceCount} ocurrencia(s) · última vez{" "}
                    {new Intl.DateTimeFormat("es-VE", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(alert.lastSeenAt)}
                  </p>
                  {alert.metadataJson && (
                    <p className="mt-2 text-[10px] text-slate-500">
                      Detalle técnico: {alert.metadataJson}
                    </p>
                  )}
                </div>
                <form action={acknowledgeOperationalAlert}>
                  <input name="alertId" type="hidden" value={alert.id} />
                  <button className="button-secondary" type="submit">
                    Reconocer
                  </button>
                </form>
              </div>
            </article>
          ))
        )}
      </div>
      <h2 className="mt-8 text-sm font-bold text-slate-300">
        Reconocidas recientemente
      </h2>
      <div className="mt-3 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08]">
        {acknowledged.length === 0 ? (
          <p className="p-4 text-xs text-slate-500">
            Todavía no hay alertas reconocidas.
          </p>
        ) : (
          acknowledged.map((alert) => (
            <div className="p-4" key={alert.id}>
              <p className="text-xs font-semibold text-slate-300">
                {alert.source} · {alert.message}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Reconocida por {alert.acknowledgedBy?.fullName ?? "Administrador"}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
