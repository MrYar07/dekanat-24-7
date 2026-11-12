import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, ChevronLeft } from "lucide-react";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { getGrades } from "@/lib/data/learning";
import { WhatIf, type WhatIfCourseProp } from "./what-if";

export const metadata: Metadata = { title: "А если…" };

export default async function WhatIfPage() {
  const g = await getGrades();

  // В браузер уходят только числа, нужные для расчёта: срезы, бонус, посещаемость своего же студента.
  const courses: WhatIfCourseProp[] = g.courses
    .filter((c) => c.result !== null)
    .map((c) => ({
      id: c.id,
      discipline: c.discipline,
      assessment: c.assessment,
      input: c.input,
      pending: c.checkpoints.filter((cp) => cp.score === null).map((cp) => ({ number: cp.number, week: cp.week })),
    }));

  return (
    <>
      <Link href="/grades" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Успеваемость
      </Link>
      <PageTitle
        eyebrow="калькулятор"
        hint="Поставь себе будущие оценки и посмотри, каким станет рейтинг. Считается по тем же правилам, что и в деканате. Ничего не сохраняется."
      >
        А если…
      </PageTitle>

      {!g.rating || courses.length === 0 ? (
        <EmptyState icon={Calculator} title="Считать пока не из чего">
          Калькулятор заработает после первого среза.
        </EmptyState>
      ) : (
        <WhatIf courses={courses} activityPoints={g.activityPoints} settings={g.settings} isPaid={g.isPaid} />
      )}
    </>
  );
}
