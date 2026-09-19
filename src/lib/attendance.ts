import { challengeDayISO, weekdayFromISO } from "./dates";
import type {
  AttendanceStatus, ChallengeSettings, IssuedTaskDay, Participant, PostponementRequest,
} from "../types";

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase() || "??";
}

export function rosterParticipants(participants: Participant[]): Participant[] {
  return participants.filter(p => p.role === "participant");
}

export function isScheduledRunDay(iso: string, runSchedule: Record<string, string>): boolean {
  return !!iso && weekdayFromISO(iso) in runSchedule;
}

export function isTaskIssued(iso: string, issuedTaskDays: Record<string, IssuedTaskDay> | undefined): boolean {
  return !!issuedTaskDays?.[iso]?.issued;
}

/** Tap cycle on the day list: came → late → absent → clear. */
export function nextAttendanceStatus(cur?: AttendanceStatus): AttendanceStatus | undefined {
  if (!cur) return "done";
  if (cur === "done") return "late";
  if (cur === "late") return "missed";
  return undefined;
}

export function isAttendanceComplete(status?: AttendanceStatus): boolean {
  return status === "done" || status === "late";
}

export function attendancePenaltySource(kind: "run" | "task", iso: string): string {
  return `attendance:${kind}:${iso}`;
}

export function absenceReason(kind: "run" | "task"): string {
  return kind === "run" ? "Пропуск пробежки" : "Задание не сдано";
}

export function approvedPostponements(list: PostponementRequest[]): PostponementRequest[] {
  return list.filter(p => p.status === "approved");
}

export function postponementAway(
  list: PostponementRequest[],
  uid: string,
  dateISO: string,
  type: "running" | "task",
): PostponementRequest | undefined {
  return approvedPostponements(list).find(
    p => p.participantUid === uid && p.dateISO === dateISO && p.type === type,
  );
}

export function postponementOnto(
  list: PostponementRequest[],
  uid: string,
  dateISO: string,
  type: "running" | "task",
): PostponementRequest | undefined {
  return approvedPostponements(list).find(
    p => p.participantUid === uid && p.targetDateISO === dateISO && p.type === type,
  );
}

export function expectedRun(
  iso: string,
  uid: string,
  runSchedule: Record<string, string>,
  postponements: PostponementRequest[],
): boolean {
  if (postponementAway(postponements, uid, iso, "running")) return false;
  if (postponementOnto(postponements, uid, iso, "running")) return true;
  return isScheduledRunDay(iso, runSchedule);
}

export function expectedTask(
  iso: string,
  uid: string,
  issuedTaskDays: Record<string, IssuedTaskDay> | undefined,
  postponements: PostponementRequest[],
): boolean {
  if (postponementAway(postponements, uid, iso, "task")) return false;
  if (postponementOnto(postponements, uid, iso, "task")) return true;
  return isTaskIssued(iso, issuedTaskDays);
}

export function unpaidPenalties(p: Participant) {
  return (p.penalties ?? []).filter(x => !x.paid && (x.amount > 0 || (x.burpees ?? 0) > 0 || x.livesLost > 0));
}

export interface DisciplineStats {
  runDone: number;
  runTotal: number;
  taskDone: number;
  taskTotal: number;
  runPct: number;
  taskPct: number;
}

export function disciplineStats(
  p: Participant,
  startDate: string,
  throughDay: number,
  settings: ChallengeSettings,
  issuedTaskDays: Record<string, IssuedTaskDay> | undefined,
  postponements: PostponementRequest[],
): DisciplineStats {
  let runDone = 0, runTotal = 0, taskDone = 0, taskTotal = 0;
  const last = Math.max(0, throughDay);
  for (let day = 1; day <= last; day++) {
    const iso = challengeDayISO(startDate, day);
    if (!iso) continue;
    if (expectedRun(iso, p.uid, settings.runSchedule, postponements)) {
      runTotal++;
      if (isAttendanceComplete(p.days?.[iso]?.run)) runDone++;
    }
    if (expectedTask(iso, p.uid, issuedTaskDays, postponements)) {
      taskTotal++;
      if (isAttendanceComplete(p.days?.[iso]?.task)) taskDone++;
    }
  }
  return {
    runDone, runTotal, taskDone, taskTotal,
    runPct: runTotal > 0 ? Math.round((runDone / runTotal) * 100) : 0,
    taskPct: taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0,
  };
}

export function formatDayShort(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${Number(d)} ${["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"][Number(m) - 1] ?? m}`;
}

export function weekdayRuFromISO(iso: string): string {
  const key = weekdayFromISO(iso);
  return ({ Mon: "Понедельник", Tue: "Вторник", Wed: "Среда", Thu: "Четверг", Fri: "Пятница", Sat: "Суббота", Sun: "Воскресенье" } as Record<string, string>)[key] ?? key;
}

export function weekdayRuShort(iso: string): string {
  const key = weekdayFromISO(iso);
  return ({ Mon: "Пн", Tue: "Вт", Wed: "Ср", Thu: "Чт", Fri: "Пт", Sat: "Сб", Sun: "Вс" } as Record<string, string>)[key] ?? key;
}
