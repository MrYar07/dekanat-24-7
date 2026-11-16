// Место на курсе (PRD 5.4): видно только самому студенту, без списков с ФИО и без чужих баллов.
// Наружу выходят только место, число студентов и сколько человек в каждом диапазоне в 5 баллов.

/** Меньше этого числа студентов место не показываем: в маленькой группе диапазоны выдают чужие баллы. */
export const MIN_COHORT = 5;
export const BIN = 5;

export type Bin = { from: number; to: number; count: number; mine: boolean };
export type Standing = {
  place: number;
  total: number;
  /** Сколько студентов делят это место, включая самого студента. */
  tied: number;
  /** Доля остальных, у кого рейтинг ниже: «выше, чем у 75% курса». */
  aboveShare: number;
  bins: Bin[];
};

/** Сравниваем с точностью до десятой — так, как рейтинг виден на экране. */
const r1 = (x: number) => Math.round(x * 10) / 10;

export function standingOf(mine: number, others: number[]): Standing | null {
  const total = others.length + 1;
  if (total < MIN_COHORT) return null;
  const me = r1(mine);
  const rest = others.map(r1);
  const higher = rest.filter((x) => x > me).length;
  const lower = rest.filter((x) => x < me).length;

  const all = [me, ...rest];
  const binOf = (x: number) => Math.min(100 - BIN, Math.floor(x / BIN) * BIN);
  const lo = Math.min(...all.map(binOf));
  const hi = Math.max(...all.map(binOf));
  const bins: Bin[] = [];
  for (let from = lo; from <= hi; from += BIN) {
    bins.push({ from, to: from + BIN, count: all.filter((x) => binOf(x) === from).length, mine: binOf(me) === from });
  }
  return {
    place: higher + 1,
    total,
    tied: total - higher - lower,
    aboveShare: rest.length === 0 ? 0 : lower / rest.length,
    bins,
  };
}
