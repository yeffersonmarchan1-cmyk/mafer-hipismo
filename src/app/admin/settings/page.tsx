import { connection } from "next/server";
import { SettingsForm } from "@/app/admin/settings/settings-form";
import { prisma } from "@/lib/prisma";

export default async function SettingsAdminPage() {
  await connection();
  const config = await prisma.systemConfig.findUnique({ where: { id: 1 } });
  return (
    <section className="page-enter mx-auto max-w-4xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 04 · Administración</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Configuración</h1>
      <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#1a1d26] p-5 shadow-xl shadow-black/10 sm:p-7">
        <div className="mb-5">
          <p className="text-sm font-semibold text-white">Parámetros de operación</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Estos datos se muestran a los jugadores al preparar su Pago Móvil.</p>
        </div>
        <SettingsForm initial={{
          paymentBank: config?.paymentBank ?? "",
          paymentCedula: config?.paymentCedula ?? "",
          paymentPhone: config?.paymentPhone ?? "",
          vesPerUsd: config?.vesPerUsd.toFixed(4) ?? "1.0000",
          infoMessage: config?.infoMessage ?? "",
        }} />
      </div>
    </section>
  );
}
