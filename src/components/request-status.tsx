import { Stamp, StatusBadge } from "@/components/ui/status";

export type RequestStatus = "submitted" | "in_review" | "ready" | "issued" | "rejected";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: "подана",
  in_review: "в работе",
  ready: "готово",
  issued: "выдано",
  rejected: "отклонена",
};

/** Статус заявки словом и иконкой. Готовый документ — фиолетовая печать. */
export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  if (status === "ready") return <Stamp />;
  if (status === "issued") return <Stamp>выдано</Stamp>;
  if (status === "rejected") return <StatusBadge tone="danger">отклонена</StatusBadge>;
  if (status === "in_review") return <StatusBadge tone="wait">в работе</StatusBadge>;
  return <StatusBadge tone="neutral">подана</StatusBadge>;
}
