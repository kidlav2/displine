import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";

interface AvProps {
  ini: string;
  photoUrl?: string | null;
  sz?: "xs" | "sm" | "md" | "lg" | "xl";
  accent?: boolean;
  /** Kept for older call sites; operators are no longer marked on the avatar. */
  admin?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-[13px]",
  lg: "size-14 text-base",
  xl: "size-20 text-2xl",
} as const;

export function Av({ ini, photoUrl, sz = "md", accent = false, onClick, className }: AvProps) {
  // Fall back to initials when the image fails to load (e.g. an expired
  // Telegram CDN URL) so we never render a broken image.
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [photoUrl]);
  const showImg = !!photoUrl && !failed;

  return (
    <span
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold",
        accent ? "bg-brand-subtle text-brand-text" : "bg-muted text-muted-foreground",
        SIZES[sz],
        onClick && "cursor-pointer",
        className,
      )}
      aria-hidden={!onClick || undefined}
    >
      {showImg
        ? <img src={photoUrl!} alt="" className="size-full object-cover" onError={() => setFailed(true)} />
        : ini}
    </span>
  );
}
