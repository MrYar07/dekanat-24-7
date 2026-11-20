import Link from "next/link";
import { ActiveMark } from "@/components/page-transition";

/** Разделы курса: баллы за срезы, посещаемость, активность с бонусом и анонимные отзывы студентов. */
export function CourseTabs({ courseId, active }: { courseId: string; active: "scores" | "attendance" | "results" | "feedback" }) {
  const tabs = [
    { key: "scores", href: `/staff/courses/${courseId}`, label: "Баллы за срезы", short: "Баллы" },
    { key: "attendance", href: `/staff/courses/${courseId}/attendance`, label: "Посещаемость", short: "Пары" },
    { key: "results", href: `/staff/courses/${courseId}/results`, label: "Активность и бонус", short: "Итоги" },
    { key: "feedback", href: `/staff/courses/${courseId}/feedback`, label: "Отзывы", short: null },
  ] as const;
  return (
    <nav aria-label="Разделы курса" className="border-border mb-5 flex flex-wrap gap-x-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={`relative -mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap ${
            t.key === active ? "text-brand font-semibold" : "text-muted hover:text-text"
          }`}
        >
          {t.key === active && <ActiveMark name="course-tab" className="bg-brand absolute inset-x-0 -bottom-0.5 h-0.5" />}
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
