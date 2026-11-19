import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, FileText, MessageCircleQuestion, PenLine, Search, TrendingUp } from "lucide-react";
import { QuestionStatusBadge } from "@/components/question-status";
import { buttonClass } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { EXAMPLES, parseQuestion, searchSections, SECTIONS, type Intent, type Section } from "@/lib/ask/intents";
import { getSchedule, getToday } from "@/lib/data/learning";
import { getMyQuestions } from "@/lib/data/questions";
import { getDocumentCatalog } from "@/lib/data/requests";
import { preview } from "@/lib/questions";
import { addDays, relativeDay } from "@/lib/time";

export const metadata: Metadata = { title: "Спроси деканат" };

const num = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MAX_QUESTION = 200;

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").slice(0, MAX_QUESTION).trim();
  const intents = q ? parseQuestion(q) : [];
  const [main, ...more] = intents;
  // Не понял вопрос — ищем по разделам, как обычный поиск.
  const found = q && !main ? searchSections(q) : [];

  return (
    <>
      <PageTitle hint="Напиши, что нужно, своими словами. Кабинет найдёт ответ в твоих данных или откроет нужную форму.">
        Спроси деканат
      </PageTitle>

      <form action="/ask" role="search" className="mb-6 flex gap-2">
        <label htmlFor="ask-q" className="sr-only">
          Вопрос
        </label>
        <input
          id="ask-q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={MAX_QUESTION}
          placeholder="Например, справка в банк"
          autoComplete="off"
          enterKeyHint="search"
          className="border-border-strong bg-surface focus:border-brand min-w-0 flex-1 rounded-lg border px-3.5 py-3 text-base"
        />
        <button type="submit" className={buttonClass("primary", "shrink-0")}>
          <Search className="size-4" aria-hidden="true" />
          <span className="max-sm:sr-only">Спросить</span>
        </button>
      </form>

      {!q ? (
        <div className="space-y-6">
          <Examples title="Можно спросить так" />
          <MyQuestions />
        </div>
      ) : main ? (
        <div className="space-y-6">
          <section aria-label="Ответ">
            <Answer intent={main} />
          </section>
          {more.length > 0 && (
            <section aria-labelledby="ask-more">
              <SectionTitle>
                <span id="ask-more">Ещё по теме</span>
              </SectionTitle>
              <SectionLinks sections={more.flatMap((i) => (i.kind === "section" ? [i.section] : []))} intents={more} />
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <EmptyState
            icon={MessageCircleQuestion}
            title="Не понял вопрос"
            action={
              <Link href={`/ask/new?q=${encodeURIComponent(q)}`} className={buttonClass("primary")}>
                <PenLine className="size-4" aria-hidden="true" />
                Написать в деканат
              </Link>
            }
          >
            Попробуй короче и проще, как в примерах ниже. Или отправь вопрос сотруднику деканата — ответ придёт уведомлением.
          </EmptyState>
          {found.length > 0 && (
            <section aria-labelledby="ask-found">
              <SectionTitle>
                <span id="ask-found">Похожие разделы</span>
              </SectionTitle>
              <SectionLinks sections={found} />
            </section>
          )}
          <Examples title="Можно спросить так" />
        </div>
      )}
    </>
  );
}

const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "Europe/Moscow" });

/** Вопросы сотрудникам деканата: последние пять и кнопка «написать». */
async function MyQuestions() {
  const all = await getMyQuestions();
  const shown = all.slice(0, 5);
  return (
    <section aria-labelledby="ask-mine">
      <SectionTitle
        action={
          <Link href="/ask/new" className="text-brand inline-flex items-center gap-1 text-sm font-semibold hover:underline">
            <PenLine className="size-4" aria-hidden="true" />
            Написать
          </Link>
        }
      >
        <span id="ask-mine">Вопросы деканату</span>
      </SectionTitle>
      {shown.length === 0 ? (
        <p className="text-muted text-sm">
          Если кабинет не нашёл ответа, напиши сотруднику деканата. Ответ придёт уведомлением, идти в каб. 214 не нужно.
        </p>
      ) : (
        <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
          {shown.map((x) => (
            <li key={x.id}>
              <Link href={`/ask/${x.id}`} className="hover:bg-surface-2 flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{preview(x.text, 80)}</span>
                  <span className="text-muted mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <QuestionStatusBadge status={x.status} />
                    <span>
                      {x.topic} · {day.format(x.createdAt)}
                    </span>
                  </span>
                </span>
                <ChevronRight className="text-muted size-5 shrink-0" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Examples({ title }: { title: string }) {
  return (
    <section aria-labelledby="ask-examples">
      <SectionTitle>
        <span id="ask-examples">{title}</span>
      </SectionTitle>
      <ul className="flex flex-wrap gap-2">
        {EXAMPLES.map((e) => (
          <li key={e}>
            <Link
              href={`/ask?q=${encodeURIComponent(e)}`}
              className="border-border bg-surface hover:border-brand inline-block rounded-full border px-3.5 py-2 text-sm"
            >
              {e}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Ссылки на разделы и документы, которые не стали главным ответом. */
function SectionLinks({ sections, intents = [] }: { sections: Section[]; intents?: Intent[] }) {
  const links = [
    ...intents.flatMap((i) =>
      i.kind === "document"
        ? [{ key: `doc-${i.code}`, title: DOC_TITLE[i.code], hint: "заказать документ", href: docHref(i) }]
        : i.kind === "rating"
          ? [{ key: "rating", title: "Мой рейтинг", hint: "баллы и прогноз", href: "/grades" }]
          : i.kind === "lessons"
            ? [{ key: "lessons", title: "Расписание", hint: "пары на неделю", href: "/schedule" }]
            : [],
    ),
    ...sections.map((s) => ({ key: s, ...SECTIONS[s] })),
  ];
  return (
    <ul className="border-border bg-surface divide-border divide-y overflow-hidden rounded-xl border">
      {links.map((l) => (
        <li key={l.key}>
          <Link href={l.href} className="hover:bg-surface-2 flex items-center gap-3 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{l.title}</span>
              <span className="text-muted block text-sm">{l.hint}</span>
            </span>
            <ArrowRight className="text-muted size-4 shrink-0" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

const DOC_TITLE = {
  study: "Справка об обучении",
  rating: "Выписка рейтинга",
  scholarship: "Справка о стипендии",
  academic: "Академическая справка",
  recredit: "Заявление на перезачёт",
} as const;

function docHref(i: Extract<Intent, { kind: "document" }>) {
  if (i.purpose) return `/requests/new/${i.code}?purpose=${encodeURIComponent(i.purpose)}`;
  if (i.period) return `/requests/new/${i.code}?period=${encodeURIComponent(i.period)}`;
  return `/requests/new/${i.code}`;
}

async function Answer({ intent }: { intent: Intent }) {
  switch (intent.kind) {
    case "document":
      return <DocumentAnswer intent={intent} />;
    case "rating":
      return <RatingAnswer />;
    case "lessons":
      return <LessonsAnswer day={intent.day} />;
    case "section": {
      const s = SECTIONS[intent.section];
      return (
        <Card>
          <p className="text-lg font-semibold">{s.title}</p>
          <p className="text-muted mt-1 text-sm">{s.hint}</p>
          <Link href={s.href} className={buttonClass("primary", "mt-4")}>
            Открыть
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Card>
      );
    }
  }
}

async function DocumentAnswer({ intent }: { intent: Extract<Intent, { kind: "document" }> }) {
  const type = (await getDocumentCatalog()).find((d) => d.code === intent.code);
  return (
    <Card>
      <div className="flex items-start gap-3">
        <FileText className="text-brand mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-lg font-semibold">
            {type?.name ?? DOC_TITLE[intent.code]}
            {intent.purpose && <span className="text-muted font-normal"> — {intent.purpose}</span>}
            {intent.period && <span className="text-muted font-normal"> — за {intent.period}</span>}
          </p>
          <p className="text-muted mt-1 text-sm">
            {type?.instant
              ? "Готово сразу: PDF с QR-кодом проверки, идти в деканат не нужно."
              : type
                ? `Заявка уйдёт в деканат, срок — до ${type.days} рабочих дней. О готовности придёт уведомление.`
                : "Форма заказа документа."}
          </p>
        </div>
      </div>
      <Link href={docHref(intent)} className={buttonClass("primary", "mt-4 w-full sm:w-auto")}>
        {intent.purpose || intent.period ? "Открыть заполненную форму" : "Открыть форму"}
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </Card>
  );
}

async function RatingAnswer() {
  const t = await getToday();
  if (!t.rating) {
    return (
      <EmptyState icon={TrendingUp} title="Баллов пока нет">
        Рейтинг появится после первых баллов за срезы.
      </EmptyState>
    );
  }
  const r = t.rating;
  return (
    <Card>
      <p className="text-muted text-sm">Рейтинг триместра{r.forecast ? " — прогноз до сессии" : ""}</p>
      <p className="mt-1 text-4xl font-bold tabular-nums">{num.format(r.rating)}</p>
      <dl className="a11y-one-col mt-3 grid gap-1 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted">Средний балл по дисциплинам</dt>
          <dd className="ml-auto font-semibold tabular-nums">{num.format(r.base)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">Бонус за достижения</dt>
          <dd className="ml-auto font-semibold tabular-nums">+{num.format(r.bonus)}</dd>
        </div>
      </dl>
      {t.goal && (
        <p className="mt-3 text-sm">
          {t.goal.gap > 0
            ? `До порога «${t.goal.label}» (${t.goal.target}) не хватает ${num.format(t.goal.gap)} балла.`
            : `Порог «${t.goal.label}» (${t.goal.target}) пройден.`}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/grades" className={buttonClass("primary")}>
          Все баллы
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Link href="/grades/rating" className={buttonClass("secondary")}>
          Из чего рейтинг
        </Link>
      </div>
    </Card>
  );
}

type DayLesson = {
  slotId: string;
  discipline: string;
  startsAt: string;
  endsAt: string;
  room: string;
  teacher: string;
  cancelled: boolean;
};

async function LessonsAnswer({ day }: { day: "next" | "today" | "tomorrow" }) {
  let date: string | null = null;
  let lessons: DayLesson[] = [];
  let today: string;

  if (day === "next") {
    const t = await getToday();
    today = t.now.date;
    if (t.upcoming) {
      date = t.upcoming.date;
      lessons = t.upcoming.lessons;
    }
  } else {
    const s = await getSchedule();
    today = s.now.date;
    date = day === "today" ? today : addDays(today, 1);
    let found = s.days.find((d) => d.date === date);
    // Завтра может быть уже следующая неделя.
    if (!found && s.week !== null && s.term && s.week < s.term.weeks) {
      found = (await getSchedule(s.week + 1)).days.find((d) => d.date === date);
    }
    lessons = (found?.lessons ?? []).filter((l) => !("movedTo" in l && l.movedTo));
  }

  const active = lessons.filter((l) => !l.cancelled);
  const when = date ? relativeDay(date, today) : null;
  const first = active[0];

  return (
    <Card>
      <div className="flex items-start gap-3">
        <CalendarDays className="text-brand mt-0.5 size-6 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {!date || active.length === 0 ? (
            <p className="text-lg font-semibold">
              {day === "tomorrow" ? "Завтра пар нет" : day === "today" ? "Сегодня пар больше нет" : "Ближайших пар нет"}
            </p>
          ) : (
            <>
              <p className="text-lg font-semibold">
                {when && when[0].toUpperCase() + when.slice(1)} первая пара — в {first.startsAt}, {first.room}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {lessons.map((l) => (
                  <li key={`${l.slotId}-${l.startsAt}`} className={`flex gap-3 ${l.cancelled ? "text-muted line-through" : ""}`}>
                    <span className="w-24 shrink-0 tabular-nums">
                      {l.startsAt}–{l.endsAt}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium">{l.discipline}</span>
                      <span className="text-muted block">
                        {l.cancelled ? "отменена" : `${l.room} · ${l.teacher}`}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
      <Link href="/schedule" className={buttonClass("secondary", "mt-4")}>
        Вся неделя
        <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </Card>
  );
}
