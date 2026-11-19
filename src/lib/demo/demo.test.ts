import { describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, DEMO_LOGINS, isDemoLogin, safeNext } from "./accounts";
import { advance, back, EMPTY_GUIDE, parseGuide, SCENARIOS, type GuideState } from "./scenarios";

describe("демо-аккаунты", () => {
  it("переключаться можно только между четырьмя демо-логинами", () => {
    expect(DEMO_LOGINS).toEqual(["student1", "student2", "teacher", "dean"]);
    expect(Object.keys(DEMO_ACCOUNTS).sort()).toEqual([...DEMO_LOGINS].sort());
    for (const login of ["t-lazareva", "ge24-01", "admin", "", "STUDENT1", null, undefined, 1]) {
      expect(isDemoLogin(login), String(login)).toBe(false);
    }
  });

  it("после переключения можно попасть только на страницу этого же сайта", () => {
    expect(safeNext("/staff")).toBe("/staff");
    expect(safeNext("/requests/3f2b1c9e-7a4d-4e1b-9c3a-5d6e7f8a9b0c")).toBe("/requests/3f2b1c9e-7a4d-4e1b-9c3a-5d6e7f8a9b0c");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "staff", "", "/a b", null, 5, `/${"a".repeat(400)}`]) {
      expect(safeNext(bad), String(bad)).toBeNull();
    }
  });
});

describe("сценарии путеводителя", () => {
  it("их девять, как в PRD, и у каждого есть шаги", () => {
    expect(SCENARIOS).toHaveLength(9);
    for (const sc of SCENARIOS) expect(sc.steps.length, sc.title).toBeGreaterThan(0);
  });

  it("каждый шаг выполняет демо-аккаунт или гость, ссылки ведут внутрь сайта и в кабинет нужной роли", () => {
    for (const sc of SCENARIOS) {
      for (const step of sc.steps) {
        expect(step.as === "anyone" || isDemoLogin(step.as), `${sc.title}: ${step.as}`).toBe(true);
        if (!step.href) continue;
        expect(safeNext(step.href), step.href).toBe(step.href);
        const staff = step.as === "teacher" || step.as === "dean";
        expect(step.href.startsWith("/staff"), `${sc.title}: ${step.href}`).toBe(staff);
      }
    }
  });

  it("шаг «на той же странице» всегда идёт после шага с другим аккаунтом и имеет подсказку", () => {
    for (const sc of SCENARIOS) {
      sc.steps.forEach((step, i) => {
        if (!step.carryUrl) return;
        expect(i).toBeGreaterThan(0);
        expect(sc.steps[i - 1].as).not.toBe(step.as);
        expect(step.carryHint).toBeTruthy();
        expect(new RegExp(step.carryUrl).test("/requests/3f2b1c9e-7a4d-4e1b-9c3a-5d6e7f8a9b0c")).toBe(true);
        expect(new RegExp(step.carryUrl).test("/requests")).toBe(false);
      });
    }
  });
});

describe("прогресс путеводителя", () => {
  it("мусор в памяти браузера превращается в пустое состояние", () => {
    for (const raw of [null, "", "не json", "null", "[]", '{"scenario":99}', '{"scenario":"1"}']) {
      expect(parseGuide(raw).scenario, String(raw)).toBeNull();
    }
    expect(parseGuide('{"scenario":2,"step":99,"done":[0,0,42,"x"],"collapsed":true}')).toEqual({
      scenario: 2,
      step: SCENARIOS[2].steps.length - 1,
      done: [0],
      collapsed: true,
    });
  });

  it("«Дальше» идёт по шагам, после последнего сценарий отмечается пройденным", () => {
    let s: GuideState = { ...EMPTY_GUIDE, scenario: 2 };
    for (let i = 1; i < SCENARIOS[2].steps.length; i++) {
      s = advance(s);
      expect(s).toMatchObject({ scenario: 2, step: i });
    }
    s = advance(s);
    expect(s).toEqual({ scenario: null, step: 0, done: [2], collapsed: false });
    // Повторное прохождение не дублирует отметку.
    expect(advance({ ...s, scenario: 2, step: SCENARIOS[2].steps.length - 1 }).done).toEqual([2]);
  });

  it("«Назад» не уходит раньше первого шага", () => {
    expect(back({ ...EMPTY_GUIDE, scenario: 2, step: 1 }).step).toBe(0);
    expect(back({ ...EMPTY_GUIDE, scenario: 2, step: 0 }).step).toBe(0);
    expect(back(EMPTY_GUIDE)).toEqual(EMPTY_GUIDE);
  });
});
