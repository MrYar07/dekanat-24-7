"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

/**
 * Смена страницы: старая гаснет, новая проявляется (стили — в globals.css, «Движение»).
 * Ключ — адрес страницы, поэтому анимация идёт только при переходе. Обновление той же страницы
 * (живые уведомления, отправленная форма) её не запускает: содержимое меняется без мигания.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}

/**
 * Метка активного раздела в меню. У всех пунктов одно имя, поэтому при переходе браузер
 * не перерисовывает метку заново, а переносит её со старого пункта на новый.
 */
export function ActiveMark({ name, className }: { name: string; className: string }) {
  return (
    <ViewTransition name={name} share="tab-slide" default="none">
      <span aria-hidden="true" className={className} />
    </ViewTransition>
  );
}
