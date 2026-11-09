import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, FileText, MapPin, TrendingUp, UserRound } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { Stamp, StatusBadge } from "@/components/ui/status";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getToday } from "@/lib/data/today";
import type { Lesson } from "@/lib/schedule";
import { formatDay, formatIn, formatShortDay, formatWeekday, mskNow, relativeDay, toMinutes } from "@/lib/time";

export const metadata: Metadata = { title: "Сегодня" };

function greeting(minutes: number) {
  const hour = Math.floor(minutes / 60);
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

const num = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const score = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Фраза из базы как предложение: с точкой в конце. */
const sentence = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");
const kindLabel = { lecture: "лекция", seminar: "семинар" } as const;

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-brand shrink-0 text-xs font-semibold hover:underline">
      {children}
    </Link>
  );
}

function changeText(l: Lesson, today: string) {
  const c = l.change!;
  if (c.kind === "cancelled") {
    return {
      lead: "Отмена.",
      text: `${l.discipline}, ${relativeDay(c.date, today)} в ${c.originalStartsAt}.${c.reason ? ` ${sentence(c.reason)}` : ""}`,
    };
  }
  if (c.kind === "room") {
    return {
      lead: "Другая аудитория.",
      text: `${l.discipline} ${relativeDay(l.date, today)} в ${l.startsAt}: ${l.room} вместо ${c.originalRoom}.`,
    };
  }
  return {
    lead: "Перенос.",
    text: `${l.discipline}: пара ${relativeDay(c.date, today)} в ${c.originalStartsAt} переносится на ${relativeDay(l.date, today)}, ${l.startsAt}, ${l.room}.${c.reason ? ` ${sentence(c.reason)}` : ""}`,
  };
}

export default async function TodayPage() {
  const t = await getToday();
  const today = t.now.date;
  const eyebrow = `${formatWeekday(today)}, ${formatDay(today)}${t.week ? ` · ${t.week}-я неделя` : ""}`;
  const day = t.upcoming;
  const focus = day?.current ?? day?.next ?? null;
  const rest = day ? day.lessons.filter((l) => l !== focus && l !== day.next) : [];

  return (
    <>
      <PageTitle eyebrow={eyebrow}>
        {greeting(t.now.minutes)}, {t.firstName}.
      </PageTitle>

      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
        <section className="sm:col-span-2">
          <SectionTitle action={<MoreLink href="/schedule">Неделя</MoreLink>}>
            {day && !day.isToday ? `Дальше по расписанию · ${relativeDay(day.date, today)}` : "Дальше по расписанию"}
          </SectionTitle>
          {!day || !focus ? (
            <EmptyState icon={CalendarDays} title="Ближайшие две недели пар нет">
              Если что-то изменится, перенос появится здесь и в уведомлениях.
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Card aria-label="Ближайшая пара">
                <p className="text-muted text-xs font-semibold tracking-[0.08em] uppercase">
                  {day.current === focus ? (
                    <span className="text-ok">Идёт сейчас · до {focus.endsAt}</span>
                  ) : day.isToday ? (
                    formatIn(toMinutes(focus.startsAt) - t.now.minutes)
                  ) : (
                    formatShortDay(day.date)
                  )}
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <p className="font-serif text-[32px] leading-none font-bold tabular-nums">{focus.startsAt}</p>
                  <p className="text-muted text-sm tabular-nums">– {focus.endsAt}</p>
                </div>
                <p className="mt-2 font-serif text-lg leading-snug font-bold">{focus.discipline}</p>
                <p className="text-muted mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {focus.room}
                    {focus.change?.kind === "room" && <span className="text-danger font-semibold">(новая)</span>}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UserRound className="size-3.5" aria-hidden="true" />
                    {focus.teacher}
                  </span>
                  <span>{kindLabel[focus.kind]}</span>
                </p>
                {day.current === focus && day.next && (
                  <p className="border-border mt-3 border-t pt-3 text-sm">
                    Следующая — <b>{day.next.discipline}</b> в {day.next.startsAt}, {day.next.room}
                  </p>
                )}
              </Card>

              <div className="space-y-4">
                {rest.length > 0 && (
                  <ol className="space-y-2 text-sm" aria-label="Остальные пары дня">
                    {rest.map((l) => (
                      <li key={l.slotId + l.startsAt} className={`flex gap-3 ${l.cancelled ? "text-muted line-through" : ""}`}>
                        <span className="w-11 shrink-0 font-serif font-bold tabular-nums">{l.startsAt}</span>
                        <span className="min-w-0">
                          {l.discipline}
                          <span className="text-muted"> · {l.cancelled ? "отменена" : l.room}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                {t.changes.length > 0 && (
                  <div className="space-y-2.5">
                    {t.changes.map((l) => {
                      const { lead, text } = changeText(l, today);
                      return (
                        <Callout key={`${l.slotId}-${l.change!.date}`} tone="change" lead={lead}>
                          {text}
                        </Callout>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionTitle action={<MoreLink href="/grades">Все баллы</MoreLink>}>Ведомость</SectionTitle>
          {t.scores.length === 0 && !t.rating ? (
            <EmptyState icon={TrendingUp} title="Новых баллов пока нет">
              Как только преподаватель поставит балл за срез, он появится здесь.
            </EmptyState>
          ) : (
            <>
              <Ledger>
                {t.scores.map((s) => (
                  <LedgerRow
                    key={`${s.discipline}-${s.number}`}
                    label={
                      <>
                        {s.discipline} <span className="text-muted">· срез {s.number}</span>
                      </>
                    }
                    value={s.score}
                    note={s.delta !== null ? signed(s.delta) : "новый"}
                  />
                ))}
                {t.rating && (
                  <LedgerRow
                    label={<b>Рейтинг триместра</b>}
                    value={score.format(t.rating.rating)}
                    note={t.rating.forecast ? "прогноз" : undefined}
                  />
                )}
              </Ledger>
              {t.goal && (
                <p className="text-muted mt-3 text-sm">
                  {t.goal.gap > 0 ? (
                    <>
                      До порога «{t.goal.label}» ({t.goal.target}) не хватает{" "}
                      <b className="text-text">{num.format(t.goal.gap)}</b>{" "}
                      {t.goal.label.startsWith("грант") ? "балла по среднему без бонусов." : "балла."}
                    </>
                  ) : (
                    <>Порог «{t.goal.label}» ({t.goal.target}) пройден.</>
                  )}
                </p>
              )}
            </>
          )}
        </section>

        <section>
          <SectionTitle action={<MoreLink href="/requests">Заказать</MoreLink>}>Справки</SectionTitle>
          {t.requests.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Активных заявок нет"
              action={
                <Link href="/requests" className={buttonClass("secondary")}>
                  Заказать справку
                </Link>
              }
            >
              Справка об обучении готовится за минуту.
            </EmptyState>
          ) : (
            <ul className="divide-border divide-y text-sm">
              {t.requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                  <span className="min-w-0">
                    {r.type}
                    <span className="text-muted block text-xs">
                      {r.status === "ready"
                        ? "можно скачать или забрать в деканате"
                        : r.days
                          ? `обычно до ${r.days} раб. дней`
                          : "обычно в течение дня"}
                    </span>
                  </span>
                  {r.status === "ready" ? (
                    <Stamp />
                  ) : r.status === "in_review" ? (
                    <StatusBadge tone="wait">в работе</StatusBadge>
                  ) : (
                    <StatusBadge tone="neutral">принята</StatusBadge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="sm:col-span-2">
          <SectionTitle
            action={t.unread > 0 ? <MoreLink href="/notifications">Уведомления · {t.unread}</MoreLink> : undefined}
          >
            Объявления
          </SectionTitle>
          {t.announcements.length === 0 ? (
            <EmptyState icon={Bell} title="Объявлений нет">
              Новости деканата и напоминания о сроках будут здесь.
            </EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {t.announcements.map((a) => (
                <Callout key={a.id} tone="announcement" lead={sentence(a.title)}>
                  {a.body}
                  <span className="text-muted mt-1 block text-xs">{relativeDay(mskNow(a.publishedAt).date, today)}</span>
                </Callout>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
