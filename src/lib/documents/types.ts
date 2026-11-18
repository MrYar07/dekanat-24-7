// Снимок данных на момент выдачи документа. PDF и страница проверки строятся из снимка,
// поэтому справка не «переписывается», если позже изменятся группа или баллы.

export type StudentSnapshot = {
  lastName: string;
  firstName: string;
  middleName: string | null;
  recordBookNumber: string;
  faculty: string;
  programCode: string;
  program: string;
  group: string;
  course: number;
  isPaid: boolean;
};

export type StudySnapshot = { kind: "study"; student: StudentSnapshot; purpose: string };

export type RatingRow = {
  discipline: string;
  assessment: "exam" | "credit";
  score: number;
  mark: string;
  /** Сколько раз пересдавали. В выписках до архива поля нет. */
  retakes?: number;
};

/** Закрытый триместр в выписке «за всё время». */
export type TermRecord = { term: string; rows: RatingRow[]; rating: number; base: number; bonus: number };

export type RatingSnapshot = {
  kind: "rating";
  student: StudentSnapshot;
  term: string;
  rows: RatingRow[];
  rating: number;
  base: number;
  bonus: number;
  forecast: boolean;
  /** Годовые рейтинги, свежий год первым. В выписках, выданных до появления архива, поля нет. */
  years?: { academicYear: string; rating: number; complete: boolean }[];
  /** Место на курсе по рейтингу триместра. В маленьком курсе его нет. */
  place?: { place: number; total: number; course: number };
  /** Выписка «за всё время обучения»: закрытые триместры по порядку, текущий — в term и rows. */
  history?: TermRecord[];
};

export type DocumentSnapshot = StudySnapshot | RatingSnapshot;
