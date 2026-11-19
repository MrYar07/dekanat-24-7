/**
 * Знак «Деканата 24/7»: печать, внутри которой стрелки часов сложились в галочку.
 * Кольцо и точки по кругу — оттиск печати деканата, стрелки на «десять минут одиннадцатого» — «круглосуточно»
 * и одновременно «готово». Рисуется текущим цветом текста: синими чернилами на бумаге, бумажным на обложке.
 */
export function LogoMark({ size = 30, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="16" r="14" strokeWidth="2" />
        {/* Двенадцать точек — часовые отметки циферблата и точки по кругу печати. */}
        <circle cx="16" cy="16" r="10.3" strokeWidth="1.5" strokeDasharray="0.1 5.293" />
        <path d="M11.6 12.4 16 18l6.4-8.2" strokeWidth="2.5" />
      </g>
    </svg>
  );
}

export function Logo({
  className = "",
  withCaption = false,
  tone = "ink",
}: {
  className?: string;
  withCaption?: boolean;
  /** ink — на бумаге, cover — на тёмной обложке (боковая панель, шапка на телефоне). */
  tone?: "ink" | "cover";
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark className={tone === "cover" ? "text-cover-ink" : "text-brand"} />
      <span className="logo-text leading-tight">
        <span className="block font-serif text-lg font-bold tracking-[-0.01em]">Деканат 24/7</span>
        {withCaption && (
          <span className={`block font-serif text-xs italic ${tone === "cover" ? "text-cover-muted" : "text-muted"}`}>
            университет «Меридиан»
          </span>
        )}
      </span>
    </span>
  );
}
