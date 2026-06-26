import type { ScoreKey } from "../types";

export const SCORE: Record<ScoreKey, number> = {
  running_on_time: 2,
  running_late:    1,
  task_completed:  5,
  missed:          0,
} as const;
