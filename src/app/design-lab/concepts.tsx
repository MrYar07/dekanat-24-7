import {
  ArrowRightLeft,
  ArrowUp,
  Bell,
  CalendarDays,
  CircleCheck,
  Clock,
  FileText,
  Home,
  Hourglass,
  MapPin,
  Megaphone,
  TrendingUp,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { demo, NAV } from "./data";

export type Theme = "light" | "dark";

const NAV_ICONS: LucideIcon[] = [Home, CalendarDays, TrendingUp, FileText, UserRound];

function MiniBanner() {
  return <p className="dl-banner">Концепт для MGIMO AI Challenge. Не официальный сервис. Данные вымышлены.</p>;
}

function PhoneNav() {
  return (
    <nav className="dl-nav" aria-label="Разделы (макет)">
      {NAV.map((label, i) => {
        const Icon = NAV_ICONS[i];
        return (
          <span key={label} className="dl-nav-item" data-active={i === 0 || undefined}>
            <Icon aria-hidden size={20} strokeWidth={i === 0 ? 2.25 : 1.75} />
            {label}
          </span>
        );
      })}
    </nav>
  );
}

/* ── A. «Спокойный кампус» ─────────────────────────────────────────── */

export function CalmToday({ theme }: { theme: Theme }) {
  const { next, change, score, rating } = demo;
  return (
    <div className="dl-phone dl-calm" data-theme={theme}>
      <MiniBanner />
      <header className="a-head">
        <span className="a-logo" aria-hidden />
        <b>Деканат 24/7</b>
        <span className="a-bell">
          <Bell size={20} aria-hidden />
          <i>2</i>
        </span>
      </header>
      <div className="a-main">
        <p className="a-date">
          {demo.date} · {demo.week}
        </p>
        <h1 className="a-h1">Доброе утро, {demo.name}!</h1>

        <section className="a-card a-next">
          <p className="a-label">
            Следующая пара <span className="a-chip">через {next.in}</span>
          </p>
          <h2>{next.title}</h2>
          <ul className="a-meta">
            <li>
              <Clock size={16} aria-hidden /> {next.start}–{next.end} · {next.kind}
            </li>
            <li>
              <MapPin size={16} aria-hidden /> {next.room}
            </li>
            <li>
              <UserRound size={16} aria-hidden /> {next.teacher}
            </li>
          </ul>
          <ul className="a-later">
            {demo.later.map((l) => (
              <li key={l.time}>
                <span>{l.time}</span> {l.title} <em>{l.room}</em>
              </li>
            ))}
          </ul>
        </section>

        <section className="a-card a-change">
          <ArrowRightLeft size={20} aria-hidden />
          <div>
            <b>Перенос: {change.title}</b>
            <p>
              {change.from} → {change.to}, {change.room}
            </p>
          </div>
        </section>

        <div className="a-grid2">
          <section className="a-card a-stat">
            <p className="a-label">Новый балл</p>
            <p className="a-num">
              {score.value}
              <span className="a-delta">
                <ArrowUp size={14} aria-hidden />
                {score.delta}
              </span>
            </p>
            <p className="a-small">
              {score.title}, {score.checkpoint.toLowerCase()}
            </p>
          </section>
          <section className="a-card a-stat">
            <p className="a-label">Рейтинг</p>
            <p className="a-num">{rating.value}</p>
            <div className="a-bar" aria-hidden>
              <span style={{ width: "89.4%" }} />
              <i style={{ left: "90%" }} />
            </div>
            <p className="a-small">
              до {rating.goalLabel} — {rating.left}
            </p>
          </section>
        </div>

        <section className="a-card">
          <p className="a-label">Справки и заявки</p>
          <ul className="a-reqs">
            {demo.requests.map((r) => (
              <li key={r.title}>
                <div>
                  <b>{r.title}</b>
                  <span>{r.note}</span>
                </div>
                <span className="a-badge" data-ok={r.ready || undefined}>
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="a-card a-note">
          <Megaphone size={20} aria-hidden />
          <div>
            <b>{demo.announcement.title}</b>
            <p>{demo.announcement.text}</p>
          </div>
        </section>
      </div>
      <PhoneNav />
    </div>
  );
}

/* ── B. «Табло» ────────────────────────────────────────────────────── */

export function BoardToday({ theme }: { theme: Theme }) {
  const { next, change, score, rating } = demo;
  return (
    <div className="dl-phone dl-board" data-theme={theme}>
      <MiniBanner />
      <header className="b-head">
        <b>Деканат 24/7</b>
        <span>{demo.dateShort}</span>
        <span className="b-bell">
          <Bell size={20} aria-hidden />
          <i>2</i>
        </span>
      </header>
      <div className="b-main">
        <section className="b-hero">
          <p className="b-hi">Привет, {demo.name}</p>
          <p className="b-big">{rating.value}</p>
          <p className="b-cap">рейтинг триместра · прогноз</p>
          <div className="b-bar" aria-hidden>
            <span style={{ width: "89.4%" }} />
            <i style={{ left: "90%" }} />
          </div>
          <p className="b-goal">
            до {rating.goalLabel} <b>+{rating.left}</b>
          </p>
        </section>

        <section className="b-tile b-next">
          <div className="b-row">
            <span className="b-tag">Следующая</span>
            <span className="b-count">{next.in}</span>
          </div>
          <h2>{next.title}</h2>
          <p>
            {next.start} · {next.room} · {next.kind.toLowerCase()}
          </p>
        </section>

        <section className="b-tile b-alert">
          <span className="b-tag">Перенос</span>
          <h2>{change.title}</h2>
          <p>
            {change.from} → {change.to}
          </p>
        </section>

        <section className="b-tile b-score">
          <p className="b-num">{score.value}</p>
          <div>
            <b>{score.title}</b>
            <p>
              {score.checkpoint} · <span className="b-up">+{score.delta}</span>
            </p>
          </div>
        </section>

        <section className="b-list">
          <h3>Справки</h3>
          {demo.requests.map((r) => (
            <div key={r.title} className="b-req">
              <span>{r.title}</span>
              <span className="b-pill" data-ok={r.ready || undefined}>
                {r.ready ? "Готова" : "Ждём"}
              </span>
            </div>
          ))}
        </section>

        <p className="b-strip">
          <Megaphone size={16} aria-hidden /> {demo.announcement.title}
        </p>
      </div>
      <PhoneNav />
    </div>
  );
}

/* ── C. «Зачётка» ──────────────────────────────────────────────────── */

export function PaperToday({ theme }: { theme: Theme }) {
  const { next, change, score, rating } = demo;
  return (
    <div className="dl-phone dl-paper" data-theme={theme}>
      <MiniBanner />
      <header className="c-head">
        <div>
          <b>Деканат 24/7</b>
          <span>университет «Меридиан»</span>
        </div>
        <span className="c-bell">
          <Bell size={20} aria-hidden />
          <i>2</i>
        </span>
      </header>
      <div className="c-main">
        <p className="c-date">
          {demo.date.toLowerCase()} — {demo.week}
        </p>
        <h1 className="c-h1">Доброе утро, {demo.name}.</h1>

        <section className="c-sec">
          <h2 className="c-title">Дальше по расписанию</h2>
          <ol className="c-timeline">
            <li data-now>
              <time>{next.start}</time>
              <div>
                <b>{next.title}</b>
                <span>
                  {next.kind}, {next.room} · через {next.in}
                </span>
              </div>
            </li>
            {demo.later.map((l) => (
              <li key={l.time}>
                <time>{l.time}</time>
                <div>
                  <b>{l.title}</b>
                  <span>{l.room}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="c-margin">
            <ArrowRightLeft size={16} aria-hidden />
            <span>
              <b>Перенос.</b> {change.title}: {change.from} → {change.to}, {change.room}
            </span>
          </p>
        </section>

        <section className="c-sec">
          <h2 className="c-title">Ведомость</h2>
          <dl className="c-ledger">
            <div>
              <dt>
                {score.title}, {score.checkpoint.toLowerCase()}
              </dt>
              <dd>
                {score.value} <small>+{score.delta}</small>
              </dd>
            </div>
            <div>
              <dt>Рейтинг триместра (прогноз)</dt>
              <dd>{rating.value}</dd>
            </div>
            <div>
              <dt>До гранта 25%</dt>
              <dd>{rating.left}</dd>
            </div>
          </dl>
        </section>

        <section className="c-sec">
          <h2 className="c-title">Справки</h2>
          {demo.requests.map((r) => (
            <div key={r.title} className="c-req">
              <div>
                <b>{r.title}</b>
                <span>{r.note}</span>
              </div>
              {r.ready ? (
                <span className="c-stamp">
                  <CircleCheck size={14} aria-hidden />
                  готово
                </span>
              ) : (
                <span className="c-wait">
                  <Hourglass size={14} aria-hidden />
                  {r.status.toLowerCase()}
                </span>
              )}
            </div>
          ))}
        </section>

        <aside className="c-notice">
          <b>{demo.announcement.title}</b>
          <p>{demo.announcement.text}</p>
        </aside>
      </div>
      <PhoneNav />
    </div>
  );
}
