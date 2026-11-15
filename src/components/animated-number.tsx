"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 900;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Число, которое пересчитывается на глазах. Прошлое значение помнит вкладка (sessionStorage):
 * если с прошлого раза оно изменилось, число доезжает от старого к новому, а рядом видна разница.
 * Экранный диктор читает сразу итог; тем, кто просил поменьше анимации, число показывается без движения.
 */
export function AnimatedNumber({
  value,
  storageKey,
  digits = 1,
}: {
  value: number;
  /**
   * Ключ в памяти вкладки. Должен включать пользователя: в одной вкладке могут побывать разные аккаунты.
   * Там, где пользователь может смениться без перезагрузки, компоненту нужен и key с тем же id.
   */
  storageKey: string;
  digits?: number;
}) {
  const format = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  // null — анимации нет, показывается само значение. Так число не может «застрять» на чужом значении.
  const [shown, setShown] = useState<number | null>(null);
  const [delta, setDelta] = useState<number | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    const remember = () => {
      try {
        window.sessionStorage.setItem(storageKey, String(value));
      } catch {
        // Без памяти вкладки число просто показывается как есть.
      }
    };
    let previous: number | null = null;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      previous = raw === null ? null : Number(raw);
    } catch {
      previous = null;
    }
    const step = 10 ** -digits / 2;
    if (previous === null || !Number.isFinite(previous) || Math.abs(previous - value) < step) {
      remember();
      return;
    }

    const from = previous;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    const tick = (now: number) => {
      const t = still ? 1 : Math.min(1, (now - started) / DURATION_MS);
      if (t < 1) {
        setShown(from + (value - from) * easeOut(t));
        frame.current = requestAnimationFrame(tick);
      } else {
        // Новое значение запоминается, только когда число доехало: прерванная анимация повторится.
        remember();
        setShown(null);
        setDelta(value - from);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, storageKey, digits]);

  const settled = shown === null;
  return (
    <span data-value={format.format(value)} data-settled={settled}>
      <span className="sr-only">{format.format(value)}</span>
      <span aria-hidden="true">{format.format(shown ?? value)}</span>
      {delta !== null && settled && (
        <span className="value-flash text-muted ml-2 align-middle font-sans text-sm font-semibold whitespace-nowrap">
          {delta > 0 ? "▲ +" : "▼ −"}
          {format.format(Math.abs(delta))}
          <span className="sr-only"> с прошлого раза</span>
        </span>
      )}
    </span>
  );
}
