// Тема оформления. Выбор хранится в cookie: сервер сразу отдаёт страницу в нужной теме, без мигания.
// Cookie нет — тема как в системе (prefers-color-scheme), правила в globals.css.

export const THEME_COOKIE = "d247_theme";
export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];
/** Цвет панели браузера: тот же, что фон страницы в globals.css. */
export const THEME_COLOR: Record<Theme, string> = { light: "#eef2ef", dark: "#101417" };

export const isTheme = (v: unknown): v is Theme => typeof v === "string" && (THEMES as readonly string[]).includes(v);
