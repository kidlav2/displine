import { createBrowserRouter, Navigate, Outlet, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import type { ConfirmationResult } from "firebase/auth";
import { signInWithPhoneNumber, RecaptchaVerifier, signInWithCustomToken } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";
import { resolveInviteCode, joinChallengeAsParticipant, type InviteData } from "../lib/firestore";
import { detectTz } from "../lib/timezone";
import { useAuthContext } from "../contexts/AuthContext";
import { AppShell } from "./AppShell";
import { HomeScreen } from "../screens/HomeScreen";
import { TasksScreen } from "../screens/TasksScreen";
import { CommunityScreen } from "../screens/CommunityScreen";
import { ReviewScreen } from "../screens/ReviewScreen";
import { ManageScreen } from "../screens/ManageScreen";
import { ManageParticipantsScreen } from "../screens/ManageParticipantsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { TeamScreen } from "../screens/TeamScreen";
import { ChallengeSettingsScreen } from "../screens/ChallengeSettingsScreen";
import { ChallengesListScreen } from "../screens/ChallengesListScreen";
import { CreateChallengeScreen } from "../screens/CreateChallengeScreen";
import { ParticipantProfile } from "../screens/ParticipantProfile";
import { ErrorScreen } from "../screens/ErrorScreen";
import { OrgLoginScreen } from "../screens/OrgLoginScreen";
import { PhoneScreen } from "../screens/PhoneScreen";
import { VerifyScreen } from "../screens/VerifyScreen";
import { TelegramLoginScreen } from "../screens/TelegramLoginScreen";
import { ProfileSetupScreen } from "../screens/ProfileSetupScreen";
import { DemoControls } from "../components/nav/DemoControls";
import { useAppContext } from "../contexts/AppContext";
import { jk } from "../constants/design";
import type { TelegramAuthData } from "../types";

// ── Auth guard ────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser, authLoading } = useAuthContext();
  if (authLoading) return null;
  if (!currentUser) return <Navigate to="/join" replace />;
  return <>{children}</>;
}

// ── Layouts ───────────────────────────────────────────────────────────────────

// Minimal shape PhoneScreen needs to display the invite preview
interface ChallengePreview { name: string; emoji: string; description: string; inviteCode: string; }

const DEMO_PREVIEW: ChallengePreview = {
  name: "Demo Challenge", emoji: "🏃",
  description: "Add ?code=XXX to join a real challenge.",
  inviteCode: "DEMO",
};

// Cloud Function callable ref — created once outside the component
const verifyTelegramLoginFn = httpsCallable<TelegramAuthData, {
  customToken: string;
  telegramId: number;
  telegramUsername: string | null;
  displayName: string;
  photoUrl: string | null;
}>(functions, "verifyTelegramLogin");

function OnboardingLayout() {
  const { setSelectedId } = useAppContext();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";

  // "telegram" is the primary step; phone/verify are kept but not active
  const [step, setStep] = useState<"telegram" | "phone" | "verify" | "profile">("telegram");
  const [telegramData, setTelegramData] = useState<TelegramAuthData | undefined>(undefined);

  // Kept for potential phone-auth fallback — not used in the active flow
  const [phone, setPhone] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [resendVerifier, setResendVerifier] = useState<RecaptchaVerifier | null>(null);

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!code);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Resolve the invite code from the URL on mount
  useEffect(() => {
    if (!code) return;
    resolveInviteCode(code)
      .then(data => {
        if (data) setInvite(data);
        else setInviteError("This invite link is invalid or has expired.");
      })
      .catch(() => setInviteError("Could not load the challenge. Check your connection."))
      .finally(() => setInviteLoading(false));
  }, [code]);

  const preview: ChallengePreview = invite ?? DEMO_PREVIEW;

  // Called by TelegramLoginScreen after the widget fires its callback
  const handleTelegramAuth = async (data: TelegramAuthData) => {
    const result = await verifyTelegramLoginFn(data);
    await signInWithCustomToken(auth, result.data.customToken);
    // Stash raw Telegram data so ProfileSetupScreen can pre-populate name + photo
    setTelegramData(data);
    setStep("profile");
  };

  // ── Phone-auth helpers (kept, not exposed in UI) ──────────────────────────
  const handlePhoneNext = (p: string, result: ConfirmationResult) => {
    setPhone(p);
    setConfirmationResult(result);
    setStep("verify");
  };

  const handleResend = async () => {
    const digits = phone.replace(/[^\d+]/g, "");
    let verifier = resendVerifier;
    if (!verifier) {
      verifier = new RecaptchaVerifier(auth, "resend-recaptcha-container", { size: "invisible" });
      setResendVerifier(verifier);
    }
    const result = await signInWithPhoneNumber(auth, digits, verifier);
    setConfirmationResult(result);
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleProfileDone = async (data: { name: string; ini: string }) => {
    if (currentUser && invite) {
      await joinChallengeAsParticipant(
        invite.challengeId,
        currentUser.uid,
        { name: data.name, ini: data.ini, tz: detectTz() },
        invite.startingLives
      );
      setSelectedId(invite.challengeId);
    }
    navigate("/app/home");
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={jk}>
        <p className="text-sm text-muted-foreground">Loading challenge…</p>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6" style={jk}>
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-3xl">🔗</p>
          <p className="font-extrabold text-lg">Invalid invite</p>
          <p className="text-sm text-muted-foreground">{inviteError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden" style={jk}>
      <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:p-8">
        <div className="lg:w-[420px] lg:bg-card lg:rounded-3xl lg:border lg:border-border lg:shadow-sm lg:overflow-hidden"
          style={{ minHeight: "min(600px, 100vh)" }}>
          {step === "telegram" && (
            <TelegramLoginScreen challenge={preview} onAuth={handleTelegramAuth} />
          )}
          {/* Phone / Verify steps — inactive in current flow, kept for fallback */}
          {step === "phone" && (
            <PhoneScreen challenge={preview} onNext={handlePhoneNext} />
          )}
          {step === "verify" && confirmationResult && (
            <VerifyScreen
              phone={phone}
              confirmationResult={confirmationResult}
              onVerify={() => setStep("profile")}
              onBack={() => setStep("phone")}
              onResend={handleResend}
            />
          )}
          {step === "profile" && (
            <ProfileSetupScreen onDone={handleProfileDone} telegramData={telegramData} />
          )}
        </div>
      </div>
      <div id="resend-recaptcha-container" />
      <div className="lg:hidden px-4 py-3 border-t border-border bg-card">
        <DemoControls />
      </div>
    </div>
  );
}

function ErrorLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden" style={jk}>
      <div className="flex-1 flex flex-col lg:flex-row lg:items-center lg:justify-center lg:p-8">
        <div className="flex flex-col flex-1 lg:flex-none lg:w-[420px] lg:bg-card lg:rounded-3xl lg:border lg:border-border lg:shadow-sm lg:overflow-hidden"
          style={{ minHeight: "min(600px, 100vh)" }}>
          <ErrorScreen />
        </div>
      </div>
      <div className="lg:hidden px-4 py-3 border-t border-border bg-card">
        <DemoControls />
      </div>
    </div>
  );
}

function OrgLoginLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden" style={jk}>
      <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:p-8">
        <div className="lg:w-[420px] lg:bg-card lg:rounded-3xl lg:border lg:border-border lg:shadow-sm lg:overflow-hidden"
          style={{ minHeight: "min(600px, 100vh)" }}>
          <OrgLoginScreen />
        </div>
      </div>
      <div className="lg:hidden px-4 py-3 border-t border-border bg-card">
        <DemoControls />
      </div>
    </div>
  );
}

function ChallengesLayout() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden" style={jk}>
      <Outlet />
      <div className="lg:hidden px-4 py-3 border-t border-border bg-card">
        <DemoControls />
      </div>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/app/home" replace /> },

  // Onboarding (unauthenticated)
  { path: "/join", element: <OnboardingLayout /> },

  // Org login (unauthenticated)
  { path: "/org-login", element: <OrgLoginLayout /> },

  // Error states
  { path: "/error/:variant", element: <ErrorLayout /> },

  // Owner challenge list (auth required)
  {
    element: <RequireAuth><ChallengesLayout /></RequireAuth>,
    children: [
      { path: "/challenges",        element: <ChallengesListScreen /> },
      { path: "/challenges/create", element: <CreateChallengeScreen /> },
    ],
  },

  // Participant profile overlay (auth required)
  {
    path: "/participants/:uid",
    element: (
      <RequireAuth>
        <div className="min-h-screen bg-background overflow-y-auto overflow-x-hidden" style={{ ...jk, scrollbarWidth: "none" }}>
          <div className="max-w-[560px] mx-auto min-h-full">
            <ParticipantProfile />
          </div>
        </div>
      </RequireAuth>
    ),
  },

  // Main app shell (auth required)
  {
    path: "/app",
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true,           element: <Navigate to="/app/home" replace /> },
      { path: "home",          element: <HomeScreen /> },
      { path: "tasks",         element: <TasksScreen /> },
      { path: "community",     element: <CommunityScreen /> },
      { path: "review",        element: <ReviewScreen /> },
      { path: "manage",        element: <ManageScreen /> },
      { path: "participants",  element: <ManageParticipantsScreen /> },
      { path: "settings",      element: <ChallengeSettingsScreen /> },
      { path: "team",          element: <TeamScreen /> },
      { path: "profile",       element: <ProfileScreen /> },
    ],
  },
]);
