import { cn } from "../../lib/cn";

interface LogoProps {
  size?: number;
  wordmark?: boolean;
  className?: string;
}

export function Logo({ size = 28, wordmark = true, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src="/favicon/android-chrome-192x192.png"
        width={size}
        height={size}
        alt={wordmark ? "" : "Displine"}
        className="shrink-0"
        draggable={false}
      />
      {wordmark && <span className="text-[15px] font-semibold tracking-[-0.01em]">Displine</span>}
    </span>
  );
}
