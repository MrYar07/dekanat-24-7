import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Контракт слоя данных: функция не принимает id пользователя и сама определяет его через requireRole.
// Тогда «подставить чужой id» нельзя в принципе: его просто некуда передать.

const dir = __dirname;
// Общие для всех данные, не привязанные к пользователю.
const PUBLIC = new Set(["getGradingSettings"]);

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

  it.each(fns.map((f) => [`${f.file}: ${f.name}`, f] as const))("%s — без id в параметрах", (_, f) => {
    expect(f.params).not.toMatch(/id|user|student/i);
  });

  it.each(fns.filter((f) => !PUBLIC.has(f.name)).map((f) => [`${f.file}: ${f.name}`, f] as const))(
    "%s — пользователь из сессии",
    (_, f) => {
      expect(f.body).toMatch(/requireRole\("student"\)/);
    },
  );

  it.each(files)("%s — только на сервере", (file) => {
    expect(readFileSync(join(dir, file), "utf8")).toMatch(/^import "server-only";/);
  });
});
