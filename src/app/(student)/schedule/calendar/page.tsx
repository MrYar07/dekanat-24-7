import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, ChevronLeft, Download } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/typography";
import { getMyCalendar } from "@/lib/data/calendar";
import { calendarUrls } from "@/lib/site";
import { FeedLink, ResetLink } from "./feed-link";

export const metadata: Metadata = { title: "Расписание в календаре" };

const STEPS = [
  ["iPhone и Mac", "Нажми «Подписаться» — Календарь сам предложит добавить подписку."],
  [
    "Google Календарь и Android",
    "Кнопка «Google Календарь» откроет подписку в браузере. Или в настройках Google Календаря: «Добавить календарь» → «По URL» и вставь ссылку.",
  ],
  ["Яндекс Календарь, Outlook и другие", "Найди в календаре «Подписку по ссылке» и вставь скопированную ссылку."],
] as const;

export default async function CalendarPage() {
  const { token, hasTerm } = await getMyCalendar();
  const urls = await calendarUrls(token);
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(urls.webcal)}`;

  return (
    <>
      <Link href="/schedule" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Расписание
      </Link>
      <PageTitle hint="Пары, переносы и отмены сами появятся в календаре на телефоне.">Расписание в календаре</PageTitle>

      {!hasTerm && (
        <div className="mb-6">
          <Callout tone="info" lead="Триместр ещё не начался.">
            Подписку можно добавить уже сейчас: пары появятся в календаре, как только деканат опубликует расписание.
          </Callout>
        </div>
      )}

      <Card aria-labelledby="subscribe">
        <h2 id="subscribe" className="font-serif text-lg font-bold">
          Подписка
        </h2>
        <p className="text-muted mt-1 text-sm">
          Календарь сам перечитывает расписание несколько раз в день: перенос или отмена доедут без тебя. Срезы
          отмечены в названии пары.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a href={urls.webcal} className={buttonClass("primary")}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            Подписаться
          </a>
          <a href={google} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
            Google Календарь
          </a>
        </div>
        <div className="mt-4">
          <FeedLink url={urls.https} />
        </div>
      </Card>

      <section aria-labelledby="how" className="mt-8">
        <h2 id="how" className="mb-2 font-serif text-lg font-bold">
          Как добавить
        </h2>
        <dl className="divide-border divide-y text-sm">
          {STEPS.map(([where, how]) => (
            <div key={where} className="py-2.5">
              <dt className="font-semibold">{where}</dt>
              <dd className="text-muted mt-0.5">{how}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted mt-2 text-xs">Google обновляет подписки реже остальных — бывает, что раз в сутки.</p>
      </section>

      <section aria-labelledby="once" className="mt-8">
        <h2 id="once" className="mb-2 font-serif text-lg font-bold">
          Один раз, без обновлений
        </h2>
        <a href={`${urls.https}?download`} download className={buttonClass("secondary")}>
          <Download className="size-4" aria-hidden="true" />
          Скачать .ics
        </a>
        <p className="text-muted mt-2 text-sm">Файл — снимок расписания на сегодня: переносы в него уже не попадут.</p>
      </section>

      <section aria-labelledby="reset" className="mt-8">
        <h2 id="reset" className="mb-2 font-serif text-lg font-bold">
          Если ссылка ушла не туда
        </h2>
        <p className="text-muted mb-3 text-sm">
          По ссылке видно только расписание твоей группы — без оценок и без имени. Если отправил её не тому, сбрось:
          старая перестанет работать, а подписку придётся добавить заново.
        </p>
        <ResetLink />
      </section>
    </>
  );
}
