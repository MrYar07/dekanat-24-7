import { useId } from "react";
import { CircleAlert, CircleCheck, Hourglass, CircleX, type LucideIcon } from "lucide-react";

export type StatusTone = "ok" | "wait" | "warn" | "danger" | "neutral";

const TONES: Record<StatusTone, { className: string; icon?: LucideIcon }> = {
  ok: { className: "bg-ok-soft text-ok", icon: CircleCheck },
  wait: { className: "bg-surface-2 text-muted", icon: Hourglass },
  warn: { className: "bg-warn-soft text-warn", icon: CircleAlert },
  danger: { className: "bg-danger-soft text-danger", icon: CircleX },
  neutral: { className: "bg-surface-2 text-text" },
};

/** Пометка о статусе заявки, срока, балла. Цвет всегда дублируется иконкой и словом. */
export function StatusBadge({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  const { className, icon: Icon } = TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${className}`}>
      {Icon && <Icon className="size-3.5" aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Штамп в строке списка: «готово», «выдано», «+40». Прямоугольный, как штамп канцелярии. */
export function Stamp({ children = "готово" }: { children?: React.ReactNode }) {
  return (
    <span className="border-stamp text-stamp inline-flex -rotate-3 items-center gap-1 rounded-[3px] border-2 px-2 py-0.5 text-[11px] font-extrabold tracking-[0.1em] whitespace-nowrap uppercase">
      <CircleCheck className="size-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * Круглая печать деканата — главный знак кабинета. Ставится один раз на экран, там, где документ или решение
 * окончательны: справка готова, справка подлинная, достижение засчитано. Слово в центре — само решение.
 * Чернила неровные (SVG-фильтр), как у настоящего оттиска. Вуз вымышленный, надпись по кругу — тоже.
 */
export function Seal({ children, size = 104 }: { children: string; size?: number }) {
  const id = useId();
  const word = children.toUpperCase();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Печать: ${children}`}
      className="text-stamp seal-in shrink-0 -rotate-[9deg]"
    >
      <defs>
        <path id={`${id}-arc`} d="M60 60 m-43.5 0 a43.5 43.5 0 1 1 87 0 a43.5 43.5 0 1 1 -87 0" />
        <filter id={`${id}-ink`} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="noise" />
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.7 1.95" result="patchy" />
          <feComposite in="SourceGraphic" in2="patchy" operator="in" />
        </filter>
      </defs>
      <g filter={`url(#${id}-ink)`} fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="56.5" strokeWidth="3" />
        <circle cx="60" cy="60" r="51.5" strokeWidth="1" />
        <circle cx="60" cy="60" r="35" strokeWidth="1" />
        <text fill="currentColor" stroke="none" fontSize="9" fontWeight="700" aria-hidden="true">
          <textPath href={`#${id}-arc`} textLength="268" lengthAdjust="spacing">
            УНИВЕРСИТЕТ «МЕРИДИАН» ✶ ДЕКАНАТ ✶
          </textPath>
        </text>
        <text
          x="60"
          y="65"
          textAnchor="middle"
          fill="currentColor"
          stroke="none"
          fontSize="14.5"
          fontWeight="800"
          letterSpacing={word.length > 7 ? undefined : "1"}
          textLength={word.length > 7 ? 61 : undefined}
          lengthAdjust={word.length > 7 ? "spacingAndGlyphs" : undefined}
          aria-hidden="true"
        >
          {word}
        </text>
      </g>
    </svg>
  );
}
