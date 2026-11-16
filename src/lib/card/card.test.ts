import { describe, expect, it } from "vitest";
import { isCardToken, REFRESH_MS, TOKEN_TTL_MS, validUntil } from "./index";

describe("электронный студенческий", () => {
  it("действует до 31 августа конца учебного года", () => {
    expect(validUntil("2026/27")).toBe("2027-08-31");
    expect(validUntil("")).toBeNull();
  });

  it("код обновляется раньше, чем устаревает", () => {
    expect(REFRESH_MS).toBeLessThan(TOKEN_TTL_MS);
  });

  it("код из адреса — только 22 символа base64url", () => {
    expect(isCardToken("a".repeat(22))).toBe(true);
    expect(isCardToken("a".repeat(21))).toBe(false);
    expect(isCardToken("../../etc/passwd______")).toBe(false);
  });
});
