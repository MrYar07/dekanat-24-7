// «Путь к цели»: что именно нужно получить на оставшихся срезах и экзаменах, чтобы выйти на порог
// (стипендия, грант, отметка «в числе лучших»). Калькулятор «а если…» отвечает на вопрос «что будет, если»,
// а здесь кабинет сам подбирает самые дешёвые способы. Чистые функции поверх того же расчёта рейтинга.

import { DEFAULT_SETTINGS, ratingForecast, type DisciplineInput, type GradingSettings, type Privilege } from "./index";
import { applyScenario, EMPTY_SCENARIO, type CourseScenario } from "./scenario";

export type PathCourse = {
  input: DisciplineInput;
  /** Номера срезов, по которым балла ещё нет. */
  pending: number[];
};

export type PathGoal = Pick<Privilege, "key" | "label" | "from" | "basis">;

/** Насколько ход выше нынешнего уровня студента: до 5 баллов — по силам, до 12 — с усилием, дальше — на пределе. */
export type Effort = "easy" | "medium" | "hard";
export const effortOf = (delta: number): Effort => (delta <= 5 ? "easy" : delta <= 12 ? "medium" : "hard");

export type PathOption =
  | {
      kind: "checkpoints" | "exam";
      /** Индекс дисциплины в переданном списке. */
      course: number;
      /** Балл, который нужно получить (на каждом из оставшихся срезов или на экзамене). */
      score: number;
      /** Нынешний уровень: средний балл за срезы или прогноз экзамена. */
      level: number;
      effort: Effort;
      /** Хватает ли одного этого хода. Если нет — gain показывает, сколько он даст при 100 баллах. */
      reaches: boolean;
      gain: number;
    }
  | {
      kind: "activity";
      /** Сколько баллов за достижения нужно добавить. */
      points: number;
      /** Сколько баллов ещё пойдёт в рейтинг до предела триместра. */
      room: number;
      reaches: boolean;
      gain: number;
    };

export type PathToGoal = {
  goal: PathGoal;
  /** Текущее значение показателя цели: рейтинг триместра или средний балл без бонуса. */
  value: number;
  /** Сколько не хватает. 0 — цель достигнута. */
  gap: number;
  reached: boolean;
  /**
   * Ровный план: на сколько баллов выше (или ниже, если цель уже достигнута) нынешнего среднего нужно
   * получать на всём, что осталось. null — цель недостижима даже с сотнями; тогда best — потолок.
   */
  uniform: { delta: number | null; best: number; targets: { course: number; checkpoints: number | null; exam: number | null }[] };
  /** Отдельные ходы, от самого лёгкого. Пусто, если цель уже достигнута. */
  options: PathOption[];
};

const EPS = 1e-9;
const clamp = (x: number) => Math.min(100, Math.max(0, x));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** Сценарий для дисциплины: одинаковый балл на всех оставшихся срезах и (если задан) на экзамене. */
function scenario(c: PathCourse, checkpoints: number | null, exam: number | null): CourseScenario {
  return {
    checkpoints: checkpoints === null ? {} : Object.fromEntries(c.pending.map((n) => [n, checkpoints])),
    session: exam,
    retakes: 0,
  };
}

/** Самые дешёвые способы выйти на цель. Дисциплины без единого среза в расчёт не входят, как и в рейтинг. */
export function pathToGoal(
  courses: PathCourse[],
  activityPoints: number,
  goal: PathGoal,
  s: GradingSettings = DEFAULT_SETTINGS,
): PathToGoal | null {
  const measure = (scenarios: CourseScenario[], activity = activityPoints) => {
    const r = ratingForecast(
      courses.map((c, i) => applyScenario(c.input, scenarios[i])),
      activity,
      s,
    );
    return r === null ? null : goal.basis === "rating" ? r.rating : r.base;
  };
  const none = courses.map(() => EMPTY_SCENARIO);
  const value = measure(none);
  if (value === null) return null;

  const reaches = (v: number | null) => v !== null && v >= goal.from - EPS;
  const counted = (c: PathCourse) => c.input.checkpoints.length > 0;
  const level = (c: PathCourse) => Math.round(mean(c.input.checkpoints));
  const isExam = (c: PathCourse) => c.input.session.kind === "exam" && c.input.session.raw === null;

  // Ровный план: всё оставшееся — на d баллов выше нынешнего среднего по дисциплине.
  const uniformAt = (d: number) =>
    courses.map((c) => {
      if (!counted(c)) return EMPTY_SCENARIO;
      const x = clamp(level(c) + d);
      return scenario(c, c.pending.length > 0 ? x : null, isExam(c) ? x : null);
    });
  let delta: number | null = null;
  for (let d = -100; d <= 100; d++) {
    if (reaches(measure(uniformAt(d)))) {
      delta = d;
      break;
    }
  }
  const shown = uniformAt(delta ?? 100);
  const uniform = {
    delta,
    best: measure(uniformAt(100)) ?? value,
    targets: courses
      .map((c, i) => ({
        course: i,
        checkpoints: counted(c) && c.pending.length > 0 ? (shown[i].checkpoints[c.pending[0]] ?? null) : null,
        exam: counted(c) && isExam(c) ? shown[i].session : null,
      }))
      .filter((t) => t.checkpoints !== null || t.exam !== null),
  };

  const reached = reaches(value);
  const options: PathOption[] = [];
  if (!reached) {
    const only = (i: number, sc: CourseScenario) => none.map((x, k) => (k === i ? sc : x));
    const lever = (i: number, kind: "checkpoints" | "exam", from: number) => {
      const c = courses[i];
      const at = (x: number) => measure(only(i, kind === "exam" ? scenario(c, null, x) : scenario(c, x, null)));
      let score = 100;
      for (let x = 0; x <= 100; x++) {
        if (reaches(at(x))) {
          score = x;
          break;
        }
      }
      const top = at(100) ?? value;
      options.push({ kind, course: i, score, level: from, effort: effortOf(score - from), reaches: reaches(top), gain: top - value });
    };
    courses.forEach((c, i) => {
      if (!counted(c)) return;
      if (c.pending.length > 0) lever(i, "checkpoints", level(c));
      // Прогноз экзамена — нынешняя работа в триместре: от неё и считаем усилие.
      if (isExam(c)) lever(i, "exam", Math.round(clamp(mean(c.input.checkpoints) + (c.input.bonus ?? 0))));
    });

    if (goal.basis === "rating") {
      const room = Math.max(0, s.activityPointsMax - activityPoints);
      const points = Math.ceil((goal.from - value) / s.activityCoefficient - EPS);
      if (room > 0) {
        options.push({ kind: "activity", points, room, reaches: points <= room, gain: Math.min(points, room) * s.activityCoefficient });
      }
    }

    const weight = (o: PathOption) => (o.kind === "activity" ? o.points / 10 : o.score - o.level);
    options.sort((a, b) => Number(b.reaches) - Number(a.reaches) || (a.reaches ? weight(a) - weight(b) : b.gain - a.gain));
  }

  return { goal, value, gap: Math.max(0, goal.from - value), reached, uniform, options };
}
