import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Navigate, useParams } from "react-router";
import { signOut } from "firebase/auth";
import { Check, Clock, Footprints, ListChecks, LogOut, MoveRight } from "lucide-react";
import { auth } from "../lib/firebase";
import {
  subscribeToChallengeDoc, requestSelfPostponement, selfMark, subscribeToMyLink, subscribeToMyPostponements, subscribeToParticipant,
} from "../lib/firestore";
import { expectedRun, expectedTask, postponementAway, scheduledDates, unpaidPenalties } from "../lib/attendance";
import { addDaysISO, datesInRange, todayISOInTz, weekdayFromISO } from "../lib/dates";
import { formatDateShort, formatMoney, formatWeekdayDate, formatWeekdayShort } from "../lib/format";
import { notify } from "../lib/notify";
import { cn } from "../lib/cn";
import { useAuthContext } from "../contexts/AuthContext";
import { AuthLayout, AuthMessage } from "../components/AuthLayout";
import { LateRunDialog } from "../components/attendance";
import { Badge, Button, Field, Input, Lives, Logo, Segmented, Select, Spinner } from "../components/atoms";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { AttendanceStatus, IssuedTaskDay, Participant, PostponementRequest } from "../types";

/** The slice of the challenge doc a participant needs. */
interface MyChallenge {
  name: string;
  emoji: string;
  startDate: string;
  endDate: string;
  duration: number;
  runSchedule: Record<string, string>;
  penaltyAmount: number;
  burpees: number;
  currency: string;
  taskDeadline: string;
  startingLives: number;
  issuedTaskDays: Record<string, IssuedTaskDay>;
}

function isoOf(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v && typeof v === "object" && "toDate" in v) return (v as { toDate(): Date }).toDate().toISOString().slice(0, 10);
  return "";
}

const STATUS_TEXT: Record<AttendanceStatus, string> = { done: "Выполнено", late: "С опозданием", missed: "Пропуск" };

export function MyDayScreen() {
  const { challengeId = "" } = useParams();
  const { currentUser } = useAuthContext();
  const uid = currentUser?.uid ?? "";
  useDocumentTitle("Мой день");

  const [pid, setPid] = useState<string | null | undefined>(undefined);
  const [challenge, setChallenge] = useState<MyChallenge | null | undefined>(undefined);
  const [me, setMe] = useState<Participant | null | undefined>(undefined);
  const [postponements, setPostponements] = useState<PostponementRequest[]>([]);

  useEffect(() => subscribeToMyLink(challengeId, uid, setPid), [challengeId, uid]);
  useEffect(() => {
    if (!pid) return;
    const unsubC = subscribeToChallengeDoc(challengeId, d => {
      if (!d) { setChallenge(null); return; }
      const start = isoOf(d.startDate);
      const duration = Number(d.duration) || 30;
      setChallenge({
        name: d.name ?? "",
        emoji: d.emoji ?? "🏃",
        startDate: start,
        endDate: isoOf(d.endDate) || addDaysISO(start, duration - 1),
        duration,
        runSchedule: d.settings?.runSchedule ?? {},
        penaltyAmount: Number(d.settings?.penaltyAmount) || 0,
        burpees: Number(d.settings?.burpees) || 0,
        currency: d.settings?.currency ?? "₸",
        taskDeadline: d.settings?.taskDeadline ?? "10:00",
        startingLives: Number(d.settings?.startingLives) || 3,
        issuedTaskDays: d.issuedTaskDays ?? {},
      });
    });
    const unsubP = subscribeToParticipant(challengeId, pid, setMe);
    const unsubPp = subscribeToMyPostponements(challengeId, pid, setPostponements);
    return () => { unsubC(); unsubP(); unsubPp(); };
  }, [challengeId, pid]);

  if (pid === undefined) return <Centered />;
  if (pid === null) {
    return (
      <AuthLayout>
        <AuthMessage
          icon={<Clock />}
          title="Заявка ещё не подтверждена"
          description="Когда организатор привяжет ваш аккаунт к имени в списке, здесь появятся отметки на сегодня."
        >
          <Button variant="ghost" size="lg" block onClick={() => signOut(auth)}>Выйти из аккаунта</Button>
        </AuthMessage>
      </AuthLayout>
    );
  }
  if (challenge === undefined || me === undefined) return <Centered />;
  if (!challenge || !me) return <Navigate to="/" replace />;

  return <MyDay challengeId={challengeId} challenge={challenge} me={me} postponements={postponements} />;
}

function MyDay({ challengeId, challenge, me, postponements }: {
  challengeId: string;
  challenge: MyChallenge;
  me: Participant;
  postponements: PostponementRequest[];
}) {
  const today = todayISOInTz(me.tz || "Asia/Almaty");
  const running = today >= challenge.startDate && today <= challenge.endDate;
  const dayNum = Math.floor((Date.parse(today) - Date.parse(challenge.startDate)) / 86_400_000) + 1;
  const firstName = me.name.split(" ")[0];
  const day = me.days?.[today] ?? {};
  const needRun = running && expectedRun(today, me.uid, challenge.runSchedule, postponements);
  const needTask = running && expectedTask(today, me.uid, challenge.issuedTaskDays, postponements);
  const runAway = postponementAway(postponements, me.uid, today, "running");
  const taskAway = postponementAway(postponements, me.uid, today, "task");
  const unpaid = unpaidPenalties(me);
  const owedMoney = unpaid.reduce((s, p) => s + (p.amount ?? 0), 0);
  const owedBurpees = unpaid.reduce((s, p) => s + (p.burpees ?? 0), 0);

  const [busy, setBusy] = useState<string | null>(null);
  const [lateOpen, setLateOpen] = useState(false);

  const mark = async (kind: "run" | "task", status: "done" | "late" | null, tier?: "short" | "long") => {
    setBusy(kind);
    try {
      await selfMark({ challengeId, kind, status, tier });
      if (status) notify.success(kind === "run" ? "Пробежка отмечена" : "Задание отмечено");
    } catch (err) {
      notify.error(err instanceof Error ? err.message.replace(/^.*?:\s*/, "") : "Не получилось отметить.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-14 max-w-[560px] items-center justify-between px-4">
        <Logo />
        <Button variant="ghost" size="sm" onClick={() => signOut(auth)} aria-label="Выйти">
          <LogOut /> Выйти
        </Button>
      </header>

      <main className="mx-auto max-w-[560px] px-4 pb-12 pt-2">
        <p className="truncate text-[13px] font-medium text-muted-foreground">{challenge.emoji} {challenge.name}</p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em]">{firstName}, привет</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted-foreground">
          <span>{formatWeekdayDate(today)}</span>
          {running && <span className="tabular">день {dayNum} из {challenge.duration}</span>}
          <Lives n={me.lives} total={challenge.startingLives} />
        </div>

        {!running ? (
          <p className="mt-6 rounded-xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
            {today < challenge.startDate
              ? `Челлендж начнётся ${formatDateShort(challenge.startDate)}. Отметки откроются в первый день.`
              : "Челлендж закончился. Спасибо, что были с нами!"}
          </p>
        ) : (
          <section aria-label="Сегодня" className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
            <TodayRow
              icon={<Footprints />}
              title="Пробежка"
              meta={needRun
                ? `до ${challenge.runSchedule[weekdayFromISO(today)] ?? "конца дня"}`
                : runAway ? `перенесена на ${formatDateShort(runAway.targetDateISO)}` : "сегодня нет"}
              status={day.run}
              bySelf={day.runBy === "self"}
              enabled={needRun}
              busy={busy === "run"}
              doneLabel="Пробежал"
              onDone={() => mark("run", "done")}
              onLate={() => setLateOpen(true)}
              onClear={() => mark("run", null)}
            />
            <TodayRow
              icon={<ListChecks />}
              title="Задание"
              meta={needTask
                ? `до ${challenge.issuedTaskDays[today]?.deadline ?? challenge.taskDeadline}`
                : taskAway ? `перенесено на ${formatDateShort(taskAway.targetDateISO)}` : "сегодня нет"}
              detail={needTask ? challenge.issuedTaskDays[today]?.title : undefined}
              status={day.task}
              bySelf={day.taskBy === "self"}
              enabled={needTask}
              busy={busy === "task"}
              doneLabel="Сделал"
              onDone={() => mark("task", "done")}
              onClear={() => mark("task", null)}
            />
          </section>
        )}

        {unpaid.length > 0 && (
          <section aria-labelledby="debt-title" className="mt-8">
            <h2 id="debt-title" className="mb-3 px-0.5 text-[15px] font-semibold">Штрафы к оплате</h2>
            <div className="rounded-xl border border-border bg-card">
              <p className="border-b border-border px-4 py-3 text-lg font-semibold text-warning-text tabular">
                {[owedMoney > 0 ? formatMoney(owedMoney, challenge.currency) : null, owedBurpees > 0 ? `${owedBurpees} бёрпи` : null].filter(Boolean).join(" · ")}
              </p>
              <ul className="divide-y divide-border">
                {unpaid.map((p, i) => (
                  <li key={p.penaltyId ?? i} className="px-4 py-2.5 text-sm">
                    <span className="block">{p.reason}</span>
                    <span className="text-[13px] text-muted-foreground tabular">
                      {[p.date.length === 10 ? formatDateShort(p.date) : null,
                        p.amount > 0 ? formatMoney(p.amount, challenge.currency) : null,
                        (p.burpees ?? 0) > 0 ? `${p.burpees} бёрпи` : null].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {running && (
          <PostponeRequest challengeId={challengeId} challenge={challenge} today={today} postponements={postponements} />
        )}
      </main>

      <LateRunDialog
        open={lateOpen}
        name={firstName}
        burpees={challenge.burpees}
        amount={challenge.penaltyAmount}
        currency={challenge.currency}
        current={null}
        onOpenChange={setLateOpen}
        onPick={tier => { setLateOpen(false); void mark("run", "late", tier); }}
      />
    </div>
  );
}

function TodayRow({ icon, title, meta, detail, status, bySelf, enabled, busy, doneLabel, onDone, onLate, onClear }: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  detail?: string;
  status?: AttendanceStatus;
  bySelf: boolean;
  enabled: boolean;
  busy: boolean;
  doneLabel: string;
  onDone: () => void;
  onLate?: () => void;
  onClear: () => void;
}) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground [&_svg]:size-5" aria-hidden>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-semibold">{title}</p>
          <p className="text-[13px] text-muted-foreground">{meta}</p>
        </div>
        {status && (
          <Badge tone={status === "done" ? "success" : status === "late" ? "warning" : "danger"} icon={status === "late" ? <Clock /> : <Check />}>
            {STATUS_TEXT[status]}
          </Badge>
        )}
      </div>

      {detail && <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted px-3 py-2.5 text-sm">{detail}</p>}

      {enabled && !status && (
        <div className={cn("mt-3 grid gap-2", onLate ? "grid-cols-[1fr_auto]" : "grid-cols-1")}>
          <Button variant="primary" size="lg" onClick={onDone} loading={busy}>
            {!busy && <Check />} {doneLabel}
          </Button>
          {onLate && <Button variant="secondary" size="lg" onClick={onLate} disabled={busy}><Clock /> Опоздал</Button>}
        </div>
      )}

      {status && (
        <div className="mt-2 flex items-center justify-between gap-3 text-[13px] text-muted-foreground">
          <span>{bySelf ? "Вы отметили сами" : "Отметил организатор"}</span>
          {bySelf && (
            <Button variant="ghost" size="sm" onClick={onClear} loading={busy} className="-mr-2">Отменить</Button>
          )}
        </div>
      )}
    </div>
  );
}

const PP_STATUS: Record<PostponementRequest["status"], { text: string; tone: "neutral" | "success" | "danger" }> = {
  pending: { text: "Ждёт ответа", tone: "neutral" },
  approved: { text: "Одобрен", tone: "success" },
  rejected: { text: "Отклонён", tone: "danger" },
};

function PostponeRequest({ challengeId, challenge, today, postponements }: {
  challengeId: string;
  challenge: MyChallenge;
  today: string;
  postponements: PostponementRequest[];
}) {
  const runDays = useMemo(
    () => scheduledDates(today, challenge.endDate, challenge.runSchedule),
    [today, challenge.endDate, challenge.runSchedule],
  );
  const allDays = useMemo(() => datesInRange(today, challenge.endDate), [today, challenge.endDate]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"running" | "task">("running");
  const fromDays = type === "running" ? runDays : allDays;
  const [from, setFrom] = useState(fromDays[0] ?? today);
  const [target, setTarget] = useState(addDaysISO(fromDays[0] ?? today, 1));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const toDays = useMemo(() => datesInRange(addDaysISO(from, 1), challenge.endDate), [from, challenge.endDate]);
  const recent = postponements.filter(p => p.targetDateISO >= today || p.status === "pending").slice(0, 5);

  useEffect(() => {
    if (!fromDays.includes(from)) setFrom(fromDays[0] ?? today);
  }, [fromDays, from, today]);
  useEffect(() => {
    if (target <= from) setTarget(addDaysISO(from, 1));
  }, [from, target]);

  const label = (iso: string) =>
    iso === today ? "Сегодня" : `${formatDateShort(iso)} ${formatWeekdayShort(iso)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await requestSelfPostponement({ challengeId, type, dateISO: from, targetDateISO: target, reason });
      notify.success("Запрос отправлен организатору");
      setReason("");
      setOpen(false);
    } catch (err) {
      notify.error(err instanceof Error ? err.message.replace(/^.*?:\s*/, "") : "Не удалось отправить запрос.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="pp-title" className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-4 px-0.5">
        <h2 id="pp-title" className="text-[15px] font-semibold">Перенос</h2>
        {!open && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><MoveRight /> Попросить перенос</Button>}
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-4">
          <Segmented
            aria-label="Что перенести"
            block
            value={type}
            onChange={setType}
            options={[{ value: "running", label: "Пробежку" }, { value: "task", label: "Задание" }]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="С даты">
              {({ id }) => (
                <Select id={id} value={from} onChange={e => setFrom(e.target.value)}>
                  {fromDays.map(d => <option key={d} value={d}>{label(d)}</option>)}
                </Select>
              )}
            </Field>
            <Field label="На дату">
              {({ id }) => (
                <Select id={id} value={target} onChange={e => setTarget(e.target.value)} disabled={toDays.length === 0}>
                  {toDays.map(d => <option key={d} value={d}>{label(d)}</option>)}
                </Select>
              )}
            </Field>
          </div>
          <Field label="Причина">
            {({ id }) => <Input id={id} value={reason} onChange={e => setReason(e.target.value)} placeholder="Например: командировка" required />}
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Отмена</Button>
            <Button type="submit" variant="primary" loading={saving} disabled={!reason.trim() || toDays.length === 0 || fromDays.length === 0}>
              Отправить
            </Button>
          </div>
        </form>
      )}

      {recent.length > 0 && (
        <ul className={cn("divide-y divide-border rounded-xl border border-border bg-card", open && "mt-3")}>
          {recent.map(p => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {p.type === "running" ? "Пробежка" : "Задание"} · {formatDateShort(p.dateISO)} → {formatDateShort(p.targetDateISO)}
                </p>
                {p.reason && <p className="truncate text-[13px] text-muted-foreground">{p.reason}</p>}
              </div>
              <Badge tone={PP_STATUS[p.status].tone}>{PP_STATUS[p.status].text}</Badge>
            </li>
          ))}
        </ul>
      )}
      {!open && recent.length === 0 && (
        <p className="px-0.5 text-[13px] text-muted-foreground">Не можете пробежать в свой день — попросите перенести. Организатор подтвердит.</p>
      )}
    </section>
  );
}

function Centered() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner />
    </div>
  );
}
