import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Link, useNavigate } from "react-router";
import { UserRound } from "lucide-react";
import { Button, EmptyState, Page, PageHeader } from "../components/atoms";
import { DAY_KIND_LABEL, DayCellVisual, DayLegend, dayKind } from "../components/attendance";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { markAttendance } from "../lib/firestore";
import {
  expectedRun, expectedTask, isScheduledRunDay, nextAttendanceStatus, rosterParticipants,
} from "../lib/attendance";
import { challengeDayISO } from "../lib/dates";
import { formatDateLong, formatWeekdayShort } from "../lib/format";
import { cn } from "../lib/cn";
import { notify } from "../lib/notify";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { DayAttendance, Participant } from "../types";

const CELL = 26;
const COL = 34;

function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[0][0]}.` : first;
}

export function GridScreen() {
  const { challenge, postponements, meParticipant } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();
  useDocumentTitle("Таблица");

  const roster = useMemo(() => rosterParticipants(challenge.participants), [challenge.participants]);
  const todayIso = challengeDayISO(challenge.startDate, challenge.currentDay || 1);
  const [overrides, setOverrides] = useState<Record<string, DayAttendance>>({});
  const [focus, setFocus] = useState<[number, number]>([0, Math.max(0, (challenge.currentDay || 1) - 1)]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const days = useMemo(
    () => Array.from({ length: challenge.duration }, (_, i) => {
      const n = i + 1;
      const iso = challengeDayISO(challenge.startDate, n);
      return { n, iso, run: isScheduledRunDay(iso, challenge.settings.runSchedule), weekday: formatWeekdayShort(iso) };
    }),
    [challenge.duration, challenge.startDate, challenge.settings.runSchedule],
  );

  // Open on today's column instead of day 1.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.max(0, (challenge.currentDay || 1) - 1);
    el.scrollLeft = Math.max(0, idx * COL - el.clientWidth / 2 + COL * 3);
  }, [challenge.currentDay, roster.length]);

  const dayOf = (p: Participant, iso: string): DayAttendance | undefined =>
    overrides[`${p.uid}|${iso}`] ?? p.days?.[iso];

  const cycle = async (p: Participant, iso: string) => {
    const needRun = expectedRun(iso, p.uid, challenge.settings.runSchedule, postponements);
    const needTask = expectedTask(iso, p.uid, challenge.issuedTaskDays, postponements);
    if (!needRun && !needTask) return;

    const current = dayOf(p, iso) ?? {};
    // When both are expected, one tap moves both together (came → late → absent → clear).
    const next = nextAttendanceStatus(needRun ? current.run : current.task);
    const updated: DayAttendance = { ...current };
    if (needRun) updated.run = next;
    if (needTask) updated.task = next;
    const key = `${p.uid}|${iso}`;
    setOverrides(o => ({ ...o, [key]: updated }));

    try {
      const penalty = {
        amount: Number(challenge.settings.penaltyAmount) || 0,
        burpees: Number(challenge.settings.burpees) > 0 ? Number(challenge.settings.burpees) : undefined,
        loggedBy: currentUser?.uid ?? "",
        actor: currentUser && meParticipant
          ? { uid: currentUser.uid, name: meParticipant.name, ini: meParticipant.ini, isAdmin: meParticipant.isAdmin }
          : undefined,
        targetName: p.name,
      };
      if (needRun) await markAttendance(challenge.id, p.uid, iso, "run", next, penalty);
      if (needTask) await markAttendance(challenge.id, p.uid, iso, "task", next, penalty);
    } catch (err) {
      console.error("[GridScreen] markAttendance failed:", err);
      notify.error("Не удалось сохранить отметку. Проверьте подключение.");
    } finally {
      setOverrides(o => {
        if (o[key] !== updated) return o;
        const rest = { ...o };
        delete rest[key];
        return rest;
      });
    }
  };

  // Roving focus: one tab stop for the whole grid, arrow keys move between cells.
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    };
    let [r, c] = focus;
    if (moves[e.key]) {
      r = Math.min(roster.length - 1, Math.max(0, r + moves[e.key][0]));
      c = Math.min(days.length - 1, Math.max(0, c + moves[e.key][1]));
    } else if (e.key === "Home") c = 0;
    else if (e.key === "End") c = days.length - 1;
    else return;
    e.preventDefault();
    setFocus([r, c]);
    tableRef.current?.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`)?.focus();
  };

  if (roster.length === 0) {
    return (
      <Page width="md">
        <PageHeader title="Таблица" />
        <div className="rounded-xl border border-dashed border-border-strong">
          <EmptyState
            icon={<UserRound />}
            title="Пока нет участников"
            description="Когда вы добавите людей, здесь появится таблица отметок за весь челлендж."
            action={<Button variant="primary" onClick={() => navigate("/app/settings#participants")}>Добавить участников</Button>}
          />
        </div>
      </Page>
    );
  }

  return (
    <Page width="full">
      <PageHeader
        title="Таблица"
        description={`${roster.length} участников · ${challenge.duration} дней. Клетка: пришёл → опоздал → не был (штраф) → сброс.`}
      />

      <DayLegend className="mb-4" />

      <div className="rounded-xl border border-border bg-card">
        <div
          ref={scrollRef}
          className="overflow-x-auto overscroll-x-contain rounded-xl"
          role="region"
          aria-label="Отметки участников по дням"
        >
          <table ref={tableRef} className="border-separate border-spacing-0" onKeyDown={onGridKeyDown}>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-20 h-14 min-w-[112px] border-b border-r border-border bg-card px-3 text-left text-[13px] font-medium text-muted-foreground sm:min-w-[200px] sm:px-4"
                >
                  Участник
                </th>
                {days.map(d => {
                  const today = d.iso === todayIso;
                  return (
                    <th key={d.n} scope="col" className="h-14 border-b border-border p-0 align-middle font-normal" style={{ minWidth: COL }}>
                      <span
                        className={cn(
                          "mx-auto flex w-[30px] flex-col items-center rounded-md py-1 leading-none",
                          today && "bg-brand-subtle",
                        )}
                        title={[formatDateLong(d.iso), d.run ? "пробежка" : null, challenge.issuedTaskDays?.[d.iso]?.title ? `задание: ${challenge.issuedTaskDays[d.iso].title}` : null].filter(Boolean).join(" · ")}
                      >
                        <span className={cn("text-xs font-semibold tabular", today ? "text-brand-text" : "text-foreground")}>{d.n}</span>
                        <span className={cn("mt-1 text-[11px]", today ? "text-brand-text" : "text-subtle-foreground")}>{d.weekday}</span>
                        <span className={cn("mt-1 size-1 rounded-full", d.run ? "bg-muted-foreground" : "bg-transparent")} aria-hidden />
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {roster.map((p, r) => {
                const view: Participant = { ...p, days: { ...p.days } };
                for (const d of days) {
                  const o = overrides[`${p.uid}|${d.iso}`];
                  if (o) view.days[d.iso] = o;
                }
                return (
                  <tr key={p.uid}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-r border-border bg-card px-3 text-left font-normal sm:px-4"
                    >
                      <Link
                        to={`/participants/${p.uid}`}
                        title={p.name}
                        className="block max-w-[96px] truncate text-sm font-medium hover:underline sm:max-w-[184px]"
                      >
                        <span className="sm:hidden">{shortName(p.name)}</span>
                        <span className="hidden sm:inline">{p.name}</span>
                      </Link>
                    </th>
                    {days.map((d, c) => {
                      const kind = dayKind(view, d.iso, todayIso, challenge.settings.runSchedule, challenge.issuedTaskDays, postponements);
                      const interactive =
                        expectedRun(d.iso, p.uid, challenge.settings.runSchedule, postponements) ||
                        expectedTask(d.iso, p.uid, challenge.issuedTaskDays, postponements);
                      const today = d.iso === todayIso;
                      const label = `${p.name}, день ${d.n}, ${formatDateLong(d.iso)}: ${DAY_KIND_LABEL[kind]}`;
                      const tabIndex = focus[0] === r && focus[1] === c ? 0 : -1;
                      return (
                        <td key={d.n} className={cn("h-9 p-0 text-center", today && "bg-brand-subtle/60")}>
                          {interactive ? (
                            <button
                              type="button"
                              data-cell={`${r}-${c}`}
                              tabIndex={tabIndex}
                              onFocus={() => setFocus([r, c])}
                              onClick={() => cycle(p, d.iso)}
                              aria-label={label}
                              title={label}
                              className="pressable inline-flex rounded-md align-middle hover:brightness-95 dark:hover:brightness-125"
                            >
                              <DayCellVisual kind={kind} size={CELL} />
                            </button>
                          ) : (
                            <span
                              data-cell={`${r}-${c}`}
                              tabIndex={tabIndex}
                              onFocus={() => setFocus([r, c])}
                              role="img"
                              aria-label={label}
                              title={label}
                              className="inline-flex rounded-md align-middle"
                            >
                              <DayCellVisual kind={kind} size={CELL} />
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
        <span className="size-1 rounded-full bg-muted-foreground" aria-hidden />
        точка под датой — день пробежки по расписанию
      </p>
    </Page>
  );
}
