"use client";

import { useTransition } from "react";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markAllReadAction } from "./actions";

export function MarkAllRead({ kind }: { kind: string | null }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      className="-mr-2 shrink-0 px-2 py-1.5 text-sm"
      disabled={pending}
      onClick={() => start(() => markAllReadAction(kind))}
    >
      <CheckCheck className="size-4" aria-hidden="true" />
      {pending ? "Отмечаю…" : kind ? "Прочитать эти" : "Прочитать все"}
    </Button>
  );
}
