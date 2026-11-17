"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import type { AnnouncementEditState } from "../actions";

type Item = {
  id: string;
  title: string;
  body: string;
  publishedAt: Date;
  editedAt: Date | null;
  withdrawnAt: Date | null;
  group: string | null;
};

const when = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

const CONTROL =
  "border-border-strong bg-surface focus:border-brand aria-[invalid=true]:border-danger mt-1 block w-full rounded-lg border px-3.5 py-3 text-base";

function plural(n: number, forms: [string, string, string]) {
  const d = n % 10;
  const h = n % 100;
  return d === 1 && h !== 11 ? forms[0] : d >= 2 && d <= 4 && (h < 12 || h > 14) ? forms[1] : forms[2];
}

/** Одно опубликованное объявление: просмотр, правка на месте и снятие в два шага. */
export function PublishedItem({
  item,
  edit,
  withdraw,
  titleMax,
  bodyMax,
}: {
  item: Item;
  edit: (prev: AnnouncementEditState, form: FormData) => Promise<AnnouncementEditState>;
  withdraw: () => Promise<{ error?: string; removed?: number }>;
  titleMax: number;
  bodyMax: number;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "withdraw">("view");
  const [state, formAction, saving] = useActionState(edit, {});
  const [withdrawing, startWithdraw] = useTransition();
  const [note, setNote] = useState<{ text: string; error?: boolean } | null>(null);

  // Сохранено — возвращаемся к просмотру; страница уже пересобрана с новым текстом.
  // Состояние меняется прямо при отрисовке, а не в эффекте: так React советует реагировать на новый ответ.
  const [seenAt, setSeenAt] = useState<number | undefined>(undefined);
  if (state.at && state.at !== seenAt) {
    setSeenAt(state.at);
    setMode("view");
    setNote({ text: "Исправлено. Студенты видят новый текст, повторного уведомления не было." });
  }

  const withdrawn = item.withdrawnAt !== null;
  const meta = [
    when.format(item.publishedAt),
    item.group ? `группа ${item.group}` : "всем студентам",
    item.editedAt && !withdrawn ? "изменено" : null,
    withdrawn ? `снято ${when.format(item.withdrawnAt!)}` : null,
  ].filter(Boolean);
  const v = state.values;
  const prefix = `edit-${item.id}`;

  return (
    <li className="border-border border-b pb-4 last:border-b-0" aria-label={item.title}>
      {mode === "edit" ? (
        <form action={formAction} className="space-y-3" noValidate>
          <TextField
            id={`${prefix}-title`}
            label="Заголовок"
            name="title"
            defaultValue={v?.title ?? item.title}
            maxLength={titleMax}
            error={state.fields?.title}
          />
          <div>
            <label htmlFor={`${prefix}-body`} className="block text-sm font-medium">
              Текст
            </label>
            <textarea
              id={`${prefix}-body`}
              name="body"
              rows={4}
              maxLength={bodyMax}
              defaultValue={v?.body ?? item.body}
              aria-invalid={state.fields?.body ? true : undefined}
              className={CONTROL}
            />
            {state.fields?.body && <p className="text-danger mt-1 text-sm">{state.fields.body}</p>}
          </div>
          {state.error && !state.fields && (
            <p role="alert" className="bg-danger-soft text-danger rounded-lg px-3.5 py-2.5 text-sm">
              {state.error}
            </p>
          )}
          <p className="text-muted text-sm">Адресаты останутся прежними. Повторного уведомления не будет.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
            <Button variant="ghost" onClick={() => setMode("view")} disabled={saving}>
              Отмена
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className={`font-semibold ${withdrawn ? "text-muted line-through" : ""}`}>{item.title}</p>
          <p className="text-muted mt-0.5 text-xs">{meta.join(" · ")}</p>
          <p className={`mt-1.5 text-sm whitespace-pre-line ${withdrawn ? "text-muted" : ""}`}>{item.body}</p>

          {!withdrawn &&
            (mode === "withdraw" ? (
              <div className="bg-surface-2 mt-3 rounded-lg p-3">
                <p className="text-sm">
                  Объявление пропадёт у студентов, уведомления о нём тоже. Вернуть его нельзя — только опубликовать заново.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={withdrawing}
                    onClick={() =>
                      startWithdraw(async () => {
                        const r: { error?: string; removed?: number } = await withdraw().catch(() => ({
                          error: "Не получилось снять. Проверьте связь и попробуйте ещё раз.",
                        }));
                        if (r.error) setNote({ text: r.error, error: true });
                        else {
                          setMode("view");
                          const n = r.removed ?? 0;
                          setNote({
                            text: `Снято. ${n === 0 ? "Уведомлений не было." : `Удалено ${n} ${plural(n, ["уведомление", "уведомления", "уведомлений"])}.`}`,
                          });
                        }
                      })
                    }
                  >
                    {withdrawing ? "Снимаем…" : "Да, снять"}
                  </Button>
                  <Button variant="ghost" onClick={() => setMode("view")} disabled={withdrawing}>
                    Оставить
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  variant="ghost"
                  className="-ml-2 px-2 py-1.5 text-sm"
                  onClick={() => {
                    setNote(null);
                    setMode("edit");
                  }}
                >
                  <Pencil className="size-4" aria-hidden="true" />
                  Исправить
                </Button>
                <Button
                  variant="ghost"
                  className="px-2 py-1.5 text-sm"
                  onClick={() => {
                    setNote(null);
                    setMode("withdraw");
                  }}
                >
                  <EyeOff className="size-4" aria-hidden="true" />
                  Снять
                </Button>
              </div>
            ))}
        </>
      )}
      <p role="status" aria-live="polite" className={`text-sm ${note ? "mt-2" : ""} ${note?.error ? "text-danger" : ""}`}>
        {note && (
          <span className="inline-flex items-start gap-1.5">
            {!note.error && <Check className="text-ok mt-0.5 size-4 shrink-0" aria-hidden="true" />}
            {note.text}
          </span>
        )}
      </p>
    </li>
  );
}
