import type React from "react";
import { Logo } from "./atoms";
import { cn } from "../lib/cn";

/** Frame for signed-out and onboarding screens: logo on top, one focused column. */
export function AuthLayout({ children, footer, className }: { children: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="flex h-16 shrink-0 items-center px-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 justify-center px-5 pb-10 pt-6 sm:items-center sm:px-6 sm:pt-0">
        <div className={cn("w-full max-w-[400px] sm:rounded-2xl sm:border sm:border-border sm:bg-card sm:p-8", className)}>
          {children}
        </div>
      </main>
      {footer && <footer className="px-5 pb-6 text-center text-[13px] text-muted-foreground">{footer}</footer>}
    </div>
  );
}

interface AuthMessageProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
}

/** Status message inside AuthLayout (errors, empty states, confirmations). */
export function AuthMessage({ icon, title, description, children }: AuthMessageProps) {
  return (
    <div>
      {icon && <div className="mb-5 text-subtle-foreground [&_svg]:size-6" aria-hidden>{icon}</div>}
      <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
      {description && <p className="mt-2 text-[15px] text-muted-foreground text-pretty">{description}</p>}
      {children && <div className="mt-8 flex flex-col gap-3">{children}</div>}
    </div>
  );
}
