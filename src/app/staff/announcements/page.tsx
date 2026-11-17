import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { BODY_MAX, getAnnouncementBoard, TITLE_MAX } from "@/lib/data/staff/dean-announcements";
import { editAnnouncementAction, publishAnnouncementAction, withdrawAnnouncementAction } from "../actions";
import { AnnouncementForm } from "./announcement-form";
import { PublishedItem } from "./published-item";

export const metadata: Metadata = { title: "Объявления" };

export default async function AnnouncementsPage() {
  const { items, groups } = await getAnnouncementBoard();

  return (
    <>
      <PageTitle hint="Объявление появится у студентов на главной, и каждому придёт уведомление. Опечатку можно исправить, ошибочное объявление — снять.">
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
                <PublishedItem
                  key={a.id}
                  item={a}
                  edit={editAnnouncementAction.bind(null, a.id)}
                  withdraw={withdrawAnnouncementAction.bind(null, a.id)}
                  titleMax={TITLE_MAX}
                  bodyMax={BODY_MAX}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
