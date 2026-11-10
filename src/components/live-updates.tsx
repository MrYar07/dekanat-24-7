"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";

type State = { unread: number; latest: { id: string; title: string; unread: boolean } | null };

/** Как часто спрашивать сервер, пока вкладка открыта. */
const INTERVAL_MS = 15_000;

/**
 * Обновление без перезагрузки. Раз в 15 секунд (и сразу при возвращении на вкладку) спрашивает
 * у сервера короткое состояние уведомлений. Если оно изменилось — перерисовывает страницу
 * (счётчик, лента, «Сегодня»), а о новом уведомлении показывает плашку.
 * Опрос, а не WebSocket: проще, переживает прокси и спящий телефон, а для кабинета 15 секунд — достаточно.
 */
export function LiveUpdates() {
  const router = useRouter();
  const pathname = usePathname();
  const known = useRef<string | null>(null);
  const latestId = useRef<string | null>(null);
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);
  const onFeed = pathname === "/notifications";

  useEffect(() => {
    let stopped = false;

    async function check() {
      if (stopped || document.visibilityState !== "visible") return;
      let state: State;
      try {
        const res = await fetch("/notifications/state", { cache: "no-store", redirect: "manual" });
        // Сессия закончилась (редирект на вход) или сервер недоступен — просто ждём следующего раза.
        if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) return;
        state = await res.json();
      } catch {
        return;
      }
      const key = `${state.unread}:${state.latest?.id ?? ""}`;
      const first = known.current === null;
      const changed = !first && key !== known.current;
      const fresh = !first && state.latest && state.latest.id !== latestId.current && state.latest.unread;
      known.current = key;
      latestId.current = state.latest?.id ?? null;
      if (changed) router.refresh();
      if (fresh && state.latest) setToast({ id: state.latest.id, title: state.latest.title });
    }

    check();
    const timer = setInterval(check, INTERVAL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [router]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8_000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-24 z-30 flex justify-center md:inset-x-auto md:right-6 md:bottom-6"
    >
      {toast && !onFeed && (
        <div className="border-border bg-surface pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border p-3 shadow-lg">
          <Bell className="text-brand mt-0.5 size-5 shrink-0" aria-hidden="true" />
          {/* Обычная ссылка: переход отмечает уведомление прочитанным. */}
          <a href={`/notifications/${toast.id}`} className="min-w-0 flex-1 text-sm">
            <span className="text-muted block text-xs">Новое уведомление</span>
            <span className="font-semibold">{toast.title}</span>
          </a>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-muted hover:text-text -m-1 rounded p-1"
            aria-label="Закрыть"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
