import { Zap } from "lucide-react";
import { SCORE } from "../../constants/scoring";
import { BRAND_COLOR, BRAND_TINT } from "../../constants/design";
import type { ScoreKey } from "../../types";

interface ScorePillProps { scoreKey: ScoreKey | null; }

export function ScorePill({ scoreKey }: ScorePillProps) {
  if (!scoreKey || scoreKey === "missed") return null;
  const pts = SCORE[scoreKey];
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full"
      style={{ background: BRAND_TINT, color: BRAND_COLOR }}
    >
      <Zap size={9} /> +{pts} оч.
    </span>
  );
}
