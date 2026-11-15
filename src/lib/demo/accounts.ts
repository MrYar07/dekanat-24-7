// Демо-аккаунты для жюри. Только эти четыре логина могут переключаться друг на друга без пароля:
// пароль у них один, так что переключение не даёт ничего сверх обычного входа.

export const DEMO_LOGINS = ["student1", "student2", "teacher", "dean"] as const;
export type DemoLogin = (typeof DEMO_LOGINS)[number];

export const DEMO_ACCOUNTS: Record<DemoLogin, { name: string; role: string }> = {
  student1: { name: "Алина", role: "студент, 2 курс" },
  student2: { name: "Матвей", role: "студент, 3 курс" },
  teacher: { name: "Преподаватель", role: "английский язык" },
  dean: { name: "Деканат", role: "сотрудник" },
};

export const isDemoLogin = (v: unknown): v is DemoLogin =>
  typeof v === "string" && (DEMO_LOGINS as readonly string[]).includes(v);

/** Переключатель и путеводитель выключаются переменной DEMO_SWITCH=off: в настоящем кабинете их бы не было. */
export const demoEnabled = () => process.env.DEMO_SWITCH !== "off";

/** Куда перейти после переключения: только путь внутри сайта. Всё остальное отбрасывается. */
export function safeNext(next: unknown): string | null {
  if (typeof next !== "string" || next.length > 300) return null;
  if (!next.startsWith("/") || next.startsWith("//") || /[\\\s]/.test(next)) return null;
  return next;
}
