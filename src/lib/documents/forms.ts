import { z } from "zod";

// Формы заказа документов. Одно описание на всё: страница рисует поля из FIELDS,
// серверное действие проверяет данные схемой SCHEMAS. Так поля и правила не разъезжаются.

export const DOCUMENT_CODES = ["study", "rating", "scholarship", "academic", "recredit"] as const;
export type DocumentCode = (typeof DOCUMENT_CODES)[number];

export const STUDY_PURPOSES = [
  "по месту работы родителей",
  "в банк",
  "в посольство для оформления визы",
  "в органы социальной защиты",
  "в военный комиссариат",
] as const;

export type Field =
  | { name: string; label: string; kind: "select"; options: readonly string[]; other?: boolean; hint?: string }
  | { name: string; label: string; kind: "text"; placeholder?: string; hint?: string; optional?: boolean }
  | { name: string; label: string; kind: "number"; min: number; max: number };

export const FIELDS: Record<DocumentCode, Field[]> = {
  study: [{ name: "purpose", label: "Куда нужна справка", kind: "select", options: STUDY_PURPOSES, other: true }],
  rating: [],
  scholarship: [
    { name: "period", label: "За какой период", kind: "select", options: ["текущий триместр", "сентябрь — октябрь", "учебный год"] },
    { name: "copies", label: "Сколько экземпляров", kind: "number", min: 1, max: 3 },
  ],
  academic: [
    { name: "purpose", label: "Для чего нужна", kind: "text", placeholder: "Например, перевод в другой вуз" },
    { name: "copies", label: "Сколько экземпляров", kind: "number", min: 1, max: 2 },
  ],
  recredit: [
    { name: "discipline", label: "Какую дисциплину перезачесть", kind: "text", placeholder: "Например, Основы программирования" },
    { name: "source", label: "Где и когда изучали", kind: "text", placeholder: "Вуз или онлайн-курс, объём в часах" },
    {
      name: "proof",
      label: "Ссылка на документ",
      kind: "text",
      placeholder: "https://…",
      hint: "Сертификат или справка из другого вуза. Можно принести в деканат.",
      optional: true,
    },
  ],
};

const text = (max: number) =>
  z
    .string()
    .trim()
    .min(2, "Заполните поле")
    .max(max, `Не длиннее ${max} символов`);

const copies = (max: number) => z.coerce.number().int("Целое число").min(1, "Хотя бы один").max(max, `Не больше ${max}`);

export const SCHEMAS = {
  study: z.object({ purpose: text(120) }),
  rating: z.object({}),
  scholarship: z.object({ period: z.enum(["текущий триместр", "сентябрь — октябрь", "учебный год"]), copies: copies(3) }),
  academic: z.object({ purpose: text(200), copies: copies(2) }),
  recredit: z.object({
    discipline: text(120),
    source: text(200),
    proof: z
      .union([z.literal(""), z.url({ protocol: /^https?$/, error: "Нужна ссылка, начинающаяся с http:// или https://" })])
      .optional(),
  }),
} satisfies Record<DocumentCode, z.ZodType>;

/** Подписи полей для страницы заявки. */
export const PAYLOAD_LABELS: Record<string, string> = {
  purpose: "Назначение",
  period: "Период",
  copies: "Экземпляров",
  discipline: "Дисциплина",
  source: "Где изучали",
  proof: "Подтверждение",
};

/** Из FormData в объект для схемы. Для select с «другое» берём текст из поля name_other. */
export function readForm(code: DocumentCode, form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of FIELDS[code]) {
    const raw = String(form.get(f.name) ?? "");
    out[f.name] = f.kind === "select" && f.other && raw === "__other" ? String(form.get(`${f.name}_other`) ?? "") : raw;
  }
  return out;
}

export function isDocumentCode(s: string): s is DocumentCode {
  return (DOCUMENT_CODES as readonly string[]).includes(s);
}
