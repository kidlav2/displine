import type { ScoreKey, ScoringConfig } from "../types";

export const SCORE: Record<ScoreKey, number> = {
  running_on_time: 2,
  running_late:    1,
  task_completed:  5,
  missed:          0,
} as const;

/** Factory default scoring — used when no per-challenge scoring is configured. */
export const DEFAULT_SCORING: ScoringConfig = [
  { key: "running_on_time", label: "Пробежка вовремя", points: 2 },
  { key: "running_late",    label: "Пробежка с оп.",   points: 1 },
  { key: "task_completed",  label: "Задание выполнено", points: 5 },
];

/** Parse raw Firestore scoring value — handles both legacy object format and new array format. */
export function parseScoring(raw: unknown): ScoringConfig {
  if (Array.isArray(raw) && raw.length > 0) return raw as ScoringConfig;
  // Legacy: { runOnTime, runLate, taskCompleted, missed }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, number>;
    return [
      { key: "running_on_time", label: "Пробежка вовремя", points: o.runOnTime     ?? 2 },
      { key: "running_late",    label: "Пробежка с оп.",   points: o.runLate       ?? 1 },
      { key: "task_completed",  label: "Задание выполнено", points: o.taskCompleted ?? 5 },
    ];
  }
  return DEFAULT_SCORING;
}
