import Link from "next/link";

/** Разделы курса: баллы за срезы, посещаемость и анонимные отзывы студентов. */
export function CourseTabs({ courseId, active }: { courseId: string; active: "scores" | "attendance" | "feedback" }) {
  const tabs = [
    { key: "scores", href: `/staff/courses/${courseId}`, label: "Баллы за срезы", short: "Баллы" },
    { key: "attendance", href: `/staff/courses/${courseId}/attendance`, label: "Посещаемость", short: null },
    { key: "feedback", href: `/staff/courses/${courseId}/feedback`, label: "Отзывы", short: null },
  ] as const;
  return (
    <nav aria-label="Разделы курса" className="border-border mb-5 flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
            t.key === active ? "border-brand text-brand font-semibold" : "text-muted hover:text-text border-transparent"
          }`}
        >
          {/* На телефоне три вкладки в одну строку: длинная подпись сокращается. */}
          {t.short ? (
            <>
              <span className="sm:hidden">{t.short}</span>
              <span className="max-sm:hidden">{t.label}</span>
            </>
          ) : (
            t.label
          )}
        </Link>
      ))}
    </nav>
  );
}
