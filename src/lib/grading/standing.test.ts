import { describe, expect, it } from "vitest";
import { standingOf } from "./standing";

describe("место на курсе", () => {
  it("место — сколько рейтингов выше, плюс один", () => {
    const s = standingOf(85, [90, 80, 70, 88, 60])!;
    expect(s.place).toBe(3);
    expect(s.total).toBe(6);
    expect(s.aboveShare).toBeCloseTo(3 / 5);
  });

  it("равные с точностью до десятой делят место", () => {
    const s = standingOf(84.96, [85.04, 85, 70, 60])!;
    expect(s.place).toBe(1);
    expect(s.tied).toBe(3);
  });

  it("в маленькой группе места нет: диапазоны выдали бы чужие баллы", () => {
    expect(standingOf(80, [70, 75, 90])).toBeNull();
  });

  it("диапазоны по 5 баллов без пропусков, свой отмечен, сотня — в последнем", () => {
    const s = standingOf(91, [100, 78, 79, 84, 66])!;
    expect(s.bins.map((b) => [b.from, b.count])).toEqual([
      [65, 1],
      [70, 0],
      [75, 2],
      [80, 1],
      [85, 0],
      [90, 1],
      [95, 1],
    ]);
    expect(s.bins.filter((b) => b.mine).map((b) => b.from)).toEqual([90]);
    expect(s.bins.reduce((n, b) => n + b.count, 0)).toBe(s.total);
  });
});
