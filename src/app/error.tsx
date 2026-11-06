"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-sm px-4 py-20">
      <ErrorState
        action={
          <Button variant="secondary" onClick={() => retry()}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Попробовать ещё раз
          </Button>
        }
      />
    </main>
  );
}
