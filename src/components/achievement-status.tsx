import { Stamp, StatusBadge } from "@/components/ui/status";

export type AchievementStatus = "pending" | "approved" | "rejected";

/** Статус достижения словом и иконкой. Засчитанное — фиолетовая печать с баллами. */
export function AchievementStatusBadge({ status, points }: { status: AchievementStatus; points: number | null }) {
  if (status === "approved") return <Stamp>+{points ?? 0}</Stamp>;
  if (status === "rejected") return <StatusBadge tone="danger">отклонено</StatusBadge>;
  return <StatusBadge tone="wait">на проверке</StatusBadge>;
}
