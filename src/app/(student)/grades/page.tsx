import type { Metadata } from "next";
import { TrendingUp } from "lucide-react";
import { EmptyState, PageTitle } from "@/components/empty-state";

export const metadata: Metadata = { title: "Успеваемость" };

export default function Page() {
  return (
    <>
      <PageTitle>Успеваемость</PageTitle>
      <EmptyState icon={TrendingUp} title="Раздел в разработке">
        Здесь будут баллы за срезы, рейтинг и калькулятор «что нужно, чтобы…».
      </EmptyState>
    </>
  );
}
