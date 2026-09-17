import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "../../lib/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
}

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-control-border",
        "transition-colors duration-150 data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
        "after:absolute after:-inset-2.5 after:content-['']",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-5 translate-x-0.5 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] data-[state=checked]:bg-primary-foreground",
          "transition-transform duration-200 ease-out data-[state=checked]:translate-x-[18px]",
        )}
      />
    </SwitchPrimitive.Root>
  );
}
