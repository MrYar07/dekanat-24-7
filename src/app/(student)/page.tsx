import type { Metadata } from "next";
import { Bell, CalendarDays, FileText, TrendingUp } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/empty-state";
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
      <PageTitle hint={<span className="first-letter:uppercase">{today}</span>}>
        {greeting(hour)}, {profile.firstName}!
      </PageTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        <EmptyState icon={CalendarDays} title="Расписание скоро появится">
          Здесь будет следующая пара, аудитория и переносы.
        </EmptyState>
        <EmptyState icon={TrendingUp} title="Новых баллов пока нет">
          Как только преподаватель поставит балл за срез, он появится здесь.
        </EmptyState>
        <EmptyState icon={FileText} title="Активных заявок нет">
          Справку можно заказать в разделе «Справки».
        </EmptyState>
        <EmptyState icon={Bell} title="Объявлений нет">
          Новости деканата и напоминания о сроках будут здесь.
        </EmptyState>
      </div>
    </>
  );
}
