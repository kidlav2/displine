import { Home, CheckSquare, Users, User, Settings, ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { BRAND_COLOR } from "../../constants/design";
import { useAppContext } from "../../contexts/AppContext";
import { DemoControls } from "./DemoControls";
import type { UserRole } from "../../types";

type TabDef = { path: string; Icon: React.ElementType; label: string };

const USER_TABS: TabDef[] = [
  { path: "/app/home",      Icon: Home,        label: "Home"      },
  { path: "/app/tasks",     Icon: CheckSquare, label: "Tasks"     },
  { path: "/app/community", Icon: Users,       label: "Community" },
  { path: "/app/profile",   Icon: User,        label: "Profile"   },
];

const HELPER_TABS: TabDef[] = [
  { path: "/app/home",      Icon: Home,        label: "Home"      },
  { path: "/app/review",    Icon: CheckSquare, label: "Review"    },
  { path: "/app/community", Icon: Users,       label: "Community" },
  { path: "/app/profile",   Icon: User,        label: "Profile"   },
];

const OWNER_TABS: TabDef[] = [
  { path: "/app/home",      Icon: Home,        label: "Home"      },
  { path: "/app/review",    Icon: CheckSquare, label: "Review"    },
  { path: "/app/community", Icon: Users,       label: "Community" },
  { path: "/app/manage",    Icon: Settings,    label: "Manage"    },
  { path: "/app/profile",   Icon: User,        label: "Profile"   },
];

function tabsForRole(role: UserRole): TabDef[] {
  return role === "owner" ? OWNER_TABS : role === "helper" ? HELPER_TABS : USER_TABS;
}

export function DesktopNav() {
  const { challenge, userRole, setSelectedId } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = tabsForRole(userRole);
  const isOwner = userRole === "owner";

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 w-60 bg-card border-r border-border">
      <div className="px-5 pt-6 pb-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base" style={{ background: "#FFF3F0" }}>🔥</div>
          <div>
            <p className="font-extrabold text-sm leading-none">Discipline</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {userRole === "owner" ? "Owner" : userRole === "helper" ? "Helper" : "Participant"}
            </p>
          </div>
        </div>
        {challenge && (
          <p className="text-xs font-semibold text-muted-foreground mt-3 truncate">{challenge.emoji} {challenge.name}</p>
        )}
      </div>

      {isOwner && (
        <button
          onClick={() => { setSelectedId(null); navigate("/challenges"); }}
          className="flex items-center gap-2 px-5 py-3 text-xs font-bold text-muted-foreground border-b border-border hover:bg-muted transition-colors">
          <ChevronLeft size={13} /> All challenges
        </button>
      )}

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {tabs.map(({ path, Icon, label }) => {
          const active = location.pathname === path;
          return (
            <button key={path} onClick={() => navigate(path)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={active ? { background: "#FFF3F0", color: BRAND_COLOR } : { color: "#6B7280" }}>
              <Icon size={18} strokeWidth={active ? 2.5 : 1.5} style={{ color: active ? BRAND_COLOR : "#9BA5B4" }} />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4 border-t border-border pt-3">
        <DemoControls />
      </div>
    </aside>
  );
}
