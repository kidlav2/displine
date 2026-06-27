import type { Achievement, ChallengeData, Participant } from "../types";

/** Returns true if the participant has unlocked this achievement based on their data. */
export function checkAchievement(
  ach: Achievement,
  p: Participant,
  challenge: ChallengeData
): boolean {
  const t = ach.conditionThreshold ?? 0;
  switch (ach.conditionType) {
    case "km_total":
      return p.km >= t;
    case "tasks_total":
      return p.results.filter(r => r.scoreKey === "task_completed").length >= t;
    case "streak": {
      let max = 0, cur = 0;
      for (const r of p.results) {
        if (r.scoreKey !== "missed") { cur++; if (cur > max) max = cur; }
        else cur = 0;
      }
      return max >= t;
    }
    case "days_half":
      return challenge.currentDay >= Math.floor(challenge.duration / 2);
    case "first_week":
      return p.results.filter(r => r.scoreKey !== "missed").length >= 7;
    case "custom":
      return false;
    default:
      return false;
  }
}
