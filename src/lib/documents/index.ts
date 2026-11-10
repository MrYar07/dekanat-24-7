import { randomBytes } from "node:crypto";

/** Код проверки: 128 случайных бит в base64url (22 символа). Угадать перебором нельзя. */
export function newVerificationCode(): string {
  return randomBytes(16).toString("base64url");
}

/** Код из адреса страницы проверки: ровно 22 символа base64url, иначе сразу «не найдено». */
export function isVerificationCode(s: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(s);
}

/** ФИО для публичной страницы проверки: фамилия и инициалы, без остальных данных. */
export function maskName(lastName: string, firstName: string, middleName: string | null): string {
  return `${lastName} ${firstName[0]}.${middleName ? ` ${middleName[0]}.` : ""}`;
}
