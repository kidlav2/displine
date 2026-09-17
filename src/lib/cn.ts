import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Teach tailwind-merge the project's custom color and shadow tokens so
// `text-muted-foreground` and `text-sm` are never treated as the same group.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "background", "foreground", "card", "popover", "primary", "primary-hover", "primary-foreground",
        "secondary", "muted", "muted-foreground", "subtle-foreground", "hover", "raised", "border", "border-strong", "control-border",
        "input", "input-background", "ring", "brand", "brand-text", "brand-subtle",
        "success", "success-text", "success-subtle", "danger", "danger-text", "danger-subtle",
        "warning", "warning-text", "warning-subtle", "postpone", "postpone-text", "postpone-subtle", "success-muted",
      ],
      shadow: ["raised"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
