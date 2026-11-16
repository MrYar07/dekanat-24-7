// Электронный студенческий: правила без доступа к базе.

/** Сколько живёт один QR-код. */
export const TOKEN_TTL_MS = 2 * 60_000;
/** Как часто экран берёт новый код: с запасом, чтобы показанный код всегда был действующим. */
export const REFRESH_MS = 60_000;
/** Больше кодов за минуту студенту не нужно: защита от того, кто дёргает обновление в цикле. */
export const MAX_TOKENS_PER_MINUTE = 20;

/** Студенческий действует до конца учебного года: «2026/27» → 31 августа 2027. */
export function validUntil(academicYear: string): string | null {
  const m = /^(\d{4})\/\d{2}$/.exec(academicYear);
  return m ? `${Number(m[1]) + 1}-08-31` : null;
}

/** Код из адреса страницы проверки: 22 символа base64url, как у справок. Остальное — сразу «не найден». */
export function isCardToken(s: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(s);
}
