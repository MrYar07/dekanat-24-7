import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { PageTitle } from "@/components/ui/typography";
import { getMyCard } from "@/lib/data/card";
import { newCardCode } from "./actions";
import { CardQr } from "./card-qr";

export const metadata: Metadata = { title: "Студенческий" };

const day = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" });

export default async function StudentCardPage() {
  const [c, code] = await Promise.all([getMyCard(), newCardCode()]);
  const until = c.validUntil ? day.format(new Date(`${c.validUntil}T12:00:00+03:00`)) : null;

  return (
    <>
      <Link href="/profile" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Профиль
      </Link>
      <PageTitle hint="Покажи на входе, в библиотеке или там, где просят студенческий.">Электронный студенческий</PageTitle>

      {/* Сама карточка — тёмно-синяя, как обложка зачётки. На ней только то, что есть на пластиковом билете. */}
      <section
        aria-label="Студенческий билет"
        className="cover bg-cover text-cover-ink relative mx-auto max-w-sm overflow-hidden rounded-2xl p-5 shadow-[0_10px_30px_-12px_rgb(23_42_94/0.55)]"
      >
        <div aria-hidden="true" className="border-cover-line pointer-events-none absolute inset-2 rounded-xl border" />
        <div className="relative flex items-center gap-2.5">
          <LogoMark size={28} />
          <div className="leading-tight">
            <p className="font-serif text-sm font-bold">Университет «Меридиан»</p>
            <p className="text-cover-muted text-xs">студенческий билет</p>
          </div>
        </div>

        <div className="relative mt-5 flex items-center gap-4">
          <span
            aria-hidden="true"
            className="border-cover-ink flex size-16 shrink-0 items-center justify-center rounded-full border-2 font-serif text-xl font-bold"
          >
            {c.firstName[0]}
            {c.lastName[0]}
          </span>
          <div className="min-w-0">
            <p className="font-serif text-xl leading-tight font-bold">{c.lastName}</p>
            <p className="font-serif text-base leading-tight">
              {c.firstName} {c.middleName}
            </p>
          </div>
        </div>

        <div className="border-cover-line relative mt-5 border-y py-5">
          <CardQr initial={code} />
        </div>

        <dl className="relative mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <div className="col-span-2">
            <dt className="text-cover-muted text-xs">Факультет</dt>
            <dd>{c.faculty}</dd>
          </div>
          <div>
            <dt className="text-cover-muted text-xs">Курс, группа</dt>
            <dd>
              {c.course}-й, {c.group}
            </dd>
          </div>
          <div>
            <dt className="text-cover-muted text-xs">Зачётка</dt>
            <dd className="tabular-nums">{c.recordBookNumber}</dd>
          </div>
          {until && (
            <div className="col-span-2">
              <dt className="text-cover-muted text-xs">Действует до</dt>
              <dd>{until}</dd>
            </div>
          )}
        </dl>
      </section>

      <p className="text-muted mx-auto mt-4 max-w-sm text-center text-xs">
        QR меняется каждую минуту: снимок экрана, пересланный другу, быстро перестаёт работать. Кто сканирует, видит
        только фамилию с инициалами, факультет, курс и срок действия — без входа и без приложения.
      </p>
    </>
  );
}
