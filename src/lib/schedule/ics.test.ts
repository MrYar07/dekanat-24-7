import { describe, expect, it } from "vitest";
import { buildCalendar, escapeText, foldLine, formatUtc, isFeedToken, termEvents } from "./ics";
import type { Change, Slot } from ".";

// 2 ноября 2026 — понедельник, начало условного триместра из двух недель.
const term = { startsOn: "2026-11-02", weeks: 2 };

const slot = (id: string, weekday: number, startsAt: string, endsAt: string): Slot => ({
  id,
  courseId: `c-${id}`,
  discipline: id === "macro" ? "Макроэкономика" : "Эконометрика",
  teacher: "Лазарева И. О.",
  kind: "seminar",
  weekday,
  startsAt,
  endsAt,
  room: "ауд. 412",
});

const slots = [slot("macro", 1, "11:10", "12:40"), slot("econ", 3, "09:30", "11:00")];

const change = (c: Partial<Change> & Pick<Change, "slotId" | "date" | "kind">): Change => ({
  newDate: null,
  newStartsAt: null,
  newEndsAt: null,
  newRoom: null,
  reason: null,
  ...c,
});

describe("экранирование и свёртка", () => {
  it("экранирует запятые, точки с запятой, косую и переносы", () => {
    expect(escapeText("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });

  it("сворачивает по 75 октетов и не режет кириллицу", () => {
    const line = `SUMMARY:${"Макроэкономика ".repeat(10)}`;
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
    expect(folded).not.toContain("�");
  });

  it("короткую строку не трогает", () => {
    expect(foldLine("VERSION:2.0")).toBe("VERSION:2.0");
  });

  it("время в UTC", () => {
    expect(formatUtc(new Date("2026-11-02T08:10:00Z"))).toBe("20261102T081000Z");
  });

  it("ссылка подписки — 22 символа base64url", () => {
    expect(isFeedToken("AbCdEfGhIjKlMnOpQrSt_-")).toBe(true);
    expect(isFeedToken("короткий")).toBe(false);
    expect(isFeedToken("AbCdEfGhIjKlMnOpQrSt_-.ics")).toBe(false);
  });
});

describe("занятия триместра", () => {
  it("каждая пара сетки на каждой неделе, время по Москве в UTC", () => {
    const events = termEvents(term, slots, []);
    expect(events).toHaveLength(4);
    const first = events[0];
    expect(first.summary).toBe("Макроэкономика · семинар");
    expect(first.start.toISOString()).toBe("2026-11-02T08:10:00.000Z"); // 11:10 МСК
    expect(first.end.toISOString()).toBe("2026-11-02T09:40:00.000Z");
    expect(first.location).toBe("ауд. 412");
    expect(first.uid).toBe("macro-2026-11-02@dekanat247");
    expect(new Set(events.map((e) => e.uid)).size).toBe(4);
  });

  it("перенос двигает то же событие, а не создаёт второе", () => {
    const moved = change({ slotId: "macro", date: "2026-11-02", kind: "moved", newDate: "2026-11-06", newStartsAt: "13:00", newEndsAt: "14:30", reason: "Преподаватель на конференции" });
    const events = termEvents(term, slots, [moved]);
    expect(events).toHaveLength(4);
    const e = events.find((x) => x.uid === "macro-2026-11-02@dekanat247")!;
    expect(e.start.toISOString()).toBe("2026-11-06T10:00:00.000Z");
    expect(e.description).toContain("Перенос: было 2 ноября, 11:10");
    expect(e.description).toContain("Преподаватель на конференции");
    expect(e.cancelled).toBe(false);
  });

  it("отмена остаётся в календаре с пометкой", () => {
    const events = termEvents(term, slots, [change({ slotId: "econ", date: "2026-11-11", kind: "cancelled", reason: "Болезнь преподавателя" })]);
    const e = events.find((x) => x.uid === "econ-2026-11-11@dekanat247")!;
    expect(e.cancelled).toBe(true);
    expect(e.summary).toBe("Отменено: Эконометрика · семинар");
  });

  it("смена аудитории видна в описании", () => {
    const events = termEvents(term, slots, [change({ slotId: "macro", date: "2026-11-09", kind: "room", newRoom: "ауд. 101" })]);
    const e = events.find((x) => x.uid === "macro-2026-11-09@dekanat247")!;
    expect(e.location).toBe("ауд. 101");
    expect(e.description).toContain("обычно ауд. 412");
  });

  it("срез помечает первую неотменённую пару дисциплины на своей неделе", () => {
    const events = termEvents(term, slots, [change({ slotId: "macro", date: "2026-11-09", kind: "cancelled" })], [
      { courseId: "c-macro", number: 1, week: 1 },
      { courseId: "c-macro", number: 2, week: 2 }, // единственная пара недели отменена — помечать нечего
    ]);
    expect(events.filter((e) => e.summary.startsWith("Срез")).map((e) => e.uid)).toEqual(["macro-2026-11-02@dekanat247"]);
  });
});

describe("файл календаря", () => {
  it("собирается по RFC 5545: CRLF, обязательные поля, отмена", () => {
    const events = termEvents(term, slots, [change({ slotId: "econ", date: "2026-11-04", kind: "cancelled" })]);
    const ics = buildCalendar({ name: "Расписание, ГЭ-24-1", description: "Концепт", events, stamp: new Date("2026-11-01T00:00:00Z") });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.split("\r\n").every((l) => !l.includes("\n"))).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(4);
    expect(ics).toContain("X-WR-CALNAME:Расписание\\, ГЭ-24-1");
    expect(ics).toContain("DTSTAMP:20261101T000000Z");
    expect(ics).toContain("STATUS:CANCELLED");
  });
});
