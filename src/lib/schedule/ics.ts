// Расписание в формате iCalendar (RFC 5545): для подписки из Google, Apple и Яндекс Календаря.
// Чистые функции: сетка, переносы и срезы приходят уже отфильтрованными по группе студента.
import { addDays, formatDay, mskInstant } from "@/lib/time";
import { lessonsOn, type Change, type Slot } from ".";

export type CalendarEvent = {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string;
  description?: string;
  cancelled?: boolean;
};

export type CheckpointWeek = { courseId: string; number: number; week: number };

const KIND = { lecture: "лекция", seminar: "семинар" } as const;
const UID_DOMAIN = "dekanat247";

/** Ссылка подписки: 22 символа base64url, как у кодов справок. Остальное — сразу «не найдено». */
export function isFeedToken(s: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(s);
}

/** Текст значения: обратная косая, запятая, точка с запятой и переносы строк экранируются. */
export function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/**
 * Строки длиннее 75 октетов сворачиваются: продолжение начинается с пробела.
 * Считаем байты UTF-8, а не символы: кириллица занимает по два, и резать букву пополам нельзя.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    // У продолжения первый октет — пробел, поэтому места на один меньше.
    const limit = parts.length === 0 ? 75 : 74;
    if (size + n > limit) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** 2026-11-09T07:30:00Z → 20261109T073000Z. */
export function formatUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildCalendar({ name, description, events, stamp }: { name: string; description: string; events: CalendarEvent[]; stamp: Date }): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Dekanat 24/7//Meridian concept//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    `X-WR-CALDESC:${escapeText(description)}`,
    "X-WR-TIMEZONE:Europe/Moscow",
    // Как часто календарю перечитывать подписку: переносы должны доезжать в тот же день.
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${formatUtc(stamp)}`,
      `DTSTART:${formatUtc(e.start)}`,
      `DTEND:${formatUtc(e.end)}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * Все занятия триместра событиями календаря.
 *
 * UID держится за пару по сетке и её исходную дату: перенесённая пара в календаре
 * переезжает на новое время, а не раздваивается. Отменённая остаётся с пометкой и STATUS:CANCELLED.
 * Неделя среза — пометка в первой паре этой дисциплины на неделе, чтобы напоминание пришло к нужному занятию.
 */
export function termEvents(
  term: { startsOn: string; weeks: number },
  slots: Slot[],
  changes: Change[],
  checkpoints: CheckpointWeek[] = [],
): CalendarEvent[] {
  const events: (CalendarEvent & { courseId: string; week: number })[] = [];

  for (let i = 0; i < term.weeks * 7; i++) {
    const date = addDays(term.startsOn, i);
    const week = Math.floor(i / 7) + 1;
    for (const l of lessonsOn(date, slots, changes)) {
      const c = l.change;
      const notes = [`Преподаватель: ${l.teacher}`];
      if (c?.kind === "moved") notes.push(`Перенос: было ${formatDay(c.date)}, ${c.originalStartsAt}, ${c.originalRoom}`);
      if (c?.kind === "room") notes.push(`Другая аудитория: обычно ${c.originalRoom}`);
      if (c?.reason) notes.push(c.reason);

      const title = `${l.discipline} · ${KIND[l.kind]}`;
      events.push({
        uid: `${l.slotId}-${c?.date ?? date}@${UID_DOMAIN}`,
        start: mskInstant(date, l.startsAt),
        end: mskInstant(date, l.endsAt),
        summary: l.cancelled ? `Отменено: ${title}` : title,
        location: l.room,
        description: notes.join("\n"),
        cancelled: l.cancelled,
        courseId: l.courseId,
        week,
      });
    }
  }

  for (const cp of checkpoints) {
    const first = events.find((e) => e.courseId === cp.courseId && e.week === cp.week && !e.cancelled);
    if (!first) continue;
    first.summary = `Срез ${cp.number} · ${first.summary}`;
    first.description = `Срез ${cp.number} на этой паре или на этой неделе — загляни в «Успеваемость».\n${first.description}`;
  }

  return events.map((e) => ({
    uid: e.uid,
    start: e.start,
    end: e.end,
    summary: e.summary,
    location: e.location,
    description: e.description,
    cancelled: e.cancelled,
  }));
}
