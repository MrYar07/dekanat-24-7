"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, Inbox, Megaphone, type LucideIcon } from "lucide-react";

const DEAN_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/staff", label: "Заявки", icon: Inbox },
  { href: "/staff/announcements", label: "Объявления", icon: Megaphone },
  { href: "/staff/schedule", label: "Расписание", icon: CalendarClock },
];

/** Разделы кабинета деканата: вкладки под шапкой. У преподавателя раздел один, вкладок нет. */
export function DeanNav() {
  const pathname = usePathname();
  // «Заявки» — это очередь (/staff) и карточки из неё: заявка на документ и достижение.
  const isActive = (href: string) =>
    href === "/staff"
      ? pathname === "/staff" || pathname.startsWith("/staff/requests") || pathname.startsWith("/staff/achievements")
      : pathname.startsWith(href);

  return (
    <nav aria-label="Разделы кабинета" className="border-border -mx-4 mb-6 border-b px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1">
        {DEAN_NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-sm sm:px-3 ${
                  active ? "border-brand text-brand font-semibold" : "text-muted hover:text-text border-transparent"
                }`}
              >
                {/* На телефоне три вкладки с иконками не помещаются в 360 px: остаются подписи. */}
                <Icon className="hidden size-4 shrink-0 sm:block" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
