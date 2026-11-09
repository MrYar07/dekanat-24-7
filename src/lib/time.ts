// Время «Меридиана» — московское. Москва живёт в UTC+3 круглый год, поэтому считаем сдвигом,
// без зависимости от часового пояса сервера (в Docker он UTC).
// Даты — строки «ГГГГ-ММ-ДД», время — «ЧЧ:ММ».

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type MskNow = {
  date: string;
  /** 1 — понедельник … 7 — воскресенье. */
  weekday: number;
  /** Минуты от начала суток. */
  minutes: number;
};

export function mskNow(at: Date = new Date()): MskNow {
  const msk = new Date(at.getTime() + MSK_OFFSET_MS);
  return {
    date: msk.toISOString().slice(0, 10),
    weekday: ((msk.getUTCDay() + 6) % 7) + 1,
    minutes: msk.getUTCHours() * 60 + msk.getUTCMinutes(),
  };
}

const parse = (date: string) => Date.parse(`${date}T00:00:00Z`);

export function addDays(date: string, days: number): string {
  return new Date(parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to) - parse(from)) / DAY_MS);
}

export function weekdayOf(date: string): number {
  return ((new Date(parse(date)).getUTCDay() + 6) % 7) + 1;
}

/** Понедельник той недели, в которую попадает дата. */
export function mondayOf(date: string): string {
  return addDays(date, 1 - weekdayOf(date));
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Учебная неделя (с 1) для даты; startsOn — понедельник первой недели. */
export function termWeek(startsOn: string, date: string): number {
  return Math.floor(daysBetween(startsOn, date) / 7) + 1;
}

/** Момент времени (UTC) для московских даты и времени. */
export function mskInstant(date: string, time = "00:00"): Date {
  return new Date(parse(date) + toMinutes(time) * 60_000 - MSK_OFFSET_MS);
}

const dayFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const weekdayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "long", timeZone: "UTC" });
const weekdayShort = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" });

/** «12 ноября» */
export function formatDay(date: string): string {
  return dayFormat.format(new Date(parse(date)));
}

/** «четверг» */
export function formatWeekday(date: string): string {
  return weekdayFormat.format(new Date(parse(date)));
}

/** «чт, 12 ноября» */
export function formatShortDay(date: string): string {
  return `${weekdayShort.format(new Date(parse(date)))}, ${formatDay(date)}`;
}

/** «сегодня», «завтра» или «чт, 12 ноября» относительно today. */
export function relativeDay(date: string, today: string): string {
  const d = daysBetween(today, date);
  if (d === 0) return "сегодня";
  if (d === 1) return "завтра";
  if (d === -1) return "вчера";
  return formatShortDay(date);
}

/** «через 25 мин», «через 2 ч 5 мин» */
export function formatIn(minutes: number): string {
  if (minutes < 60) return `через ${minutes} мин`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `через ${h} ч` : `через ${h} ч ${m} мин`;
}
