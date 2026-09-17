import { Link, useLocation } from "react-router";
import { cn } from "../../lib/cn";
import { TABS, isTabActive } from "./tabs";

export function TabBar() {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Основная навигация" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-safe lg:hidden">
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-4">
        {TABS.map(tab => {
          const active = isTabActive(tab, pathname);
          const { Icon } = tab;
          return (
            <li key={tab.path}>
              <Link
                to={tab.path}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150",
                  "focus-visible:-outline-offset-4",
                  active ? "text-brand-text" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.25 : 1.75} className={active ? "text-brand" : undefined} aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
