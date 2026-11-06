import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getMyProfile } from "@/lib/data/student";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Профиль" };

export default async function ProfilePage() {
  const p = await getMyProfile();
  const fullName = [p.lastName, p.firstName, p.middleName].filter(Boolean).join(" ");

  const rows: [string, string][] = [
    ["Факультет", p.faculty],
    ["Направление", `${p.programCode} ${p.program}`],
    ["Курс", String(p.course)],
    ["Группа", p.group],
    ["Номер зачётки", p.recordBookNumber],
    ["Форма обучения", p.isPaid ? "Платная" : "Бюджетная"],
  ];

  return (
    <>
      <PageTitle eyebrow="профиль">Мои данные</PageTitle>
      <Card>
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="border-brand text-brand flex size-14 shrink-0 items-center justify-center rounded-full border-2 font-serif text-lg font-bold"
          >
            {p.firstName[0]}
            {p.lastName[0]}
          </span>
          <div>
            <p className="font-serif text-lg leading-snug font-bold">{fullName}</p>
            <p className="text-muted text-sm">Студент, {p.group}</p>
          </div>
        </div>
        <div className="mt-6">
          <SectionTitle>Сведения</SectionTitle>
          <dl className="divide-border divide-y text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4">
                <dt className="text-muted sm:w-40 sm:shrink-0">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>
      <form action={logout} className="mt-4">
        <Button type="submit" variant="danger" className="w-full">
          <LogOut className="size-5" aria-hidden="true" />
          Выйти
        </Button>
      </form>
    </>
  );
}
