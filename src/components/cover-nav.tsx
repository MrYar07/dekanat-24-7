"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CalendarDays,
  ChartNoAxesColumn,
  FileText,
  Home,
  Inbox,
  Megaphone,
  MessageCircleQuestion,
  NotebookPen,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { ActiveMark } from "@/components/page-transition";

// Разделы на обложке — боковой панели широкого экрана. Активный раздел выглядит как бумажная закладка:
// она того же цвета, что страница, и доходит до края панели, будто лист выглядывает из-под обложки.

type Item = { href: string; label: string; icon: LucideIcon; also?: string[]; gap?: boolean };

const SETS: Record<"student" | "dean" | "teacher", Item[]> = {
  student: [
    { href: "/", label: "Сегодня", icon: Home },
    { href: "/schedule", label: "Расписание", icon: CalendarDays },
    { href: "/grades", label: "Успеваемость", icon: TrendingUp },
    { href: "/requests", label: "Справки", icon: FileText },
    { href: "/profile", label: "Профиль", icon: UserRound },
    { href: "/notifications", label: "Уведомления", icon: Bell, gap: true },
    { href: "/ask", label: "Спроси деканат", icon: MessageCircleQuestion },
  ],
  dean: [
    // «Заявки» — это очередь и карточки из неё: заявка на документ, достижение и вопрос.
    { href: "/staff", label: "Заявки", icon: Inbox, also: ["/staff/requests", "/staff/achievements", "/staff/questions"] },
    { href: "/staff/announcements", label: "Объявления", icon: Megaphone },
    { href: "/staff/schedule", label: "Расписание", icon: CalendarClock },
    { href: "/staff/stats", label: "Сводка", icon: ChartNoAxesColumn, gap: true },
  ],
  teacher: [{ href: "/staff", label: "Курсы", icon: NotebookPen, also: ["/staff/courses"] }],
};

function isActive(pathname: string, item: Item) {
  if (item.href === "/" || item.href === "/staff") {
    return pathname === item.href || (item.also ?? []).some((p) => pathname.startsWith(p));
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function CoverNav({ kind, unread = 0 }: { kind: keyof typeof SETS; unread?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Разделы кабинета" className="mt-5">
      <ul className="space-y-0.5">
        {SETS[kind].map((item) => {
          const active = isActive(pathname, item);
          const Icon = item.icon;
          const count = item.href === "/notifications" ? unread : 0;
          return (
            <li key={item.href} className={item.gap ? "border-cover-line mt-3 border-t pt-3" : ""}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`nav-item relative isolate flex items-center gap-3 rounded-l-md py-2.5 pr-5 pl-3 text-sm ${
                  active ? "text-text font-semibold" : "text-cover-muted hover:bg-cover-hover hover:text-cover-ink"
                }`}
              >
                {/* Закладка — отдельный слой: при переходе она переезжает на новый раздел. */}
                {active && <ActiveMark name={`cover-tab-${kind}`} className="nav-mark bg-bg absolute inset-0 -z-10 rounded-l-md" />}
                <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={active ? 2.2 : 1.8} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {count > 0 && (
                  <span
                    key={count}
                    className={`badge-pop rounded-full px-1.5 text-xs leading-5 font-bold tabular-nums ${
                      active ? "bg-brand text-brand-ink" : "bg-cover-ink text-cover"
                    }`}
                  >
                    {count}
                    <span className="sr-only"> непрочитанных</span>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
