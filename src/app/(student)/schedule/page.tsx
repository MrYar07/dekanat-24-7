import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { StatusBadge } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { getSchedule } from "@/lib/data/learning";
import { formatDay, formatShortDay, formatWeekday, toMinutes } from "@/lib/time";

export const metadata: Metadata = { title: "Расписание" };

const kindLabel = { lecture: "лекция", seminar: "семинар" } as const;
const sentence = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

/** «16–21 ноября» или «30 ноября — 5 декабря». */
function formatRange(first: string, last: string) {
  const [d1, m1] = formatDay(first).split(" ");
  const [, m2] = formatDay(last).split(" ");
  return m1 === m2 ? `${d1}–${formatDay(last)}` : `${formatDay(first)} — ${formatDay(last)}`;
}

function WeekLink({
  week,
  disabled,
  label,
  children,
}: {
  week: number;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span aria-hidden="true" className="text-border rounded-full p-2">
        {children}
      </span>
    );
  }
  return (
    <Link href={`/schedule?week=${week}`} aria-label={label} className="text-muted hover:text-text rounded-full p-2">
      {children}
    </Link>
  );
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const { week: raw } = await searchParams;
  const s = await getSchedule(raw ? Number(raw) : undefined);

  if (!s.term || s.week === null) {
    return (
      <>
        <PageTitle>Расписание</PageTitle>
        <EmptyState icon={CalendarDays} title="Триместр ещё не начался">
          Расписание появится здесь, как только деканат его опубликует.
        </EmptyState>
      </>
    );
  }

  const first = s.days[0].date;
  const last = s.days[s.days.length - 1].date;
  const isCurrent = s.week === s.currentWeek;
  const cps = s.checkpointsThisWeek;

  return (
    <>
      <PageTitle eyebrow={formatRange(first, last)}>Расписание</PageTitle>

      <nav aria-label="Недели триместра" className="mb-6 flex items-center gap-1 whitespace-nowrap">
        <WeekLink week={s.week - 1} disabled={s.week <= 1} label="Предыдущая неделя">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </WeekLink>
        <p className="text-center font-serif text-lg font-bold">
          {s.week}-я неделя
          <span className="text-muted font-sans text-sm font-normal"> из {s.term.weeks}</span>
        </p>
        <WeekLink week={s.week + 1} disabled={s.week >= s.term.weeks} label="Следующая неделя">
          <ChevronRight className="size-5" aria-hidden="true" />
        </WeekLink>
        {!isCurrent && (
          <Link href="/schedule" className={`${buttonClass("ghost")} ml-auto`}>
            К текущей
          </Link>
        )}
      </nav>

      {cps.length > 0 && (
        <div className="mb-6">
          <Callout tone="info" lead="Неделя срезов.">
            {cps.length === 1
              ? `Срез ${cps[0].number} по дисциплине «${cps[0].discipline}».`
              : `Срез ${cps[0].number} по ${cps.length} дисциплинам — на занятиях по расписанию.`}
          </Callout>
        </div>
      )}

      <div className="space-y-6">
        {s.days.map((d) => (
          <section key={d.date} aria-labelledby={`day-${d.date}`}>
            <div className="mb-1 flex items-center gap-3">
              <h2
                id={`day-${d.date}`}
                className={`shrink-0 text-sm font-semibold ${d.isToday ? "text-brand" : d.isPast ? "text-muted" : ""}`}
              >
                <span className="capitalize">{formatWeekday(d.date)}</span>, {formatDay(d.date)}
              </h2>
              {d.isToday && <StatusBadge tone="neutral">сегодня</StatusBadge>}
              <span aria-hidden="true" className="bg-border h-px flex-1" />
            </div>

            {d.lessons.length === 0 ? (
              <p className="text-muted py-2 text-sm">Пар нет</p>
            ) : (
              <ol className="divide-border divide-y">
                {d.lessons.map((l) => {
                  const going =
                    d.isToday &&
                    !l.cancelled &&
                    toMinutes(l.startsAt) <= s.now.minutes &&
                    toMinutes(l.endsAt) > s.now.minutes;
                  return (
                    <li
                      key={`${l.slotId}-${l.startsAt}`}
                      aria-current={going ? "time" : undefined}
                      className={`flex gap-3 py-3 sm:gap-5 ${going ? "bg-brand-soft -mx-3 rounded-lg px-3" : ""}`}
                    >
                      <div className={`w-12 shrink-0 tabular-nums ${l.cancelled ? "text-muted line-through" : ""}`}>
                        <p className="font-serif text-[17px] leading-tight font-bold">{l.startsAt}</p>
                        <p className="text-muted text-xs">{l.endsAt}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`leading-snug font-semibold ${l.cancelled ? "text-muted line-through" : ""}`}>
                          {l.discipline}
                        </p>
                        <p className="text-muted mt-0.5 text-sm">
                          {kindLabel[l.kind]} · {l.room} · {l.teacher}
                        </p>
                        {l.change && (
                          <p className="text-danger mt-1 text-sm">
                            {l.movedTo
                              ? `Перенесена на ${formatShortDay(l.movedTo)}, ${l.change.newStartsAt ?? l.startsAt}.`
                              : l.change.kind === "cancelled"
                                ? "Отменена."
                                : l.change.kind === "room"
                                  ? `Другая аудитория, по сетке — ${l.change.originalRoom}.`
                                  : l.change.date === l.date
                                    ? `Перенесена на другое время, по сетке — ${l.change.originalStartsAt}.`
                                    : `Перенесена с ${formatShortDay(l.change.date)}.`}
                            {l.change.reason && <span className="text-muted"> {sentence(l.change.reason)}</span>}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 self-start pt-0.5">
                        {going ? (
                          <StatusBadge tone="ok">идёт</StatusBadge>
                        ) : l.attendance === "absent" ? (
                          <StatusBadge tone="warn">пропуск</StatusBadge>
                        ) : l.attendance === "excused" ? (
                          <StatusBadge tone="neutral">уважит.</StatusBadge>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
