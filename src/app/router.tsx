import { createBrowserRouter, Navigate, Outlet, ScrollRestoration, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { signInWithCustomToken, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";
import {
  resolveInviteCode, acceptTeamInvite, TeamInviteError,
  challengeRef, participantRef, leaveChallenge, removeChallengeRole, type InviteData,
} from "../lib/firestore";
import { detectTz } from "../lib/timezone";
import { useAuthContext } from "../contexts/AuthContext";
import { AppShell } from "./AppShell";
import { DayScreen } from "../screens/DayScreen";
import { GridScreen } from "../screens/GridScreen";
import { RatingScreen } from "../screens/RatingScreen";
import { OperatorSettingsScreen } from "../screens/OperatorSettingsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { TeamScreen } from "../screens/TeamScreen";
import { ChallengesListScreen } from "../screens/ChallengesListScreen";
import { CreateChallengeScreen } from "../screens/CreateChallengeScreen";
import { ParticipantProfile } from "../screens/ParticipantProfile";
import { ErrorScreen } from "../screens/ErrorScreen";
import { OrgLoginScreen } from "../screens/OrgLoginScreen";
import { TelegramLoginScreen } from "../screens/TelegramLoginScreen";
import { ProfileSetupScreen } from "../screens/ProfileSetupScreen";
import { StravaCallbackScreen } from "../screens/StravaCallbackScreen";

import { useAppContext } from "../contexts/AppContext";
import { Av, Button, Logo, Spinner } from "../components/atoms";
import { AuthLayout, AuthMessage } from "../components/AuthLayout";
import { Lock, Link2Off, UserRoundCheck, Users } from "lucide-react";
import type { TelegramProfile } from "../types";

// ── Auth guard ────────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { currentUser, authLoading } = useAuthContext();
  if (authLoading) return <FullScreenSpinner />;
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

function operatorIds(roles: Record<string, string> | undefined): string[] {
  return Object.entries(roles ?? {})
    .filter(([, r]) => r === "owner" || r === "helper")
    .map(([id]) => id);
}

function SignOutButton() {
  return (
    <Button variant="ghost" size="lg" block onClick={() => signOut(auth)}>
      Выйти из аккаунта
    </Button>
  );
}

function NoChallengesStep({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <AuthMessage
      title="Создайте первый челлендж"
      description="Задайте даты, расписание пробежек и штрафы, затем добавьте участников по имени — им входить не нужно."
    >
      <Button variant="primary" size="lg" block onClick={() => navigate("/challenges/create")}>
        Создать челлендж
      </Button>
      <p className="text-center text-[13px] text-muted-foreground">
        Вас пригласили помощником? Откройте ссылку-приглашение от организатора.
      </p>
      <SignOutButton />
    </AuthMessage>
  );
}

function NoAccessStep() {
  return (
    <AuthMessage
      icon={<Lock />}
      title="Нет доступа"
      description="Трекером пользуются организаторы и помощники. Участников отмечают по имени — отдельный вход им не нужен."
    >
      <SignOutButton />
    </AuthMessage>
  );
}

function FullScreenSpinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner />
    </div>
  );
}

type RootStep = "login" | "profile" | "no-challenges" | "no-access";

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
    const ids = operatorIds(roles);
    if (ids.length === 0) {
      setStep(Object.keys(roles).length > 0 ? "no-access" : "no-challenges");
    } else if (ids.length === 1) {
      setSelectedId(ids[0]);
      navigate("/app/day", { replace: true });
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

  if (authLoading) return <FullScreenSpinner />;

  return (
    <AuthLayout>
      {step === "login" && <TelegramLoginScreen onAuth={handleTelegramAuth} onGoogleAuth={handleGoogleAuth} />}
      {step === "profile" && <ProfileSetupScreen onDone={handleProfileDone} telegramData={telegramData} />}
      {step === "no-access" && <NoAccessStep />}
      {step === "no-challenges" && <NoChallengesStep navigate={navigate} />}
    </AuthLayout>
  );
}

// ── Onboarding layout (/join?code=XXX) ────────────────────────────────────────
// Requires ?code param. Shows challenge preview and join flow.

interface ChallengePreview { name: string; emoji: string; description: string; inviteCode: string; }

interface ChallengeConflict {
  challengeId: string;
  name: string;
  emoji: string;
  wasTeamMember: boolean;
  actor: { uid: string; name: string; ini: string; isAdmin: boolean };
}

function OnboardingLayout() {
  const { setSelectedId } = useAppContext();
  const { currentUser, userProfile } = useAuthContext();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code") ?? "";

  const [step, setStep] = useState<"telegram" | "profile">("telegram");
  const [telegramData, setTelegramData] = useState<TelegramProfile | undefined>(undefined);

  // An already-authenticated user landing on an invite link must explicitly
  // confirm which account they're joining as (item 4) rather than being silently
  // assumed to join as whoever happens to be logged in. Set true once the user
  // either confirms their current account or signs in fresh during this flow.
  const [accountConfirmed, setAccountConfirmed] = useState(false);

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [inviteLoading, setInviteLoading] = useState(!!code);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Single-challenge-at-a-time: set when the user already has a different
  // active challenge and needs to choose before joining this one.
  const [conflict, setConflict] = useState<ChallengeConflict | null>(null);
  const [conflictLoading, setConflictLoading] = useState(false);
  const [leavingConflict, setLeavingConflict] = useState(false);
  const [autoJoinError, setAutoJoinError] = useState<string | null>(null);

  // No code → show join-or-create landing (handled below, skip resolution)
  useEffect(() => {
    if (!code) {
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
        // Verify the participant doc still exists — it could be absent after a
        // partially-applied leave (participant deleted but challengeRoles not cleared).
        // If stale, clean up and let this effect re-fire to do the actual join.
        getDoc(participantRef(invite.challengeId, currentUser.uid)).then(snap => {
          if (snap.exists()) {
            setSelectedId(invite.challengeId);
            navigate("/app/day", { replace: true });
          } else {
            removeChallengeRole(currentUser.uid, invite.challengeId).catch(console.error);
          }
        });
        return;
      }

      // Public participant invites are closed — only team (operator) invites join here.
      if (invite.type !== "team") return;

      // Already authenticated but hasn't yet confirmed which account to join as.
      // Hold here — the render shows the account-choice screen; joining only
      // proceeds once the user taps "Continue" (which sets accountConfirmed).
      if (!accountConfirmed) return;

      // Don't silently join a second challenge — surface the conflict so the
      // user can decide whether to leave their current one first.
      const otherIds = Object.keys(userProfile.challengeRoles ?? {});
      if (otherIds.length > 0) {
        if (!conflict && !conflictLoading) {
          setConflictLoading(true);
          const existingId = otherIds[0];
          Promise.all([
            getDoc(challengeRef(existingId)),
            getDoc(participantRef(existingId, currentUser.uid)),
          ]).then(([chSnap, pSnap]) => {
            if (!pSnap.exists()) {
              // Stale entry — participant doc is gone (half-left state).
              // Clean up and let the effect re-fire to proceed with join.
              removeChallengeRole(currentUser.uid, existingId).catch(console.error);
              return;
            }
            const chData = chSnap.data();
            const pData = pSnap.data();
            setConflict({
              challengeId:   existingId,
              name:          chData?.name  ?? "",
              emoji:         chData?.emoji ?? "🏁",
              wasTeamMember: pData?.role === "helper",
              actor: {
                uid:     currentUser.uid,
                name:    pData?.name ?? userProfile.name,
                ini:     pData?.ini  ?? userProfile.ini,
                isAdmin: pData?.isAdmin ?? false,
              },
            });
          }).catch(() => {
            // PERMISSION_DENIED means the participant doc no longer exists
            // (stale challengeRoles entry after a failed leave). Clean it up.
            removeChallengeRole(currentUser.uid, existingId).catch(console.error);
          }).finally(() => setConflictLoading(false));
        }
        return;
      }

      if (invite.type === "team") {
        acceptTeamInvite(code, currentUser.uid, {
          name:     userProfile.name,
          ini:      userProfile.ini,
          tz:       userProfile.timezone,
          photoUrl: userProfile.photoUrl ?? currentUser.photoURL ?? null,
        }).then(({ challengeId }) => {
          setSelectedId(challengeId);
          navigate("/app/day", { replace: true });
        }).catch((err: unknown) => {
          if (err instanceof TeamInviteError) {
            navigate(`/error/team-invite-${err.reason}`, { replace: true });
          } else {
            setAutoJoinError("Не удалось вступить в челлендж. Пожалуйста, попробуйте снова.");
            setStep("profile");
          }
        });
      }
    } else if (userProfile && !invite && !inviteError) {
      // Invite still loading — wait (inviteLoading guard above handles this)
    } else {
      // Authenticated but no profile yet → show profile setup
      setStep("profile");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, userProfile, step, inviteLoading, invite, conflict, conflictLoading, accountConfirmed]);

  // Google auth sets step → "profile" synchronously before userProfile loads from
  // Firestore. Once it does, check if the user is already a member and skip the
  // join form entirely. Also handles stale challengeRoles from a failed leave.
  useEffect(() => {
    if (step !== "profile" || !currentUser || !userProfile || !invite) return;
    if (userProfile.challengeRoles?.[invite.challengeId]) {
      getDoc(participantRef(invite.challengeId, currentUser.uid)).then(snap => {
        if (snap.exists()) {
          setSelectedId(invite.challengeId);
          navigate("/app/day", { replace: true });
        } else {
          // Stale entry — remove it so the profile form can proceed to join.
          removeChallengeRole(currentUser.uid, invite.challengeId).catch(console.error);
        }
      });
    }
  }, [step, currentUser, userProfile, invite, setSelectedId, navigate]);

  const handleLeaveConflictAndJoin = async () => {
    if (!conflict || !currentUser) return;
    setLeavingConflict(true);
    try {
      await leaveChallenge(conflict.challengeId, currentUser.uid, conflict.wasTeamMember, conflict.actor);
      // userProfile.challengeRoles updates via the live subscription in
      // AuthContext — clearing conflict lets the effect above re-evaluate
      // and proceed with the normal join flow once it does.
      setConflict(null);
    } catch (e) {
      console.error("[OnboardingLayout] leaveChallenge failed:", e);
      setLeavingConflict(false);
    }
  };

  const handleStayInCurrentChallenge = () => {
    if (!conflict) return;
    setSelectedId(conflict.challengeId);
    navigate("/app/day", { replace: true });
  };

  // Item 4: account-choice actions for an already-signed-in user on an invite link.
  const handleContinueAsCurrentAccount = () => setAccountConfirmed(true);

  const handleSwitchAccount = async () => {
    await signOut(auth);
    // Reset the flow so the login screen shows fresh for the other account.
    setAccountConfirmed(false);
    setConflict(null);
    setTelegramData(undefined);
    setStep("telegram");
  };

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
    // The user just picked this account by signing in — no account-choice needed.
    setAccountConfirmed(true);
    setStep("profile");
  };

  const handleGoogleAuthOnboarding = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
    // Google auth resolves with name/photo in currentUser — profile step will read it
    setAccountConfirmed(true);
    setStep("profile");
  };

  const handleProfileDone = async (data: { name: string; ini: string }) => {
    if (currentUser && invite) {
      // Already a member (e.g. Google auth set step="profile" before userProfile
      // loaded, and the auto-redirect useEffect hasn't fired yet). Skip re-join —
      // setDoc on an existing participant doc would be rejected by Firestore rules.
      if (userProfile?.challengeRoles?.[invite.challengeId]) {
        const pSnap = await getDoc(participantRef(invite.challengeId, currentUser.uid));
        if (pSnap.exists()) {
          setSelectedId(invite.challengeId);
          navigate("/app/day", { replace: true });
          return;
        }
        // Stale entry (participant doc gone after failed leave) — fall through to re-join.
      }
      if (invite.type === "team") {
        const { challengeId } = await acceptTeamInvite(code, currentUser.uid, {
          name:     data.name,
          ini:      data.ini,
          tz:       detectTz(),
          photoUrl: currentUser.photoURL ?? null,
        }).catch((err: unknown) => {
          if (err instanceof TeamInviteError) {
            navigate(`/error/team-invite-${err.reason}`, { replace: true });
          }
          throw err;
        });
        setSelectedId(challengeId);
      } else {
        // Participants are added by name. This invite is not for operators.
        navigate("/", { replace: true });
        return;
      }
    }
    navigate("/app/day", { replace: true });
  };

  if (inviteLoading) return <FullScreenSpinner />;

  // No code provided — organizer landing
  if (!code) {
    return (
      <AuthLayout>
        <AuthMessage
          title="Трекер для организаторов"
          description="Участников добавляют по имени. Войдите, если вы организатор или помощник."
        >
          <Button variant="primary" size="lg" block onClick={() => navigate("/")}>Войти</Button>
        </AuthMessage>
      </AuthLayout>
    );
  }

  if (inviteError) {
    return (
      <AuthLayout>
        <AuthMessage icon={<Link2Off />} title="Приглашение недействительно" description={inviteError}>
          <Button variant="secondary" size="lg" block onClick={() => navigate("/")}>На главную</Button>
        </AuthMessage>
      </AuthLayout>
    );
  }

  if (invite && invite.type !== "team") {
    return (
      <AuthLayout>
        <AuthMessage
          icon={<Users />}
          title="Участникам вход не нужен"
          description="Организатор добавляет людей по имени и сам отмечает пробежки и задания. Эта ссылка не для входа участников."
        >
          <Button variant="primary" size="lg" block onClick={() => navigate("/")}>Вход для организаторов</Button>
        </AuthMessage>
      </AuthLayout>
    );
  }

  if (conflict) {
    return (
      <AuthLayout>
        <AuthMessage
          title="Вы уже в другом челлендже"
          description={<>Сейчас вы в команде «{conflict.name}». Чтобы присоединиться к новому, сначала нужно покинуть текущий.</>}
        >
          <Button variant="danger" size="lg" block onClick={handleLeaveConflictAndJoin} loading={leavingConflict}>
            Покинуть и присоединиться
          </Button>
          <Button variant="secondary" size="lg" block onClick={handleStayInCurrentChallenge} disabled={leavingConflict}>
            Остаться в текущем
          </Button>
        </AuthMessage>
      </AuthLayout>
    );
  }

  // Item 4: already signed in on arrival — let the user confirm which account to
  // join as, or switch, instead of silently assuming the current session.
  if (
    currentUser && userProfile && invite && !accountConfirmed &&
    !userProfile.challengeRoles?.[invite.challengeId]
  ) {
    const secondary = currentUser.email
      ?? (userProfile.telegramUsername ? `@${userProfile.telegramUsername}` : null);
    return (
      <AuthLayout>
        <AuthMessage
          icon={<UserRoundCheck />}
          title="Присоединиться к команде"
          description={<>Приглашение в «{invite.name}». Вы вошли в этот аккаунт:</>}
        >
          <div className="-mt-2 mb-2 flex items-center gap-3 rounded-xl border border-border px-4 py-3">
            <Av ini={userProfile.ini} photoUrl={userProfile.photoUrl} sz="md" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{userProfile.name}</p>
              {secondary && <p className="truncate text-[13px] text-muted-foreground">{secondary}</p>}
            </div>
          </div>
          <Button variant="primary" size="lg" block onClick={handleContinueAsCurrentAccount}>
            Продолжить как {userProfile.name.split(" ")[0]}
          </Button>
          <Button variant="secondary" size="lg" block onClick={handleSwitchAccount}>
            Войти в другой аккаунт
          </Button>
        </AuthMessage>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {step === "telegram" && (
        <TelegramLoginScreen challenge={preview} onAuth={handleTelegramAuth} onGoogleAuth={handleGoogleAuthOnboarding} />
      )}
      {step === "profile" && (
        <ProfileSetupScreen onDone={handleProfileDone} telegramData={telegramData} initialError={autoJoinError} />
      )}
    </AuthLayout>
  );
}

function ErrorLayout() {
  return (
    <AuthLayout>
      <ErrorScreen />
    </AuthLayout>
  );
}

function OrgLoginLayout() {
  return (
    <AuthLayout>
      <OrgLoginScreen />
    </AuthLayout>
  );
}

function ChallengesLayout() {
  const navigate = useNavigate();
  return (
    <div className="min-h-dvh bg-background">
      <ScrollRestoration />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-[1040px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <Logo />
          <Button variant="ghost" size="sm" onClick={async () => { await signOut(auth); navigate("/", { replace: true }); }}>
            Выйти
          </Button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  { path: "/", element: <RootLayout /> },

  // Onboarding — requires ?code=XXX to join a challenge
  { path: "/join", element: <OnboardingLayout /> },

  // Strava OAuth callback — no auth wrapper needed; screen handles unauthenticated state
  { path: "/strava-callback", element: <StravaCallbackScreen /> },

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

  // Participant profile — detail screen inside the app frame (no phone tab bar)
  {
    path: "/participants/:uid",
    element: <RequireAuth><AppShell variant="detail" /></RequireAuth>,
    children: [{ index: true, element: <ParticipantProfile /> }],
  },

  // Main app shell (auth required)
  {
    path: "/app",
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true,      element: <Navigate to="/app/day" replace /> },
      { path: "day",      element: <DayScreen /> },
      { path: "grid",     element: <GridScreen /> },
      { path: "rating",   element: <RatingScreen /> },
      { path: "settings", element: <OperatorSettingsScreen /> },
      { path: "team",     element: <TeamScreen /> },
      { path: "profile",  element: <ProfileScreen /> },
      { path: "home",     element: <Navigate to="/app/day" replace /> },
    ],
  },
]);
