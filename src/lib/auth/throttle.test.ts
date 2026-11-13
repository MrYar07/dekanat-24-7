import { describe, expect, it } from "vitest";
import { isLockedOut, MAX_FAILS_PER_IP, MAX_FAILS_PER_LOGIN, MAX_FAILS_PER_PAIR } from "./throttle";

describe("ограничение попыток входа", () => {
  it("пять неудач с одного адреса под одним логином закрывают вход этому адресу", () => {
    expect(isLockedOut({ pair: MAX_FAILS_PER_PAIR - 1, ip: 4, login: 4 })).toBe(false);
    expect(isLockedOut({ pair: MAX_FAILS_PER_PAIR, ip: 5, login: 5 })).toBe(true);
  });

  it("чужие неудачи под тем же логином не мешают: общий демо-аккаунт не закрыть пятью опечатками", () => {
    expect(isLockedOut({ pair: 0, ip: 0, login: 5 })).toBe(false);
    expect(isLockedOut({ pair: 0, ip: 0, login: MAX_FAILS_PER_LOGIN - 1 })).toBe(false);
  });

  it("подбор с многих адресов упирается в общий предел логина", () => {
    expect(isLockedOut({ pair: 1, ip: 1, login: MAX_FAILS_PER_LOGIN })).toBe(true);
  });

  it("перебор логинов с одного адреса упирается в предел адреса", () => {
    expect(isLockedOut({ pair: 1, ip: MAX_FAILS_PER_IP, login: 1 })).toBe(true);
  });
});
