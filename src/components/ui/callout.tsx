import { ArrowRightLeft, Info, Megaphone, type LucideIcon } from "lucide-react";

export type CalloutTone = "change" | "info" | "announcement";

const TONES: Record<CalloutTone, { icon: LucideIcon; accent: string }> = {
  change: { icon: ArrowRightLeft, accent: "text-danger" },
  info: { icon: Info, accent: "text-brand" },
  announcement: { icon: Megaphone, accent: "text-brand" },
};

/** Пометка на полях: перенос пары, подсказка, объявление. Акцентный цвет — только у иконки и первого слова. */
export function Callout({
  tone,
  lead,
  children,
}: {
  tone: CalloutTone;
  lead: string;
  children?: React.ReactNode;
}) {
  const { icon: Icon, accent } = TONES[tone];
  return (
    <div className="flex gap-2.5 text-sm leading-snug">
      <Icon className={`mt-0.5 size-4 shrink-0 ${accent}`} aria-hidden="true" />
      <p>
        <b className={accent}>{lead}</b> {children}
      </p>
    </div>
  );
}
