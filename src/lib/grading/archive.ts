// Архив и годовой рейтинг (docs/GRADING.md): годовой — среднее рейтингов триместров без бонуса активности.
// Чистые функции: данные о триместрах приходят уже посчитанными (ratingForecast по каждому триместру).

import { DEFAULT_SETTINGS, yearRating, type RatingForecast } from "./index";

export const TERMS_PER_YEAR = 3;

export type TermSummary = {
  id: string;
  name: string;
  academicYear: string;
  number: number;
  current: boolean;
  rating: RatingForecast | null;
  /** Сколько пересдач было за триместр: с ними грант не положен. */
  retakes: number;
};

export type YearSummary = {
  academicYear: string;
  terms: TermSummary[];
  /** Среднее средних баллов триместров. null — ни в одном триместре ещё нет баллов. */
  rating: number | null;
  /** Все три триместра закрыты: годовой рейтинг окончательный. */
  complete: boolean;
  retakes: number;
};

/** Триместры по учебным годам: свежий год первым, триместры внутри года — по порядку. */
export function summarizeYears(terms: TermSummary[]): YearSummary[] {
  const byYear = new Map<string, TermSummary[]>();
  for (const t of terms) byYear.set(t.academicYear, [...(byYear.get(t.academicYear) ?? []), t]);

  return [...byYear.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([academicYear, list]) => {
      const sorted = [...list].sort((a, b) => a.number - b.number);
      const rated = sorted.filter((t) => t.rating !== null);
      const final = rated.filter((t) => !t.current && !t.rating!.forecast);
      return {
        academicYear,
        terms: sorted,
        rating: yearRating(rated.map((t) => t.rating!.base)),
        complete: final.length === TERMS_PER_YEAR,
        retakes: sorted.reduce((n, t) => n + t.retakes, 0),
      };
    });
}

export type YearGrant = { label: string; from: number; reached: boolean };

/**
 * Гранты на обучение — по годовому рейтингу и только без пересдач. Для бюджетной формы грантов нет.
 * Пока год не закрыт, это прогноз: «если так и пойдёт».
 */
export function yearGrants(year: YearSummary, isPaid: boolean, s = DEFAULT_SETTINGS): YearGrant[] {
  if (!isPaid || year.rating === null) return [];
  const ok = year.retakes === 0;
  return [
    { label: "грант 25%", from: s.privileges.grant25From, reached: ok && year.rating >= s.privileges.grant25From },
    { label: "грант 50%", from: s.privileges.grant50From, reached: ok && year.rating >= s.privileges.grant50From },
  ];
}

/** Повышенная стипендия на следующий триместр: рейтинг триместра от порога и ни одной пересдачи. */
export function earnedScholarship(t: TermSummary, s = DEFAULT_SETTINGS): boolean {
  return !t.current && t.rating !== null && !t.rating.forecast && t.retakes === 0 && t.rating.rating >= s.privileges.scholarshipFrom;
}

/** Учебный год, в котором начался триместр: с августа — новый год. «2025/26». */
export function academicYearOf(date: string): string {
  const [y, m] = date.split("-").map(Number);
  const start = m >= 8 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}
