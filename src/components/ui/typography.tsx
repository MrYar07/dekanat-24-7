/** Заголовок страницы: засечки, над ним — курсивная строка (дата, раздел), под ним — подсказка. */
export function PageTitle({
  children,
  eyebrow,
  hint,
}: {
  children: React.ReactNode;
  eyebrow?: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow && <p className="text-muted mb-1 font-serif text-sm italic">{eyebrow}</p>}
      <h1 className="font-serif text-[28px] leading-tight font-bold">{children}</h1>
      {hint && <p className="text-muted mt-1 text-sm">{hint}</p>}
    </div>
  );
}

/** Заголовок раздела: капитель и линейка до края, как графа в бланке. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-muted shrink-0 text-xs font-semibold tracking-[0.14em] uppercase">{children}</h2>
      <span aria-hidden="true" className="bg-border h-px flex-1" />
      {action}
    </div>
  );
}
