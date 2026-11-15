"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

type Choice = Theme | "system";

/** Применить тему сразу, без запроса к серверу, и запомнить выбор на год. «system» — забыть выбор. */
function applyTheme(choice: Choice) {
  const root = document.documentElement;
  if (choice === "system") {
    delete root.dataset.theme;
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; samesite=lax`;
  } else {
    root.dataset.theme = choice;
    document.cookie = `${THEME_COOKIE}=${choice}; path=/; max-age=31536000; samesite=lax`;
  }
}

const effectiveTheme = (): Theme =>
  (document.documentElement.dataset.theme as Theme | undefined) ??
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

/** Кнопка в шапке: светлая ↔ тёмная. Какой значок показать, решает CSS, поэтому сервер и браузер не расходятся. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Сменить тему: светлая или тёмная"
      title="Сменить тему"
      onClick={() => {
        applyTheme(effectiveTheme() === "dark" ? "light" : "dark");
        // Цвет панели браузера приходит с сервера: обновляем его под новую тему.
        router.refresh();
      }}
      className={`text-muted hover:text-text rounded-full p-2 ${className}`}
    >
      <Moon className="only-light size-5" aria-hidden="true" />
      <Sun className="only-dark size-5" aria-hidden="true" />
    </button>
  );
}

const OPTIONS: { value: Choice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Светлая", icon: Sun },
  { value: "dark", label: "Тёмная", icon: Moon },
  { value: "system", label: "Как в системе", icon: Monitor },
];

/** Выбор темы в профиле: три варианта, включая «как в системе». */
export function ThemePicker({ initial }: { initial: Choice }) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>(initial);
  return (
    <fieldset>
      <legend className="sr-only">Тема оформления</legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <label
            key={value}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center text-xs has-[:focus-visible]:outline-2 ${
              choice === value ? "border-brand bg-brand-soft text-brand font-semibold" : "border-border text-muted hover:text-text"
            }`}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={choice === value}
              onChange={() => {
                setChoice(value);
                applyTheme(value);
                router.refresh();
              }}
              className="sr-only"
            />
            <Icon className="size-5" aria-hidden="true" />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
