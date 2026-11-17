"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Settings2 } from "lucide-react";
import {
  A11Y_COOKIE,
  A11Y_DEFAULT,
  a11yAttributes,
  CONTRAST_LABEL,
  CONTRASTS,
  FONT_LABEL,
  FONT_SIZES,
  serializeA11y,
  type A11y,
} from "@/lib/a11y";

const ATTRS = ["data-a11y", "data-font", "data-contrast", "data-spacing"];
/** Флаг «панель только что включили»: тогда настройки открываются сразу. */
const OPEN_FLAG = "d247_a11y_open";

/** Применить настройки сразу, без запроса к серверу, и запомнить на год. null — обычная версия. */
function applyA11y(a: A11y | null) {
  const root = document.documentElement;
  for (const name of ATTRS) root.removeAttribute(name);
  for (const [name, value] of Object.entries(a11yAttributes(a))) root.setAttribute(name, value);
  document.cookie = a
    ? `${A11Y_COOKIE}=${serializeA11y(a)}; path=/; max-age=31536000; samesite=lax`
    : `${A11Y_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * Кнопка «Версия для слабовидящих» в шапке. Когда версия включена, кнопку прячет CSS:
 * её место занимает панель настроек над страницей.
 */
export function A11yToggle({ className = "", tone = "paper" }: { className?: string; tone?: "paper" | "cover" }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Версия для слабовидящих"
      title="Версия для слабовидящих"
      onClick={() => {
        applyA11y(A11Y_DEFAULT);
        try {
          sessionStorage.setItem(OPEN_FLAG, "1");
        } catch {}
        router.refresh();
      }}
      className={`a11y-toggle rounded-full p-2 ${tone === "cover" ? "text-cover-muted hover:text-cover-ink" : "text-muted hover:text-text"} ${className}`}
    >
      <Eye className="size-5" aria-hidden="true" />
    </button>
  );
}

function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  render,
}: {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render: (v: T) => { label: string; content: React.ReactNode };
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const { label, content } = render(o);
          const active = o === value;
          return (
            <label
              key={o}
              className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border-2 px-3 py-1.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 ${
                active ? "border-brand bg-brand-soft text-brand font-semibold" : "border-border-strong text-text"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o}
                checked={active}
                onChange={() => onChange(o)}
                aria-label={label}
                className="sr-only"
              />
              {content}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Образец схемы: буква «Ц» в цветах схемы, как на сайтах госорганов. */
const SWATCH: Record<A11y["contrast"], string> = {
  normal: "bg-[#eef2ef] text-[#1d3a8a] border border-[#1d3a8a]",
  bw: "bg-white text-black border border-black",
  wb: "bg-black text-white border border-white",
  blue: "bg-[#9dd1ff] text-[#02264d] border border-[#02264d]",
};
const FONT_SAMPLE: Record<A11y["font"], string> = {
  md: "text-sm",
  lg: "text-lg",
  xl: "text-2xl",
};

/** Панель над страницей, пока включена версия для слабовидящих: размер шрифта, цвета, интервалы и выход. */
export function A11yBar({ initial }: { initial: A11y }) {
  const router = useRouter();
  const [a, setA] = useState(initial);
  // Панель только что включили кнопкой в шапке — настройки сразу открыты. Флаг читается на клиенте:
  // после включения панель приходит через router.refresh(), без гидратации, поэтому сервер не расходится.
  const [open, setOpen] = useState(() => {
    try {
      return typeof window !== "undefined" && sessionStorage.getItem(OPEN_FLAG) === "1";
    } catch {
      return false;
    }
  });
  const [off, setOff] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem(OPEN_FLAG);
    } catch {}
  }, []);

  const update = (patch: Partial<A11y>) => {
    const next = { ...a, ...patch };
    setA(next);
    applyA11y(next);
    // Цвет панели браузера приходит с сервера: обновляем его под схему.
    if (patch.contrast) router.refresh();
  };

  if (off) return null;
  return (
    <section aria-label="Версия для слабовидящих" className="border-border-strong bg-surface border-b-2">
      <div className="mx-auto max-w-5xl px-4 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            aria-expanded={open}
            aria-controls="a11y-panel"
            onClick={() => setOpen((o) => !o)}
            className="inline-flex min-h-11 items-center gap-2 text-left font-semibold"
          >
            <Settings2 className="size-5 shrink-0" aria-hidden="true" />
            {open ? "Скрыть настройки" : "Настройки для слабовидящих"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOff(true);
              applyA11y(null);
              router.refresh();
            }}
            className="border-border-strong inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold"
          >
            <EyeOff className="size-4 shrink-0" aria-hidden="true" />
            Обычная версия
          </button>
        </div>
        {open && (
          <div
            id="a11y-panel"
            className="mt-2 flex flex-col gap-4 pb-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-8"
          >
            <Choice
              legend="Размер шрифта"
              name="a11y-font"
              options={FONT_SIZES}
              value={a.font}
              onChange={(font) => update({ font })}
              render={(f) => ({
                label: `Шрифт ${FONT_LABEL[f]}`,
                content: (
                  <span aria-hidden="true" className={`font-serif leading-none font-bold ${FONT_SAMPLE[f]}`}>
                    А
                  </span>
                ),
              })}
            />
            <Choice
              legend="Цвета"
              name="a11y-contrast"
              options={CONTRASTS}
              value={a.contrast}
              onChange={(contrast) => update({ contrast })}
              render={(c) => ({
                label: `Цвета: ${CONTRAST_LABEL[c]}`,
                content: (
                  <span aria-hidden="true" className={`grid size-7 place-items-center rounded font-bold ${SWATCH[c]}`}>
                    Ц
                  </span>
                ),
              })}
            />
            <Choice
              legend="Интервалы"
              name="a11y-spacing"
              options={["normal", "wide"] as const}
              value={a.spacing}
              onChange={(spacing) => update({ spacing })}
              render={(s) => {
                const label = s === "normal" ? "обычные" : "увеличенные";
                return {
                  label: `Интервалы ${label}`,
                  content: <span className="text-sm">{label}</span>,
                };
              }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
