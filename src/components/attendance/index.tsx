import { Check, MoveRight, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { expectedRun, expectedTask, postponementAway } from "../../lib/attendance";
import type { AttendanceStatus, IssuedTaskDay, Participant, PostponementRequest } from "../../types";

// ── Day status (grid cells, profile history) ─────────────────────────────────

export type DayKind = "done" | "partial" | "missed" | "postponed" | "pending" | "future" | "none";

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  done: "всё выполнено",
  partial: "выполнено частично",
  missed: "пропуск",
  postponed: "перенос",
  pending: "не отмечено",
  future: "впереди",
  none: "нет заданий",
};

export function dayKind(
  p: Participant,
  iso: string,
  todayISO: string,
  runSchedule: Record<string, string>,
  issuedTaskDays: Record<string, IssuedTaskDay> | undefined,
  postponements: PostponementRequest[],
): DayKind {
  const away = postponementAway(postponements, p.uid, iso, "running") || postponementAway(postponements, p.uid, iso, "task");
  const needRun = expectedRun(iso, p.uid, runSchedule, postponements);
  const needTask = expectedTask(iso, p.uid, issuedTaskDays, postponements);
  if (away) return "postponed";
  if (!needRun && !needTask) return "none";

  const statuses = [needRun && p.days?.[iso]?.run, needTask && p.days?.[iso]?.task].filter(s => s !== false);
  if (statuses.includes("missed")) return "missed";
  const done = statuses.filter(s => s === "done").length;
  if (done === statuses.length) return "done";
  if (done > 0) return "partial";
  return iso > todayISO ? "future" : "pending";
}

const CELL: Record<DayKind, string> = {
  done: "bg-success text-white",
  partial: "bg-success-muted",
  missed: "bg-danger text-white",
  postponed: "bg-postpone text-white",
  pending: "shadow-[inset_0_0_0_1.5px_var(--control-border)]",
  future: "shadow-[inset_0_0_0_1px_var(--border)]",
  none: "",
};

/** The colored square used by the grid and the participant history. Icons back up color for missed/postponed. */
export function DayCellVisual({ kind, size = 26, icons = "status", className }: {
  kind: DayKind;
  size?: number;
  icons?: "status" | "all";
  className?: string;
}) {
  const iconSize = Math.round(size * 0.5);
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-md", CELL[kind], className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {kind === "missed" && <X size={iconSize} strokeWidth={3} />}
      {kind === "postponed" && <MoveRight size={iconSize} strokeWidth={2.75} />}
      {kind === "done" && icons === "all" && <Check size={iconSize} strokeWidth={3} />}
      {kind === "none" && <span className="size-[3px] rounded-full bg-border-strong" />}
    </span>
  );
}

export function DayLegend({ className }: { className?: string }) {
  const items: DayKind[] = ["done", "partial", "missed", "postponed", "pending", "none"];
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-muted-foreground", className)}>
      {items.map(k => (
        <li key={k} className="inline-flex items-center gap-2">
          <DayCellVisual kind={k} size={16} className="rounded-[4px]" />
          {DAY_KIND_LABEL[k]}
        </li>
      ))}
    </ul>
  );
}

// ── Mark button (Day screen) ─────────────────────────────────────────────────

const STATUS_TEXT = { done: "выполнено", missed: "пропуск" } as const;

interface MarkButtonProps {
  status?: AttendanceStatus;
  onClick: () => void;
  /** e.g. "Айдар, пробежка" — announced together with the state. */
  label: string;
}

export function MarkButton({ status, onClick, label }: MarkButtonProps) {
  const state = status ? STATUS_TEXT[status] : "не отмечено";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${state}`}
      title={`${label}: ${state}`}
      className={cn(
        "pressable relative inline-flex size-10 items-center justify-center rounded-[10px] border-[1.5px]",
        "after:absolute after:-inset-1 after:content-['']",
        status === "done" && "border-success bg-success text-white",
        status === "missed" && "border-danger bg-danger text-white",
        !status && "border-control-border text-transparent hover:bg-hover",
      )}
    >
      {status === "missed"
        ? <X size={20} strokeWidth={2.75} aria-hidden />
        : <Check size={20} strokeWidth={2.75} aria-hidden className={cn(!status && "opacity-0")} />}
    </button>
  );
}

/** Placeholder for a column that doesn't apply to this person today. */
export function MarkPlaceholder({ postponedTo }: { postponedTo?: string }) {
  if (postponedTo) {
    return (
      <span
        className="inline-flex size-10 items-center justify-center rounded-[10px] bg-postpone-subtle text-postpone-text"
        title={`Перенесено на ${postponedTo}`}
      >
        <MoveRight size={18} strokeWidth={2.5} aria-hidden />
        <span className="sr-only">Перенесено на {postponedTo}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex size-10 items-center justify-center text-subtle-foreground">
      <span aria-hidden>—</span>
      <span className="sr-only">Не требуется</span>
    </span>
  );
}
