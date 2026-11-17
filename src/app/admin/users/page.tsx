import { connection } from "next/server";
import { UserActiveAction, UserPasswordAction } from "@/app/admin/users/user-actions";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export default async function UsersAdminPage() {
  await connection();
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, cedula: true, fullName: true, whatsappPhone: true, role: true, isActive: true, createdAt: true },
  });

  return (
    <section className="page-enter mx-auto max-w-5xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-400">Módulo 05 · Administración</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Usuarios</h1>
      <p className="mt-2 text-sm text-slate-400">Cuentas registradas y estado de acceso.</p>
      <div className="mt-7 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d151a]">
        {users.length ? users.map((user) => (
          <article className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4 last:border-0" key={user.id}>
            <div>
              <p className="text-sm font-semibold text-white">{user.fullName}</p>
              <p className="mt-1 text-xs text-slate-500">{user.cedula} · {user.whatsappPhone}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[9px] font-bold text-slate-300">{user.role}</span>
              <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${user.isActive ? "bg-green-400/10 text-green-300" : "bg-rose-400/10 text-rose-300"}`}>{user.isActive ? "Activo" : "Inactivo"}</span>
              <UserActiveAction isActive={user.isActive} userId={user.id} />
            </div>
            <div className="w-full border-t border-white/[0.05] pt-3">
              <UserPasswordAction userId={user.id} />
            </div>
          </article>
        )) : (
          <p className="p-6 text-sm text-slate-400">Aún no hay usuarios registrados.</p>
        )}
      </div>
    </section>
  );
}
