"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Home, TrendingUp, UserRound, type LucideIcon } from "lucide-react";

type Item = { href: string; label: string; icon: LucideIcon };

export const STUDENT_NAV: Item[] = [
  { href: "/", label: "Сегодня", icon: Home },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/grades", label: "Успеваемость", icon: TrendingUp },
  { href: "/requests", label: "Справки", icon: FileText },
  { href: "/profile", label: "Профиль", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Нижняя панель на телефоне, боковая колонка на широком экране. */
export function StudentNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы кабинета"
      className="border-border bg-surface fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] md:static md:w-56 md:shrink-0 md:border-t-0 md:bg-transparent md:pb-0"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 md:max-w-none md:grid-cols-1 md:gap-1">
        {STUDENT_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-1 py-2 text-[11px] md:flex-row md:gap-3 md:rounded-xl md:px-3 md:py-2.5 md:text-sm ${
                  active ? "text-brand md:bg-brand-soft font-medium" : "text-muted hover:text-text"
                }`}
              >
                <Icon aria-hidden="true" className="size-6 md:size-5" strokeWidth={active ? 2.2 : 1.8} />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
