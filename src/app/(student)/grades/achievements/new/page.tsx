import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/typography";
import { getAchievementKinds } from "@/lib/data/achievements";
import { getGrades } from "@/lib/data/learning";
import { submitAchievementAction } from "../actions";
import { AchievementForm } from "./achievement-form";

export const metadata: Metadata = { title: "Новое достижение" };

const one = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 });

export default async function NewAchievementPage() {
  const [kinds, g] = await Promise.all([getAchievementKinds(), getGrades()]);
  const s = g.settings;
  const left = Math.max(0, s.activityPointsMax - g.activityPoints);

  return (
    <>
      <Link href="/grades#achievements-title" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Успеваемость
      </Link>
      <PageTitle
        eyebrow="бонус активности"
        hint={`Олимпиады, статьи, соревнования и работа в студенческих организациях дают до +${one.format(s.activityPointsMax * s.activityCoefficient)} к рейтингу триместра. Деканат проверит подтверждение и начислит баллы.`}
      >
        Новое достижение
      </PageTitle>

      <div className="max-w-xl">
        <Card>
          <AchievementForm action={submitAchievementAction} kinds={kinds} bonusPerPoint={s.activityCoefficient} />
        </Card>
        <p className="text-muted mt-4 text-sm">
          {left > 0
            ? `Сейчас засчитано ${g.activityPoints} из ${s.activityPointsMax} баллов. В рейтинг пойдёт ещё не больше ${left}.`
            : `У тебя уже ${g.activityPoints} баллов — это предел для триместра. Новое достижение засчитают, но рейтинг от него не вырастет.`}
        </p>
      </div>
    </>
  );
}
