import { describe, expect, it } from "vitest";
import { addDays, mondayOf, mskInstant, mskNow, termWeek, formatIn } from "@/lib/time";
import { lessonsOn, upcomingChanges, upcomingDay, type Change, type Slot } from ".";

// 9 ноября 2026 — понедельник.
const MON = "2026-11-09";

const slot = (id: string, weekday: number, startsAt: string, endsAt: string, discipline = id): Slot => ({
  id,
  courseId: `c-${id}`,
  discipline,
  teacher: "Лазарева И. О.",
  kind: "seminar",
  weekday,
  startsAt,
  endsAt,
  room: "ауд. 412",
});

const slots = [
  slot("macro", 1, "11:10", "12:40", "Макроэкономика"),
  slot("world", 1, "13:00", "14:30", "Мировая экономика"),
  slot("econometrics", 2, "11:10", "12:40", "Эконометрика"),
];

const change = (c: Partial<Change> & Pick<Change, "slotId" | "date" | "kind">): Change => ({
  newDate: null,
  newStartsAt: null,
  newEndsAt: null,
  newRoom: null,
  reason: null,
  ...c,
});

describe("время по Москве", () => {
  it("переводит UTC в московские дату, день недели и минуты", () => {
    // 21:30 UTC воскресенья — это уже 00:30 понедельника в Москве.
    expect(mskNow(new Date("2026-11-08T21:30:00Z"))).toEqual({ date: MON, weekday: 1, minutes: 30 });
  });

  it("считает понедельник недели и учебную неделю", () => {
    expect(mondayOf("2026-11-12")).toBe(MON);
    expect(termWeek(addDays(MON, -56), MON)).toBe(9);
    expect(mskInstant(MON, "11:10").toISOString()).toBe("2026-11-09T08:10:00.000Z");
  });

  it("пишет «через» по-человечески", () => {
    expect(formatIn(25)).toBe("через 25 мин");
    expect(formatIn(60)).toBe("через 1 ч");
    expect(formatIn(125)).toBe("через 2 ч 5 мин");
  });
});

describe("занятия на дату", () => {
  it("раскладывает сетку по дню недели и сортирует по времени", () => {
    expect(lessonsOn(MON, slots, []).map((l) => l.discipline)).toEqual(["Макроэкономика", "Мировая экономика"]);
  });

  it("перенос убирает пару из исходного дня и добавляет в новый", () => {
    const moved = change({ slotId: "econometrics", date: "2026-11-10", kind: "moved", newDate: "2026-11-12", newStartsAt: "13:00", newEndsAt: "14:30" });
    expect(lessonsOn("2026-11-10", slots, [moved])).toEqual([]);
    const [thu] = lessonsOn("2026-11-12", slots, [moved]);
    expect(thu).toMatchObject({ discipline: "Эконометрика", startsAt: "13:00", cancelled: false });
    expect(thu.change?.originalStartsAt).toBe("11:10");
  });

  it("отмена оставляет пару в списке с пометкой, смена аудитории меняет аудиторию", () => {
    const changes = [
      change({ slotId: "macro", date: MON, kind: "cancelled", reason: "болезнь" }),
      change({ slotId: "world", date: MON, kind: "room", newRoom: "ауд. 330" }),
    ];
    const [macro, world] = lessonsOn(MON, slots, changes);
    expect(macro.cancelled).toBe(true);
    expect(world.room).toBe("ауд. 330");
    expect(world.change?.originalRoom).toBe("ауд. 412");
  });
});

describe("ближайший учебный день", () => {
  it("до первой пары: следующая — первая", () => {
    const day = upcomingDay({ date: MON, weekday: 1, minutes: 10 * 60 }, slots, []);
    expect(day?.isToday).toBe(true);
    expect(day?.current).toBeNull();
    expect(day?.next?.discipline).toBe("Макроэкономика");
  });

  it("во время пары: текущая и следующая", () => {
    const day = upcomingDay({ date: MON, weekday: 1, minutes: 11 * 60 + 30 }, slots, []);
    expect(day?.current?.discipline).toBe("Макроэкономика");
    expect(day?.next?.discipline).toBe("Мировая экономика");
  });

  it("после последней пары — следующий учебный день", () => {
    const day = upcomingDay({ date: MON, weekday: 1, minutes: 15 * 60 }, slots, []);
    expect(day).toMatchObject({ date: "2026-11-10", isToday: false });
    expect(day?.next?.discipline).toBe("Эконометрика");
  });

  it("пропускает день, где все пары отменены", () => {
    const cancelled = change({ slotId: "econometrics", date: "2026-11-10", kind: "cancelled" });
    const day = upcomingDay({ date: MON, weekday: 1, minutes: 15 * 60 }, slots, [cancelled]);
    expect(day?.date).toBe("2026-11-16");
  });

  it("без расписания — null", () => {
    expect(upcomingDay({ date: MON, weekday: 1, minutes: 0 }, [], [])).toBeNull();
  });
});

describe("изменения на неделю", () => {
  it("видит перенос по новой дате и не видит старые изменения", () => {
    const changes = [
      change({ slotId: "econometrics", date: "2026-11-10", kind: "moved", newDate: "2026-11-12", newStartsAt: "13:00" }),
      change({ slotId: "macro", date: "2026-11-02", kind: "cancelled" }),
    ];
    const list = upcomingChanges(MON, slots, changes);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ discipline: "Эконометрика", date: "2026-11-12" });
  });
});
