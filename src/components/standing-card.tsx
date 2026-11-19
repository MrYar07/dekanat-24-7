import { Card } from "@/components/ui/card";
import type { Standing } from "@/lib/grading/standing";

const percent = new Intl.NumberFormat("ru-RU", { style: "percent", maximumFractionDigits: 0 });
const students = (n: number) => {
  const a = n % 100;
  const b = n % 10;
  return a > 10 && a < 20 ? "студентов" : b === 1 ? "студент" : b > 1 && b < 5 ? "студента" : "студентов";
};

/**
 * Место на курсе: видно только самому студенту. Чужих баллов и фамилий нет —
 * только сколько человек в каждом диапазоне рейтинга, свой диапазон отмечен.
 */
export function StandingCard({ s, course }: { s: Standing; course: number }) {
  const max = Math.max(...s.bins.map((b) => b.count));
  return (
    <Card>
      <div className="a11y-one-col grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-end">
        <div>
          <p className="font-serif text-[2.5rem] leading-none font-bold tabular-nums">
            {s.place}-е <span className="text-2xl">место</span>
          </p>
          <p className="mt-1.5 text-sm">
            из {s.total} на {course}-м курсе
            {s.tied > 1 && <span className="text-muted"> · делишь его ещё с {s.tied - 1}</span>}
          </p>
          <p className="text-muted mt-3 text-sm">
            {s.place === 1 && s.tied === 1
              ? "Рейтинг выше, чем у всех на курсе."
              : `Рейтинг выше, чем у ${percent.format(s.aboveShare)} курса.`}
          </p>
        </div>

        <figure>
          <ul aria-label="Сколько студентов в каждом диапазоне рейтинга" className="flex h-32 items-end gap-1.5">
            {s.bins.map((b) => (
              <li key={b.from} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                <span className="sr-only">
                  {b.from}–{b.to}: {b.count} {students(b.count)}
                  {b.mine && ", ты здесь"}
                </span>
                <span aria-hidden="true" className={`text-xs tabular-nums ${b.mine ? "text-brand font-bold" : "text-muted"}`}>
                  {b.mine ? (b.count > 1 ? `ты · ${b.count}` : "ты") : b.count || ""}
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-1 w-full rounded-t-sm ${b.mine ? "bg-brand" : "bg-surface-2 border-border border border-b-0"}`}
                  style={{ height: b.count === 0 ? 2 : `${(b.count / max) * 72}%` }}
                />
              </li>
            ))}
          </ul>
          <div aria-hidden="true" className="border-border-strong flex gap-1.5 border-t pt-1">
            {s.bins.map((b) => (
              <span key={b.from} className="text-muted min-w-0 flex-1 text-center text-[0.6875rem] tabular-nums">
                {b.from}
              </span>
            ))}
          </div>
          <figcaption className="text-muted mt-1 text-center text-xs">рейтинг триместра, шаг 5 баллов</figcaption>
        </figure>
      </div>
      <p className="text-muted border-border mt-4 border-t pt-3 text-xs">
        Видно только тебе. Фамилий и чужих баллов здесь нет — только сколько человек в каждом диапазоне. Считается по
        прогнозу рейтинга, как и сам рейтинг.
      </p>
    </Card>
  );
}
