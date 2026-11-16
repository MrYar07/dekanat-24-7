"use client";

import { useEffect, useRef, useState } from "react";
import { REFRESH_MS, TOKEN_TTL_MS } from "@/lib/card";
import { newCardCode, type CardCode } from "./actions";

/**
 * QR студенческого. Каждую минуту берёт новый одноразовый код, пока экран открыт.
 * Пока показывается студенческий, экран не гаснет (Wake Lock, если браузер умеет).
 */
export function CardQr({ initial }: { initial: CardCode | null }) {
  const [code, setCode] = useState(initial);
  // Время узнаём только в браузере: на сервере его нет, иначе текст отсчёта разошёлся бы при гидратации.
  const [now, setNow] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  // Когда выдан текущий код: от этого момента через минуту берём следующий.
  const fetchedAt = useRef(initial ? initial.expiresAt - TOKEN_TTL_MS : 0);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const next = await newCardCode();
        if (cancelled) return;
        if (next) {
          setCode(next);
          fetchedAt.current = Date.now();
        }
        setOffline(false);
      } catch {
        if (!cancelled) setOffline(true);
      }
    };
    const tick = () => {
      setNow(Date.now());
      if (document.visibilityState === "visible" && Date.now() - fetchedAt.current >= REFRESH_MS) {
        fetchedAt.current = Date.now();
        void refresh();
      }
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    const take = () => {
      if (document.visibilityState === "visible" && wakeLock) wakeLock.request("screen").then((l) => (lock = l), () => {});
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      void lock?.release().catch(() => {});
    };
  }, []);

  if (!code) {
    return <p className="text-sm">Не получилось сделать QR-код. Обнови страницу через минуту.</p>;
  }
  const left = now === null ? null : Math.max(0, Math.ceil((code.expiresAt - now) / 1000));
  const stale = left === 0;
  const nextIn = now === null ? null : Math.max(0, Math.ceil((code.expiresAt - TOKEN_TTL_MS + REFRESH_MS - now) / 1000));

  return (
    <div className="flex flex-col items-center">
      <div
        role="img"
        aria-label="QR-код для проверки студенческого"
        data-verify-url={code.url}
        className={`size-48 rounded-md bg-white p-2 transition-opacity [&>svg]:size-full ${stale ? "opacity-30" : ""}`}
        // SVG собирает библиотека qrcode на нашем сервере из нашего же адреса: чужого текста в нём нет.
        dangerouslySetInnerHTML={{ __html: code.svg }}
      />
      {/* Обратный отсчёт диктор не читает каждую секунду: вслух — только когда что-то пошло не так. */}
      <p className="mt-2 text-center text-xs tabular-nums" aria-hidden={!stale && !offline}>
        {stale
          ? "Нет связи: код устарел, проверка его не примет"
          : offline
            ? `Нет связи: этот код действует ещё ${left} с`
            : nextIn === null
              ? "Код меняется каждую минуту"
              : `Код обновится через ${nextIn} с`}
      </p>
      <p className="sr-only" aria-live="polite">
        {stale ? "QR-код устарел, нужна связь" : offline ? "Нет связи, QR-код скоро устареет" : ""}
      </p>
      <a href={code.url} target="_blank" rel="noopener" className="mt-1 text-xs font-semibold underline underline-offset-2">
        Открыть проверку
      </a>
    </div>
  );
}
