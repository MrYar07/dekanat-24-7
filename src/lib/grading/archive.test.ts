import { describe, expect, it } from "vitest";
import { academicYearOf, earnedScholarship, summarizeYears, yearGrants, type TermSummary } from "./archive";

const term = (academicYear: string, number: number, base: number | null, extra: Partial<TermSummary> & { bonus?: number; forecast?: boolean } = {}): TermSummary => {
  const { bonus = 0, forecast = false, ...rest } = extra;
  return {
    id: `${academicYear}-${number}`,
    name: `${number}-й триместр`,
    academicYear,
    number,
    current: false,
    retakes: 0,
    rating: base === null ? null : { base, bonus, rating: Math.min(100, base + bonus), forecast, counted: 6 },
    ...rest,
  };
};

describe("годовой рейтинг", () => {
  it("среднее средних баллов триместров, бонус активности не входит", () => {
    const [year] = summarizeYears([term("2025/26", 1, 88, { bonus: 4 }), term("2025/26", 2, 90, { bonus: 2 }), term("2025/26", 3, 89)]);
    expect(year.rating).toBeCloseTo(89);
    expect(year.complete).toBe(true);
  });

  it("свежий год первым, триместры по порядку", () => {
    const years = summarizeYears([term("2024/25", 2, 70), term("2025/26", 1, 80), term("2024/25", 1, 72), term("2024/25", 3, 74)]);
    expect(years.map((y) => y.academicYear)).toEqual(["2025/26", "2024/25"]);
    expect(years[1].terms.map((t) => t.number)).toEqual([1, 2, 3]);
  });

  it("год с текущим триместром не закрыт, даже если триместров три", () => {
    const [year] = summarizeYears([term("2026/27", 1, 80), term("2026/27", 2, 82), term("2026/27", 3, 84, { current: true, forecast: true })]);
    expect(year.complete).toBe(false);
    expect(year.rating).toBeCloseTo(82);
  });

  it("триместр без баллов не тянет год вниз", () => {
    const [year] = summarizeYears([term("2026/27", 1, null, { current: true })]);
    expect(year.rating).toBeNull();
    expect(year.complete).toBe(false);
  });

  it("пересдачи года складываются", () => {
    const [year] = summarizeYears([term("2024/25", 1, 70), term("2024/25", 2, 71, { retakes: 1 }), term("2024/25", 3, 72, { retakes: 1 })]);
    expect(year.retakes).toBe(2);
  });
});

describe("гранты и стипендия", () => {
  const year = (rating: number, retakes = 0) => summarizeYears([term("2025/26", 1, rating, { retakes }), term("2025/26", 2, rating), term("2025/26", 3, rating)])[0];

  it("грант 25% — от 90, грант 50% — от 95", () => {
    expect(yearGrants(year(89.4), true).map((g) => g.reached)).toEqual([false, false]);
    expect(yearGrants(year(90), true).map((g) => g.reached)).toEqual([true, false]);
    expect(yearGrants(year(96), true).map((g) => g.reached)).toEqual([true, true]);
  });

  it("с пересдачей гранта нет, на бюджете грантов нет вовсе", () => {
    expect(yearGrants(year(96, 1), true).map((g) => g.reached)).toEqual([false, false]);
    expect(yearGrants(year(96), false)).toEqual([]);
  });

  it("повышенная стипендия — за закрытый триместр от 85 без пересдач", () => {
    expect(earnedScholarship(term("2025/26", 1, 84, { bonus: 2 }))).toBe(true);
    expect(earnedScholarship(term("2025/26", 1, 84))).toBe(false);
    expect(earnedScholarship(term("2025/26", 1, 90, { retakes: 1 }))).toBe(false);
    expect(earnedScholarship(term("2026/27", 1, 90, { current: true, forecast: true }))).toBe(false);
  });
});

describe("учебный год по дате", () => {
  it("с августа — новый год", () => {
    expect(academicYearOf("2026-09-21")).toBe("2026/27");
    expect(academicYearOf("2026-03-02")).toBe("2025/26");
    expect(academicYearOf("2099-08-01")).toBe("2099/00");
  });
});
