// Калькулятор «а если…»: что станет с баллом дисциплины и рейтингом при предполагаемых оценках.
// Чистые функции поверх расчёта из index.ts: считают в браузере, без запросов к серверу и без сохранения.

import {
  DEFAULT_SETTINGS,
  disciplineScore,
  privilegesFor,
  ratingForecast,
  type DisciplineInput,
  type DisciplineResult,
  type GradingSettings,
  type Privilege,
  type RatingForecast,
} from "./index";

export type CourseScenario = {
  /** Предполагаемые баллы за ещё не выставленные срезы: номер среза → балл. */
  checkpoints: Record<number, number>;
  /** Предполагаемый балл на экзамене или зачёте. null — не задан. */
  session: number | null;
  /** Сколько пересдач понадобится. Учитывается, только если задан балл сессии. */
  retakes: number;
};

export const EMPTY_SCENARIO: CourseScenario = { checkpoints: {}, session: null, retakes: 0 };

export const isEmptyScenario = (sc: CourseScenario) => Object.keys(sc.checkpoints).length === 0 && sc.session === null;

const score = (x: number) => Math.min(100, Math.max(0, Math.round(x)));

/** Данные дисциплины с подставленными предположениями. Выставленные оценки не меняются. */
export function applyScenario(input: DisciplineInput, sc: CourseScenario): DisciplineInput {
  const extra = Object.entries(sc.checkpoints)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, v]) => score(v));
  return {
    ...input,
    checkpoints: [...input.checkpoints, ...extra],
    session: sc.session === null ? input.session : { ...input.session, raw: score(sc.session), retakes: Math.max(0, sc.retakes) },
  };
}

export type WhatIfCourse = { before: DisciplineResult | null; after: DisciplineResult | null };

export type WhatIf = {
  before: RatingForecast | null;
  after: RatingForecast | null;
  courses: WhatIfCourse[];
  /** Привилегии, порог которых пройден только в сценарии, и те, что в сценарии теряются. */
  gained: Privilege[];
  lost: Privilege[];
};

/** Рейтинг и баллы дисциплин до и после сценария. activityPoints — отдельно «сейчас» и «в сценарии». */
export function whatIf(
  courses: { input: DisciplineInput; scenario: CourseScenario }[],
  activity: { now: number; then: number },
  isPaid: boolean,
  s: GradingSettings = DEFAULT_SETTINGS,
): WhatIf {
  const changed = courses.map((c) => applyScenario(c.input, c.scenario));
  const before = ratingForecast(
    courses.map((c) => c.input),
    activity.now,
    s,
  );
  const after = ratingForecast(changed, activity.then, s);

  const was = before ? privilegesFor(before, isPaid, s) : [];
  const will = after ? privilegesFor(after, isPaid, s) : [];
  const reached = (list: Privilege[], key: Privilege["key"]) => list.find((p) => p.key === key)?.reached ?? false;

  return {
    before,
    after,
    courses: courses.map((c, i) => ({ before: disciplineScore(c.input, s), after: disciplineScore(changed[i], s) })),
    gained: will.filter((p) => p.reached && !reached(was, p.key)),
    lost: was.filter((p) => p.reached && !reached(will, p.key)),
  };
}
