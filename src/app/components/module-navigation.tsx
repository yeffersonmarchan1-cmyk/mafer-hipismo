"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  Settings,
  Shield,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";

const navigationIcons = {
  "badge-check": BadgeCheck,
  calendar: CalendarDays,
  clipboard: ClipboardList,
  settings: Settings,
  shield: Shield,
  ticket: Ticket,
  trophy: Trophy,
  users: Users,
};

type Module = {
  href: string;
  label: string;
  icon: keyof typeof navigationIcons;
};

export function ModuleNavigation({
  modules,
  mobile = false,
}: {
  modules: readonly Module[];
  mobile?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? "Navegación móvil" : "Navegación principal"}
      className={
        mobile
          ? "flex min-w-max gap-1 px-2 py-2"
          : "mt-3 space-y-1"
      }
    >
      {modules.map((module) => {
        const active =
          pathname === module.href ||
          (module.href !== "/admin" && pathname.startsWith(`${module.href}/`));
        const Icon = navigationIcons[module.icon];

        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={
              mobile
                ? `flex min-h-14 min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl px-2 text-[9px] font-semibold ${
                    active
                      ? "bg-red-500/10 text-red-300"
                      : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
                  }`
                : `group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium ${
                    active
                      ? "border-red-500/20 bg-red-500/[0.09] text-white shadow-sm shadow-red-950/20"
                      : "border-transparent text-slate-400 hover:border-white/[0.05] hover:bg-white/[0.04] hover:text-white"
                  }`
            }
            href={module.href}
            key={module.href}
          >
            <Icon
              aria-hidden="true"
              className={
                mobile
                  ? `size-5 shrink-0 ${active ? "text-red-400" : "text-slate-600"}`
                  : `size-5 shrink-0 ${
                      active
                        ? "text-red-300"
                        : "text-slate-500 group-hover:text-red-300"
                    }`
              }
              strokeWidth={1.8}
            />
            <span className={mobile ? "max-w-16 truncate" : ""}>{module.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
