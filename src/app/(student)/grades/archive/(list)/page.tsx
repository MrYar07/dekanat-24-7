import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronLeft, ChevronRight } from "lucide-react";
import { StepLine } from "@/components/charts/step-line";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { StatusBadge } from "@/components/ui/status";
import { PageTitle, SectionTitle } from "@/components/ui/typography";
import { getMyArchive } from "@/lib/data/learning";
import { earnedScholarship, yearGrants, type TermSummary } from "@/lib/grading/archive";

export const metadata: Metadata = { title: "Архив и годовой рейтинг" };

const one = new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Округление как при показе: разница «до порога» считается от того числа, которое видно на экране. */
const r1 = (x: number) => Math.round(x * 10) / 10;

function TermRow({ t }: { t: TermSummary }) {
  const href = t.current ? "/grades" : `/grades/archive/${t.id}`;
  const r = t.rating;
  return (
    <li>
      <Link
        href={href}
        className="hover:bg-surface-2 -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors"
        aria-label={`${t.name}: ${r ? `средний балл ${one.format(r.base)}, рейтинг ${one.format(r.rating)}` : "баллов пока нет"}${t.current ? ", идёт сейчас" : ""}`}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t.name}</span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {t.current && <StatusBadge tone="wait">идёт, прогноз</StatusBadge>}
            {t.retakes > 0 && <StatusBadge tone="warn">{t.retakes === 1 ? "пересдача" : `пересдач: ${t.retakes}`}</StatusBadge>}
            {earnedScholarship(t) && <StatusBadge tone="ok">повышенная стипендия</StatusBadge>}
          </span>
        </span>
        {r ? (
          <span className="shrink-0 text-right">
            <span className="block font-serif text-[17px] font-bold tabular-nums">{one.format(r.base)}</span>
            <span className="text-muted block text-xs tabular-nums">
              {r.bonus > 0 ? `+${one.format(r.bonus)} бонус → ${one.format(r.rating)}` : "без бонуса"}
            </span>
          </span>
        ) : (
          <span className="text-muted text-sm">нет баллов</span>
        )}
        <ChevronRight className="text-muted size-4 shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}

export default async function ArchivePage() {
  const a = await getMyArchive();
  const s = a.settings;
  const back = (
    <Link href="/grades" className="text-muted hover:text-text -ml-1 mb-3 inline-flex items-center gap-1 text-sm">
      <ChevronLeft className="size-4" aria-hidden="true" />
      Успеваемость
    </Link>
  );

  const bases = a.years.flatMap((y) => y.terms.map((t) => t.rating?.base).filter((x) => x !== undefined));
  if (bases.length === 0) {
    return (
      <>
        {back}
        <PageTitle>Архив и годовой рейтинг</PageTitle>
        <EmptyState icon={Archive} title="Пока пусто">Архив появится после первого триместра: здесь будут все оценки и годовой рейтинг.</EmptyState>
      </>
    );
  }
  // Общая шкала для графиков всех лет, чтобы их можно было сравнивать.
  const domain: [number, number] = [Math.floor(Math.min(...bases)) - 4, Math.min(100, Math.ceil(Math.max(...bases)) + 4)];

  return (
    <>
      {back}
      <PageTitle hint="Годовой рейтинг — среднее средних баллов трёх триместров, без бонуса активности. По нему дают гранты на обучение.">
        Архив и годовой рейтинг
      </PageTitle>

      <div className="space-y-8">
        {a.years.map((y) => {
          const grants = yearGrants(y, a.isPaid, s);
          const nextGrant = grants.find((g) => !g.reached);
          const current = y.terms.some((t) => t.current);
          return (
            <section key={y.academicYear} aria-labelledby={`year-${y.academicYear}`}>
              <SectionTitle>
                <span id={`year-${y.academicYear}`}>
                  {y.academicYear} учебный год · {y.course}-й курс
                </span>
              </SectionTitle>
              <Card>
                <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-start">
                  <div>
                    <p className="text-muted text-sm">{y.complete ? "Годовой рейтинг" : "Годовой рейтинг, прогноз"}</p>
                    <p className="font-serif text-[40px] leading-none font-bold tabular-nums" aria-label={`Годовой рейтинг ${y.academicYear}`}>
                      {y.rating === null ? "—" : one.format(y.rating)}
                    </p>
                    <p className="text-muted mt-1.5 text-sm">
                      {y.complete
                        ? "Год закрыт, рейтинг итоговый."
                        : current
                          ? `Идёт ${y.terms.find((t) => t.current)!.number}-й триместр из трёх: пока это среднее по ${y.terms.filter((t) => t.rating).length === 1 ? "одному триместру" : "прошедшим триместрам"}.`
                          : "Не все триместры года в архиве."}
                    </p>

                    {grants.length > 0 && y.rating !== null && (
                      <p className="mt-3 text-sm">
                        {y.retakes > 0 ? (
                          <>Гранта нет: в этом году была пересдача.</>
                        ) : nextGrant ? (
                          <>
                            До порога «{nextGrant.label}» ({nextGrant.from}) {y.complete ? "не хватило" : "не хватает"}{" "}
                            <b>{one.format(nextGrant.from - r1(y.rating))}</b>.
                            {grants[0].reached && <> Грант 25% {y.complete ? "получен" : "уже на пороге"}.</>}
                          </>
                        ) : (
                          <>Грант 50% {y.complete ? "получен" : "по прогнозу держится"}.</>
                        )}
                        {!y.complete && current && (
                          <>
                            {" "}
                            <Link href="/grades/goal" className="text-brand font-semibold hover:underline">
                              Путь к цели
                            </Link>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  {y.terms.some((t) => t.rating) && (
                    <figure>
                      <StepLine
                        title={`Средний балл по триместрам ${y.academicYear}`}
                        points={[1, 2, 3].map((n) => {
                          const t = y.terms.find((x) => x.number === n);
                          return { label: `${n}-й`, value: t?.rating ? r1(t.rating.base) : null };
                        })}
                        domain={domain}
                        decimals={1}
                        width={200}
                        height={84}
                      />
                      <figcaption className="text-muted mt-1 text-center text-xs">средний балл по триместрам</figcaption>
                    </figure>
                  )}
                </div>

                <ul className="divide-border border-border mt-4 divide-y border-t pt-1">
                  {y.terms.map((t) => (
                    <TermRow key={t.id} t={t} />
                  ))}
                </ul>
              </Card>
            </section>
          );
        })}
      </div>

      <p className="text-muted mt-6 max-w-[65ch] text-xs">
        Повышенная стипендия — за триместр с рейтингом от {s.privileges.scholarshipFrom} без пересдач, на следующий триместр.
        Гранты — по годовому рейтингу: 25% от {s.privileges.grant25From}, 50% от {s.privileges.grant50From}, тоже без пересдач.
      </p>
    </>
  );
}
