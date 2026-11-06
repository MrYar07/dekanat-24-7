import { CircleAlert, CircleCheck, Hourglass, CircleX, type LucideIcon } from "lucide-react";

export type StatusTone = "ok" | "wait" | "warn" | "danger" | "neutral";

const TONES: Record<StatusTone, { className: string; icon?: LucideIcon }> = {
  ok: { className: "bg-ok-soft text-ok", icon: CircleCheck },
  wait: { className: "bg-surface-2 text-muted", icon: Hourglass },
  warn: { className: "bg-warn-soft text-warn", icon: CircleAlert },
  danger: { className: "bg-danger-soft text-danger", icon: CircleX },
  neutral: { className: "bg-surface-2 text-text" },
};

/** Статус заявки, срока, балла. Цвет всегда дублируется иконкой и словом. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const { className, icon: Icon } = TONES[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}
    >
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Печать на готовом документе. Только для итогового «готово / выдано / подтверждено». */
export function Stamp({ children = "готово" }: { children?: React.ReactNode }) {
  return (
    <span className="border-stamp text-stamp inline-flex -rotate-3 items-center gap-1 rounded-md border-2 px-2 py-0.5 text-[11px] font-extrabold tracking-[0.1em] whitespace-nowrap uppercase">
      <CircleCheck className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}
