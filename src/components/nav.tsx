"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, Home, TrendingUp, UserRound, type LucideIcon, Bell } from "lucide-react";

// short — подпись в нижней панели телефона, где на пункт приходится ~70 px.
type Item = { href: string; label: string; short?: string; icon: LucideIcon };

export const STUDENT_NAV: Item[] = [
  { href: "/", label: "Сегодня", icon: Home },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/grades", label: "Успеваемость", short: "Оценки", icon: TrendingUp },
  { href: "/requests", label: "Справки", icon: FileText },
  { href: "/profile", label: "Профиль", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Нижняя панель на телефоне, боковая колонка на широком экране. */
export function StudentNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы кабинета"
      className="border-border bg-bg fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] md:static md:w-56 md:shrink-0 md:border-t-0 md:bg-transparent md:pb-0"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 md:max-w-none md:grid-cols-1 md:gap-0.5">
        {STUDENT_NAV.map(({ href, label, short, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 px-0.5 py-2 text-[11px] md:flex-row md:gap-3 md:border-l-2 md:px-3 md:py-2.5 md:text-sm ${
                  active
                    ? "text-brand md:border-brand md:bg-brand-soft font-semibold"
                    : "text-muted hover:text-text md:border-transparent"
                }`}
              >
                <Icon aria-hidden="true" className="size-6 md:size-5" strokeWidth={active ? 2.2 : 1.8} />
                <span className="max-w-full truncate md:hidden">{short ?? label}</span>
                <span className="hidden truncate md:inline">{label}</span>
              </Link>
            </li>
          );
        })}
        {/* На телефоне уведомления — колокольчик в шапке, на десктопе — отдельный пункт под разделами. */}
        <li className="border-border hidden md:mt-3 md:block md:border-t md:pt-3">
          <Link
            href="/notifications"
            aria-current={isActive(pathname, "/notifications") ? "page" : undefined}
            className={`flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm ${
              isActive(pathname, "/notifications")
                ? "text-brand border-brand bg-brand-soft font-semibold"
                : "text-muted hover:text-text border-transparent"
            }`}
          >
            <Bell aria-hidden="true" className="size-5" strokeWidth={1.8} />
            <span className="flex-1 truncate">Уведомления</span>
            {unread > 0 && (
              <span className="bg-brand text-brand-ink rounded-full px-1.5 text-xs leading-5 font-bold tabular-nums">
                {unread}
                <span className="sr-only"> непрочитанных</span>
              </span>
            )}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
