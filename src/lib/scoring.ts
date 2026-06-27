import { DEFAULT_SCORING } from "../constants/scoring";
import type { DayResult, ScoringConfig } from "../types";

/** Calculate total score using per-challenge scoring config, falling back to defaults. */
export function calcScore(results: DayResult[], scoring?: ScoringConfig): number {
  const s = scoring ?? DEFAULT_SCORING;
  return results.reduce((acc, r) => {
    const entry = s.find(e => e.key === r.scoreKey);
    return acc + (entry?.points ?? 0);
  }, 0);
}
