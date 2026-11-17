"use client";

import { useState, useTransition } from "react";
import { Check, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resetCalendarLink } from "./actions";

/** Ссылка подписки: поле, из которого удобно скопировать, и кнопка «Скопировать». */
export function FeedLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <label htmlFor="feed-url" className="text-muted mb-1 block text-xs">
        Ссылка для подписки
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="feed-url"
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="border-border bg-surface-2 w-full min-w-0 flex-1 rounded-lg border px-3 py-2.5 font-mono text-xs"
        />
        <Button
          variant="secondary"
          className="shrink-0 self-start sm:self-auto"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              window.prompt("Скопируй ссылку:", url);
            }
          }}
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          <span aria-live="polite">{copied ? "Скопировано" : "Скопировать"}</span>
        </Button>
      </div>
    </div>
  );
}

/** Сброс ссылки — в два шага: после него все подписки по старой ссылке перестанут обновляться. */
export function ResetLink() {
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, start] = useTransition();

  const reset = () =>
    start(async () => {
      try {
        await resetCalendarLink();
        setAsking(false);
        setFailed(false);
        setDone(true);
      } catch {
        setFailed(true);
      }
    });

  return (
    <div>
      {asking ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={reset} disabled={pending}>
            {pending ? "Сбрасываю…" : "Да, сбросить"}
          </Button>
          <Button variant="ghost" onClick={() => setAsking(false)} disabled={pending}>
            Оставить как есть
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          onClick={() => {
            setDone(false);
            setAsking(true);
          }}
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Сбросить ссылку
        </Button>
      )}
      <p role="status" className={`mt-2 text-sm ${failed ? "text-danger" : ""}`}>
        {failed
          ? "Не получилось сбросить ссылку. Проверь связь и попробуй ещё раз."
          : done
            ? "Готово: старая ссылка больше не работает. Добавь подписку заново по новой."
            : ""}
      </p>
    </div>
  );
}
