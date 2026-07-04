import { createBrowserRouter, Navigate, Outlet, useNavigate, useSearchParams } from "react-router";
import { useEffect, useState } from "react";
import { signInWithCustomToken, signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../lib/firebase";
import {
  resolveInviteCode, joinChallengeAsParticipant, acceptTeamInvite, TeamInviteError,
  challengeRef, participantRef, leaveChallenge, removeChallengeRole, type InviteData,
} from "../lib/firestore";
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
import { StravaCallbackScreen } from "../screens/StravaCallbackScreen";

import { useAppContext } from "../contexts/AppContext";
import { Av } from "../components/atoms";
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

function NoChallengesStep({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [codeInput, setCodeInput] = useState("");
  const submit = () => codeInput.trim() && navigate(`/join?code=${encodeURIComponent(codeInput.trim())}`);
  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 text-center" style={{ minHeight: "min(600px, 100vh)" }}>
      <p className="text-4xl">🏁</p>
      <div className="space-y-1">
        <p className="font-extrabold text-xl">Нет челленджей</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Создайте новый челлендж или введите код приглашения от организатора.
        </p>
      </div>
      <button
        onClick={() => navigate("/challenges/create")}
        className="w-full max-w-[280px] px-6 py-3 rounded-2xl font-extrabold text-sm text-white"
        style={{ background: "#FF4F00" }}
      >
        Создать новый челлендж
      </button>
      <div className="w-full max-w-[280px] flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-semibold text-muted-foreground">или</span>
        <div className="flex-1 h-px bg-border" />
      </div>
      <div className="w-full max-w-[280px] flex gap-2">
        <input
          value={codeInput}
          onChange={e => setCodeInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="Код приглашения"
          className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none placeholder-muted-foreground tracking-wider"
        />
        <button
          onClick={submit}
          disabled={!codeInput.trim()}
          className="px-4 py-2.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-40"
          style={{ background: "#2AABEE" }}
        >
          Войти
        </button>
      </div>
    </div>
  );
}

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
    return <NoChallengesStep navigate={navigate} />;
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
            navigate("/app/home", { replace: true });
          } else {
            removeChallengeRole(currentUser.uid, invite.challengeId).catch(console.error);
          }
        });
        return;
      }

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
          navigate("/app/home", { replace: true });
        }).catch((err: unknown) => {
          if (err instanceof TeamInviteError) {
            navigate(`/error/team-invite-${err.reason}`, { replace: true });
          } else {
            setAutoJoinError("Не удалось вступить в челлендж. Пожалуйста, попробуйте снова.");
            setStep("profile");
          }
        });
      } else {
        joinChallengeAsParticipant(
          invite.challengeId,
          currentUser.uid,
          { name: userProfile.name, ini: userProfile.ini, tz: userProfile.timezone,
            photoUrl: userProfile.photoUrl ?? currentUser.photoURL ?? null },
          invite.startingLives,
          code,
        ).then(() => {
          setSelectedId(invite.challengeId);
          navigate("/app/home", { replace: true });
        }).catch((err: unknown) => {
          // Surface the failure instead of silently bouncing back to the form.
          console.error("[OnboardingLayout] auto-join failed:", err);
          setAutoJoinError("Не удалось вступить в челлендж. Пожалуйста, попробуйте снова.");
          setStep("profile");
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
          navigate("/app/home", { replace: true });
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
    navigate("/app/home", { replace: true });
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
          navigate("/app/home", { replace: true });
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
        await joinChallengeAsParticipant(
          invite.challengeId,
          currentUser.uid,
          { name: data.name, ini: data.ini, tz: detectTz(),
            photoUrl: currentUser.photoURL ?? null },
          invite.startingLives,
          code,
        );
        setSelectedId(invite.challengeId);
      }
    }
    navigate("/app/home", { replace: true });
  };

  const [codeInput, setCodeInput] = useState("");

  if (inviteLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" style={jk}>
        <p className="text-sm text-muted-foreground">Загрузка челленджа…</p>
      </div>
    );
  }

  // No code provided — show join-or-create landing
  if (!code) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center gap-6" style={jk}>
        <p className="text-5xl">🏁</p>
        <div className="space-y-1.5">
          <p className="font-extrabold text-xl">Присоединиться или создать</p>
          <p className="text-sm text-muted-foreground max-w-[280px] leading-snug">
            Создайте свой челлендж или введите код приглашения от организатора.
          </p>
        </div>
        <div className="w-full max-w-[320px] flex flex-col gap-3">
          <button
            onClick={() => navigate("/challenges/create")}
            className="w-full py-3.5 rounded-2xl font-extrabold text-sm text-white"
            style={{ background: "#FF4F00" }}
          >
            Создать новый челлендж
          </button>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-semibold text-muted-foreground">или</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="flex gap-2">
            <input
              value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && codeInput.trim() && navigate(`/join?code=${encodeURIComponent(codeInput.trim())}`)}
              placeholder="Код приглашения"
              className="flex-1 bg-muted rounded-xl px-3 py-2.5 text-sm font-semibold outline-none placeholder-muted-foreground tracking-wider"
            />
            <button
              onClick={() => codeInput.trim() && navigate(`/join?code=${encodeURIComponent(codeInput.trim())}`)}
              disabled={!codeInput.trim()}
              className="px-4 py-2.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-40"
              style={{ background: "#2AABEE" }}
            >
              Войти
            </button>
          </div>
        </div>
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
          <button
            onClick={() => navigate("/join")}
            className="mt-2 px-6 py-2.5 rounded-xl font-extrabold text-sm text-white"
            style={{ background: "#FF4F00" }}
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (conflict) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6" style={jk}>
        <div className="text-center space-y-4 max-w-xs">
          <p className="text-3xl">{conflict.emoji}</p>
          <p className="font-extrabold text-lg">Вы уже в другом челлендже</p>
          <p className="text-sm text-muted-foreground leading-snug">
            Вы уже участвуете в другом челлендже — <span className="font-semibold text-foreground">{conflict.name}</span>.
            Чтобы присоединиться к этому, нужно сначала покинуть текущий.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={handleLeaveConflictAndJoin}
              disabled={leavingConflict}
              className="px-6 py-3 rounded-xl font-extrabold text-sm text-destructive-foreground bg-destructive disabled:opacity-40"
            >
              {leavingConflict ? "…" : "Покинуть текущий и присоединиться"}
            </button>
            <button
              onClick={handleStayInCurrentChallenge}
              disabled={leavingConflict}
              className="px-6 py-2.5 rounded-xl font-bold text-sm border border-border disabled:opacity-40"
            >
              Остаться в текущем
            </button>
          </div>
        </div>
      </div>
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
      <div className="min-h-screen bg-background flex items-center justify-center px-6" style={jk}>
        <div className="text-center space-y-5 max-w-xs">
          <p className="text-3xl">{invite.emoji}</p>
          <div className="space-y-1">
            <p className="font-extrabold text-lg">Присоединиться к челленджу</p>
            <p className="text-sm text-muted-foreground leading-snug">
              <span className="font-semibold text-foreground">{invite.name}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 justify-center rounded-2xl border border-border bg-card px-4 py-3">
            <Av ini={userProfile.ini} photoUrl={userProfile.photoUrl} sz="md" />
            <div className="text-left min-w-0">
              <p className="text-sm font-bold truncate">{userProfile.name}</p>
              {secondary && <p className="text-xs text-muted-foreground truncate">{secondary}</p>}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Вы вошли как этот аккаунт. Продолжить?</p>
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleContinueAsCurrentAccount}
              className="px-6 py-3 rounded-xl font-extrabold text-sm text-white"
              style={{ background: "#FF4F00" }}
            >
              Продолжить как {userProfile.name}
            </button>
            <button
              onClick={handleSwitchAccount}
              className="px-6 py-2.5 rounded-xl font-bold text-sm border border-border"
            >
              Войти в другой аккаунт
            </button>
          </div>
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
            <ProfileSetupScreen onDone={handleProfileDone} telegramData={telegramData} initialError={autoJoinError} />
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
