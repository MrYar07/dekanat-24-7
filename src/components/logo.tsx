// Собственный знак «Деканата 24/7»: циферблат с отметкой в положении «всегда».
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold ${className}`}>
      <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
        <rect width="28" height="28" rx="8" fill="var(--brand)" />
        <circle cx="14" cy="14" r="7.5" fill="none" stroke="var(--brand-ink)" strokeWidth="2" />
        <path d="M14 9.5V14l3 2" fill="none" stroke="var(--brand-ink)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span>
        Деканат <span className="text-brand">24/7</span>
      </span>
    </span>
  );
}
