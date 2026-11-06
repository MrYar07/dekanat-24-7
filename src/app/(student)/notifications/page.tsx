import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Уведомления" };

export default function Page() {
  return (
    <>
      <PageTitle>Уведомления</PageTitle>
      <EmptyState icon={Bell} title="Пока тихо">
        Новые баллы, статусы заявок и объявления деканата появятся здесь.
      </EmptyState>
    </>
  );
}
