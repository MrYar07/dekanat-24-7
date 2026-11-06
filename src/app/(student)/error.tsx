"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

// В Next.js 16 функция повтора называется retry (раньше была reset).
export default function StudentError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      action={
        <Button variant="secondary" onClick={() => retry()}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Попробовать ещё раз
        </Button>
      }
    />
  );
}
