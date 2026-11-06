import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Bell, CalendarDays, Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { Ledger, LedgerRow } from "@/components/ui/ledger";
import { StatusBadge, Stamp } from "@/components/ui/status";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Дизайн-система" };

// Витрина дизайн-системы «Зачётка». Открывается только в режиме разработки.
const COLORS = [
  ["bg", "фон страницы"],
  ["surface", "лист, карточка"],
  ["surface-2", "заглушки, нейтральные метки"],
  ["text", "основной текст"],
  ["text-muted", "подписи"],
  ["border", "линейки и рамки"],
  ["brand", "чернила: ссылки, кнопки, текущая пара"],
  ["stamp", "печать «готово»"],
  ["ok", "успех, рост балла"],
  ["warn", "предупреждение, близкий срок"],
  ["danger", "ошибки и переносы"],
] as const;

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

export default function DesignLabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <PageTitle eyebrow="дизайн-система" hint="Бумага, чернила и печать. Компоненты лежат в src/components/ui.">
        Зачётка
      </PageTitle>

      <Block title="Цвета">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COLORS.map(([token, use]) => (
            <li key={token} className="flex items-center gap-3">
              <span
                className="border-border size-10 shrink-0 rounded-lg border"
                style={{ background: `var(--${token})` }}
              />
              <span className="min-w-0 text-sm">
                <code className="block">--{token}</code>
                <span className="text-muted">{use}</span>
              </span>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Шрифты">
        <div className="space-y-3">
          <p className="font-serif text-[28px] leading-tight font-bold">PT Serif — заголовки и цифры: 89,4</p>
          <p className="text-muted font-serif italic">PT Serif курсив — дата и пометки: пятница, 6 ноября</p>
          <p>Golos Text — основной текст интерфейса, подписи, кнопки и формы.</p>
          <p className="text-muted text-xs font-semibold tracking-[0.14em] uppercase">Капитель — заголовки разделов</p>
        </div>
      </Block>

      <Block title="Кнопки">
        <div className="flex flex-wrap gap-3">
          <Button>Заказать справку</Button>
          <Button variant="secondary">Скачать PDF</Button>
          <Button variant="ghost">Отмена</Button>
          <Button variant="danger">Выйти</Button>
          <Button disabled>Отправляем…</Button>
        </div>
      </Block>

      <Block title="Статусы и печать">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone="ok">Готова</StatusBadge>
          <StatusBadge tone="wait">На рассмотрении</StatusBadge>
          <StatusBadge tone="warn">Срок завтра</StatusBadge>
          <StatusBadge tone="danger">Отклонена</StatusBadge>
          <StatusBadge tone="neutral">Черновик</StatusBadge>
          <Stamp />
          <Stamp>выдано</Stamp>
        </div>
      </Block>

      <Block title="Ведомость и пометки">
        <div className="grid gap-8 sm:grid-cols-2">
          <Ledger>
            <LedgerRow label="Мировая экономика, срез 2" value="92" note="+6" />
            <LedgerRow label="Рейтинг триместра" value="89,4" note="прогноз" />
            <LedgerRow label="До гранта 25%" value="0,6" />
          </Ledger>
          <div className="space-y-3">
            <Callout tone="change" lead="Перенос.">
              Эконометрика: вт, 10 ноября → чт, 12 ноября, 13:00, ауд. 305
            </Callout>
            <Callout tone="announcement" lead="Третий срез — 23–27 ноября.">
              По всем дисциплинам.
            </Callout>
            <Callout tone="info" lead="Подсказка.">
              Баллы за срез появляются сразу, как их поставит преподаватель.
            </Callout>
          </div>
        </div>
      </Block>

      <Block title="Поля формы">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <TextField label="Куда нужна справка" name="demo-place" placeholder="Например, по месту работы" />
          <TextField label="Количество экземпляров" name="demo-count" defaultValue="0" error="Нужен хотя бы один" />
        </div>
      </Block>

      <Block title="Состояния">
        <div className="grid gap-4 sm:grid-cols-3">
          <EmptyState icon={Bell} title="Пока тихо">
            Новые баллы и статусы заявок появятся здесь.
          </EmptyState>
          <ErrorState action={<Button variant="secondary">Попробовать ещё раз</Button>} />
          <div aria-label="Загрузка" className="space-y-3 py-2">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        </div>
      </Block>

      <Block title="Пример: блок «Дальше по расписанию»">
        <Card className="max-w-md">
          <ol className="space-y-3">
            <li className="border-brand -ml-4 grid grid-cols-[48px_1fr] gap-2.5 border-l-[3px] pl-[13px] sm:-ml-5 sm:pl-[17px]">
              <time className="text-brand pt-0.5 font-serif font-bold tabular-nums">11:10</time>
              <div>
                <p className="font-serif text-lg leading-snug font-bold">Макроэкономика</p>
                <p className="text-muted flex flex-wrap gap-x-3 text-[13px]">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3.5" aria-hidden="true" /> через 25 мин
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden="true" /> ауд. 412
                  </span>
                </p>
              </div>
            </li>
            <li className="grid grid-cols-[48px_1fr] gap-2.5">
              <time className="text-muted pt-0.5 font-serif tabular-nums">13:00</time>
              <div>
                <p className="font-semibold">Мировая экономика</p>
                <p className="text-muted text-[13px]">ауд. 218</p>
              </div>
            </li>
          </ol>
          <div className="border-border mt-4 border-t pt-3">
            <Callout tone="change" lead="Перенос.">
              Эконометрика: вт → чт, 12 ноября, 13:00
            </Callout>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Справка об обучении</span>
            <Stamp />
          </div>
          <p className="text-muted mt-4 flex items-center gap-1.5 text-xs">
            <CalendarDays className="size-3.5" aria-hidden="true" /> Вымышленные данные для примера
          </p>
        </Card>
      </Block>
    </main>
  );
}
