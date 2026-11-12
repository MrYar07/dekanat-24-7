/**
 * Линия по шагам (срез 1 → срез 2 → срез 3). Одна серия, поэтому без легенды: что нарисовано, говорит подпись.
 * Значения подписаны прямо у точек (их не больше трёх-четырёх), цвет несёт только линия, текст — обычными чернилами.
 * Шкала общая для всех таких графиков на странице (domain), чтобы их можно было сравнивать между собой.
 */
export type StepPoint = { label: string; value: number | null };


export function StepLine({
  points,
  domain,
  title,
  width = 160,
  height = 76,
  decimals = 0,
}: {
  points: StepPoint[];
  /** [низ, верх] шкалы. */
  domain: [number, number];
  /** Что на графике — для экранного диктора и подсказки. */
  title: string;
  width?: number;
  height?: number;
  /** Сколько знаков после запятой показывать: баллы срезов целые, рейтинг — с десятыми. */
  decimals?: number;
}) {
  const numberFormat = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const pad = { top: 20, right: 16, bottom: 18, left: 16 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const [lo, hi] = domain;
  const x = (i: number) => pad.left + (points.length === 1 ? innerW / 2 : (innerW * i) / (points.length - 1));
  const y = (v: number) => pad.top + innerH * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo || 1));

  const drawn = points.map((p, i) => ({ ...p, i })).filter((p): p is StepPoint & { i: number; value: number } => p.value !== null);
  const path = drawn.map((p, k) => `${k === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const summary = `${title}: ${drawn.map((p) => `${p.label} — ${numberFormat.format(p.value)}`).join(", ")}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={summary}
      className="block h-auto w-full"
      style={{ maxWidth: width * 1.5 }}
    >
      {/* Базовая линия шкалы: тонкая и неяркая. */}
      <line
        x1={pad.left - 6}
        x2={width - pad.right + 6}
        y1={pad.top + innerH}
        y2={pad.top + innerH}
        stroke="var(--border)"
        strokeWidth="1"
      />
      {drawn.length > 1 && (
        <path d={path} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      )}
      {points.map((p, i) => (
        <g key={i}>
          <text x={x(i)} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted)">
            {p.label}
          </text>
          {p.value !== null && (
            <>
              {/* Кольцо цвета фона отделяет точку от линии. */}
              <circle cx={x(i)} cy={y(p.value)} r="4.5" fill="var(--brand)" stroke="var(--surface)" strokeWidth="2" />
              <text
                x={x(i)}
                y={y(p.value) - 9}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill="var(--text)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {numberFormat.format(p.value)}
              </text>
              {/* Область наведения крупнее точки. */}
              <circle cx={x(i)} cy={y(p.value)} r="14" fill="transparent">
                <title>{`${p.label}: ${numberFormat.format(p.value)}`}</title>
              </circle>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}
