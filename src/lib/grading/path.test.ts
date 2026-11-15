import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, disciplineScore, ratingForecast, type DisciplineInput } from "./index";
import { healthOf } from "./health";
import { effortOf, pathToGoal, type PathCourse, type PathGoal } from "./path";
import { applyScenario } from "./scenario";

const course = (checkpoints: number[], kind: "exam" | "credit" = "exam", over: Partial<DisciplineInput> = {}): PathCourse => ({
  input: { checkpoints, bonus: 0, session: { kind, raw: null }, attendancePct: 90, activity: null, ...over },
  pending: [1, 2, 3].slice(checkpoints.length),
});
const scholarship: PathGoal = { key: "scholarship", label: "повышенная стипендия", from: 85, basis: "rating" };
const grant: PathGoal = { key: "grant25", label: "грант 25%", from: 90, basis: "base" };
const rating = (cs: PathCourse[], activity: number) => ratingForecast(cs.map((c) => c.input), activity)!;

describe("путь к цели: ровный план", () => {
  const courses = [course([80, 84]), course([78, 82]), course([86, 80], "credit")];

  it("цель не достигнута: найден наименьший прирост, при котором она достигается", () => {
    const p = pathToGoal(courses, 40, scholarship)!;
    expect(p.reached).toBe(false);
    expect(p.value).toBeCloseTo(rating(courses, 40).rating, 9);
    expect(p.gap).toBeCloseTo(85 - p.value, 9);
    expect(p.uniform.delta).toBeGreaterThan(0);

    // Проверяем минимальность тем же расчётом: с найденным приростом цель есть, с приростом на балл меньше — нет.
    const at = (d: number) =>
      ratingForecast(
        courses.map((c) => {
          const x = Math.min(100, Math.round((c.input.checkpoints[0] + c.input.checkpoints[1]) / 2) + d);
          return applyScenario(c.input, {
            checkpoints: Object.fromEntries(c.pending.map((n) => [n, x])),
            session: c.input.session.kind === "exam" ? x : null,
            retakes: 0,
          });
        }),
        40,
      )!.rating;
    expect(at(p.uniform.delta!)).toBeGreaterThanOrEqual(85);
    expect(at(p.uniform.delta! - 1)).toBeLessThan(85);
  });

  it("цели на всём оставшемся: срез у каждой дисциплины, экзамен только там, где он есть", () => {
    const p = pathToGoal(courses, 40, scholarship)!;
    expect(p.uniform.targets.map((t) => t.course)).toEqual([0, 1, 2]);
    expect(p.uniform.targets[0]).toMatchObject({ checkpoints: 82 + p.uniform.delta!, exam: 82 + p.uniform.delta! });
    expect(p.uniform.targets[2].exam).toBeNull();
  });

  it("цель достигнута: показан запас — на сколько можно опуститься", () => {
    const strong = [course([92, 94]), course([90, 96])];
    const p = pathToGoal(strong, 0, scholarship)!;
    expect(p.reached).toBe(true);
    expect(p.gap).toBe(0);
    expect(p.uniform.delta).toBeLessThan(0);
    expect(p.options).toEqual([]);
  });

  it("недостижимая цель: delta = null и известен потолок", () => {
    const weak = [course([50, 52]), course([48, 55])];
    const p = pathToGoal(weak, 0, { ...scholarship, from: 99 })!;
    expect(p.uniform.delta).toBeNull();
    expect(p.uniform.best).toBeLessThan(99);
    expect(p.uniform.best).toBeGreaterThan(p.value);
  });

  it("нет ни одного среза — считать не из чего", () => {
    expect(pathToGoal([course([])], 0, scholarship)).toBeNull();
  });
});

describe("путь к цели: отдельные ходы", () => {
  // Средний балл 83,6 + бонус 0,4 = 84,0: до стипендии не хватает балла.
  const courses = [course([82, 86]), course([84, 82])];

  it("экзамен: найден наименьший балл, которого хватает в одиночку", () => {
    const p = pathToGoal(courses, 10, scholarship)!;
    const exam = p.options.find((o) => o.kind === "exam" && o.course === 0)!;
    expect(exam.kind).toBe("exam");
    if (exam.kind !== "exam") return;
    expect(exam.reaches).toBe(true);
    const withExam = (x: number) =>
      ratingForecast([applyScenario(courses[0].input, { checkpoints: {}, session: x, retakes: 0 }), courses[1].input], 10)!.rating;
    expect(withExam(exam.score)).toBeGreaterThanOrEqual(85);
    expect(withExam(exam.score - 1)).toBeLessThan(85);
    expect(exam.level).toBe(84);
    expect(exam.effort).toBe(effortOf(exam.score - 84));
  });

  it("достижения: нужное число баллов считается от разрыва, хода нет, если предел триместра выбран", () => {
    const p = pathToGoal(courses, 10, scholarship)!;
    const activity = p.options.find((o) => o.kind === "activity")!;
    expect(activity).toMatchObject({ kind: "activity", points: Math.ceil(p.gap / 0.04 - 1e-9), reaches: true, room: 90 });
    expect(pathToGoal(courses, 100, scholarship)!.options.some((o) => o.kind === "activity")).toBe(false);
  });

  it("грант считается по среднему баллу: достижения ему не помогают", () => {
    const p = pathToGoal(courses, 10, grant)!;
    expect(p.value).toBeCloseTo(rating(courses, 10).base, 9);
    expect(p.options.some((o) => o.kind === "activity")).toBe(false);
  });

  it("сначала ходы, которых хватает в одиночку, от лёгкого к трудному; потом остальные по пользе", () => {
    const p = pathToGoal(courses, 10, { ...scholarship, from: 88 })!;
    const flags = p.options.map((o) => o.reaches);
    expect(flags.indexOf(false) === -1 || flags.lastIndexOf(true) < flags.indexOf(false)).toBe(true);
    const lone = p.options.filter((o) => o.reaches && o.kind !== "activity");
    const efforts = lone.map((o) => (o.kind === "activity" ? 0 : o.score - o.level));
    expect(efforts).toEqual([...efforts].sort((a, b) => a - b));
    const rest = p.options.filter((o) => !o.reaches).map((o) => o.gain);
    expect(rest).toEqual([...rest].sort((a, b) => b - a));
  });

  it("усилие: до 5 баллов сверх уровня — по силам, до 12 — с усилием, дальше — на пределе", () => {
    expect([0, 5, 6, 12, 13].map(effortOf)).toEqual(["easy", "easy", "medium", "medium", "hard"]);
  });
});

describe("светофор по дисциплине", () => {
  const health = (c: PathCourse, planned = 3) => healthOf(c.input, disciplineScore(c.input), planned)!;

  it("ровная сильная дисциплина — спокойно, без причин", () => {
    expect(health(course([86, 88]))).toEqual({ level: 0, label: "спокойно", reasons: [] });
  });

  it("балл ниже 60 — нужен план", () => {
    const h = health(course([50, 55]));
    expect(h.level).toBe(2);
    expect(h.reasons[0]).toContain("ниже 60");
  });

  it("до оценки ниже меньше двух баллов — на грани; до «неуд» — уже план", () => {
    const edge = health(course([75, 76], "exam", { attendancePct: 76 }));
    expect(edge.level).toBe(1);
    expect(edge.reasons[0]).toContain("«удовлетворительно»");
    expect(health(course([60, 61], "exam", { attendancePct: 62 })).level).toBe(2);
  });

  it("падение среза и низкая посещаемость — причины обратить внимание", () => {
    const h = health(course([90, 78], "exam", { attendancePct: 70 }));
    expect(h.level).toBe(1);
    expect(h.reasons.join(" ")).toContain("на 12 баллов ниже");
    expect(h.reasons.join(" ")).toContain("Посещаемость 70%");
  });

  it("зачёт без автомата после всех срезов — придётся сдавать", () => {
    const c = course([70, 72, 71], "credit");
    expect(health(c).reasons.join(" ")).toContain(`не больше ${DEFAULT_SETTINGS.creditCapWithoutAuto}`);
    // Пока срезы не все — ещё есть шанс, причины нет.
    expect(health(course([70, 72], "credit")).reasons.join(" ")).not.toContain("Автомата не будет");
  });

  it("без срезов светофора нет", () => {
    expect(healthOf(course([]).input, null, 3)).toBeNull();
  });
});
