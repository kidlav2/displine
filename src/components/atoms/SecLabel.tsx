import type React from "react";

export function SecLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-extrabold tracking-widest uppercase text-muted-foreground">
      {children}
    </p>
  );
}
