import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Link, useNavigate } from "react-router";
import { CalendarClock, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Ellipsis, Flag, Footprints, ListChecks, MoveRight, Plus, Trash2, UserRound } from "lucide-react";
import {
  Av, Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Lives, Page, ProgressBar, Segmented, Sheet, Switch, Textarea,
} from "../components/atoms";
import { MarkButton, MarkPlaceholder } from "../components/attendance";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import {
  cancelPostponement, deletePenalty, logPenalty, markAttendance, markPenaltyPaid, recordPostponement, setTaskIssued, setTaskText,
  type FeedActor,
} from "../lib/firestore";
import {
  approvedPostponements, expectedRun, expectedTask, isAttendanceComplete, isScheduledRunDay, nextAttendanceStatus,
  postponementAway, postponementOnto, rosterParticipants, unpaidPenalties,
} from "../lib/attendance";
import { addDaysISO, challengeDayISO, challengePhase, durationFromDates, weekdayFromISO } from "../lib/dates";
import { formatDateLong, formatDateShort, formatMoney, formatWeekdayDate, localISODate, plural } from "../lib/format";
import { cn } from "../lib/cn";
import { notify } from "../lib/notify";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { AttendanceStatus, ChallengeData, Participant, Penalty, PostponementRequest } from "../types";

type Kind = "run" | "task";

export function DayScreen() {
  const { challenge, challenges, postponements, orgNotes, meParticipant } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const today = challenge.currentDay || 1;
  const [dayNum, setDayNum] = useState(today);
  const [optimistic, setOptimistic] = useState<Record<string, AttendanceStatus | null>>({});
  const [issuedOverride, setIssuedOverride] = useState<{ iso: string; value: boolean } | null>(null);
  const [sheetUid, setSheetUid] = useState<string | null>(null);

  useDocumentTitle(`День ${dayNum}`);

  const phase = challengePhase(challenge.startDate, challenge.duration);
  const iso = challengeDayISO(challenge.startDate, dayNum);
  // "Today" only exists while the challenge is running — before start and after
  // the finish the day number is clamped, so it must not be labelled as today.
  const isToday = phase === "active" && dayNum === today;
  const roster = useMemo(() => rosterParticipants(challenge.participants), [challenge.participants]);
  const runDay = isScheduledRunDay(iso, challenge.settings.runSchedule);
  const runDeadline = runDay ? challenge.settings.runSchedule[weekdayFromISO(iso)] : undefined;
  const taskIssued = issuedOverride?.iso === iso ? issuedOverride.value : !!challenge.issuedTaskDays?.[iso]?.issued;
  const taskDeadline = challenge.issuedTaskDays?.[iso]?.deadline ?? challenge.settings.taskDeadline ?? "10:00";

  const actor: FeedActor | undefined = currentUser && meParticipant
    ? { uid: currentUser.uid, name: meParticipant.name, ini: meParticipant.ini, isAdmin: meParticipant.isAdmin }
    : undefined;

  const statusOf = (p: Participant, kind: Kind): AttendanceStatus | undefined => {
    const key = `${p.uid}|${iso}|${kind}`;
    return key in optimistic ? optimistic[key] ?? undefined : p.days?.[iso]?.[kind];
  };

  // Task days with the switch's pending value applied, so the list reacts instantly.
  const issuedDays = useMemo(() => {
    const base = challenge.issuedTaskDays ?? {};
    if (issuedOverride?.iso !== iso) return base;
    const next = { ...base };
    if (issuedOverride.value) next[iso] = { issued: true };
    else delete next[iso];
    return next;
  }, [challenge.issuedTaskDays, issuedOverride, iso]);

  const stats = useMemo(() => {
    let runDone = 0, runNeed = 0, taskDone = 0, taskNeed = 0, allDone = 0, people = 0;
    for (const p of roster) {
      const needRun = expectedRun(iso, p.uid, challenge.settings.runSchedule, postponements);
      const needTask = expectedTask(iso, p.uid, issuedDays, postponements);
      const run = statusOf(p, "run");
      const task = statusOf(p, "task");
      if (needRun) { runNeed++; if (isAttendanceComplete(run)) runDone++; }
      if (needTask) { taskNeed++; if (isAttendanceComplete(task)) taskDone++; }
      if (needRun || needTask) {
        people++;
        if ((!needRun || isAttendanceComplete(run)) && (!needTask || isAttendanceComplete(task))) allDone++;
      }
    }
    return { runDone, runNeed, taskDone, taskNeed, allDone, people };
    // statusOf only reads `optimistic`, which is listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, iso, challenge.settings.runSchedule, issuedDays, postponements, optimistic]);

  const toggle = async (p: Participant, kind: Kind) => {
    const key = `${p.uid}|${iso}|${kind}`;
    const next = nextAttendanceStatus(statusOf(p, kind));
    setOptimistic(o => ({ ...o, [key]: next ?? null }));
    try {
      await markAttendance(challenge.id, p.uid, iso, kind, next, {
        amount: Number(challenge.settings.penaltyAmount) || 0,
        burpees: Number(challenge.settings.burpees) > 0 ? Number(challenge.settings.burpees) : undefined,
        loggedBy: currentUser?.uid ?? "",
        actor,
        targetName: p.name,
      });
    } catch (err) {
      console.error("[DayScreen] markAttendance failed:", err);
      notify.error("Не удалось сохранить отметку. Проверьте подключение.");
    } finally {
      setOptimistic(o => {
        if (o[key] !== (next ?? null)) return o;
        const rest = { ...o };
        delete rest[key];
        return rest;
      });
    }
  };

  const toggleIssued = async (value: boolean) => {
    setIssuedOverride({ iso, value });
    try {
      await setTaskIssued(challenge.id, iso, value, challenge.settings.taskDeadline);
    } catch (err) {
      console.error("[DayScreen] setTaskIssued failed:", err);
      notify.error("Не удалось изменить задание дня.");
    } finally {
      setIssuedOverride(null);
    }
  };

  const go = (n: number) => setDayNum(Math.min(challenge.duration, Math.max(1, n)));
  const sheetParticipant = roster.find(p => p.uid === sheetUid) ?? null;
  const hasOtherChallenges = challenges.length > 1;

  return (
    <Page width="lg">
      <header className="mb-6">
        {hasOtherChallenges ? (
          <button
            type="button"
            onClick={() => navigate("/challenges")}
            className="-ml-1 inline-flex max-w-full items-center gap-1 rounded-md px-1 text-[13px] font-medium text-muted-foreground hover:text-foreground lg:hidden"
            aria-label={`Сменить челлендж. Сейчас: ${challenge.name}`}
          >
            <span className="truncate">{challenge.name}</span>
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
          </button>
        ) : (
          <p className="truncate text-[13px] font-medium text-muted-foreground lg:hidden">{challenge.name}</p>
        )}

        <div className="mt-1 flex items-center justify-between gap-4 lg:mt-0">
          <h1 className="whitespace-nowrap text-[28px] font-semibold leading-tight tracking-[-0.02em] tabular">
            День {dayNum}
            <span className="font-normal text-subtle-foreground"> из {challenge.duration}</span>
          </h1>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton label="Предыдущий день" variant="secondary" onClick={() => go(dayNum - 1)} disabled={dayNum <= 1}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Следующий день" variant="secondary" onClick={() => go(dayNum + 1)} disabled={dayNum >= challenge.duration}>
              <ChevronRight />
            </IconButton>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="relative inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-md text-[15px] text-muted-foreground hover:text-foreground">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            <span>
              {formatWeekdayDate(iso)}
              {isToday && <span className="text-brand-text"> · сегодня</span>}
            </span>
            <ChevronDown className="size-3.5 shrink-0" aria-hidden />
            {/* Native date picker over the label: opens on tap (phones) and via showPicker (desktop). */}
            <input
              type="date"
              aria-label="Выбрать дату"
              value={iso}
              min={challenge.startDate}
              max={challengeDayISO(challenge.startDate, challenge.duration)}
              onClick={e => { try { e.currentTarget.showPicker(); } catch { /* unsupported */ } }}
              onChange={e => {
                const picked = e.target.value;
                if (picked) go(durationFromDates(challenge.startDate, picked));
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          {phase === "active" && !isToday && (
            <Button size="sm" variant="ghost" onClick={() => go(today)} className="-ml-1">
              Вернуться к сегодня
            </Button>
          )}
        </div>
      </header>

      {phase !== "active" && <PhaseBanner challenge={challenge} phase={phase} />}

      <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-8">
      <section aria-label="Итоги дня" className="rounded-xl border border-border bg-card xl:sticky xl:top-10 xl:order-2">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-1 xl:divide-x-0 xl:divide-y">
          <SummaryRow
            icon={<Footprints />}
            title="Пробежка"
            meta={runDay ? `до ${runDeadline}` : "Не по расписанию"}
            value={runDay ? [stats.runDone, stats.runNeed] : undefined}
          />
          <SummaryRow
            icon={<ListChecks />}
            title="Задание"
            meta={taskIssued ? `Выдано · до ${taskDeadline}` : "Не выдано"}
            value={taskIssued ? [stats.taskDone, stats.taskNeed] : undefined}
            trailing={
              <Switch
                checked={taskIssued}
                onCheckedChange={toggleIssued}
                aria-label="Задание на этот день выдано"
              />
            }
          />
        </div>
        {taskIssued && (
          <TaskText key={iso} challengeId={challenge.id} iso={iso} text={challenge.issuedTaskDays?.[iso]?.title ?? ""} />
        )}
        <div className="flex items-center gap-4 border-t border-border px-4 py-3">
          <p className="shrink-0 text-sm text-muted-foreground">Выполнили всё</p>
          <ProgressBar value={stats.allDone} max={stats.people || 1} label="Выполнили всё" className="flex-1" />
          <p className="shrink-0 text-sm font-semibold tabular">
            {stats.allDone}<span className="font-normal text-subtle-foreground"> из {stats.people}</span>
          </p>
        </div>
      </section>

      {roster.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border-strong xl:order-1 xl:mt-0">
          <EmptyState
            icon={<UserRound />}
            title="Пока нет участников"
            description="Добавьте людей по имени — после этого их можно отмечать каждый день."
            action={<Button variant="primary" onClick={() => navigate("/app/settings#participants")}>Добавить участников</Button>}
          />
        </div>
      ) : (
        <section aria-labelledby="roster-title" className="mt-8 xl:order-1 xl:mt-0">
          <div className="rounded-xl border border-border bg-card">
            <div className="sticky top-0 z-10 flex h-11 items-center gap-3 rounded-t-xl border-b border-border bg-card pl-4 pr-2">
              <h2 id="roster-title" className="min-w-0 flex-1 text-[15px] font-semibold">
                Участники <span className="font-normal text-subtle-foreground tabular">{roster.length}</span>
              </h2>
              <div className="flex gap-2 text-xs font-medium text-muted-foreground" aria-hidden>
                <span className="w-10 text-center">Бег</span>
                <span className="w-10 text-center">Задание</span>
              </div>
              <span className="w-8" aria-hidden />
            </div>
            <p className="border-b border-border px-4 py-2 text-[13px] text-muted-foreground">
              Нажатие: пришёл → опоздал → не был (штраф и −1 жизнь) → сброс
            </p>

            <ul className="divide-y divide-border">
              {roster.map(p => (
                <RosterRow
                  key={p.uid}
                  p={p}
                  iso={iso}
                  challenge={challenge}
                  postponements={postponements}
                  issuedDays={issuedDays}
                  note={orgNotes[p.uid]}
                  run={statusOf(p, "run")}
                  task={statusOf(p, "task")}
                  onToggle={kind => toggle(p, kind)}
                  onMore={() => setSheetUid(p.uid)}
                />
              ))}
            </ul>
          </div>
        </section>
      )}

      </div>

      {sheetParticipant && (
        <ParticipantDaySheet
          key={`${sheetParticipant.uid}-${iso}`}
          p={sheetParticipant}
          iso={iso}
          dayNum={dayNum}
          challenge={challenge}
          postponements={postponements}
          note={orgNotes[sheetParticipant.uid]}
          actor={actor}
          loggedBy={currentUser?.uid ?? ""}
          onClose={() => setSheetUid(null)}
        />
      )}
    </Page>
  );
}

function PhaseBanner({ challenge, phase }: { challenge: ChallengeData; phase: "upcoming" | "completed" }) {
  const navigate = useNavigate();
  const end = challengeDayISO(challenge.startDate, challenge.duration);
  if (phase === "completed") {
    return (
      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <Flag className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium">Челлендж завершился {formatDateLong(end)}</p>
          <p className="mt-0.5 text-[13px] text-muted-foreground text-pretty">
            Показан последний день. Отметки за прошедшие дни можно исправить. Чтобы продолжить, создайте новый челлендж или сдвиньте даты.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate("/app/settings")}>Изменить даты</Button>
          <Button size="sm" variant="primary" onClick={() => navigate("/challenges/create")}>Новый челлендж</Button>
        </div>
      </div>
    );
  }
  const daysLeft = Math.max(1, durationFromDates(localISODate(), challenge.startDate) - 1);
  return (
    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center">
      <CalendarClock className="hidden size-5 shrink-0 text-muted-foreground sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">
          Старт {formatDateLong(challenge.startDate)} — через {daysLeft} {plural(daysLeft, ["день", "дня", "дней"])}
        </p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">До старта добавьте участников и проверьте расписание.</p>
      </div>
      <Button size="sm" variant="secondary" onClick={() => navigate("/app/settings#participants")}>Участники</Button>
    </div>
  );
}

/** What the day's task actually was — written once, readable any time later. */
function TaskText({ challengeId, iso, text }: { challengeId: string; iso: string; text: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Long tasks are clamped to a few lines; measure whether the clamp actually cuts text.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (el && !expanded) setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, [text, expanded, editing]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setTaskText(challengeId, iso, draft);
      setEditing(false);
      notify.success("Задание сохранено");
    } catch (err) {
      console.error("[DayScreen] setTaskText failed:", err);
      notify.error("Не удалось сохранить задание.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form onSubmit={save} className="border-t border-border px-4 py-3">
        <Textarea
          aria-label={`Задание на ${formatDateLong(iso)}`}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(e); }}
          placeholder="Например: 50 приседаний и планка 2 минуты"
          rows={4}
          className="max-h-60 overflow-y-auto"
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setDraft(text); setEditing(false); }} disabled={saving}>Отмена</Button>
          <Button size="sm" variant="primary" type="submit" loading={saving}>Сохранить</Button>
        </div>
      </form>
    );
  }

  if (!text) {
    return (
      <div className="border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => { setDraft(""); setEditing(true); }}
          className="pressable flex w-full items-center gap-2 rounded-lg border border-dashed border-control-border px-3 py-2.5 text-left text-sm text-subtle-foreground transition-colors duration-150 hover:bg-hover hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
        >
          <Plus className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">Записать задание — например: 50 приседаний и планка 2 минуты</span>
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border px-4 py-3">
      <div className="flex items-start gap-3">
        <p
          ref={textRef}
          className={cn(
            "min-w-0 flex-1 whitespace-pre-wrap break-words text-sm",
            expanded ? "max-h-64 overflow-y-auto overscroll-contain pr-1" : "line-clamp-4",
          )}
        >
          {text}
        </p>
        <Button size="sm" variant="ghost" className="-mr-2 -mt-1 shrink-0" onClick={() => { setDraft(text); setEditing(true); }}>
          Изменить
        </Button>
      </div>
      {(overflowing || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
          className="mt-1.5 rounded text-[13px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25"
        >
          {expanded ? "Свернуть" : "Показать полностью"}
        </button>
      )}
    </div>
  );
}

function SummaryRow({ icon, title, meta, value, trailing }: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  value?: [number, number];
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[68px] items-center gap-3 px-4 py-3">
      <span className="text-muted-foreground [&_svg]:size-5" aria-hidden>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">{title}</p>
        <p className="text-[13px] text-muted-foreground">{meta}</p>
      </div>
      {value && (
        <p className="text-xl font-semibold tabular">
          {value[0]}<span className="text-base font-normal text-subtle-foreground">/{value[1]}</span>
        </p>
      )}
      {trailing && <div className="ml-1 flex items-center">{trailing}</div>}
    </div>
  );
}

function RosterRow({ p, iso, challenge, postponements, issuedDays, note, run, task, onToggle, onMore }: {
  p: Participant;
  iso: string;
  challenge: ChallengeData;
  postponements: PostponementRequest[];
  issuedDays: ChallengeData["issuedTaskDays"];
  note?: string;
  run?: AttendanceStatus;
  task?: AttendanceStatus;
  onToggle: (kind: Kind) => void;
  onMore: () => void;
}) {
  const needRun = expectedRun(iso, p.uid, challenge.settings.runSchedule, postponements);
  const needTask = expectedTask(iso, p.uid, issuedDays, postponements);
  const runAway = postponementAway(postponements, p.uid, iso, "running");
  const taskAway = postponementAway(postponements, p.uid, iso, "task");
  const movedHere = postponementOnto(postponements, p.uid, iso, "running") || postponementOnto(postponements, p.uid, iso, "task");
  const unpaid = unpaidPenalties(p);
  const unpaidAmount = unpaid.reduce((sum, x) => sum + (x.amount ?? 0), 0);
  const unpaidBurpees = unpaid.reduce((sum, x) => sum + (x.burpees ?? 0), 0);
  const firstName = p.name.split(" ")[0];

  return (
    <li className="flex items-center gap-3 py-2.5 pl-4 pr-2">
      <Link
        to={`/participants/${p.uid}`}
        className="-my-1 -ml-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg py-1 pl-1.5 transition-colors duration-150 hover:bg-hover"
      >
        <Av ini={p.ini} photoUrl={p.photoUrl} sz="md" className="hidden sm:inline-flex" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{p.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <Lives n={p.lives} />
            {!p.active && <Badge tone="danger">Выбыл</Badge>}
            {unpaid.length > 0 && (
              <span className="text-[13px] font-medium text-warning-text" title="Есть неоплаченный штраф">
                {unpaidAmount > 0 ? `штраф ${formatMoney(unpaidAmount, challenge.settings.currency)}` : `${unpaidBurpees} бёрпи`}
              </span>
            )}
            {movedHere && <Badge tone="postpone">Перенос</Badge>}
          </span>
          {note && needRun && <span className="mt-1 block truncate text-[13px] text-subtle-foreground">{note}</span>}
        </span>
      </Link>

      <div className="flex gap-2">
        {needRun
          ? <MarkButton status={run} onClick={() => onToggle("run")} label={`${firstName}, пробежка`} />
          : <MarkPlaceholder postponedTo={runAway ? formatDateShort(runAway.targetDateISO) : undefined} />}
        {needTask
          ? <MarkButton status={task} onClick={() => onToggle("task")} label={`${firstName}, задание`} />
          : <MarkPlaceholder postponedTo={taskAway ? formatDateShort(taskAway.targetDateISO) : undefined} />}
      </div>

      <IconButton label={`Штраф или перенос: ${p.name}`} size="sm" onClick={onMore}>
        <Ellipsis />
      </IconButton>
    </li>
  );
}

const QUICK_REASONS = ["Пропуск пробежки", "Задание не сдано", "Опоздание"];

function ParticipantDaySheet({ p, iso, dayNum, challenge, postponements, note, actor, loggedBy, onClose }: {
  p: Participant;
  iso: string;
  dayNum: number;
  challenge: ChallengeData;
  postponements: PostponementRequest[];
  note?: string;
  actor?: FeedActor;
  loggedBy: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const needRun = expectedRun(iso, p.uid, challenge.settings.runSchedule, postponements);
  const [reason, setReason] = useState("");
  const [savingPenalty, setSavingPenalty] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Penalty | null>(null);
  const [postponeType, setPostponeType] = useState<"running" | "task">(needRun ? "running" : "task");
  const [target, setTarget] = useState(addDaysISO(iso, 1));
  const [postponeNote, setPostponeNote] = useState("");
  const [savingPostpone, setSavingPostpone] = useState(false);

  const { penaltyAmount, burpees, currency } = challenge.settings;
  const [open, setOpen] = useState(true);
  const close = () => { setOpen(false); setTimeout(onClose, 250); };

  // This day's penalties first, then unpaid ones, then the rest (newest first).
  const penalties = [...p.penalties].sort((a, b) =>
    Number(b.date === iso) - Number(a.date === iso) ||
    Number(!!a.paid) - Number(!!b.paid) ||
    (b.date > a.date ? 1 : -1));
  const dayPostponements = approvedPostponements(postponements)
    .filter(x => x.participantUid === p.uid && (x.dateISO === iso || x.targetDateISO === iso));

  const savePenalty = async (reasonText: string) => {
    const trimmed = reasonText.trim();
    if (!trimmed || savingPenalty) return;
    setSavingPenalty(true);
    try {
      await logPenalty(challenge.id, p.uid, {
        reason: trimmed,
        livesLost: 1,
        amount: Number(penaltyAmount) || 0,
        burpees: Number(burpees) > 0 ? Number(burpees) : undefined,
        loggedBy,
        forDate: iso,
      }, actor, p.name);
      setReason("");
      notify.success(`Штраф записан: ${p.name}`);
    } catch (err) {
      console.error("[DayScreen] logPenalty failed:", err);
      notify.error("Не удалось записать штраф.");
    } finally {
      setSavingPenalty(false);
    }
  };

  const submitPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePenalty(reason);
  };

  const run = async (id: string, action: () => Promise<void>, ok: string, fail: string) => {
    setBusyId(id);
    try {
      await action();
      notify.success(ok);
    } catch (err) {
      console.error("[DayScreen]", fail, err);
      notify.error(fail);
    } finally {
      setBusyId(null);
    }
  };

  const submitPostpone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    setSavingPostpone(true);
    try {
      await recordPostponement(challenge.id, p, {
        type: postponeType,
        dateISO: iso,
        targetDateISO: target,
        reason: postponeNote.trim(),
      });
      setPostponeNote("");
      notify.success(`${postponeType === "running" ? "Пробежка" : "Задание"} перенесено на ${formatDateLong(target)}`);
    } catch (err) {
      console.error("[DayScreen] recordPostponement failed:", err);
      notify.error("Не удалось сохранить перенос.");
    } finally {
      setSavingPostpone(false);
    }
  };

  const penaltyParts = [
    "−1 жизнь",
    penaltyAmount > 0 ? formatMoney(penaltyAmount, currency) : null,
    burpees > 0 ? `или ${burpees} бёрпи` : null,
  ].filter(Boolean).join(" · ");

  return (
    <Sheet
      open={open}
      onOpenChange={o => { if (!o) close(); }}
      title={p.name}
      description={`День ${dayNum} · ${formatWeekdayDate(iso)}`}
    >
      <div className="flex items-center gap-3">
        <Lives n={p.lives} total={challenge.settings.startingLives} />
        {note && <p className="min-w-0 truncate text-[13px] text-muted-foreground">{note}</p>}
      </div>

      <form onSubmit={submitPenalty} className="mt-6">
        <h3 className="text-[15px] font-semibold">Штраф за {formatDateLong(iso)}</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{penaltyParts}</p>
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Записать штраф по причине">
            {QUICK_REASONS.map(r => (
              <button
                key={r}
                type="button"
                disabled={savingPenalty}
                onClick={() => savePenalty(r)}
                className="pressable h-8 rounded-full border border-border-strong px-3 text-[13px] transition-colors duration-150 hover:bg-hover disabled:opacity-50"
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted-foreground">Нажатие сразу записывает штраф за этот день</p>
          <Field label="Причина">
            {({ id }) => (
              <Input id={id} value={reason} onChange={e => setReason(e.target.value)} placeholder="Или напишите свою" autoComplete="off" />
            )}
          </Field>
          <Button type="submit" variant="secondary" block loading={savingPenalty} disabled={!reason.trim()}>
            Записать штраф
          </Button>
        </div>
      </form>

      {penalties.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Все штрафы</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {penalties.map((pen, i) => (
              <li key={pen.penaltyId ?? `${pen.date}-${i}`} className="flex items-center gap-2 py-2 pl-3 pr-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{pen.reason}</p>
                  <p className="text-[13px] text-muted-foreground tabular">
                    {[
                      pen.date.length === 10 ? formatDateShort(pen.date) : pen.date,
                      pen.amount > 0 ? formatMoney(pen.amount, currency) : null,
                      pen.paid ? "оплачен" : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {pen.penaltyId && !pen.paid && (
                  <Button
                    size="sm"
                    loading={busyId === `pay-${pen.penaltyId}`}
                    onClick={() => run(`pay-${pen.penaltyId}`, () => markPenaltyPaid(challenge.id, p.uid, pen.penaltyId!), "Оплата отмечена", "Не удалось отметить оплату.")}
                  >
                    Оплачен
                  </Button>
                )}
                {pen.penaltyId && (
                  <IconButton label={`Удалить штраф: ${pen.reason}`} size="sm" onClick={() => setToDelete(pen)} className="hover:text-danger-text">
                    <Trash2 />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submitPostpone} className="mt-7 border-t border-border pt-6">
        <h3 className="text-[15px] font-semibold">Перенос</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">День не будет считаться пропуском</p>

        {dayPostponements.length > 0 && (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {dayPostponements.map(x => (
              <li key={x.id} className="flex items-center gap-3 py-2 pl-3 pr-1.5">
                <MoveRight className="size-4 shrink-0 text-postpone-text" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {x.type === "running" ? "Пробежка" : "Задание"}: {formatDateShort(x.dateISO)} → {formatDateShort(x.targetDateISO)}
                  </p>
                  {x.reason && <p className="truncate text-[13px] text-muted-foreground">{x.reason}</p>}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busyId === `pp-${x.id}`}
                  onClick={() => run(`pp-${x.id}`, () => cancelPostponement(challenge.id, x.id), "Перенос отменён", "Не удалось отменить перенос.")}
                >
                  Отменить
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-col gap-3">
          <Segmented
            aria-label="Что переносим"
            value={postponeType}
            onChange={setPostponeType}
            block
            options={[{ value: "running", label: "Пробежку" }, { value: "task", label: "Задание" }]}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="На дату">
              {({ id }) => (
                <Input id={id} type="date" value={target} min={addDaysISO(iso, 1)} onChange={e => setTarget(e.target.value)} />
              )}
            </Field>
            <Field label="Комментарий">
              {({ id }) => (
                <Input id={id} value={postponeNote} onChange={e => setPostponeNote(e.target.value)} placeholder="Из чата" autoComplete="off" />
              )}
            </Field>
          </div>
          <Button type="submit" variant="secondary" block loading={savingPostpone} disabled={!target}>
            {target ? `Перенести на ${formatDateLong(target)}` : "Перенести"}
          </Button>
        </div>
      </form>

      <Button variant="ghost" block className="mt-4" onClick={() => { close(); navigate(`/participants/${p.uid}`); }}>
        Открыть профиль
      </Button>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={o => { if (!o && !busyId) setToDelete(null); }}
        title="Удалить штраф?"
        description={toDelete ? `«${toDelete.reason}». Жизнь вернётся участнику${toDelete.amount > 0 ? `, ${formatMoney(toDelete.amount, currency)} уйдёт из кассы` : ""}.` : undefined}
        confirmLabel="Удалить"
        loading={!!busyId && busyId.startsWith("del-")}
        onConfirm={async () => {
          const pen = toDelete;
          if (!pen?.penaltyId) return;
          await run(`del-${pen.penaltyId}`, () => deletePenalty(challenge.id, p.uid, pen.penaltyId!), "Штраф удалён", "Не удалось удалить штраф.");
          setToDelete(null);
        }}
      />
    </Sheet>
  );
}
