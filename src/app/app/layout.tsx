import type { ReactNode } from "react";
import { ModuleShell } from "@/app/components/module-shell";
import { requireUser } from "@/lib/auth";

export default async function PlayerLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <ModuleShell fullName={user.fullName} role={user.role}>
      {children}
    </ModuleShell>
  );
}
