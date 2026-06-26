import { SCORE } from "../constants/scoring";
import type { DayResult } from "../types";

export function calcScore(results: DayResult[]): number {
  return results.reduce((acc, r) => acc + SCORE[r.scoreKey], 0);
}
