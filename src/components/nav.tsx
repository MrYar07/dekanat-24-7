"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ActiveMark } from "@/components/page-transition";
import { CalendarDays, FileText, Home, TrendingUp, UserRound, type LucideIcon, Bell } from "lucide-react";

// short — подпись в нижней панели телефона, где на пункт приходится ~70 px.
// tiny — там же, но в версии для слабовидящих: крупный шрифт, и «Расписание» не помещается даже сокращённым.
type Item = { href: string; label: string; short?: string; tiny?: string; icon: LucideIcon };

export const STUDENT_NAV: Item[] = [
  { href: "/", label: "Сегодня", icon: Home },
  { href: "/schedule", label: "Расписание", tiny: "Пары", icon: CalendarDays },
  { href: "/grades", label: "Успеваемость", short: "Оценки", icon: TrendingUp },
  { href: "/requests", label: "Справки", icon: FileText },
  { href: "/profile", label: "Профиль", icon: UserRound },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Нижняя панель вкладок на телефоне. На широком экране разделы живут на обложке (components/cover.tsx). */
export function StudentNav({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Разделы кабинета"
      className="border-border bg-bg fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 md:max-w-none md:grid-cols-1 md:gap-0.5">
        {STUDENT_NAV.map(({ href, label, short, tiny, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-0.5 px-0.5 py-2 text-[0.6875rem] md:flex-row md:gap-3 md:border-l-2 md:px-3 md:py-2.5 md:text-sm ${
                  active
                    ? "text-brand md:border-brand md:bg-brand-soft font-semibold"
                    : "text-muted hover:text-text md:border-transparent"
                }`}
              >
                {active && <ActiveMark name="bottom-tab" className="bg-brand absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-b-full md:hidden" />}
                <Icon aria-hidden="true" className="tab-icon size-6 md:size-5" strokeWidth={active ? 2.2 : 1.8} />
                <span className={`nav-label max-w-full truncate md:hidden ${tiny ? "a11y-hide" : ""}`}>{short ?? label}</span>
                {tiny && <span className="nav-label a11y-only max-w-full truncate md:hidden">{tiny}</span>}
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
