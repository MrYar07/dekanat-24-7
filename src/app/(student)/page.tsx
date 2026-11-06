import type { Metadata } from "next";
import Link from "next/link";
import { Bell, CalendarDays, FileText, TrendingUp } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getMyProfile } from "@/lib/data/student";

export const metadata: Metadata = { title: "Сегодня" };

function greeting(hour: number) {
  if (hour < 5) return "Доброй ночи";
  if (hour < 12) return "Доброе утро";
  if (hour < 18) return "Добрый день";
  return "Добрый вечер";
}

export default async function TodayPage() {
  const profile = await getMyProfile();
  const hour = Number(
    new Intl.DateTimeFormat("ru-RU", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Moscow" }).format(new Date()),
  );
  const today = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Moscow",
  }).format(new Date());

  return (
    <>
      <PageTitle eyebrow={today}>
        {greeting(hour)}, {profile.firstName}.
      </PageTitle>
      <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2">
        <section>
          <SectionTitle>Дальше по расписанию</SectionTitle>
          <EmptyState icon={CalendarDays} title="Расписание скоро появится">
            Здесь будет следующая пара, аудитория и переносы.
          </EmptyState>
        </section>
        <section>
          <SectionTitle>Ведомость</SectionTitle>
          <EmptyState icon={TrendingUp} title="Новых баллов пока нет">
            Как только преподаватель поставит балл за срез, он появится здесь.
          </EmptyState>
        </section>
        <section>
          <SectionTitle>Справки</SectionTitle>
          <EmptyState
            icon={FileText}
            title="Активных заявок нет"
            action={
              <Link href="/requests" className={buttonClass("secondary")}>
                Заказать справку
              </Link>
            }
          >
            Справка об обучении готовится за минуту.
          </EmptyState>
        </section>
        <section>
          <SectionTitle>Объявления</SectionTitle>
          <EmptyState icon={Bell} title="Объявлений нет">
            Новости деканата и напоминания о сроках будут здесь.
          </EmptyState>
        </section>
      </div>
    </>
  );
}
