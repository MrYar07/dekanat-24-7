import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Callout } from "@/components/ui/callout";
import { Card } from "@/components/ui/card";
import { PageTitle } from "@/components/ui/typography";
import { getDocumentCatalog } from "@/lib/data/requests";
import { FIELDS, isDocumentCode, type Field } from "@/lib/documents/forms";
import { orderAction } from "../../actions";
import { OrderForm } from "./order-form";

export const metadata: Metadata = { title: "Заказ справки" };

/**
 * Значения из адреса («Спроси деканат» открывает форму с выбранным назначением).
 * Берём только варианты из списка поля: произвольный текст из ссылки в форму не попадает.
 */
function initialValues(fields: Field[], query: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = query[f.name];
    if (f.kind === "select" && typeof v === "string" && f.options.includes(v)) out[f.name] = v;
  }
  return out;
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  if (!isDocumentCode(code)) notFound();
  const type = (await getDocumentCatalog()).find((d) => d.code === code);
  if (!type) notFound();

  return (
    <>
      <Link href="/requests" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
        <ChevronLeft className="size-4" aria-hidden="true" />
        Все справки
      </Link>
      <PageTitle
        eyebrow={type.instant ? "готово сразу" : `деканат, до ${type.days} рабочих дней`}
        hint={type.description}
      >
        {type.name}
      </PageTitle>

      <div className="a11y-one-col grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <OrderForm
            action={orderAction.bind(null, code)}
            fields={FIELDS[code]}
            instant={type.instant}
            initial={initialValues(FIELDS[code], query)}
          />
        </Card>
        <div className="space-y-3">
          {type.instant ? (
            <>
              <Callout tone="info" lead="Без похода в деканат.">
                PDF с QR-кодом проверки подлинности. Печать и подпись не нужны: по коду любой может убедиться, что
                справка настоящая.
              </Callout>
              {code === "rating" && (
                <Callout tone="info" lead="До сессии —">
                  прогноз: вместо оценок сессии подставляются баллы за работу в триместре. Это будет указано в выписке.
                </Callout>
              )}
            </>
          ) : (
            <Callout tone="info" lead="Как это работает.">
              Заявка уйдёт в деканат. Когда статус изменится, придёт уведомление, а готовый документ можно будет забрать
              в каб. 214.
            </Callout>
          )}
        </div>
      </div>
    </>
  );
}
