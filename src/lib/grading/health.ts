// «Светофор» по дисциплине: спокойно, обрати внимание или нужен план — и почему.
// Чистая функция поверх расчёта балла: причины перечислены словами, цвет только дублирует их.

import { DEFAULT_SETTINGS, markFor, MARK_LABEL, type DisciplineInput, type DisciplineResult, type GradingSettings, type Mark } from "./index";

/** 0 — спокойно, 1 — обрати внимание, 2 — нужен план. */
export type HealthLevel = 0 | 1 | 2;
export type Health = { level: HealthLevel; label: string; reasons: string[] };

export const HEALTH_LABEL: Record<HealthLevel, string> = { 0: "спокойно", 1: "обрати внимание", 2: "нужен план" };

/** До оценки ниже осталось меньше стольких баллов — «на грани». */
const MARK_MARGIN = 2;
/** Срез хуже предыдущего на столько баллов — заметное падение. */
const DROP = 10;
/** Посещаемость ниже — уже бьёт по вовлечённости. */
const ATTENDANCE_LOW = 75;

const one = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });
const NEXT_DOWN: Record<Mark, Mark | null> = { excellent: "good", good: "satisfactory", satisfactory: "fail", fail: null };

export function healthOf(
  input: DisciplineInput,
  result: DisciplineResult | null,
  /** Сколько срезов запланировано: нужно, чтобы понять, есть ли ещё шанс на автомат. */
  plannedCheckpoints: number,
  s: GradingSettings = DEFAULT_SETTINGS,
): Health | null {
  if (!result) return null;
  const reasons: { level: HealthLevel; text: string }[] = [];
  const mark = markFor(result.score, s);
  const floor = mark === "excellent" ? s.thresholds.excellent : mark === "good" ? s.thresholds.good : s.thresholds.satisfactory;

  if (mark === "fail") {
    reasons.push({
      level: 2,
      text: `Балл ${one.format(result.score)} — ниже ${s.thresholds.satisfactory}. Если так останется, будет долг и пересдача.`,
    });
  } else if (result.score - floor < MARK_MARGIN) {
    const down = NEXT_DOWN[mark]!;
    reasons.push({
      level: down === "fail" ? 2 : 1,
      text: `До «${MARK_LABEL[down]}» всего ${one.format(result.score - floor)} балла: один слабый срез — и оценка ниже.`,
    });
  }

  const cps = input.checkpoints;
  if (cps.length >= 2 && cps[cps.length - 2] - cps[cps.length - 1] >= DROP) {
    reasons.push({
      level: 1,
      text: `Последний срез на ${cps[cps.length - 2] - cps[cps.length - 1]} баллов ниже предыдущего.`,
    });
  }

  if (input.attendancePct !== null && input.attendancePct < ATTENDANCE_LOW) {
    reasons.push({
      level: 1,
      text: `Посещаемость ${Math.round(input.attendancePct)}%: она входит в балл дисциплины.`,
    });
  }

  // Зачёт: все срезы выставлены, а до автомата не хватило — зачёт придётся сдавать.
  if (input.session.kind === "credit" && input.session.raw === null && cps.length >= plannedCheckpoints && !result.session.auto) {
    reasons.push({
      level: 1,
      text: `Автомата не будет: зачёт нужно сдавать, за него ставят не больше ${s.creditCapWithoutAuto}.`,
    });
  }

  const level = reasons.reduce<HealthLevel>((max, r) => (r.level > max ? r.level : max), 0);
  return {
    level,
    label: HEALTH_LABEL[level],
    reasons: reasons.sort((a, b) => b.level - a.level).map((r) => r.text),
  };
}
