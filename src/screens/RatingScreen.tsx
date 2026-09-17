import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { UserRound } from "lucide-react";
import { Av, Badge, Button, EmptyState, Lives, Page, PageHeader, ProgressBar } from "../components/atoms";
import { useAppContext } from "../contexts/AppContext";
import { disciplineStats, rosterParticipants, unpaidPenalties } from "../lib/attendance";
import { formatMoney, plural } from "../lib/format";
import { cn } from "../lib/cn";
import { useDocumentTitle } from "../lib/useDocumentTitle";

export function RatingScreen() {
  const { challenge, postponements } = useAppContext();
  const navigate = useNavigate();
  useDocumentTitle("Рейтинг");

  const roster = useMemo(() => rosterParticipants(challenge.participants), [challenge.participants]);

  const rows = useMemo(() => roster
    .map(p => ({
      p,
      s: disciplineStats(p, challenge.startDate, challenge.currentDay, challenge.settings, challenge.issuedTaskDays, postponements),
      unpaid: unpaidPenalties(p).length,
    }))
    .sort((a, b) => (b.s.runPct + b.s.taskPct) - (a.s.runPct + a.s.taskPct)),
  [roster, challenge, postponements]);

  const avg = (key: "runPct" | "taskPct") =>
    rows.length ? Math.round(rows.reduce((sum, r) => sum + r.s[key], 0) / rows.length) : 0;
  const activeCount = roster.filter(p => p.active).length;

  if (roster.length === 0) {
    return (
      <Page width="md">
        <PageHeader title="Рейтинг" />
        <div className="rounded-xl border border-dashed border-border-strong">
          <EmptyState
            icon={<UserRound />}
            title="Пока нет участников"
            description="Рейтинг появится, когда в челлендже будут люди и первые отметки."
            action={<Button variant="primary" onClick={() => navigate("/app/settings#participants")}>Добавить участников</Button>}
          />
        </div>
      </Page>
    );
  }

  return (
    <Page width="md">
      <PageHeader title="Рейтинг" description={`Дисциплина за ${challenge.currentDay} ${plural(challenge.currentDay, ["день", "дня", "дней"])} — с первого дня по сегодняшний.`} />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        <Metric label="Касса" value={formatMoney(challenge.totalTreasury, challenge.settings.currency)} />
        <Metric label="В игре" value={`${activeCount} из ${roster.length}`} />
        <Metric label="Пробежки" value={`${avg("runPct")}%`} hint="в среднем" />
        <Metric label="Задания" value={`${avg("taskPct")}%`} hint="в среднем" />
      </dl>

      <section aria-labelledby="rating-title" className="mt-8">
        <h2 id="rating-title" className="sr-only">Участники по дисциплине</h2>
        <ol className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map(({ p, s, unpaid }, i) => (
            <li key={p.uid}>
              <Link
                to={`/participants/${p.uid}`}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-hover sm:gap-4",
                  i === 0 && "rounded-t-xl",
                  i === rows.length - 1 && "rounded-b-xl",
                )}
              >
                <span className={cn("w-6 shrink-0 text-center text-sm font-semibold tabular", i < 3 ? "text-foreground" : "text-subtle-foreground")}>
                  {i + 1}
                </span>
                <Av ini={p.ini} photoUrl={p.photoUrl} sz="md" className="hidden sm:inline-flex" />
                <span className={cn("min-w-0 flex-1", !p.active && "opacity-60")}>
                  <span className="block truncate text-[15px] font-medium">{p.name}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Lives n={p.lives} />
                    {!p.active && <Badge tone="danger">Выбыл</Badge>}
                    {unpaid > 0 && <Badge tone="warning">{unpaid === 1 ? "Штраф" : `Штрафов: ${unpaid}`}</Badge>}
                  </span>
                </span>
                <span className="w-[112px] shrink-0 space-y-2 sm:w-[168px]">
                  <Score label="Бег" pct={s.runPct} done={s.runDone} total={s.runTotal} />
                  <Score label="Задания" pct={s.taskPct} done={s.taskDone} total={s.taskTotal} />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-4 text-[13px] text-muted-foreground text-pretty">
        Процент пробежек считается от дней с пробежкой по расписанию, процент заданий — от дней, когда задание было выдано.
        Перенесённые дни не считаются пропуском.
      </p>
    </Page>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular">
        {value}
        {hint && <span className="ml-1.5 text-[13px] font-normal text-subtle-foreground">{hint}</span>}
      </dd>
    </div>
  );
}

function Score({ label, pct, done, total }: { label: string; pct: number; done: number; total: number }) {
  return (
    <span className="block" title={`${label}: ${done} из ${total}`}>
      <span className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular">{total > 0 ? `${pct}%` : "—"}</span>
      </span>
      <ProgressBar value={pct} className="mt-1 h-1" label={`${label}: ${pct}%`} />
    </span>
  );
}
