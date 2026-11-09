// Раскладка недельной сетки на конкретные дни с учётом переносов, отмен и смены аудиторий.
// Чистые функции: данные приходят из базы уже отфильтрованными по группе студента.
import { addDays, toMinutes, weekdayOf, type MskNow } from "@/lib/time";

export type Slot = {
  id: string;
  courseId: string;
  discipline: string;
  teacher: string;
  kind: "lecture" | "seminar";
  weekday: number;
  startsAt: string;
  endsAt: string;
  room: string;
};

export type Change = {
  slotId: string;
  date: string;
  kind: "moved" | "cancelled" | "room";
  newDate: string | null;
  newStartsAt: string | null;
  newEndsAt: string | null;
  newRoom: string | null;
  reason: string | null;
};

export type Lesson = {
  slotId: string;
  courseId: string;
  discipline: string;
  teacher: string;
  kind: Slot["kind"];
  date: string;
  startsAt: string;
  endsAt: string;
  room: string;
  cancelled: boolean;
  /** Что изменилось относительно сетки: для пометки «перенос», «отмена», «другая аудитория». */
  change: (Change & { originalStartsAt: string; originalRoom: string }) | null;
};

function base(slot: Slot, date: string): Lesson {
  return {
    slotId: slot.id,
    courseId: slot.courseId,
    discipline: slot.discipline,
    teacher: slot.teacher,
    kind: slot.kind,
    date,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    room: slot.room,
    cancelled: false,
    change: null,
  };
}

/** Занятия на дату. Отменённые остаются в списке с cancelled = true, перенесённые появляются в новом дне. */
export function lessonsOn(date: string, slots: Slot[], changes: Change[]): Lesson[] {
  const bySlot = new Map(slots.map((s) => [s.id, s]));
  const lessons: Lesson[] = [];

  for (const slot of slots) {
    if (slot.weekday !== weekdayOf(date)) continue;
    const change = changes.find((c) => c.slotId === slot.id && c.date === date);
    const lesson = base(slot, date);
    if (change) {
      const tagged = { ...change, originalStartsAt: slot.startsAt, originalRoom: slot.room };
      if (change.kind === "moved" && change.newDate !== date) continue;
      if (change.kind === "cancelled") lesson.cancelled = true;
      lesson.startsAt = change.newStartsAt ?? lesson.startsAt;
      lesson.endsAt = change.newEndsAt ?? lesson.endsAt;
      lesson.room = change.newRoom ?? lesson.room;
      lesson.change = tagged;
    }
    lessons.push(lesson);
  }

  for (const change of changes) {
    if (change.kind !== "moved" || change.newDate !== date || change.date === date) continue;
    const slot = bySlot.get(change.slotId);
    if (!slot) continue;
    lessons.push({
      ...base(slot, date),
      startsAt: change.newStartsAt ?? slot.startsAt,
      endsAt: change.newEndsAt ?? slot.endsAt,
      room: change.newRoom ?? slot.room,
      change: { ...change, originalStartsAt: slot.startsAt, originalRoom: slot.room },
    });
  }

  return lessons.sort((a, b) => toMinutes(a.startsAt) - toMinutes(b.startsAt));
}

export type UpcomingDay = {
  date: string;
  isToday: boolean;
  /** Оставшиеся занятия дня, включая идущее сейчас. Отменённые тоже, чтобы было видно отмену. */
  lessons: Lesson[];
  /** Идущее сейчас занятие. */
  current: Lesson | null;
  /** Ближайшее ещё не начавшееся занятие. */
  next: Lesson | null;
};

/** Ближайший день, в котором остались занятия: сегодня (если пары ещё будут) или следующий учебный. */
export function upcomingDay(now: MskNow, slots: Slot[], changes: Change[], horizonDays = 14): UpcomingDay | null {
  for (let i = 0; i <= horizonDays; i++) {
    const date = addDays(now.date, i);
    const isToday = i === 0;
    const lessons = lessonsOn(date, slots, changes).filter((l) => !isToday || toMinutes(l.endsAt) > now.minutes);
    const active = lessons.filter((l) => !l.cancelled);
    if (active.length === 0) continue;

    const current = isToday ? (active.find((l) => toMinutes(l.startsAt) <= now.minutes) ?? null) : null;
    const next = active.find((l) => !isToday || toMinutes(l.startsAt) > now.minutes) ?? null;
    return { date, isToday, lessons, current, next };
  }
  return null;
}

/** Изменения на ближайшие дни: и по исходной дате занятия, и по новой дате переноса. */
export function upcomingChanges(today: string, slots: Slot[], changes: Change[], days = 7): Lesson[] {
  const until = addDays(today, days);
  const inRange = (d: string | null) => d !== null && d >= today && d <= until;
  const bySlot = new Map(slots.map((s) => [s.id, s]));

  return changes
    .filter((c) => bySlot.has(c.slotId) && (inRange(c.date) || inRange(c.newDate)))
    .map((c) => {
      const slot = bySlot.get(c.slotId)!;
      const date = c.kind === "moved" && c.newDate ? c.newDate : c.date;
      return {
        ...base(slot, date),
        startsAt: c.newStartsAt ?? slot.startsAt,
        endsAt: c.newEndsAt ?? slot.endsAt,
        room: c.newRoom ?? slot.room,
        cancelled: c.kind === "cancelled",
        change: { ...c, originalStartsAt: slot.startsAt, originalRoom: slot.room },
      };
    })
    .sort((a, b) => (a.change!.date < b.change!.date ? -1 : 1));
}
