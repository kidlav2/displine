import { useMemo, useState } from "react";
import type React from "react";
import { Link, useNavigate } from "react-router";
import { ChevronDown, ChevronLeft, ChevronRight, Ellipsis, Footprints, ListChecks, UserRound } from "lucide-react";
import {
  Av, Badge, Button, EmptyState, Field, IconButton, Input, Lives, Page, ProgressBar, Segmented, Sheet, Switch,
} from "../components/atoms";
import { MarkButton, MarkPlaceholder } from "../components/attendance";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import {
  logPenalty, markPenaltyPaid, recordPostponement, setAttendanceField, setTaskIssued,
  type FeedActor,
} from "../lib/firestore";
import {
  expectedRun, expectedTask, isScheduledRunDay, nextAttendanceStatus,
  postponementAway, postponementOnto, rosterParticipants, unpaidPenalties,
} from "../lib/attendance";
import { addDaysISO, challengeDayISO, weekdayFromISO } from "../lib/dates";
import { formatDateLong, formatDateShort, formatMoney, formatWeekdayDate } from "../lib/format";
import { notify } from "../lib/notify";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { AttendanceStatus, ChallengeData, Participant, PostponementRequest } from "../types";

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

  const iso = challengeDayISO(challenge.startDate, dayNum);
  const isToday = dayNum === today;
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
      if (needRun) { runNeed++; if (run === "done") runDone++; }
      if (needTask) { taskNeed++; if (task === "done") taskDone++; }
      if (needRun || needTask) {
        people++;
        if ((!needRun || run === "done") && (!needTask || task === "done")) allDone++;
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
      await setAttendanceField(challenge.id, p.uid, iso, kind, next);
    } catch (err) {
      console.error("[DayScreen] setAttendanceField failed:", err);
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
    <Page width="md">
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

        <div className="mt-1 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] tabular">
              День {dayNum}
              <span className="font-normal text-subtle-foreground"> из {challenge.duration}</span>
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {formatWeekdayDate(iso)}
              {isToday && <span className="text-brand-text"> · сегодня</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {!isToday && (
              <Button size="sm" variant="ghost" onClick={() => go(today)} className="mr-1">
                Сегодня
              </Button>
            )}
            <IconButton label="Предыдущий день" variant="secondary" onClick={() => go(dayNum - 1)} disabled={dayNum <= 1}>
              <ChevronLeft />
            </IconButton>
            <IconButton label="Следующий день" variant="secondary" onClick={() => go(dayNum + 1)} disabled={dayNum >= challenge.duration}>
              <ChevronRight />
            </IconButton>
          </div>
        </div>
      </header>

      <section aria-label="Итоги дня" className="rounded-xl border border-border bg-card">
        <div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
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
        <div className="flex items-center gap-4 border-t border-border px-4 py-3">
          <p className="shrink-0 text-sm text-muted-foreground">Выполнили всё</p>
          <ProgressBar value={stats.allDone} max={stats.people || 1} label="Выполнили всё" className="flex-1" />
          <p className="shrink-0 text-sm font-semibold tabular">
            {stats.allDone}<span className="font-normal text-subtle-foreground"> из {stats.people}</span>
          </p>
        </div>
      </section>

      {roster.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border-strong">
          <EmptyState
            icon={<UserRound />}
            title="Пока нет участников"
            description="Добавьте людей по имени — после этого их можно отмечать каждый день."
            action={<Button variant="primary" onClick={() => navigate("/app/settings#participants")}>Добавить участников</Button>}
          />
        </div>
      ) : (
        <section aria-labelledby="roster-title" className="mt-8">
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
  const [payingId, setPayingId] = useState<string | null>(null);
  const [postponeType, setPostponeType] = useState<"running" | "task">(needRun ? "running" : "task");
  const [target, setTarget] = useState(addDaysISO(iso, 1));
  const [postponeNote, setPostponeNote] = useState("");
  const [savingPostpone, setSavingPostpone] = useState(false);

  const { penaltyAmount, burpees, currency } = challenge.settings;
  const unpaid = unpaidPenalties(p);
  const [open, setOpen] = useState(true);
  const close = () => { setOpen(false); setTimeout(onClose, 250); };

  const submitPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSavingPenalty(true);
    try {
      await logPenalty(challenge.id, p.uid, {
        reason: reason.trim(),
        livesLost: 1,
        amount: penaltyAmount,
        burpees: burpees > 0 ? burpees : undefined,
        loggedBy,
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

  const markPaid = async (penaltyId: string) => {
    setPayingId(penaltyId);
    try {
      await markPenaltyPaid(challenge.id, p.uid, penaltyId);
      notify.success("Штраф отмечен как оплаченный");
    } catch (err) {
      console.error("[DayScreen] markPenaltyPaid failed:", err);
      notify.error("Не удалось отметить оплату.");
    } finally {
      setPayingId(null);
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

      {unpaid.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-[13px] font-medium text-muted-foreground">Не оплачено</h3>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {unpaid.map(pen => (
              <li key={pen.penaltyId ?? `${pen.date}-${pen.reason}`} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{pen.reason}</p>
                  <p className="text-[13px] text-muted-foreground tabular">
                    {[pen.amount > 0 ? formatMoney(pen.amount, currency) : null, (pen.burpees ?? 0) > 0 ? `${pen.burpees} бёрпи` : null]
                      .filter(Boolean).join(" или ")}
                  </p>
                </div>
                {pen.penaltyId && (
                  <Button size="sm" onClick={() => markPaid(pen.penaltyId!)} loading={payingId === pen.penaltyId}>
                    Отметить оплату
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submitPenalty} className="mt-6">
        <h3 className="text-[15px] font-semibold">Штраф</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{penaltyParts}</p>
        <div className="mt-3 flex flex-col gap-3">
          <Field label="Причина">
            {({ id }) => (
              <Input id={id} value={reason} onChange={e => setReason(e.target.value)} placeholder="Например: пропуск пробежки" autoComplete="off" />
            )}
          </Field>
          <Button type="submit" variant="secondary" block loading={savingPenalty} disabled={!reason.trim()}>
            Записать штраф
          </Button>
        </div>
      </form>

      <form onSubmit={submitPostpone} className="mt-7 border-t border-border pt-6">
        <h3 className="text-[15px] font-semibold">Перенос</h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">День не будет считаться пропуском</p>
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
    </Sheet>
  );
}
