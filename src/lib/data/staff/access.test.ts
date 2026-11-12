import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Контракт слоя данных сотрудника, по исходному коду (как access.test.ts студента):
// - каждая функция сама проверяет роль своего файла: преподаватель не вызовет функцию деканата и наоборот;
// - id пользователя в параметры не передаётся, только берётся из сессии;
// - функции преподавателя с id курса ищут курс только через ownCourse(courseId, user.id),
//   а ownCourse ограничивает выборку курсами этого преподавателя и наружу не экспортируется.

const ROLE: Record<string, string> = {
  "dean.ts": "dean_office",
  "dean-announcements.ts": "dean_office",
  "dean-schedule.ts": "dean_office",
  "teacher.ts": "teacher",
};

// Новый файл в этой папке должен попасть в таблицу ролей, иначе его функции останутся без проверки.
const files = readdirSync(__dirname).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

const fns = Object.keys(ROLE).flatMap((file) => {
  const src = readFileSync(join(__dirname, file), "utf8");
  return [...src.matchAll(/export async function (\w+)\(([^)]*)\)[^{]*\{([\s\S]*?)\n\}/g)].map(([, name, params, body]) => ({
    file,
    name,
    params,
    body,
  }));
});

describe("слой данных сотрудника", () => {
  it("у каждого файла слоя есть роль, и в каждом найдены функции", () => {
    expect(files.sort()).toEqual(Object.keys(ROLE).sort());
    expect(new Set(fns.map((f) => f.file)).size).toBe(files.length);
  });

  it.each(fns.map((f) => [`${f.file}: ${f.name}`, f] as const))("%s — роль проверяется в самой функции", (_, f) => {
    expect(f.body).toMatch(new RegExp(`requireRole\\("${ROLE[f.file]}"\\)`));
    expect(f.params).not.toMatch(/user|teacher/i);
  });

  it.each(fns.filter((f) => f.file === "teacher.ts" && /courseId/.test(f.params)).map((f) => [f.name, f] as const))(
    "teacher.ts: %s — курс только свой",
    (_, f) => {
      expect(f.body).toMatch(/ownCourse\(courseId, user\.id\)/);
    },
  );

  it("ownCourse ищет курс среди курсов преподавателя и не экспортируется", () => {
    const src = readFileSync(join(__dirname, "teacher.ts"), "utf8");
    const def = src.match(/async function ownCourse\(courseId: string, teacherId: string\) \{([\s\S]*?)\n\}/);
    expect(def).not.toBeNull();
    expect(def![1]).toMatch(/eq\(courses\.teacherId, teacherId\)/);
    expect(src).not.toMatch(/export[^\n]*ownCourse/);
  });

  it.each(Object.keys(ROLE))("%s — только на сервере", (file) => {
    expect(readFileSync(join(__dirname, file), "utf8")).toMatch(/^import "server-only";/);
  });
});
