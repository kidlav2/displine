import { forwardRef } from "react";
import type React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "border border-border-strong bg-card text-foreground hover:bg-hover",
  ghost: "text-foreground hover:bg-hover",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-ghost": "text-danger-text hover:bg-danger-subtle",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px] [&_svg]:size-4",
  md: "h-10 gap-2 px-4 text-sm [&_svg]:size-[18px]",
  lg: "h-12 gap-2 px-5 text-[15px] [&_svg]:size-5",
};

/** Button styling for elements that must stay links (<a href>, router <Link>). */
export function buttonClass({ variant = "secondary", size = "md", block = false, className }: {
  variant?: Variant; size?: Size; block?: boolean; className?: string;
} = {}) {
  return cn(
    "pressable inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium [&_svg]:shrink-0",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, block = false, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "pressable inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium",
        "disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

type IconButtonSize = "sm" | "md" | "lg";
const ICON_SIZES: Record<IconButtonSize, string> = {
  sm: "size-8 [&_svg]:size-4",
  md: "size-10 [&_svg]:size-5",
  lg: "size-11 [&_svg]:size-5",
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name — icon-only buttons have no visible text. */
  label: string;
  variant?: "ghost" | "secondary";
  size?: IconButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, type = "button", children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "pressable inline-flex shrink-0 items-center justify-center rounded-lg text-muted-foreground",
        "hover:bg-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-40",
        variant === "secondary" && "border border-border-strong bg-card",
        ICON_SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
