import Link from "next/link";
import { Bell, MessageCircleQuestion } from "lucide-react";
import { Cover, CoverBar } from "@/components/cover";
import { LiveUpdates } from "@/components/live-updates";
import { PageTransition } from "@/components/page-transition";
import { StudentNav } from "@/components/nav";
import { A11yToggle } from "@/components/a11y";
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
        {/* На телефоне «Спроси деканат» — значок в шапке, на широком экране — пункт на обложке. */}
        <Link href="/ask" aria-label="Спроси деканат" className="text-cover-muted hover:text-cover-ink rounded-full p-2">
          <MessageCircleQuestion className="size-6" aria-hidden="true" />
        </Link>
        <A11yToggle tone="cover" />
        <ThemeToggle tone="cover" />
        <Link
          href="/notifications"
          aria-label={unread > 0 ? `Уведомления, непрочитанных: ${unread}` : "Уведомления"}
          className="text-cover-muted hover:text-cover-ink relative -mr-2 rounded-full p-2"
        >
          <Bell className="size-6" aria-hidden="true" />
          {unread > 0 && (
            <span
              key={unread}
              aria-hidden="true"
              className="badge-pop bg-cover-ink text-cover absolute top-0.5 right-0.5 grid min-w-[1.125rem] place-items-center rounded-full px-1 text-[0.6875rem] leading-[1.125rem] font-bold tabular-nums"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </CoverBar>

      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto w-full max-w-4xl px-4 pt-5 pb-28 md:px-10 md:pt-8 md:pb-10">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
      <StudentNav />
      <LiveUpdates />
    </div>
  );
}
