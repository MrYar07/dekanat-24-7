import type { Metadata } from "next";
import { LogOut, NotebookPen } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { PageTitle } from "@/components/ui/typography";
import { requireRole } from "@/lib/auth/dal";
import { logout } from "@/app/login/actions";

export const metadata: Metadata = { title: "Кабинет сотрудника" };

const ROLE_LABEL = { teacher: "преподаватель", dean_office: "деканат" } as const;

export default async function StaffPage() {
  const user = await requireRole("teacher", "dean_office");
  const role = user.role as keyof typeof ROLE_LABEL;

  return (
    <main className="mx-auto max-w-3xl px-4 py-4">
      <header className="border-border mb-6 flex items-center justify-between border-b pb-3">
        <Logo withCaption />
        <form action={logout}>
          <Button type="submit" variant="ghost" className="px-3 text-sm">
            <LogOut className="size-4" aria-hidden="true" />
            Выйти
          </Button>
        </form>
      </header>
      <PageTitle eyebrow={`кабинет сотрудника · ${ROLE_LABEL[role]}`}>
        {user.firstName} {user.middleName}
      </PageTitle>
      <EmptyState icon={NotebookPen} title="Раздел в разработке">
        {role === "teacher"
          ? "Здесь будет журнал групп: посещаемость, баллы за срезы и оценки сессии."
          : "Здесь будет очередь заявок студентов, подтверждение достижений и объявления."}
      </EmptyState>
    </main>
  );
}
