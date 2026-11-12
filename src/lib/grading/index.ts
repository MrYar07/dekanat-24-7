// Расчёт баллов и рейтинга по правилам «Меридиана» (docs/GRADING.md).
// Чистые функции без доступа к базе: одни и те же на сервере и в калькуляторе.
// Внутри ничего не округляем — только при показе.

export type GradingSettings = {
  weights: { work: number; session: number; engagement: number };
  thresholds: { excellent: number; good: number; satisfactory: number };
  autoCreditFrom: number;
  creditCapWithoutAuto: number;
  teacherBonusMax: number;
  retakePenalty: number;
  activityPointsMax: number;
  activityCoefficient: number;
  /** Пороги привилегий: стипендия и отметка — по рейтингу триместра, гранты — по годовому, без пересдач. */
  privileges: { scholarshipFrom: number; topFrom: number; grant25From: number; grant50From: number };
};

export const DEFAULT_SETTINGS: GradingSettings = {
  weights: { work: 0.4, session: 0.45, engagement: 0.15 },
  thresholds: { excellent: 90, good: 75, satisfactory: 60 },
  autoCreditFrom: 75,
  creditCapWithoutAuto: 74,
  teacherBonusMax: 5,
  retakePenalty: 10,
  activityPointsMax: 100,
  activityCoefficient: 0.04,
  privileges: { scholarshipFrom: 85, topFrom: 80, grant25From: 90, grant50From: 95 },
};

const clamp = (x: number, min = 0, max = 100) => Math.min(max, Math.max(min, x));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export type Mark = "excellent" | "good" | "satisfactory" | "fail";

export const MARK_LABEL: Record<Mark, string> = {
  excellent: "отлично",
  good: "хорошо",
  satisfactory: "удовлетворительно",
  fail: "неудовлетворительно",
};

export function markFor(score: number, s = DEFAULT_SETTINGS): Mark {
  if (score >= s.thresholds.excellent) return "excellent";
  if (score >= s.thresholds.good) return "good";
  if (score >= s.thresholds.satisfactory) return "satisfactory";
  return "fail";
}

/** Работа в триместре: среднее выставленных срезов + бонус преподавателя. Нет срезов — null. */
export function trimesterWork(checkpoints: number[], bonus = 0, s = DEFAULT_SETTINGS): number | null {
  if (checkpoints.length === 0) return null;
  return clamp(mean(checkpoints) + clamp(bonus, 0, s.teacherBonusMax));
}

export type SessionInput = {
  kind: "exam" | "credit";
  /** Балл, полученный на экзамене или зачёте. null — ещё не сдавал. */
  raw: number | null;
  retakes?: number;
};

export type SessionResult = { score: number; auto: boolean; forecast: boolean };

/** Сессия с учётом автомата, потолка зачёта без автомата и штрафа за пересдачи. */
export function sessionScore(input: SessionInput, work: number | null, s = DEFAULT_SETTINGS): SessionResult | null {
  if (input.kind === "credit" && work !== null && work >= s.autoCreditFrom) {
    return { score: work, auto: true, forecast: false };
  }
  if (input.raw === null) {
    return work === null ? null : { score: work, auto: false, forecast: true };
  }
  let score = clamp(input.raw);
  if (input.kind === "credit") score = Math.min(score, s.creditCapWithoutAuto);
  score = clamp(score - s.retakePenalty * (input.retakes ?? 0));
  return { score, auto: false, forecast: false };
}

/** Вовлечённость: половина посещаемость, половина активность. Есть только одно — берём его. */
export function engagement(attendancePct: number | null, activity: number | null): number | null {
  if (attendancePct === null && activity === null) return null;
  if (attendancePct === null) return clamp(activity!);
  if (activity === null) return clamp(attendancePct);
  return clamp(0.5 * attendancePct + 0.5 * activity);
}

export type DisciplineInput = {
  checkpoints: number[];
  bonus?: number;
  session: SessionInput;
  attendancePct: number | null;
  activity: number | null;
};

export type DisciplineResult = {
  score: number;
  /** true, если хотя бы одна часть ещё оценена прогнозом. */
  forecast: boolean;
  work: number;
  session: SessionResult;
  engagement: number;
};

export function disciplineScore(input: DisciplineInput, s = DEFAULT_SETTINGS): DisciplineResult | null {
  const work = trimesterWork(input.checkpoints, input.bonus, s);
  if (work === null) return null;

  const session = sessionScore(input.session, work, s)!;
  const eng = engagement(input.attendancePct, input.activity);
  const engValue = eng ?? work;

  const w = s.weights;
  return {
    score: clamp(w.work * work + w.session * session.score + w.engagement * engValue),
    forecast: session.forecast || eng === null || input.activity === null,
    work,
    session,
    engagement: engValue,
  };
}

export type TrimesterRating = { rating: number; base: number; bonus: number };

/** Рейтинг триместра: среднее по дисциплинам + бонус активности, не выше 100. */
export function trimesterRating(
  disciplineScores: number[],
  activityPoints: number,
  s = DEFAULT_SETTINGS,
): TrimesterRating | null {
  if (disciplineScores.length === 0) return null;
  const base = mean(disciplineScores);
  const bonus = clamp(activityPoints, 0, s.activityPointsMax) * s.activityCoefficient;
  return { rating: clamp(base + bonus), base, bonus };
}

/** Годовой рейтинг: среднее рейтингов триместров без бонуса активности. */
export function yearRating(trimesterBases: number[]): number | null {
  return trimesterBases.length === 0 ? null : mean(trimesterBases);
}

export type Needed = { kind: "already" } | { kind: "need"; score: number } | { kind: "impossible" };

function toNeeded(x: number): Needed {
  if (x <= 0) return { kind: "already" };
  // Баллы целые: нужен ближайший целый, который точно даёт цель.
  const score = Math.ceil(x - 1e-9);
  return score > 100 ? { kind: "impossible" } : { kind: "need", score };
}

/**
 * Сколько нужно набрать на каждом оставшемся срезе, чтобы работа в триместре вышла на цель
 * (например, на автомат). plannedCount — сколько всего срезов по дисциплине.
 */
export function neededOnRemainingCheckpoints(
  checkpoints: number[],
  plannedCount: number,
  target: number,
  bonus = 0,
  s = DEFAULT_SETTINGS,
): Needed {
  const remaining = plannedCount - checkpoints.length;
  const sum = checkpoints.reduce((a, b) => a + b, 0);
  const effectiveTarget = target - clamp(bonus, 0, s.teacherBonusMax);
  if (remaining <= 0) {
    return sum / Math.max(1, checkpoints.length) >= effectiveTarget ? { kind: "already" } : { kind: "impossible" };
  }
  return toNeeded((effectiveTarget * plannedCount - sum) / remaining);
}

/** Сколько нужно получить на экзамене, чтобы балл дисциплины вышел на цель. */
export function neededOnExam(
  work: number,
  engagementScore: number,
  target: number,
  retakes = 0,
  s = DEFAULT_SETTINGS,
): Needed {
  const w = s.weights;
  const sessionNeeded = (target - w.work * work - w.engagement * engagementScore) / w.session;
  if (sessionNeeded <= 0) return { kind: "already" };
  return toNeeded(sessionNeeded + s.retakePenalty * retakes);
}

export type RatingForecast = TrimesterRating & {
  /** true, если хотя бы одна дисциплина считается прогнозом (сессии ещё не было). */
  forecast: boolean;
  /** Сколько дисциплин учтено: без срезов дисциплина в рейтинг пока не входит. */
  counted: number;
};

/** Рейтинг триместра по всем дисциплинам студента: то, что видно на «Сегодня» и в «Успеваемости». */
export function ratingForecast(
  courses: DisciplineInput[],
  activityPoints: number,
  s = DEFAULT_SETTINGS,
): RatingForecast | null {
  const results = courses.map((c) => disciplineScore(c, s)).filter((r) => r !== null);
  const rating = trimesterRating(
    results.map((r) => r.score),
    activityPoints,
    s,
  );
  if (!rating) return null;
  return { ...rating, forecast: results.some((r) => r.forecast), counted: results.length };
}

/** Процент посещаемости: уважительные пропуски не считаются. Нет отметок — null. */
export function attendancePercent(present: number, absent: number): number | null {
  const total = present + absent;
  return total === 0 ? null : (present / total) * 100;
}

export type Privilege = {
  key: "scholarship" | "top" | "grant25" | "grant50";
  label: string;
  from: number;
  /** По какому показателю считается: рейтинг триместра или средний балл без бонуса (прообраз годового). */
  basis: "rating" | "base";
  reached: boolean;
};

/** Привилегии, доступные студенту, и выполнен ли порог. Гранты — только для платной формы. */
export function privilegesFor(r: TrimesterRating, isPaid: boolean, s = DEFAULT_SETTINGS): Privilege[] {
  const p = s.privileges;
  const list: Privilege[] = [
    { key: "scholarship", label: "повышенная стипендия", from: p.scholarshipFrom, basis: "rating", reached: false },
    { key: "top", label: "«В числе лучших на факультете»", from: p.topFrom, basis: "rating", reached: false },
  ];
  if (isPaid) {
    list.push(
      { key: "grant25", label: "грант 25%", from: p.grant25From, basis: "base", reached: false },
      { key: "grant50", label: "грант 50%", from: p.grant50From, basis: "base", reached: false },
    );
  }
  return list.map((x) => ({ ...x, reached: (x.basis === "rating" ? r.rating : r.base) >= x.from }));
}

export type Goal = { label: string; target: number; value: number; gap: number; basis: Privilege["basis"] };

/**
 * Ближайшая цель для экрана «Сегодня»: для платной формы — следующий грант,
 * для бюджета — повышенная стипендия. Всё уже достигнуто — gap = 0 у старшей цели.
 */
export function nextGoal(r: TrimesterRating, isPaid: boolean, s = DEFAULT_SETTINGS): Goal {
  const ladder = privilegesFor(r, isPaid, s).filter((x) => (isPaid ? x.basis === "base" : x.key === "scholarship"));
  const goal = ladder.find((x) => !x.reached) ?? ladder[ladder.length - 1];
  const value = goal.basis === "rating" ? r.rating : r.base;
  return { label: goal.label, target: goal.from, value, gap: Math.max(0, goal.from - value), basis: goal.basis };
}

// ——— Разбор «из чего складывается» ———

export type PartShare = {
  /** Балл части, 0–100. */
  value: number;
  /** Вес части в балле дисциплины. */
  weight: number;
  /** Вклад в балл дисциплины: value × weight. */
  points: number;
};

export type DisciplineBreakdown = {
  score: number;
  forecast: boolean;
  work: PartShare & { mean: number; bonus: number; count: number };
  session: PartShare & {
    /** auto — автомат по зачёту; forecast — сессии ещё не было, подставлена работа в триместре; taken — сдано. */
    mode: "auto" | "forecast" | "taken";
    kind: "exam" | "credit";
    raw: number | null;
    /** Зачёт без автомата упёрся в потолок. */
    capped: boolean;
    retakes: number;
    penalty: number;
  };
  engagement: PartShare & {
    /** both — посещаемость и активность; одна из них; none — нет ни того ни другого, подставлена работа. */
    mode: "both" | "attendance" | "activity" | "none";
    attendancePct: number | null;
    activity: number | null;
  };
};

/**
 * Балл дисциплины по частям — для экрана «Из чего мой рейтинг». Считает теми же функциями,
 * что и disciplineScore, поэтому сумма вкладов всегда равна баллу дисциплины.
 */
export function explainDiscipline(input: DisciplineInput, s = DEFAULT_SETTINGS): DisciplineBreakdown | null {
  const result = disciplineScore(input, s);
  if (!result) return null;
  const w = s.weights;
  const share = (value: number, weight: number): PartShare => ({ value, weight, points: value * weight });

  const bonus = clamp(input.bonus ?? 0, 0, s.teacherBonusMax);
  const retakes = input.session.retakes ?? 0;
  const raw = input.session.raw;
  const mode = result.session.auto ? "auto" : result.session.forecast ? "forecast" : "taken";

  return {
    score: result.score,
    forecast: result.forecast,
    work: { ...share(result.work, w.work), mean: mean(input.checkpoints), bonus, count: input.checkpoints.length },
    session: {
      ...share(result.session.score, w.session),
      mode,
      kind: input.session.kind,
      raw,
      capped: mode === "taken" && input.session.kind === "credit" && raw !== null && raw > s.creditCapWithoutAuto,
      retakes: mode === "taken" ? retakes : 0,
      penalty: mode === "taken" ? s.retakePenalty * retakes : 0,
    },
    engagement: {
      ...share(result.engagement, w.engagement),
      mode:
        input.attendancePct !== null && input.activity !== null
          ? "both"
          : input.attendancePct !== null
            ? "attendance"
            : input.activity !== null
              ? "activity"
              : "none",
      attendancePct: input.attendancePct,
      activity: input.activity,
    },
  };
}

export type RatingStep = { after: number; rating: number; base: number };

/**
 * Как срезы меняли прогноз рейтинга: рейтинг, посчитанный только по первым k срезам каждой дисциплины.
 * Посещаемость, бонусы и баллы активности берутся сегодняшние — это разбор влияния срезов, а не архив.
 * Шаг k есть, только если хотя бы у одной дисциплины выставлен k-й срез.
 */
export function ratingBySteps(courses: DisciplineInput[], activityPoints: number, s = DEFAULT_SETTINGS): RatingStep[] {
  const max = Math.max(0, ...courses.map((c) => c.checkpoints.length));
  const steps: RatingStep[] = [];
  for (let k = 1; k <= max; k++) {
    const r = ratingForecast(
      courses.map((c) => ({ ...c, checkpoints: c.checkpoints.slice(0, k) })),
      activityPoints,
      s,
    );
    if (r) steps.push({ after: k, rating: r.rating, base: r.base });
  }
  return steps;
}
