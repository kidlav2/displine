import { useId } from "react";
import type React from "react";
import { cn } from "../../lib/cn";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: React.ReactNode; title?: string }>;
  "aria-label": string;
  size?: "sm" | "md";
  block?: boolean;
  className?: string;
}

/** Radio group styled as a segmented control — native radios give arrow-key navigation for free. */
export function Segmented<T extends string>({
  value, onChange, options, size = "md", block = false, className, ...aria
}: SegmentedProps<T>) {
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={aria["aria-label"]}
      className={cn("inline-flex rounded-lg bg-muted p-0.5", block && "flex w-full", className)}
    >
      {options.map(opt => (
        <label key={opt.value} className={cn("relative", block && "flex-1")} title={opt.title}>
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium text-muted-foreground",
              "transition-colors duration-150 hover:text-foreground",
              "peer-checked:bg-raised peer-checked:text-foreground peer-checked:shadow-[0_1px_2px_rgb(0_0_0/0.08)]",
              "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-ring",
              size === "sm" ? "h-7 px-2.5 text-[13px]" : "h-9 px-3 text-sm",
            )}
          >
            {opt.label}
          </span>
        </label>
      ))}
    </div>
  );
}
