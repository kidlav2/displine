import { useEffect, useMemo, useState } from "react";
import type React from "react";
import { Button, Field, Input, Segmented, Select } from "./atoms";
import { recordPostponement, updatePostponement } from "../lib/firestore";
import { approvedPostponements, postponementAway, scheduledDates } from "../lib/attendance";
import { addDaysISO, datesInRange } from "../lib/dates";
import { formatDateLong, formatDateShort, formatWeekdayShort } from "../lib/format";
import { notify } from "../lib/notify";
import type { Participant, PostponementRequest } from "../types";

function dateLabel(iso: string): string {
  return `${formatDateShort(iso)} ${formatWeekdayShort(iso)}`;
}

export function PostponeForm({
  challengeId,
  participant,
  startDate,
  endDate,
  runSchedule,
  postponements,
  defaultFrom,
  editing,
  onCancelEdit,
}: {
  challengeId: string;
  participant: Pick<Participant, "uid" | "ini" | "name">;
  startDate: string;
  endDate: string;
  runSchedule: Record<string, string>;
  postponements: PostponementRequest[];
  defaultFrom: string;
  editing?: PostponementRequest | null;
  onCancelEdit?: () => void;
}) {
  const runDays = useMemo(
    () => scheduledDates(startDate, endDate, runSchedule),
    [startDate, endDate, runSchedule],
  );
  const allDays = useMemo(() => datesInRange(startDate, endDate), [startDate, endDate]);
  const defaultRun = runDays.find(d => d >= defaultFrom) ?? runDays[0] ?? defaultFrom;

  const [type, setType] = useState<"running" | "task">(editing?.type ?? "running");
  const [from, setFrom] = useState(editing?.dateISO ?? defaultRun);
  const [target, setTarget] = useState(editing?.targetDateISO ?? addDaysISO(defaultRun, 1));
  const [note, setNote] = useState(editing?.reason ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    setType(editing.type);
    setFrom(editing.dateISO);
    setTarget(editing.targetDateISO);
    setNote(editing.reason ?? "");
  }, [editing]);

  const fromDays = type === "running" && runDays.length > 0 ? runDays : allDays;
  const toDays = useMemo(() => datesInRange(addDaysISO(from, 1), endDate), [from, endDate]);
  const taken = postponementAway(postponements, participant.uid, from, type === "running" ? "running" : "task");
  const blocked = taken && taken.id !== editing?.id;
  const canSubmit = !!from && !!target && target > from && toDays.includes(target) && !blocked;

  const setFromDate = (next: string) => {
    setFrom(next);
    const nextTo = datesInRange(addDaysISO(next, 1), endDate);
    if (!target || target <= next || !nextTo.includes(target)) setTarget(nextTo[0] ?? "");
  };

  const reset = () => {
    setType("running");
    setFrom(defaultRun);
    setTarget(addDaysISO(defaultRun, 1));
    setNote("");
    onCancelEdit?.();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const payload = { type, dateISO: from, targetDateISO: target, reason: note.trim() };
    try {
      if (editing) await updatePostponement(challengeId, editing.id, payload);
      else await recordPostponement(challengeId, participant, payload);
      notify.success(`${type === "running" ? "Пробежка" : "Задание"}: ${formatDateLong(from)} → ${formatDateLong(target)}`);
      if (editing) reset();
      else setNote("");
    } catch (err) {
      console.error("[PostponeForm] failed:", err);
      notify.error("Не удалось сохранить перенос.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Segmented
        aria-label="Что переносим"
        value={type}
        onChange={v => {
          setType(v);
          if (v === "running" && runDays.length && !runDays.includes(from)) setFromDate(defaultRun);
        }}
        block
        options={[{ value: "running", label: "Пробежку" }, { value: "task", label: "Задание" }]}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="С даты">
          {({ id }) => (
            <Select id={id} value={fromDays.includes(from) ? from : fromDays[0] ?? ""} onChange={e => setFromDate(e.target.value)}>
              {fromDays.map(d => (
                <option key={d} value={d}>{dateLabel(d)}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="На дату">
          {({ id }) => (
            <Select id={id} value={toDays.includes(target) ? target : toDays[0] ?? ""} onChange={e => setTarget(e.target.value)} disabled={toDays.length === 0}>
              {toDays.map(d => (
                <option key={d} value={d}>{dateLabel(d)}</option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field label="Договорённость">
        {({ id }) => (
          <Input id={id} value={note} onChange={e => setNote(e.target.value)} autoComplete="off" />
        )}
      </Field>
      {blocked && (
        <p className="text-[13px] text-warning-text">Этот день уже перенесён</p>
      )}
      <div className="flex gap-2">
        {editing && (
          <Button type="button" variant="ghost" className="flex-1" onClick={reset} disabled={saving}>
            Отмена
          </Button>
        )}
        <Button type="submit" variant="secondary" className="flex-1" loading={saving} disabled={!canSubmit}>
          {editing ? "Сохранить" : "Перенести"}
        </Button>
      </div>
    </form>
  );
}

export function PostponeList({
  items,
  busyId,
  editingId,
  onEdit,
  onCancel,
}: {
  items: PostponementRequest[];
  busyId?: string | null;
  editingId?: string | null;
  onEdit: (item: PostponementRequest) => void;
  onCancel: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {items.map(x => (
        <li key={x.id} className="flex flex-wrap items-center gap-2 py-2 ps-3 pe-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              {x.type === "running" ? "Пробежка" : "Задание"} · {formatDateLong(x.dateISO)} → {formatDateLong(x.targetDateISO)}
            </p>
            {x.reason && <p className="truncate text-[13px] text-muted-foreground">{x.reason}</p>}
          </div>
          <Button
            size="sm"
            variant={editingId === x.id ? "secondary" : "ghost"}
            onClick={() => onEdit(x)}
          >
            Изменить
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busyId === x.id}
            onClick={() => onCancel(x.id)}
          >
            Отменить
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function personPostponements(list: PostponementRequest[], uid: string): PostponementRequest[] {
  return approvedPostponements(list)
    .filter(x => x.participantUid === uid)
    .sort((a, b) => a.dateISO.localeCompare(b.dateISO) || a.targetDateISO.localeCompare(b.targetDateISO));
}
