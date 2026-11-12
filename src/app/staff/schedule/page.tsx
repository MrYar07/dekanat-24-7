import type { Metadata } from "next";
import Link from "next/link";
import { CalendarOff, ChevronLeft, ChevronRight, MapPin, UserRound } from "lucide-react";
import { FilterChip, FilterChips } from "@/components/ui/filter-chips";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { PageTitle } from "@/components/ui/typography";
import { getScheduleBoard } from "@/lib/data/staff/dean-schedule";
import { PAIRS } from "@/lib/schedule";
import { addDays, formatDay, formatWeekday, weekdayOf } from "@/lib/time";
import { changeLessonAction, restoreLessonAction } from "../actions";
import { LessonChangeForm, RestoreButton } from "./lesson-change-form";

export const metadata: Metadata = { title: "Расписание" };

const KIND = { lecture: "лекция", seminar: "семинар" } as const;
const WEEKDAY = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const CHANGE_LABEL = { moved: "перенос", cancelled: "отмена", room: "другая аудитория" } as const;

export default async function DeanSchedulePage({ searchParams }: { searchParams: Promise<{ group?: string; date?: string }> }) {
  const params = await searchParams;
  const board = await getScheduleBoard(params.group, params.date);
  const { group, date, today, term } = board;
  const url = (d: string, g = group?.id) => `/staff/schedule?group=${g}&date=${d}`;

  if (!term || !group) {
    return (
      <>
        <PageTitle eyebrow="деканат">Расписание</PageTitle>
        <EmptyState icon={CalendarOff} title="Менять пока нечего">
          Нет текущего триместра или групп.
        </EmptyState>
      </>
    );
  }

  const past = date < today;
  const prevWeek = addDays(date, -7);
  const nextWeek = addDays(date, 7);

  return (
    <>
      <PageTitle
        eyebrow={`деканат · ${term.week}-я неделя триместра`}
        hint="Перенос, отмена или смена аудитории для конкретной пары. Группа сразу увидит изменение и получит уведомление."
      >
        Расписание
      </PageTitle>

      <div className="mb-3">
        <FilterChips label="Группа">
          {board.groups.map((g) => (
            <FilterChip key={g.id} href={url(date, g.id)} active={g.id === group.id} label={g.name} />
          ))}
        </FilterChips>
      </div>

      <div className="mb-6 flex items-center gap-0.5">
        {prevWeek >= term.startsOn ? (
          <Link href={url(prevWeek)} aria-label="Предыдущая неделя" className="text-muted hover:text-text -ml-2 shrink-0 rounded-full p-2">
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="w-7 shrink-0" />
        )}
        {/* Неделя сеткой из шести ячеек: на телефоне все дни видны сразу, выбранный не уезжает за край. */}
        <nav aria-label="День недели" className="min-w-0 flex-1">
          <ul className="grid grid-cols-6 gap-1">
            {board.week.map((d) => {
              const active = d.date === date;
              const label = `${formatWeekday(d.date)}, ${formatDay(d.date)}, пар: ${d.lessons}`;
              const cell = (
                <>
                  <span className="block text-[11px] uppercase">{WEEKDAY[weekdayOf(d.date) - 1]}</span>
                  <span className="block font-serif text-lg leading-tight font-bold tabular-nums">{Number(d.date.slice(8))}</span>
                  <span className="block text-[11px] tabular-nums">{d.lessons > 0 ? `${d.lessons} ${d.lessons === 1 ? "пара" : d.lessons < 5 ? "пары" : "пар"}` : "—"}</span>
                </>
              );
              return (
                <li key={d.date}>
                  {d.inTerm ? (
                    <Link
                      href={url(d.date)}
                      aria-current={active ? "date" : undefined}
                      aria-label={label}
                      className={`block rounded-lg border py-1.5 text-center ${
                        active ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-text"
                      }`}
                    >
                      {cell}
                    </Link>
                  ) : (
                    <span className="border-border text-muted block rounded-lg border border-dashed py-1.5 text-center opacity-50">{cell}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
        {nextWeek <= term.endsOn ? (
          <Link href={url(nextWeek)} aria-label="Следующая неделя" className="text-muted hover:text-text -mr-2 shrink-0 rounded-full p-2">
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="w-7 shrink-0" />
        )}
      </div>

      <h2 className="mb-3 font-serif text-lg font-bold">
        {formatWeekday(date)}, {formatDay(date)}
        {date === today && <span className="text-muted ml-2 text-sm font-normal">сегодня</span>}
      </h2>

      {board.lessons.length === 0 && board.movedAway.length === 0 ? (
        <EmptyState icon={CalendarOff} title="Пар нет">
          У группы {group.name} в этот день нет занятий.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {board.lessons.map((l) => {
            // Перенесённая сюда пара привязана к своей дате по сетке: менять и возвращать нужно её.
            const gridDate = l.change?.date ?? date;
            const editable = gridDate >= today && date >= today;
            return (
              <li key={`${l.slotId}-${gridDate}`} className="border-border bg-surface rounded-xl border p-4">
                <div className="flex items-start gap-3">
                  <p className={`w-12 shrink-0 font-serif text-lg font-bold tabular-nums ${l.cancelled ? "text-muted line-through" : ""}`}>
                    {l.startsAt}
                  </p>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold ${l.cancelled ? "text-muted line-through" : ""}`}>{l.discipline}</p>
                    <p className="text-muted mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {l.room}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="size-3.5" aria-hidden="true" />
                        {l.teacher}
                      </span>
                      <span>{KIND[l.kind]}</span>
                    </p>
                    {l.change && (
                      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <StatusBadge tone="danger">{CHANGE_LABEL[l.change.kind]}</StatusBadge>
                        <span>
                          {l.change.kind === "moved" && `с ${formatDay(l.change.date)}, ${l.change.originalStartsAt}`}
                          {l.change.kind === "room" && `вместо ${l.change.originalRoom}`}
                          {l.change.reason && `${l.change.kind === "cancelled" ? "" : ". "}${l.change.reason}`}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {editable && (
                  <div className="border-border mt-3 border-t pt-3">
                    <details className="group">
                      <summary className="text-brand cursor-pointer list-none text-sm font-semibold hover:underline [&::-webkit-details-marker]:hidden">
                        {l.change ? "Изменить по-другому" : "Изменить пару"}
                      </summary>
                      <div className="mt-3">
                        <LessonChangeForm
                          action={changeLessonAction.bind(null, l.slotId, gridDate)}
                          pairs={Object.keys(PAIRS)}
                          minDate={today}
                          maxDate={term.endsOn}
                          gridDate={gridDate}
                          formId={`${l.slotId}-${gridDate}`}
                        />
                      </div>
                    </details>
                    {l.change && (
                      <div className="mt-3">
                        <RestoreButton action={restoreLessonAction.bind(null, l.slotId, gridDate)} />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}

          {board.movedAway.map(({ slot, change }) => (
            <li key={`away-${slot.id}`} className="border-border rounded-xl border border-dashed p-4">
              <div className="flex items-start gap-3">
                <p className="text-muted w-12 shrink-0 font-serif text-lg font-bold tabular-nums line-through">{slot.startsAt}</p>
                <div className="min-w-0 flex-1">
                  <p className="text-muted font-semibold line-through">{slot.discipline}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <StatusBadge tone="danger">перенос</StatusBadge>
                    <span>
                      на {formatDay(change.newDate!)}, {change.newStartsAt ?? slot.startsAt}, {change.newRoom ?? slot.room}
                      {change.reason && `. ${change.reason}`}
                    </span>
                  </p>
                </div>
              </div>
              {date >= today && (
                <div className="border-border mt-3 border-t pt-3">
                  <RestoreButton action={restoreLessonAction.bind(null, slot.id, date)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {past && <p className="text-muted mt-4 text-sm">Этот день уже прошёл: прошедшие пары не меняются.</p>}
    </>
  );
}
