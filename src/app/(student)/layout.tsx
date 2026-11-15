import Link from "next/link";
import { Bell } from "lucide-react";
import { Cover, CoverBar } from "@/components/cover";
import { LiveUpdates } from "@/components/live-updates";
import { StudentNav } from "@/components/nav";
import { ThemeToggle } from "@/components/theme";
import { requireRole } from "@/lib/auth/dal";
import { getUnreadCount } from "@/lib/data/learning";
import { getMyProfile } from "@/lib/data/student";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  await requireRole("student");
  const [unread, me] = await Promise.all([getUnreadCount(), getMyProfile()]);

  return (
    <div className="md:flex">
      {/* Широкий экран: обложка зачётки слева. Телефон: узкая полоса обложки сверху и вкладки внизу. */}
      <Cover
        home="/"
        kind="student"
        unread={unread}
        initials={`${me.firstName[0]}${me.lastName[0]}`}
        name={`${me.firstName} ${me.lastName}`}
        lines={[`${me.group}, ${me.course} курс`, `зачётка ${me.recordBookNumber}`]}
      />
      <CoverBar home="/">
        <ThemeToggle tone="cover" />
        <Link
          href="/notifications"
          aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : "Уведомления"}
          className="text-cover-muted hover:text-cover-ink relative -mr-2 rounded-full p-2"
        >
          <Bell className="size-6" aria-hidden="true" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="bg-cover-ink text-cover absolute top-0.5 right-0.5 grid min-w-[18px] place-items-center rounded-full px-1 text-[11px] leading-[18px] font-bold tabular-nums"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </CoverBar>

      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto w-full max-w-4xl px-4 pt-5 pb-28 md:px-10 md:pt-8 md:pb-10">
          {children}
        </main>
      </div>
      <StudentNav />
      <LiveUpdates />
    </div>
  );
}
