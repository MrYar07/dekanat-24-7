// Ограничение попыток входа. Чистая функция: счётчики неудач за окно приходят из базы.
//
// Логины демо общие, поэтому неудачи считаются по паре «логин + адрес»: чужие опечатки
// не закрывают вход остальным. Общий предел на логин остаётся — от подбора с многих адресов.

export const WINDOW_MS = 15 * 60 * 1000;
/** Неудач с одного адреса под одним логином. */
export const MAX_FAILS_PER_PAIR = 5;
/** Неудач с одного адреса под любыми логинами. */
export const MAX_FAILS_PER_IP = 20;
/** Неудач под одним логином со всех адресов. */
export const MAX_FAILS_PER_LOGIN = 30;

export type FailCounts = { pair: number; ip: number; login: number };

export function isLockedOut(fails: FailCounts): boolean {
  return fails.pair >= MAX_FAILS_PER_PAIR || fails.ip >= MAX_FAILS_PER_IP || fails.login >= MAX_FAILS_PER_LOGIN;
}
