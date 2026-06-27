import { Outlet, useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { DesktopNav } from "../components/nav/DesktopNav";
import { TabBar } from "../components/nav/TabBar";
import { useAuthContext } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { BRAND_COLOR } from "../constants/design";

function NoChallengeState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center gap-4">
      <p className="text-5xl">🔗</p>
      <div className="space-y-1">
        <p className="font-extrabold text-xl">Вы ещё не вступили в челлендж</p>
        <p className="text-sm text-muted-foreground max-w-[280px] leading-snug">
          Похоже, вступление не завершилось. Попросите организатора повторно отправить
          ссылку-приглашение и нажмите её ещё раз.
        </p>
      </div>
      <button
        onClick={() => navigate("/join")}
        className="mt-2 px-8 py-3 rounded-xl font-extrabold text-sm text-white"
        style={{ background: BRAND_COLOR }}
      >
        Использовать ссылку-приглашение
      </button>
    </div>
  );
}

function KickedState({ challengeName, challengeEmoji }: { challengeName: string; challengeEmoji: string }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center gap-4">
      <p className="text-5xl">🚫</p>
      <div className="space-y-1.5">
        <p className="font-extrabold text-xl">Вы были удалены из челленджа</p>
        <p className="text-sm text-muted-foreground max-w-[280px] leading-snug">
          {challengeEmoji} <span className="font-semibold text-foreground">{challengeName}</span> — организатор удалил вас из этого челленджа.
        </p>
      </div>
      <button
        onClick={() => navigate("/join")}
        className="mt-2 px-8 py-3 rounded-xl font-extrabold text-sm text-white"
        style={{ background: BRAND_COLOR }}
      >
        Вступить в другой челлендж
      </button>
    </div>
  );
}

export function AppShell() {
  const { currentUser, userProfile } = useAuthContext();
  const { challenges, loading, challenge, meParticipant } = useAppContext();

  // Show the empty state only for real authenticated users whose join step
  // failed — i.e. they have a profile but no challenge roles and no challenges loaded.
  const showNoChallengeState =
    !loading &&
    !!currentUser &&
    !!userProfile &&
    Object.keys(userProfile.challengeRoles).length === 0 &&
    challenges.length === 0;

  // Detect "kicked" state: challenge loaded + participants snapshot resolved (non-empty)
  // but current user is no longer in the participants list.
  const showKickedState =
    !loading &&
    !!challenge &&
    challenge.participants.length > 0 &&
    !meParticipant;

  const inner = (() => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full min-h-[50vh]">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (showNoChallengeState) return <NoChallengeState />;
    if (showKickedState) return <KickedState challengeName={challenge!.name} challengeEmoji={challenge!.emoji} />;
    // Challenges loaded but selectedId points to a doc that didn't come back
    // (e.g. stale ID after challenge deletion). Show recovery UI rather than crash.
    if (!challenge) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[50vh] px-6 text-center gap-3">
          <p className="text-3xl">🔗</p>
          <p className="font-extrabold text-lg">Челлендж не найден</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Не удалось загрузить данные. Попробуйте обновить страницу.
          </p>
          <button onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl font-extrabold text-sm text-white mt-1"
            style={{ background: BRAND_COLOR }}>
            Обновить
          </button>
        </div>
      );
    }
    return <Outlet />;
  })();

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      <DesktopNav />

      <div className="flex-1 min-h-screen flex flex-col min-w-0 lg:ml-60">
        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-8" style={{ scrollbarWidth: "none" }}>
          {inner}
        </div>

        {/* Mobile bottom tab bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          <TabBar />
        </div>
      </div>
    </div>
  );
}
