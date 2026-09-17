import { Link, useLocation, useNavigate } from "react-router";
import { ChevronsUpDown } from "lucide-react";
import { Av, Logo } from "../atoms";
import { ROLE_LABELS } from "../../constants/design";
import { useAppContext } from "../../contexts/AppContext";
import { cn } from "../../lib/cn";
import { TABS, isTabActive } from "./tabs";
import { challengePhase } from "../../lib/dates";

export function DesktopNav() {
  const { challenge, userRole, meParticipant } = useAppContext();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 shrink-0 items-center px-5">
        <Logo />
      </div>

      {challenge && (
        <div className="px-3">
          <button
            type="button"
            onClick={() => navigate("/challenges")}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-2.5 py-2 text-left transition-colors duration-150 hover:bg-hover"
            aria-label={`Сменить челлендж. Сейчас: ${challenge.name}`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-base" aria-hidden>
              {challenge.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-semibold leading-snug">{challenge.name}</span>
              <span className="block text-xs text-muted-foreground tabular">
                {{
                  active: `День ${challenge.currentDay} из ${challenge.duration}`,
                  upcoming: "Ещё не начался",
                  completed: "Завершён",
                }[challengePhase(challenge.startDate, challenge.duration)]}
              </span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-subtle-foreground" aria-hidden />
          </button>
        </div>
      )}

      <nav aria-label="Основная навигация" className="mt-5 flex-1 overflow-y-auto px-3">
        <ul className="space-y-0.5">
          {TABS.map(tab => {
            const active = isTabActive(tab, pathname);
            const { Icon } = tab;
            return (
              <li key={tab.path}>
                <Link
                  to={tab.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors duration-150",
                    active ? "bg-hover text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground",
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.25 : 1.75} className={active ? "text-brand" : undefined} aria-hidden />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {meParticipant && (
        <div className="shrink-0 border-t border-border p-3">
          <Link
            to="/app/profile"
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-hover"
          >
            <Av ini={meParticipant.ini} photoUrl={meParticipant.photoUrl} sz="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{meParticipant.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABELS[userRole]}</span>
            </span>
          </Link>
        </div>
      )}
    </aside>
  );
}
