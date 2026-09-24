import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { UserRound } from "lucide-react";
import { Av, Badge, Button, EmptyState, Lives, Page, PageHeader, ProgressBar } from "../components/atoms";
import { useAppContext } from "../contexts/AppContext";
import { disciplineStats, rosterParticipants, unpaidPenalties } from "../lib/attendance";
import { formatMoney, plural } from "../lib/format";
import { cn } from "../lib/cn";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { Participant } from "../types";

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
  const money = useMemo(() => penaltyStats(roster), [roster]);

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
    <Page width="lg">
      <PageHeader title="Рейтинг" description={`Дисциплина за ${challenge.currentDay} ${plural(challenge.currentDay, ["день", "дня", "дней"])} — с первого дня по сегодняшний.`} />

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:grid-rows-[auto_1fr] xl:items-start xl:gap-x-8 xl:gap-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4 xl:col-start-2 xl:row-start-1 xl:grid-cols-2">
        <Metric label="Касса" value={formatMoney(money.total, challenge.settings.currency)} />
        <Metric label="В игре" value={`${activeCount} из ${roster.length}`} />
        <Metric label="Пробежки" value={`${avg("runPct")}%`} hint="в среднем" />
        <Metric label="Задания" value={`${avg("taskPct")}%`} hint="в среднем" />
      </dl>

      <section aria-labelledby="rating-title" className="mt-8 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:mt-0">
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

      <TreasuryCard stats={money} currency={challenge.settings.currency} />
      </div>

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

interface Debtor { p: Participant; amount: number; burpees: number }
interface PenaltyStats {
  total: number;
  paid: number;
  unpaid: number;
  count: number;
  unpaidCount: number;
  burpees: number;
  debtors: Debtor[];
  reasons: [string, number][];
}

/** Money is counted from the penalties themselves, so it always matches the profiles. */
function penaltyStats(roster: Participant[]): PenaltyStats {
  const st: PenaltyStats = { total: 0, paid: 0, unpaid: 0, count: 0, unpaidCount: 0, burpees: 0, debtors: [], reasons: [] };
  const reasons = new Map<string, number>();
  for (const p of roster) {
    let owes = 0;
    let owesBurpees = 0;
    for (const pen of p.penalties ?? []) {
      const amount = Number(pen.amount) || 0;
      st.count++;
      st.total += amount;
      st.burpees += Number(pen.burpees) || 0;
      if (pen.paid) st.paid += amount;
      else {
        st.unpaid += amount;
        st.unpaidCount++;
        owes += amount;
        owesBurpees += Number(pen.burpees) || 0;
      }
      const reason = pen.reason.trim() || "Без причины";
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
    if (owes > 0 || owesBurpees > 0) st.debtors.push({ p, amount: owes, burpees: owesBurpees });
  }
  st.debtors.sort((a, b) => b.amount - a.amount || b.burpees - a.burpees);
  st.reasons = [...reasons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return st;
}

function TreasuryCard({ stats, currency }: { stats: PenaltyStats; currency: string }) {
  return (
    <section aria-labelledby="treasury-title" className="mt-8 rounded-xl border border-border bg-card xl:col-start-2 xl:row-start-2 xl:mt-0">
      <div className="px-4 pb-4 pt-3">
        <h2 id="treasury-title" className="text-[15px] font-semibold">Касса</h2>
        {stats.count === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Штрафов пока не было.</p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[13px] text-muted-foreground">Собрано</p>
                <p className="mt-0.5 text-xl font-semibold tabular">{formatMoney(stats.paid, currency)}</p>
              </div>
              <div>
                <p className="text-[13px] text-muted-foreground">Ждём оплаты</p>
                <p className={cn("mt-0.5 text-xl font-semibold tabular", stats.unpaid > 0 && "text-warning-text")}>
                  {formatMoney(stats.unpaid, currency)}
                </p>
              </div>
            </div>
            <ProgressBar value={stats.paid} max={stats.total || 1} className="mt-3 h-1.5" label={`Собрано ${stats.paid} из ${stats.total}`} />
            <p className="mt-2 text-[13px] text-muted-foreground tabular">
              {[
                `${stats.count} ${plural(stats.count, ["штраф", "штрафа", "штрафов"])}`,
                stats.unpaidCount > 0 ? `${stats.unpaidCount} не ${plural(stats.unpaidCount, ["оплачен", "оплачены", "оплачены"])}` : "все оплачены",
                stats.burpees > 0 ? `${stats.burpees} бёрпи` : null,
              ].filter(Boolean).join(" · ")}
            </p>
          </>
        )}
      </div>

      {stats.debtors.length > 0 && (
        <div className="border-t border-border">
          <h3 className="px-4 pb-1 pt-3 text-[13px] font-medium text-muted-foreground">Кто должен</h3>
          <ul className="pb-1.5">
            {stats.debtors.map(({ p, amount, burpees }) => (
              <li key={p.uid}>
                <Link to={`/participants/${p.uid}`} className="flex min-h-10 items-center gap-3 px-4 py-1.5 transition-colors duration-150 hover:bg-hover">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                  <span className="shrink-0 text-sm font-semibold text-warning-text tabular">
                    {[amount > 0 ? formatMoney(amount, currency) : null, burpees > 0 ? `${burpees} бёрпи` : null].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.reasons.length > 0 && (
        <div className="border-t border-border px-4 py-3">
          <h3 className="text-[13px] font-medium text-muted-foreground">Чаще всего штрафуют за</h3>
          <ul className="mt-1.5 space-y-1">
            {stats.reasons.map(([reason, n]) => (
              <li key={reason} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{reason}</span>
                <span className="shrink-0 text-muted-foreground tabular">×{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
