// Версия для слабовидящих. Как и тема, выбор хранится в cookie: сервер сразу отдаёт страницу
// крупным шрифтом и в нужных цветах, без мигания. Правила оформления — в globals.css.

export const A11Y_COOKIE = "d247_a11y";

export const FONT_SIZES = ["md", "lg", "xl"] as const;
export const CONTRASTS = ["normal", "bw", "wb", "blue"] as const;
export const SPACINGS = ["normal", "wide"] as const;

export type A11y = {
  font: (typeof FONT_SIZES)[number];
  /** normal — цвета обычной темы; остальные — схемы высокой контрастности. */
  contrast: (typeof CONTRASTS)[number];
  spacing: (typeof SPACINGS)[number];
};

/** С чего начинается версия для слабовидящих: крупный шрифт, чёрным по белому. */
export const A11Y_DEFAULT: A11y = { font: "lg", contrast: "bw", spacing: "normal" };

/** Подписи для кнопок и экранного диктора. */
export const FONT_LABEL: Record<A11y["font"], string> = { md: "обычный", lg: "крупный", xl: "очень крупный" };
export const CONTRAST_LABEL: Record<A11y["contrast"], string> = {
  normal: "как в теме",
  bw: "чёрным по белому",
  wb: "белым по чёрному",
  blue: "синим по голубому",
};

/** Цвет панели браузера: тот же, что фон страницы в схеме. */
export const CONTRAST_COLOR: Record<Exclude<A11y["contrast"], "normal">, string> = {
  bw: "#ffffff",
  wb: "#000000",
  blue: "#9dd1ff",
};

const pick = <T extends string>(list: readonly T[], v: string | undefined, fallback: T): T =>
  (list as readonly string[]).includes(v ?? "") ? (v as T) : fallback;

/** «lg.bw.normal» → настройки. Cookie нет или в нём мусор — null, обычная версия. */
export function parseA11y(value: string | undefined): A11y | null {
  if (!value) return null;
  const [font, contrast, spacing] = value.split(".");
  if (!font || !(FONT_SIZES as readonly string[]).includes(font)) return null;
  return {
    font: pick(FONT_SIZES, font, A11Y_DEFAULT.font),
    contrast: pick(CONTRASTS, contrast, A11Y_DEFAULT.contrast),
    spacing: pick(SPACINGS, spacing, A11Y_DEFAULT.spacing),
  };
}

export function serializeA11y(a: A11y): string {
  return `${a.font}.${a.contrast}.${a.spacing}`;
}

/** Атрибуты для <html>: по ним globals.css меняет размер шрифта, цвета и интервалы. */
export function a11yAttributes(a: A11y | null): Record<string, string> {
  if (!a) return {};
  return {
    "data-a11y": "",
    "data-font": a.font,
    ...(a.contrast !== "normal" ? { "data-contrast": a.contrast } : {}),
    ...(a.spacing !== "normal" ? { "data-spacing": a.spacing } : {}),
  };
}
