import type { ComponentProps } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium transition-colors disabled:pointer-events-none disabled:opacity-60";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:opacity-90",
  secondary: "border-border bg-surface text-text hover:bg-surface-2 border",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
  danger: "border-border bg-surface text-danger hover:bg-danger-soft border",
};

/** Классы кнопки — и для `<button>`, и для `<Link>`, который выглядит как кнопка. */
export function buttonClass(variant: ButtonVariant = "primary", className = "") {
  return `${BASE} ${VARIANTS[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button type={type} className={buttonClass(variant, className)} {...props} />;
}
