/** «Ведомость»: строки «название … значение» с точками-выносками. Для баллов, рейтинга, реквизитов. */
export function Ledger({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <dl className={`space-y-2.5 ${className}`}>{children}</dl>;
}

export function LedgerRow({
  label,
  value,
  note,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Мелкая пометка после значения: «+6», «прогноз». */
  note?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-2 text-sm">
      <dt className="min-w-0">{label}</dt>
      <span aria-hidden="true" className="border-border min-w-4 flex-1 -translate-y-1 border-b border-dotted" />
      <dd className="shrink-0 text-right">
        <span className="font-serif text-[17px] font-bold tabular-nums">{value}</span>
        {note && <span className="text-muted ml-1 text-xs font-semibold">{note}</span>}
      </dd>
    </div>
  );
}
