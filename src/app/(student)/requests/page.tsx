import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";

export const metadata: Metadata = { title: "Справки" };

export default function Page() {
  return (
    <>
      <PageTitle>Справки</PageTitle>
      <EmptyState icon={FileText} title="Раздел в разработке">
        Здесь можно будет заказать справку за минуту и следить за статусом заявлений.
      </EmptyState>
    </>
  );
}
