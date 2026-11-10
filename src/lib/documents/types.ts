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

export type RatingSnapshot = {
  kind: "rating";
  student: StudentSnapshot;
  term: string;
  rows: { discipline: string; assessment: "exam" | "credit"; score: number; mark: string }[];
  rating: number;
  base: number;
  bonus: number;
  forecast: boolean;
};

export type DocumentSnapshot = StudySnapshot | RatingSnapshot;
