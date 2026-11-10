import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarClock, FileText, Megaphone, Timer, TrendingUp, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getCheckpointReminders } from "@/lib/data/learning";
import { getMyNotifications, isNotificationKind, type NotificationKind } from "@/lib/data/notifications";
import { daysBetween, formatDay, mskNow } from "@/lib/time";
import { MarkAllRead } from "./mark-all-read";

export const metadata: Metadata = { title: "Уведомления" };

const KINDS: { kind: NotificationKind; label: string; icon: LucideIcon }[] = [
  { kind: "score", label: "Оценки", icon: TrendingUp },
  { kind: "request", label: "Заявки", icon: FileText },
  { kind: "change", label: "Расписание", icon: CalendarClock },
  { kind: "announcement", label: "Объявления", icon: Megaphone },
];
const ICON = Object.fromEntries(KINDS.map((k) => [k.kind, k.icon])) as Record<NotificationKind, LucideIcon>;

const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" });

function dayTitle(date: string, today: string) {
  const d = daysBetween(date, today);
  return d === 0 ? "Сегодня" : d === 1 ? "Вчера" : formatDay(date);
}

/** «Срез 3: Английский язык, Макроэкономика…» — по номеру среза, а не строкой на каждую дисциплину. */
function cutsByNumber(items: { discipline: string; number: number }[]) {
  const map = new Map<number, string[]>();
  for (const i of items) map.set(i.number, [...(map.get(i.number) ?? []), i.discipline]);
  return [...map.entries()].sort(([a], [b]) => a - b);
}

function inWeeksText(n: number) {
  if (n === 0) return "На этой неделе";
  if (n === 1) return "На следующей неделе";
  return `Через ${n} недели`;
}

function FilterChip({ href, active, label, count }: { href: string; active: boolean; label: string; count?: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-brand bg-brand-soft text-brand font-semibold" : "border-border text-muted hover:text-text"
      }`}
    >
      {label}
      {count ? (
        <span className="bg-brand text-brand-ink rounded-full px-1.5 text-[11px] leading-[18px] font-bold tabular-nums">
          {count}
          <span className="sr-only"> непрочитанных</span>
        </span>
      ) : null}
    </Link>
  );
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind: raw } = await searchParams;
  const kind = isNotificationKind(raw) ? raw : undefined;
  const [{ items, unread, unreadTotal }, reminders] = await Promise.all([
    getMyNotifications(kind),
    kind ? Promise.resolve([]) : getCheckpointReminders(),
  ]);
  const today = mskNow().date;
  const shownUnread = kind ? (unread[kind] ?? 0) : unreadTotal;

  // Группы по дням (по Москве), в порядке ленты.
  const days: { date: string; items: typeof items }[] = [];
  for (const n of items) {
    const date = mskNow(n.createdAt).date;
    const last = days.at(-1);
    if (last?.date === date) last.items.push(n);
    else days.push({ date, items: [n] });
  }

  return (
    <>
      <PageTitle
        hint={
          unreadTotal > 0
            ? `Непрочитанных: ${unreadTotal}. Новые появляются сами, перезагружать страницу не нужно.`
            : "Всё прочитано. Новые баллы, заявки и переносы появятся здесь сами."
        }
      >
        Уведомления
      </PageTitle>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <nav aria-label="Тип уведомлений" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          <FilterChip href="/notifications" active={!kind} label="Все" count={unreadTotal} />
          {KINDS.map((k) => (
            <FilterChip
              key={k.kind}
              href={`/notifications?kind=${k.kind}`}
              active={kind === k.kind}
              label={k.label}
              count={unread[k.kind]}
            />
          ))}
        </nav>
        {shownUnread > 0 && <MarkAllRead kind={kind ?? null} />}
      </div>

      {reminders.length > 0 && (
        <section aria-labelledby="soon-title" className="mb-6">
          <SectionTitle>
            <span id="soon-title">Скоро</span>
          </SectionTitle>
          <div className="space-y-3">
            {reminders.map((w) => (
              <Card key={w.week} className="flex gap-3">
                <Timer className="text-brand mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-semibold">
                    {inWeeksText(w.inWeeks)}, с {formatDay(w.startsOn)}
                  </p>
                  {cutsByNumber(w.items).map(([number, names]) => (
                    <p key={number} className="text-muted mt-1 text-sm">
                      Срез {number}: {names.join(", ")}.
                    </p>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {items.length === 0 ? (
        kind ? (
          <EmptyState
            icon={ICON[kind]}
            title="Здесь пока пусто"
            action={
              <Link href="/notifications" className="text-brand text-sm font-semibold hover:underline">
                Показать все уведомления
              </Link>
            }
          >
            Уведомления этого типа появятся здесь сами.
          </EmptyState>
        ) : (
          <EmptyState icon={Bell} title="Пока тихо">
            Новые баллы, статусы заявок и объявления деканата появятся здесь.
          </EmptyState>
        )
      ) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d.date} aria-labelledby={`day-${d.date}`}>
              <SectionTitle>
                <span id={`day-${d.date}`}>{dayTitle(d.date, today)}</span>
              </SectionTitle>
              <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
                {d.items.map((n) => {
                  const Icon = ICON[n.kind];
                  const isUnread = n.readAt === null;
                  return (
                    <li key={n.id}>
                      {/* Обычная ссылка, не <Link>: переход отмечает уведомление прочитанным, предзагрузка не должна. */}
                      <a href={`/notifications/${n.id}`} className="hover:bg-surface-2 flex gap-3 px-4 py-3.5">
                        <span
                          className={`grid size-9 shrink-0 place-items-center rounded-full ${
                            isUnread ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted"
                          }`}
                        >
                          <Icon className="size-[18px]" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className={isUnread ? "font-semibold" : "text-muted"}>
                              {isUnread && <span className="sr-only">Новое: </span>}
                              {n.title}
                            </span>
                            <span className="text-muted flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
                              {isUnread && <span aria-hidden="true" className="bg-brand size-2 rounded-full" />}
                              {time.format(n.createdAt)}
                            </span>
                          </span>
                          {n.body && <span className="text-muted mt-0.5 block text-sm">{n.body}</span>}
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
