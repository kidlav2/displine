import { BRAND_COLOR } from "../../constants/design";
import { convertTime } from "../../lib/timezone";

interface DualTimestampProps {
  time: string;
  participantTz: string;
  adminTz: string;
  label?: boolean;
}

export function DualTimestamp({ time, participantTz, adminTz, label = true }: DualTimestampProps) {
  if (!time || time === "—") return <span className="text-muted-foreground text-xs font-mono">—</span>;
  const adminTime = convertTime(time, participantTz, adminTz);
  const same = time === adminTime;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-mono font-bold">{time}</span>
        {label && <span className="text-muted-foreground">участник</span>}
      </div>
      {!same && (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-mono font-bold" style={{ color: BRAND_COLOR }}>{adminTime}</span>
          {label && <span className="text-muted-foreground">ваше время</span>}
        </div>
      )}
    </div>
  );
}
