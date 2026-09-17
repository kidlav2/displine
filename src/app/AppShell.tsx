import { Outlet, ScrollRestoration, useNavigate } from "react-router";
import { Link2Off, Lock, UserX } from "lucide-react";
import { DesktopNav } from "../components/nav/DesktopNav";
import { TabBar } from "../components/nav/TabBar";
import { Button, EmptyState, PageSpinner } from "../components/atoms";
import { useAuthContext } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { cn } from "../lib/cn";

function NoAccessState() {
  const navigate = useNavigate();
  return (
    <EmptyState
      className="min-h-[70vh] justify-center"
      icon={<Lock />}
      title="Нет доступа к челленджу"
      description="Трекером пользуются организаторы и помощники. Участникам входить не нужно — их отмечают по имени."
      action={<Button variant="primary" onClick={() => navigate("/")}>На экран входа</Button>}
    />
  );
}

function RemovedState({ challengeName }: { challengeName?: string }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      className="min-h-[70vh] justify-center"
      icon={<UserX />}
      title="Вас удалили из челленджа"
      description={challengeName
        ? `Организатор «${challengeName}» закрыл вам доступ. Чтобы вернуться, попросите новое приглашение в команду.`
        : "Чтобы вернуться, попросите организатора пригласить вас в команду."}
      action={<Button variant="primary" onClick={() => navigate("/")}>На экран входа</Button>}
    />
  );
}

/** "tabs" shows the phone tab bar; "detail" screens (participant profile) hide it. */
export function AppShell({ variant = "tabs" }: { variant?: "tabs" | "detail" }) {
  const { currentUser, userProfile } = useAuthContext();
  const { challenges, loading, challenge, meParticipant } = useAppContext();

  const roleCount = userProfile ? Object.keys(userProfile.challengeRoles ?? {}).length : 0;

  // Authenticated user with a profile but no challenge roles and nothing loaded.
  const showNoChallengeState =
    !loading && !!currentUser && !!userProfile && roleCount === 0 && challenges.length === 0;

  // "Removed" in two scenarios:
  // 1. Challenge is readable but the user is absent from participants.
  // 2. Challenge is no longer readable (rules denied access after removal) —
  //    loading done, nothing loaded, but the profile still lists roles.
  const showRemovedState =
    !loading && (
      (!!challenge && challenge.participants.length > 0 && !meParticipant) ||
      (!challenge && !!currentUser && !!userProfile && roleCount > 0 && challenges.length === 0)
    );

  const inner = (() => {
    if (loading) return <PageSpinner />;
    if (showNoChallengeState) return <NoAccessState />;
    if (showRemovedState) return <RemovedState challengeName={challenge?.name} />;
    if (meParticipant && meParticipant.role === "participant") return <NoAccessState />;
    // selectedId points to a challenge that didn't load (e.g. deleted).
    if (!challenge) {
      return (
        <EmptyState
          className="min-h-[70vh] justify-center"
          icon={<Link2Off />}
          title="Челлендж не найден"
          description="Не удалось загрузить данные. Проверьте подключение и обновите страницу."
          action={<Button variant="primary" onClick={() => window.location.reload()}>Обновить</Button>}
        />
      );
    }
    return <Outlet />;
  })();

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main"
        className="fixed left-4 top-4 z-[60] -translate-y-20 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus-visible:translate-y-0"
      >
        Перейти к содержимому
      </a>
      <ScrollRestoration />
      <DesktopNav />
      <main
        id="main"
        className={cn(
          "min-h-dvh lg:pl-64",
          variant === "tabs" && "pb-[calc(64px+env(safe-area-inset-bottom))] lg:pb-0",
        )}
      >
        {inner}
      </main>
      {variant === "tabs" && <TabBar />}
    </div>
  );
}
