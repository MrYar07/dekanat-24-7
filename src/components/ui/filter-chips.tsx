import Link from "next/link";

/** Ряд фильтров-ссылок. На телефоне прокручивается вбок без полосы прокрутки. */
export function FilterChips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden"
    >
      {children}
    </nav>
  );
}

export function FilterChip({
  href,
  active,
  label,
  count,
  countLabel = "непрочитанных",
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  /** Что считает число — для экранного диктора. */
  countLabel?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${
        active ? "border-brand bg-brand-soft text-brand font-semibold" : "border-border text-muted hover:text-text"
      }`}
    >
      {label}
      {count ? (
        <span className="bg-brand text-brand-ink rounded-full px-1.5 text-[11px] leading-[18px] font-bold tabular-nums">
          {count}
          <span className="sr-only"> {countLabel}</span>
        </span>
      ) : null}
    </Link>
  );
}
