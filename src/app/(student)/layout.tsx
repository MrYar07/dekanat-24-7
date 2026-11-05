import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/logo";
import { StudentNav } from "@/components/nav";
import { requireRole } from "@/lib/auth/dal";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRole("student");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col md:flex-row md:gap-6 md:px-6 md:py-6">
      <div className="md:w-56 md:shrink-0">
        <header className="flex items-center justify-between px-4 py-3 md:mb-4 md:px-3 md:py-0">
          <Link href="/" aria-label="Деканат 24/7, на главную">
            <Logo />
          </Link>
          <Link
            href="/notifications"
            aria-label="Уведомления"
            className="text-muted hover:text-text rounded-full p-2 md:hidden"
          >
            <Bell className="size-6" aria-hidden="true" />
          </Link>
        </header>
        <StudentNav />
      </div>
      <main className="min-w-0 flex-1 px-4 pt-1 pb-28 md:px-0 md:pt-0 md:pb-6">{children}</main>
    </div>
  );
}
