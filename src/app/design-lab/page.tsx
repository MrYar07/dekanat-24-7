import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@fontsource-variable/unbounded";
import "@fontsource-variable/manrope";
import "@fontsource/pt-serif/400.css";
import "@fontsource/pt-serif/400-italic.css";
import "@fontsource/pt-serif/700.css";
import "./design-lab.css";
import { BoardToday, CalmToday, PaperToday, type Theme } from "./concepts";

export const metadata: Metadata = { title: "Дизайн-концепции" };

// Временная страница для выбора визуального направления. В продакшн-сборку не попадает.
const CONCEPTS = [
  {
    id: "calm",
    name: "A. Спокойный кампус",
    tagline: "Чистый современный сервис: белые карточки, индиго, один шрифт.",
    font: "Golos Text",
    feel: "Как банковское приложение или Госуслуги, только дружелюбнее. Ничего не отвлекает.",
    plus: "Самый понятный и безопасный, легко масштабировать на все экраны.",
    minus: "Узнаваемый «шаблонный» вид, жюри может не запомнить.",
    Screen: CalmToday,
  },
  {
    id: "board",
    name: "B. Табло",
    tagline: "Яркий и смелый: огромные цифры, лайм и коралл, жирные рамки.",
    font: "Unbounded (заголовки) + Manrope (текст)",
    feel: "Как табло вокзала или фитнес-трекер. Рейтинг — главный герой экрана.",
    plus: "Сразу запоминается, хорошо смотрится на видео и скриншотах.",
    minus: "Громкий для официальных справок, нужна дисциплина, чтобы не стало пёстро.",
    Screen: BoardToday,
  },
  {
    id: "paper",
    name: "C. Зачётка",
    tagline: "Бумага, чернила и печать: засечки, линейки, «ведомость».",
    font: "PT Serif (заголовки) + Golos Text (текст)",
    feel: "Как хороший журнал или фирменный бланк. Отсылка к бумажному деканату, который мы оцифровали.",
    plus: "Своё лицо и история («печать теперь цифровая»), солидно для справок.",
    minus: "Меньше «приложения», сложнее сделать живые графики в том же стиле.",
    Screen: PaperToday,
  },
] as const;

const THEMES: { theme: Theme; label: string }[] = [
  { theme: "light", label: "Светлая тема" },
  { theme: "dark", label: "Тёмная тема" },
];

export default function DesignLabPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="dl-page">
      <h1>Экран «Сегодня»: три направления</h1>
      <p className="dl-intro">
        Данные одинаковые, меняется только визуальный язык. Каждый макет — ширина телефона 360 px, в светлой и
        тёмной теме. Выбери одно направление (или скажи, что взять из разных), и из него соберём дизайн-систему.
      </p>
      {CONCEPTS.map(({ id, name, tagline, font, feel, plus, minus, Screen }) => (
        <section key={id} id={id} className="dl-concept">
          <div className="dl-about">
            <h2>{name}</h2>
            <p className="dl-tagline">{tagline}</p>
            <dl>
              <div>
                <dt>Шрифты</dt>
                <dd>{font}</dd>
              </div>
              <div>
                <dt>Ощущение</dt>
                <dd>{feel}</dd>
              </div>
              <div>
                <dt>Плюс</dt>
                <dd>{plus}</dd>
              </div>
              <div>
                <dt>Минус</dt>
                <dd>{minus}</dd>
              </div>
            </dl>
          </div>
          <div className="dl-phones">
            {THEMES.map(({ theme, label }) => (
              <figure key={theme}>
                <Screen theme={theme} />
                <figcaption>{label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
