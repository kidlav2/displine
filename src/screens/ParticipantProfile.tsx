import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { useNavigate, useParams } from "react-router";
import { Check, Plus, Trash2, UserX } from "lucide-react";
import {
  Badge, Button, ConfirmDialog, EmptyState, Field, Hearts, IconButton, Input, Page, PageHeader, PageSpinner, RoleBadge, Section, Sheet, Textarea,
} from "../components/atoms";
import { DayLegend, DAY_KIND_LABEL, dayKind, type DayKind } from "../components/attendance";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { disciplineStats, unpaidPenalties } from "../lib/attendance";
import { challengeDayISO, weekdayFromISO } from "../lib/dates";
import { deletePenalty, logPenalty, markPenaltyPaid, saveOrgNote, type FeedActor } from "../lib/firestore";
import { formatDateLong, formatDateShort, formatMoney } from "../lib/format";
import { cn } from "../lib/cn";
import { notify } from "../lib/notify";
import { useDocumentTitle } from "../lib/useDocumentTitle";
import type { ChallengeData, Participant, Penalty } from "../types";

export function ParticipantProfile() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { challenge, loading, postponements, orgNotes, meParticipant } = useAppContext();
  const { currentUser } = useAuthContext();
  const participant = challenge?.participants.find(p => p.uid === uid);
  useDocumentTitle(participant?.name);

  const [penaltyOpen, setPenaltyOpen] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Penalty | null>(null);
  const [deleting, setDeleting] = useState(false);

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate("/app/day"));

  // This route can be opened directly (deep link / refresh) before data arrives.
  if (loading || !challenge) return <PageSpinner />;

  if (!participant) {
    return (
      <Page width="sm">
        <PageHeader back={{ onClick: back }} title="Участник" />
        <EmptyState icon={<UserX />} title="Участник не найден" description="Возможно, его удалили из челленджа." />
      </Page>
    );
  }

  const actor: FeedActor | undefined = currentUser && meParticipant
    ? { uid: currentUser.uid, name: meParticipant.name, ini: meParticipant.ini, isAdmin: meParticipant.isAdmin }
    : undefined;

  const isRosterMember = participant.role === "participant";
  const stats = disciplineStats(participant, challenge.startDate, challenge.currentDay, challenge.settings, challenge.issuedTaskDays, postponements);
  const unpaid = unpaidPenalties(participant);
  const penalties = [...participant.penalties].sort((a, b) => Number(!!a.paid) - Number(!!b.paid) || (b.date > a.date ? 1 : -1));

  const markPaid = async (penaltyId: string) => {
    setPayingId(penaltyId);
    try {
      await markPenaltyPaid(challenge.id, participant.uid, penaltyId);
    } catch (err) {
      console.error("[ParticipantProfile] markPenaltyPaid failed:", err);
      notify.error("Не удалось отметить оплату.");
    } finally {
      setPayingId(null);
    }
  };

  return (
    <Page width="sm">
      <PageHeader
        back={{ onClick: back }}
        title={participant.name}
        description={participant.role === "participant" && participant.joinDate ? `В списке с ${participant.joinDate}` : undefined}
        actions={isRosterMember ? undefined : <RoleBadge role={participant.role} />}
      />

      <div className="space-y-8">
        <section aria-label="Сводка" className="rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3.5">
            <Hearts n={participant.lives} total={challenge.settings.startingLives} sz={18} />
            <p className="text-sm text-muted-foreground tabular">
              {participant.lives} из {challenge.settings.startingLives} {challenge.settings.startingLives === 1 ? "жизни" : "жизней"}
            </p>
            {!participant.active && <Badge tone="danger" className="ml-auto">Выбыл</Badge>}
          </div>
          <dl className="grid grid-cols-3 divide-x divide-border">
            <Stat label="Пробежки" value={stats.runTotal ? `${stats.runPct}%` : "—"} hint={`${stats.runDone} из ${stats.runTotal}`} />
            <Stat label="Задания" value={stats.taskTotal ? `${stats.taskPct}%` : "—"} hint={`${stats.taskDone} из ${stats.taskTotal}`} />
            <Stat
              label="Штрафы"
              value={String(participant.penalties.length)}
              hint={unpaid.length ? `${unpaid.length} не оплачено` : participant.penalties.length ? "все оплачены" : "нет"}
              tone={unpaid.length ? "warning" : undefined}
            />
          </dl>
        </section>

        {isRosterMember && (
          <Section title="Дни" description="Отметки меняются на экранах «День» и «Таблица»." grouped={false}>
            <div className="rounded-xl border border-border bg-card p-4">
              <DayCalendar p={participant} challenge={challenge} postponements={postponements} />
            </div>
            <DayLegend className="mt-3" />
          </Section>
        )}

        <Section
          title="Штрафы"
          action={
            <Button size="sm" variant="secondary" onClick={() => setPenaltyOpen(true)}>
              <Plus /> Записать
            </Button>
          }
        >
          {penalties.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Нарушений нет</p>
          ) : penalties.map((pen, i) => (
            <PenaltyRow
              key={pen.penaltyId ?? `${pen.date}-${i}`}
              pen={pen}
              currency={challenge.settings.currency}
              paying={payingId === pen.penaltyId}
              onMarkPaid={pen.penaltyId && !pen.paid ? () => markPaid(pen.penaltyId!) : undefined}
              onDelete={pen.penaltyId ? () => setToDelete(pen) : undefined}
            />
          ))}
        </Section>

        <NoteSection challengeId={challenge.id} uid={participant.uid} note={orgNotes[participant.uid] ?? ""} />
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={o => { if (!o && !deleting) setToDelete(null); }}
        title="Удалить штраф?"
        description={toDelete ? `«${toDelete.reason}». Жизнь вернётся участнику${toDelete.amount > 0 ? `, ${formatMoney(toDelete.amount, challenge.settings.currency)} уйдёт из кассы` : ""}.` : undefined}
        confirmLabel="Удалить"
        loading={deleting}
        onConfirm={async () => {
          if (!toDelete?.penaltyId) return;
          setDeleting(true);
          try {
            await deletePenalty(challenge.id, participant.uid, toDelete.penaltyId);
            notify.success("Штраф удалён");
            setToDelete(null);
          } catch (err) {
            console.error("[ParticipantProfile] deletePenalty failed:", err);
            notify.error("Не удалось удалить штраф.");
          } finally {
            setDeleting(false);
          }
        }}
      />

      {penaltyOpen && (
        <PenaltySheet
          challenge={challenge}
          participant={participant}
          actor={actor}
          loggedBy={currentUser?.uid ?? ""}
          onClose={() => setPenaltyOpen(false)}
        />
      )}
    </Page>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "warning" }) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tabular">{value}</dd>
      <dd className={cn("text-[13px] tabular", tone === "warning" ? "text-warning-text" : "text-subtle-foreground")}>{hint}</dd>
    </div>
  );
}

const CAL_CELL: Record<DayKind, string> = {
  done: "bg-success text-white",
  partial: "bg-success-muted text-foreground",
  missed: "bg-danger text-white",
  postponed: "bg-postpone text-white",
  pending: "shadow-[inset_0_0_0_1.5px_var(--control-border)] text-foreground",
  future: "text-subtle-foreground",
  none: "text-subtle-foreground",
};

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEK_LABELS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

/** Challenge days laid out as a Monday-first calendar. */
function DayCalendar({ p, challenge, postponements }: {
  p: Participant;
  challenge: ChallengeData;
  postponements: ReturnType<typeof useAppContext>["postponements"];
}) {
  const todayIso = challengeDayISO(challenge.startDate, challenge.currentDay || 1);
  const cells = useMemo(() => {
    const days = Array.from({ length: challenge.duration }, (_, i) => {
      const iso = challengeDayISO(challenge.startDate, i + 1);
      return { n: i + 1, iso, kind: dayKind(p, iso, todayIso, challenge.settings.runSchedule, challenge.issuedTaskDays, postponements) };
    });
    const lead = days.length ? WEEK.indexOf(weekdayFromISO(days[0].iso)) : 0;
    return [...Array.from({ length: Math.max(0, lead) }, () => null), ...days];
  }, [p, challenge, postponements, todayIso]);

  return (
    <div className="mx-auto max-w-[360px]">
      <div className="grid grid-cols-7 gap-1.5 pb-2" aria-hidden>
        {WEEK_LABELS.map(w => <span key={w} className="text-center text-xs text-subtle-foreground">{w}</span>)}
      </div>
      <ol className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => c === null ? (
          <li key={`lead-${i}`} aria-hidden />
        ) : (
          <li
            key={c.iso}
            title={`День ${c.n}, ${formatDateLong(c.iso)}: ${DAY_KIND_LABEL[c.kind]}`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-md text-[13px] font-medium tabular",
              CAL_CELL[c.kind],
              c.iso === todayIso && "outline-2 outline-offset-2 outline-brand",
            )}
          >
            <span aria-hidden>{Number(c.iso.slice(8, 10))}</span>
            <span className="sr-only">День {c.n}, {formatDateLong(c.iso)}: {DAY_KIND_LABEL[c.kind]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PenaltyRow({ pen, currency, paying, onMarkPaid, onDelete }: {
  pen: Penalty;
  currency: string;
  paying: boolean;
  onMarkPaid?: () => void;
  onDelete?: () => void;
}) {
  const cost = [
    pen.amount > 0 ? formatMoney(pen.amount, currency) : null,
    (pen.burpees ?? 0) > 0 ? `${pen.burpees} бёрпи` : null,
  ].filter(Boolean).join(" или ");
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] sm:text-sm">{pen.reason}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground tabular">
          {[pen.date.length === 10 ? formatDateShort(pen.date) : pen.date, cost, pen.livesLost > 0 ? `−${pen.livesLost} жизнь` : null]
            .filter(Boolean).join(" · ")}
        </p>
      </div>
      {pen.paid ? (
        <Badge tone="success" icon={<Check />}>Оплачен</Badge>
      ) : onMarkPaid ? (
        <Button size="sm" variant="secondary" onClick={onMarkPaid} loading={paying}>Отметить оплату</Button>
      ) : (
        <Badge tone="warning">Не оплачен</Badge>
      )}
      {onDelete && (
        <IconButton label={`Удалить штраф: ${pen.reason}`} size="sm" onClick={onDelete} className="-mr-1.5 hover:text-danger-text">
          <Trash2 />
        </IconButton>
      )}
    </div>
  );
}

function NoteSection({ challengeId, uid, note }: { challengeId: string; uid: string; note: string }) {
  const [draft, setDraft] = useState(note);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setDraft(note); }, [note]);
  const changed = draft.trim() !== note.trim();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveOrgNote(challengeId, uid, draft.trim());
      notify.success("Договорённость сохранена");
    } catch (err) {
      console.error("[ParticipantProfile] saveOrgNote failed:", err);
      notify.error("Не удалось сохранить договорённость.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Section title="Договорённость" description="Видна организаторам на экране «День»." grouped={false}>
      <form onSubmit={save} className="space-y-3">
        <Textarea
          aria-label="Договорённость"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="Например: бегает по субботам вместо воскресенья"
          rows={3}
        />
        {changed && (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDraft(note)} disabled={saving}>Отменить</Button>
            <Button size="sm" variant="primary" type="submit" loading={saving}>Сохранить</Button>
          </div>
        )}
      </form>
    </Section>
  );
}

function PenaltySheet({ challenge, participant, actor, loggedBy, onClose }: {
  challenge: ChallengeData;
  participant: Participant;
  actor?: FeedActor;
  loggedBy: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(true);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState(String(challenge.settings.penaltyAmount || 0));
  const [burpees, setBurpees] = useState(String(challenge.settings.burpees || 0));
  const [saving, setSaving] = useState(false);
  const close = () => { setOpen(false); setTimeout(onClose, 250); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSaving(true);
    try {
      const b = parseInt(burpees, 10) || 0;
      await logPenalty(challenge.id, participant.uid, {
        reason: reason.trim(),
        livesLost: 1,
        amount: parseInt(amount, 10) || 0,
        burpees: b > 0 ? b : undefined,
        loggedBy,
      }, actor, participant.name);
      notify.success("Штраф записан");
      close();
    } catch (err) {
      console.error("[ParticipantProfile] logPenalty failed:", err);
      notify.error("Не удалось записать штраф.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) close(); }} title="Записать штраф" description={`${participant.name} · спишется 1 жизнь`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Причина">
          {({ id }) => <Input id={id} value={reason} onChange={e => setReason(e.target.value)} placeholder="Например: пропуск пробежки" autoFocus autoComplete="off" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Сумма">
            {({ id }) => <Input id={id} type="number" inputMode="numeric" min={0} value={amount} onChange={e => setAmount(e.target.value)} suffix={challenge.settings.currency} />}
          </Field>
          <Field label="Или бёрпи">
            {({ id }) => <Input id={id} type="number" inputMode="numeric" min={0} value={burpees} onChange={e => setBurpees(e.target.value)} suffix="раз" />}
          </Field>
        </div>
        <Button type="submit" variant="primary" block loading={saving} disabled={!reason.trim()}>
          Записать штраф
        </Button>
      </form>
    </Sheet>
  );
}
