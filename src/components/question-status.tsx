import { StatusBadge } from "@/components/ui/status";

export type QuestionStatus = "open" | "answered";

/** Статус вопроса в деканат словом и иконкой. */
export function QuestionStatusBadge({ status }: { status: QuestionStatus }) {
  return status === "answered" ? (
    <StatusBadge tone="ok">есть ответ</StatusBadge>
  ) : (
    <StatusBadge tone="wait">ждёт ответа</StatusBadge>
  );
}
