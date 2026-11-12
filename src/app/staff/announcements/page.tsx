import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { BODY_MAX, getAnnouncementBoard, TITLE_MAX } from "@/lib/data/staff/dean-announcements";
import { publishAnnouncementAction } from "../actions";
import { AnnouncementForm } from "./announcement-form";

export const metadata: Metadata = { title: "Объявления" };

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

export default async function AnnouncementsPage() {
  const { items, groups } = await getAnnouncementBoard();

  return (
    <>
      <PageTitle eyebrow="деканат" hint="Объявление появится у студентов на главной, и каждому придёт уведомление.">
        Объявления
      </PageTitle>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card aria-label="Новое объявление" className="h-fit">
          <AnnouncementForm action={publishAnnouncementAction} groups={groups} titleMax={TITLE_MAX} bodyMax={BODY_MAX} />
        </Card>

        <section aria-labelledby="published-title">
          <SectionTitle>
            <span id="published-title">Опубликованные</span>
          </SectionTitle>
          {items.length === 0 ? (
            <EmptyState icon={Megaphone} title="Объявлений пока нет">
              Первое опубликованное объявление появится здесь.
            </EmptyState>
          ) : (
            <ul className="space-y-4">
              {items.map((a) => (
                <li key={a.id} className="border-border border-b pb-4 last:border-b-0">
                  <p className="font-semibold">{a.title}</p>
                  <p className="text-muted mt-0.5 text-xs">
                    {when.format(a.publishedAt)} · {a.group ? `группа ${a.group}` : "всем студентам"}
                  </p>
                  <p className="mt-1.5 text-sm whitespace-pre-line">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
