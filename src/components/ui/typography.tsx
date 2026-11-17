/**
 * Заголовок страницы: засечки. Строка над ним — только когда она что-то сообщает (дата, номер, срок),
 * а не называет раздел ещё раз. Подсказка под ним не длиннее 65 знаков в строке.
 */
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
      <h1 className="font-serif text-[1.75rem] leading-[1.15] font-bold tracking-[-0.01em]">{children}</h1>
      {hint && <p className="text-muted mt-1.5 max-w-[65ch] text-sm leading-normal">{hint}</p>}
    </div>
  );
}

/** Заголовок раздела: подпись графы и линейка до края листа, как в бланке. Обычный регистр, без капители. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-muted min-w-0 text-[0.8125rem] font-semibold">{children}</h2>
      <span aria-hidden="true" className="bg-border h-px min-w-4 flex-1" />
      {action}
    </div>
  );
}

/** Подпись внутри листа: мелкий курсив, как «(подпись)» под строкой в бланке. */
export function Caption({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-muted font-serif text-sm italic ${className}`}>{children}</p>;
}
