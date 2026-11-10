import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Контракт слоя данных: функция не принимает id пользователя и сама определяет его через requireRole.
// Тогда «подставить чужой id» нельзя в принципе: его просто некуда передать.

const dir = __dirname;
// Общие для всех данные, не привязанные к пользователю.
// verifyDocument — публичная проверка справки по QR-коду, без входа и с минимумом данных.
const PUBLIC = new Set(["verifyDocument"]);

const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const fns = files.flatMap((file) => {
  const src = readFileSync(join(dir, file), "utf8");
  return [...src.matchAll(/export async function (\w+)\(([^)]*)\)[^{]*\{([\s\S]*?)\n\}/g)].map(([, name, params, body]) => ({
    file,
    name,
    params,
    body,
  }));
});

describe("слой данных студента", () => {
  it("файлы найдены", () => {
    expect(fns.length).toBeGreaterThan(2);
  });

  it.each(fns.map((f) => [`${f.file}: ${f.name}`, f] as const))("%s — без id пользователя в параметрах", (_, f) => {
    expect(f.params).not.toMatch(/user|student/i);
    // id объекта (заявки) допустим, только если выборка ограничена студентом из сессии.
    if (/id/i.test(f.params)) expect(f.body).toMatch(/eq\((requests|issuedDocuments)\.studentId, user\.id\)/);
  });

  it.each(fns.filter((f) => !PUBLIC.has(f.name)).map((f) => [`${f.file}: ${f.name}`, f] as const))(
    "%s — пользователь из сессии",
    (_, f) => {
      // Напрямую или через loadStudent(), который сам вызывает requireRole (проверено ниже).
      expect(f.body).toMatch(/requireRole\("student"\)|loadStudent\(\)/);
    },
  );

  it.each(files.filter((f) => readFileSync(join(dir, f), "utf8").includes("loadStudent(")))(
    "%s — loadStudent берёт студента из сессии и не принимает аргументов",
    (file) => {
      const src = readFileSync(join(dir, file), "utf8");
      const def = src.match(/const loadStudent = cache\(async \(\) => \{([\s\S]*?)\n\}\);/);
      expect(def, "loadStudent должен быть cache(async () => ...) без параметров").not.toBeNull();
      expect(def![1]).toMatch(/requireRole\("student"\)/);
      expect(src).not.toMatch(/export[^\n]*loadStudent/);
    },
  );

  it.each(files)("%s — только на сервере", (file) => {
    expect(readFileSync(join(dir, file), "utf8")).toMatch(/^import "server-only";/);
  });
});
