import Link from "next/link";
import { LogOut } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth/dal";

const ROLE_LABEL = { teacher: "преподаватель", dean_office: "деканат" } as const;

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("teacher", "dean_office");
  const role = ROLE_LABEL[user.role as keyof typeof ROLE_LABEL];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-3 md:px-6 md:py-5">
      <header className="border-border mb-6 flex items-center justify-between gap-3 border-b pb-3">
        <Link href="/staff" aria-label="Деканат 24/7, кабинет сотрудника">
          <Logo withCaption />
        </Link>
        <div className="flex min-w-0 items-center gap-1">
          <p className="text-muted hidden min-w-0 truncate text-right text-sm sm:block">
            {user.lastName} {user.firstName[0]}.{user.middleName ? ` ${user.middleName[0]}.` : ""} · {role}
          </p>
          <form action={logout}>
            <Button type="submit" variant="ghost" className="px-3 text-sm">
              <LogOut className="size-4" aria-hidden="true" />
              Выйти
            </Button>
          </form>
        </div>
      </header>
      <main className="pb-10">{children}</main>
    </div>
  );
}
