import { Home, CheckSquare, Users, User, Settings, ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import { BRAND_COLOR } from "../../constants/design";
import { useAppContext } from "../../contexts/AppContext";
import type { UserRole } from "../../types";

type TabDef = { path: string; Icon: React.ElementType; label: string };

const USER_TABS: TabDef[] = [
  { path: "/app/home",      Icon: Home,        label: "Главная"     },
  { path: "/app/tasks",     Icon: CheckSquare, label: "Задания"     },
  { path: "/app/community", Icon: Users,       label: "Сообщество"  },
  { path: "/app/profile",   Icon: User,        label: "Профиль"     },
];

const HELPER_TABS: TabDef[] = [
  { path: "/app/home",      Icon: Home,        label: "Главная"    },
  { path: "/app/review",    Icon: CheckSquare, label: "Проверка"   },
  { path: "/app/community", Icon: Users,       label: "Сообщество" },
  { path: "/app/profile",   Icon: User,        label: "Профиль"    },
];

const OWNER_TABS: TabDef[] = [
  { path: "/app/home",      Icon: Home,        label: "Главная"     },
  { path: "/app/review",    Icon: CheckSquare, label: "Проверка"    },
  { path: "/app/community", Icon: Users,       label: "Сообщество"  },
  { path: "/app/manage",    Icon: Settings,    label: "Управление"  },
  { path: "/app/profile",   Icon: User,        label: "Профиль"     },
];

function tabsForRole(role: UserRole): TabDef[] {
  return role === "owner" ? OWNER_TABS : role === "helper" ? HELPER_TABS : USER_TABS;
}

export function TabBar() {
  const { userRole, setSelectedId } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();
  const tabs = tabsForRole(userRole);
  const isOwner = userRole === "owner";

  return (
    <div className="flex flex-col bg-card border-t border-border">
      {isOwner && (
        <button
          onClick={() => { setSelectedId(null); navigate("/challenges"); }}
          className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold text-muted-foreground border-b border-border/60 hover:bg-muted transition-colors">
          <ChevronLeft size={13} /> Все челленджи
        </button>
      )}
      <div className="flex">
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
    </div>
  );
}
