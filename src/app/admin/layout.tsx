import type { ReactNode } from "react";
import { ModuleShell } from "@/app/components/module-shell";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  return (
    <ModuleShell fullName={user.fullName} role="ADMIN">
      {children}
    </ModuleShell>
  );
}
