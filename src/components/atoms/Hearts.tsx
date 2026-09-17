import { Heart } from "lucide-react";
import { cn } from "../../lib/cn";

interface HeartsProps { n: number; total?: number; sz?: number; className?: string; }

/** Full row of hearts — for profiles and settings, where there is room. */
export function Hearts({ n, total = 5, sz = 16, className }: HeartsProps) {
  const count = Math.max(total, n);
  return (
    <span role="img" aria-label={`Жизни: ${n} из ${total}`} className={cn("inline-flex gap-0.5", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Heart
          key={i}
          size={sz}
          strokeWidth={2}
          aria-hidden
          className={i < n ? "fill-danger text-danger" : "fill-transparent text-border-strong"}
        />
      ))}
    </span>
  );
}

/** Compact "♥ 4" — for dense lists. */
export function Lives({ n, total, className }: { n: number; total?: number; className?: string }) {
  const out = n <= 0;
  return (
    <span
      role="img"
      aria-label={total ? `Жизни: ${n} из ${total}` : `Жизни: ${n}`}
      className={cn(
        "inline-flex items-center gap-1 text-[13px] font-medium tabular",
        out ? "text-subtle-foreground" : "text-muted-foreground",
        className,
      )}
    >
      <Heart size={13} strokeWidth={2.25} aria-hidden className={out ? "text-border-strong" : "fill-danger text-danger"} />
      <span>
        {n}
        {total ? <span className="text-subtle-foreground">/{total}</span> : null}
      </span>
    </span>
  );
}
