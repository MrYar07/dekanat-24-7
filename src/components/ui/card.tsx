import type { ComponentProps } from "react";

/** Лист бумаги поверх фона: для блоков, которые нужно выделить (профиль, форма, карточка справки). */
export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`border-border bg-surface rounded-xl border p-4 sm:p-5 ${className}`} {...props} />;
}
