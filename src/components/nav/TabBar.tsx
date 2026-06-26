import { Home, CheckSquare, Users, User, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { BRAND_COLOR } from "../../constants/design";
import { useAppContext } from "../../contexts/AppContext";
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

export function TabBar() {
  const { userRole } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = tabsForRole(userRole);

  return (
    <div className="flex bg-card border-t border-border">
      {tabs.map(({ path, Icon, label }) => {
        const active = location.pathname === path;
        return (
          <button key={path} onClick={() => navigate(path)} className="flex-1 flex flex-col items-center py-3 gap-1">
            <Icon size={21} strokeWidth={active ? 2.5 : 1.5} style={{ color: active ? BRAND_COLOR : "#9BA5B4" }} />
            <span className="text-[9px] font-bold" style={{ color: active ? BRAND_COLOR : "#9BA5B4" }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
