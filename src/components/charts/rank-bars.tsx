/**
 * Ранжированный список с полосками: одна серия, цвет бренда, значение подписано у каждой строки.
 * Это обычный список, поэтому экранный диктор читает его без отдельной таблицы; полоска — украшение.
 * Полоска тонкая, растёт от левого края: слева срез прямой, у конца данных скруглён.
 */
export function RankBars({
  title,
  items,
  unit,
}: {
  title: string;
  items: { label: string; value: number; note?: string }[];
  /** Формы слова для подсказки при наведении: «заявка», «заявки», «заявок». */
  unit: [string, string, string];
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const word = (n: number) => {
    const a = Math.abs(n) % 100;
    const b = a % 10;
    return a > 10 && a < 20 ? unit[2] : b === 1 ? unit[0] : b > 1 && b < 5 ? unit[1] : unit[2];
  };
  return (
    <ul aria-label={title} className="space-y-3">
      {items.map((i) => (
        <li key={i.label} title={`${i.label}: ${i.value} ${word(i.value)}`}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0">
              {i.label}
              {i.note && <span className="text-muted"> · {i.note}</span>}
            </span>
            <span className="shrink-0 font-serif text-base font-bold tabular-nums">{i.value}</span>
          </div>
          <div aria-hidden="true" className="mt-1 h-2">
            <div
              className="bg-brand h-full rounded-r"
              // Нулевое значение не рисуем вовсе; у ненулевого полоска не уже 4 px, чтобы её было видно.
              style={{ width: i.value === 0 ? 0 : `max(4px, ${(i.value / max) * 100}%)` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
