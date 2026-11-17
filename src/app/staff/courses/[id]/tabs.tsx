import Link from "next/link";

/** Два раздела курса: баллы за срезы и посещаемость. */
export function CourseTabs({ courseId, active }: { courseId: string; active: "scores" | "attendance" }) {
  const tabs = [
    { key: "scores", href: `/staff/courses/${courseId}`, label: "Баллы за срезы" },
    { key: "attendance", href: `/staff/courses/${courseId}/attendance`, label: "Посещаемость" },
  ] as const;
  return (
    <nav aria-label="Разделы курса" className="border-border mb-5 flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm ${
            t.key === active ? "border-brand text-brand font-semibold" : "text-muted hover:text-text border-transparent"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
