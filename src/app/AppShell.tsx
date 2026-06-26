import { Outlet, useNavigate } from "react-router";
import { DesktopNav } from "../components/nav/DesktopNav";
import { TabBar } from "../components/nav/TabBar";
import { DemoControls } from "../components/nav/DemoControls";
import { useAuthContext } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { BRAND_COLOR } from "../constants/design";

function NoChallengeState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center gap-4">
      <p className="text-5xl">🔗</p>
      <div className="space-y-1">
        <p className="font-extrabold text-xl">You haven't joined a challenge yet</p>
        <p className="text-sm text-muted-foreground max-w-[280px] leading-snug">
          It looks like the join step didn't complete. Ask your organizer to resend
          the invite link, then tap it to try again.
        </p>
      </div>
      <button
        onClick={() => navigate("/join")}
        className="mt-2 px-8 py-3 rounded-xl font-extrabold text-sm text-white"
        style={{ background: BRAND_COLOR }}
      >
        Use my invite link
      </button>
    </div>
  );
}

export function AppShell() {
  const { currentUser, userProfile, authLoading } = useAuthContext();
  const { challenges } = useAppContext();

  // Show the empty state only for real authenticated users whose join step
  // failed — i.e. they have a profile but no challenge roles and no challenges
  // loaded. Demo mode (currentUser = null) falls through to normal rendering.
  const showNoChallengeState =
    !authLoading &&
    !!currentUser &&
    !!userProfile &&
    Object.keys(userProfile.challengeRoles).length === 0 &&
    challenges.length === 0;

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      <DesktopNav />

      <div className="flex-1 min-h-screen flex flex-col min-w-0 lg:ml-60">
        {/* Mobile demo bar */}
        <div className="lg:hidden border-b border-border bg-card px-4 py-2 overflow-x-hidden">
          <DemoControls />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-8" style={{ scrollbarWidth: "none" }}>
          {showNoChallengeState ? <NoChallengeState /> : <Outlet />}
        </div>

        {/* Mobile bottom tab bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
          <TabBar />
        </div>
      </div>
    </div>
  );
}
