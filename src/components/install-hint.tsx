"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Событие Chrome и Edge: сайт можно установить. В типах браузера его пока нет. */
type InstallEvent = Event & { prompt: () => Promise<void> };

/** Подсказка в профиле: как поставить кабинет на главный экран. Кнопка появляется там, где браузер это умеет. */
export function InstallHint() {
  const [install, setInstall] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    const onInstalled = () => setInstall(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return (
    <div className="flex items-start gap-3 text-sm">
      <Smartphone className="text-brand mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p>
          Кабинет можно поставить на главный экран телефона. Он будет открываться как приложение, без адресной строки.
        </p>
        {install ? (
          <Button variant="secondary" className="mt-2 px-3 py-1.5 text-sm" onClick={() => void install.prompt()}>
            Установить
          </Button>
        ) : (
          <p className="text-muted mt-1 text-xs">
            В меню браузера выбери «Установить приложение» или «На экран „Домой“». На айфоне этот пункт в меню «Поделиться».
          </p>
        )}
      </div>
    </div>
  );
}
