// Собственный знак «Деканата 24/7»: циферблат с отметкой в положении «всегда».
export function Logo({ className = "", withCaption = false }: { className?: string; withCaption?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true" className="shrink-0">
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--brand)" strokeWidth="2" />
        <circle cx="14" cy="14" r="8.5" fill="none" stroke="var(--brand)" strokeWidth="1" strokeDasharray="1.5 2.5" />
        <path d="M14 8.5V14l3.5 2.2" fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="leading-tight">
        <span className="block font-serif text-lg font-bold">Деканат 24/7</span>
        {withCaption && (
          <span className="text-muted block text-[10.5px] tracking-[0.12em] uppercase">университет «Меридиан»</span>
        )}
      </span>
    </span>
  );
}
