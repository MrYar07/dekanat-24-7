import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Расписание" };

export default function Page() {
  return (
    <>
      <PageTitle>Расписание</PageTitle>
      <EmptyState icon={CalendarDays} title="Раздел в разработке">
        Здесь будут пары на сегодня и на неделю, аудитории, преподаватели и переносы.
      </EmptyState>
    </>
  );
}
