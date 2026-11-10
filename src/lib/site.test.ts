import { afterEach, describe, expect, it, vi } from "vitest";

const incoming = new Map<string, string>();
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: (k: string) => incoming.get(k) ?? null }) }));

const { verifyUrl } = await import("./site");

afterEach(() => {
  incoming.clear();
  vi.unstubAllEnvs();
});

describe("адрес в QR-коде справки", () => {
  it("в проде берётся из SITE_URL, а не из заголовков запроса", async () => {
    vi.stubEnv("SITE_URL", "https://meridian.example/");
    incoming.set("host", "localhost:3000");
    incoming.set("x-forwarded-host", "evil.example");
    expect(await verifyUrl("abc")).toBe("https://meridian.example/verify/abc");
  });

  it("локально без SITE_URL — хост запроса по http", async () => {
    vi.stubEnv("SITE_URL", "");
    incoming.set("host", "localhost:3000");
    expect(await verifyUrl("abc")).toBe("http://localhost:3000/verify/abc");
  });
});
