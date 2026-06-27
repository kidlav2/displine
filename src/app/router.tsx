import { createBrowserRouter, Navigate, Outlet, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { signInWithCustomToken, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";
import { resolveInviteCode, joinChallengeAsParticipant, acceptTeamInvite, TeamInviteError, type InviteData } from "../lib/firestore";
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
import { TelegramLoginScreen } from "../screens/TelegramLoginScreen";
import { ProfileSetupScreen } from "../screens/ProfileSetupScreen";

import { useAppContext } from "../contexts/AppContext";
import { jk } from "../constants/design";
import type { TelegramProfile } from "../types";

// ── Auth guard ────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser, authLoading } = useAuthContext();
  if (authLoading) return null;
  if (!currentUser) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ── Cloud Function callable ref ───────────────────────────────────────────────

const verifyTelegramLoginFn = httpsCallable<
  { id_token: string; nonce: string },
  { customToken: string; telegramId: number; telegramUsername: string | null; displayName: string; photoUrl: string | null }
>(functions, "verifyTelegramLogin");

// ── Root layout (/) ───────────────────────────────────────────────────────────
// Plain login entry point. No challenge preview, no invite code.
// After login: routes based on challengeRoles in Firestore profile.

type RootStep = "login" | "profile" | "no-challenges";

function RootLayout() {
  const { currentUser, userProfile, authLoading } = useAuthContext();
  const { setSelectedId } = useAppContext();
  const navigate = useNavigate();
  const [step, setStep] = useState<RootStep>("login");
  const [telegramData, setTelegramData] = useState<TelegramProfile | undefined>(undefined);

  // Once auth resolves, route returning users straight to their destination
  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) { setStep("login"); return; }

    // User is authenticated — check their profile
    if (!userProfile) {
      // Auth resolved but no profile yet → new user needs profile setup
      setStep("profile");
      return;
    }

    const roles = userProfile.challengeRoles ?? {};
    const ids = Object.keys(roles);
    if (ids.length === 0) {
      setStep("no-challenges");
    } else if (ids.length === 1) {
      setSelectedId(ids[0]);
      navigate("/app/home", { replace: true });
    } else {
      navigate("/challenges", { replace: true });
    }
  }, [authLoading, currentUser, userProfile, navigate, setSelectedId]);

  const handleTelegramAuth = async (payload: { id_token: string; nonce: string }) => {
    const result = await verifyTelegramLoginFn(payload);
    await signInWithCustomToken(auth, result.data.customToken);
    setTelegramData({
      telegramId:       result.data.telegramId,
      telegramUsername: result.data.telegramUsername,
      displayName:      result.data.displayName,
      photoUrl:         result.data.photoUrl,
    });
    // AuthContext will fire → useEffect above will pick up the new user + profile state
  };

  const handleGoogleAuth = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
    // AuthContext onAuthStateChanged fires → useEffect above routes the user
  };

  const handleProfileDone = async (_data: { name: string; ini: string }) => {
    // After profile creation on root flow, user has no challenge yet
    setStep("no-challenges");
  };

  const inner = (() => {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center" style={jk}>
          <p className="text-sm text-muted-foreground">Загрузка…</p>
        </div>
      );
    }

    if (step === "login") {
      return (
        <div className="lg:w-[420px] lg:bg-card lg:rounded-3xl lg:border lg:border-border lg:shadow-sm lg:overflow-hidden"
          style={{ minHeight: "min(600px, 100vh)" }}>
          <TelegramLoginScreen
            onAuth={handleTelegramAuth}
            onGoogleAuth={handleGoogleAuth}
            onInviteCode={code => navigate(`/join?code=${encodeURIComponent(code)}`)}
          />
        </div>
      );
    }

    if (step === "profile") {
      return (
        <div className="lg:w-[420px] lg:bg-card lg:rounded-3xl lg:border lg:border-border lg:shadow-sm lg:overflow-hidden"
          style={{ minHeight: "min(600px, 100vh)" }}>
          <ProfileSetupScreen onDone={handleProfileDone} telegramData={telegramData} />
        </div>
      );
    }

    // no-challenges
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 text-center" style={{ minHeight: "min(600px, 100vh)" }}>
        <p className="text-4xl">🏁</p>
        <div className="space-y-1">
          <p className="font-extrabold text-xl">Нет челленджей</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Вы не участвуете ни в одном челлендже. Создайте новый или попросите организатора прислать ссылку-приглашение.
          </p>
        </div>
        <button
          onClick={() => navigate("/challenges/create")}
          className="px-6 py-3 rounded-2xl font-extrabold text-sm text-white"
          style={{ background: "#FF4F00" }}
        >
          Создать новый челлендж
        </button>
      </div>
    );
  })();

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden" style={jk}>
      <div className="flex-1 lg:flex lg:items-center lg:justify-center lg:p-8">
        {inner}
      </div>
    </div>
  );
}

// ── Onboarding layout (/join?code=XXX) ────────────────────────────────────────
// Requires ?code param. Shows challenge preview and join flow.

interface ChallengePreview { name: string; emoji: string; description: string; inviteCode: string; }

function OnboardingLayout() {
  const { setSelectedId } = useAppContext();
  const { currentUser, userProfile } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";

  const [step, setStep] = useState<"telegram" | "profile">("telegram");
  const [telegramData, setTelegramData] = useState<TelegramProfile | undefined>(undefined);

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!code);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // No code → immediate error
  useEffect(() => {
    if (!code) {
      setInviteError("Код приглашения не найден. Попросите организатора прислать действующую ссылку.");
      setInviteLoading(false);
      return;
    }
    resolveInviteCode(code)
      .then(data => {
        if (data) setInvite(data);
        else setInviteError("Эта ссылка-приглашение недействительна или устарела.");
      })
      .catch((err: unknown) => {
        if (err instanceof TeamInviteError) {
          navigate(`/error/team-invite-${err.reason}`, { replace: true });
        } else {
          setInviteError("Не удалось загрузить челлендж. Проверьте подключение.");
        }
      })
      .finally(() => setInviteLoading(false));
  }, [code]);

  // If the user is already authenticated, skip the login step.
  // If they also have a profile and the invite is loaded, join and navigate directly.
  useEffect(() => {
    if (!currentUser || step !== "telegram" || inviteLoading) return;

    if (userProfile && invite) {
      const alreadyJoined = !!userProfile.challengeRoles?.[invite.challengeId];
      if (alreadyJoined) {
        setSelectedId(invite.challengeId);
        navigate("/app/home", { replace: true });
      } else if (invite.type === "team") {
        acceptTeamInvite(code, currentUser.uid, {
          name:     userProfile.name,
          ini:      userProfile.ini,
          tz:       userProfile.timezone,
          photoUrl: userProfile.photoUrl ?? currentUser.photoURL ?? null,
        }).then(({ challengeId }) => {
          setSelectedId(challengeId);
          navigate("/app/home", { replace: true });
        }).catch((err: unknown) => {
          if (err instanceof TeamInviteError) {
            navigate(`/error/team-invite-${err.reason}`, { replace: true });
          }
        });
      } else {
        joinChallengeAsParticipant(
          invite.challengeId,
          currentUser.uid,
          { name: userProfile.name, ini: userProfile.ini, tz: userProfile.timezone,
            photoUrl: userProfile.photoUrl ?? currentUser.photoURL ?? null },
          invite.startingLives
        ).then(() => {
          setSelectedId(invite.challengeId);
          navigate("/app/home", { replace: true });
        });
      }
    } else if (userProfile && !invite && !inviteError) {
      // Invite still loading — wait (inviteLoading guard above handles this)
    } else {
      // Authenticated but no profile yet → show profile setup
      setStep("profile");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userProfile, step, inviteLoading, invite]);

  const preview: ChallengePreview | undefined = invite ?? undefined;

  const handleTelegramAuth = async (payload: { id_token: string; nonce: string }) => {
    const result = await verifyTelegramLoginFn(payload);
    await signInWithCustomToken(auth, result.data.customToken);
    setTelegramData({
      telegramId:       result.data.telegramId,
      telegramUsername: result.data.telegramUsername,
      displayName:      result.data.displayName,
      photoUrl:         result.data.photoUrl,
    });
    setStep("profile");
  };

  const handleGoogleAuthOnboarding = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
    // Google auth resolves with name/photo in currentUser — profile step will read it
    setStep("profile");
  };

  const handleProfileDone = async (data: { name: string; ini: string }) => {
    if (currentUser && invite) {
      try {
        if (invite.type === "team") {
          const { challengeId } = await acceptTeamInvite(code, currentUser.uid, {
            name:     data.name,
            ini:      data.ini,
            tz:       detectTz(),
            photoUrl: currentUser.photoURL ?? null,
          });
          setSelectedId(challengeId);
        } else {
          await joinChallengeAsParticipant(
            invite.challengeId,
            currentUser.uid,
            { name: data.name, ini: data.ini, tz: detectTz(),
              photoUrl: currentUser.photoURL ?? null },
            invite.startingLives
          );
          setSelectedId(invite.challengeId);
        }
      } catch (err: unknown) {
        if (err instanceof TeamInviteError) {
          navigate(`/error/team-invite-${err.reason}`, { replace: true });
          return;
        }
        throw err;
      }
    }
    navigate("/app/home");
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={jk}>
        <p className="text-sm text-muted-foreground">Загрузка челленджа…</p>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6" style={jk}>
        <div className="text-center space-y-3 max-w-xs">
          <p className="text-3xl">🔗</p>
          <p className="font-extrabold text-lg">Недействительное приглашение</p>
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
            <TelegramLoginScreen challenge={preview} onAuth={handleTelegramAuth} onGoogleAuth={handleGoogleAuthOnboarding} />
          )}
          {step === "profile" && (
            <ProfileSetupScreen onDone={handleProfileDone} telegramData={telegramData} />
          )}
        </div>
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
    </div>
  );
}

function ChallengesLayout() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden" style={jk}>
      <Outlet />
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  { path: "/", element: <RootLayout /> },

  // Onboarding — requires ?code=XXX to join a challenge
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
