import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type React from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { Achievement, ChallengeData, Participant, PostponementRequest, ScoringConfig, Task, UserRole } from "../types";
import { parseScoring, DEFAULT_SCORING } from "../constants/scoring";
import { detectTz } from "../lib/timezone";
import { challengeCurrentDay, todayRunDayInTz, todayISO } from "../lib/dates";

/** Normalize any Firestore date value (Timestamp, ISO "YYYY-MM-DD", or legacy English string like "Jun 28, 2026") to "YYYY-MM-DD". */
function toISODate(v: unknown): string {
  if (!v) return "";
  if (typeof v === "object" && v !== null && "toDate" in v) {
    const d = (v as { toDate(): Date }).toDate();
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  if (typeof v !== "string") return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  // Legacy English format stored in Firestore (e.g. "Jun 28, 2026")
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
import { useAuthContext } from "./AuthContext";
import {
  challengeRef, participantsCol, tasksCol, teamCol, achievementsCol,
  snapToParticipant, snapToReviewItem, snapToTask, snapToTeamMember, snapToAchievement,
  subscribeToPostponementQueue,
} from "../lib/firestore";

interface AppContextType {
  challenges: ChallengeData[];
  setChallenges: React.Dispatch<React.SetStateAction<ChallengeData[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  userRole: UserRole;
  adminTz: string;
  setAdminTz: (tz: string) => void;
  adminTzAuto: boolean;
  setAdminTzAuto: (auto: boolean) => void;
  isRunDay: boolean;
  loading: boolean;
  todayTask: Task | null;
  todayDeadline: string;
  // Derived helpers
  challenge: ChallengeData;
  meParticipant: Participant | null;
  isAdmin: boolean;
  isOwner: boolean;
  scoring: ScoringConfig;
  achievements: Achievement[];
  postponementQueue: PostponementRequest[];
  updateChallenge: (id: string, update: Partial<ChallengeData>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, authLoading } = useAuthContext();

  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminTz, setAdminTz]       = useState<string>(detectTz);
  const [adminTzAuto, setAdminTzAuto] = useState(true);
  // Start true — we don't know yet whether there are challenges to load
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [todayTask, setTodayTask]   = useState<Task | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [postponementQueue, setPostponementQueue] = useState<PostponementRequest[]>([]);

  // ── Load challenge metadata from Firestore ────────────────────────────────
  useEffect(() => {
    // Auth still resolving — stay in loading state
    if (authLoading) return;

    // Not signed in or no profile yet — nothing to load
    if (!currentUser || !userProfile) {
      setChallengeLoading(false);
      return;
    }

    const roleEntries = Object.entries(userProfile.challengeRoles);
    if (roleEntries.length === 0) {
      setChallenges([]);
      setChallengeLoading(false);
      return;
    }

    setChallengeLoading(true);
    let resolvedCount = 0;
    const unsubs = roleEntries.map(([cid]) =>
      onSnapshot(challengeRef(cid), (snap) => {
        if (!snap.exists()) {
          // Challenge doc missing — count as resolved so loading unblocks.
          resolvedCount++;
          if (resolvedCount >= roleEntries.length) setChallengeLoading(false);
          return;
        }
        const d = snap.data();
        setChallenges(prev => {
          const existing = prev.find(c => c.id === cid);
          const merged: ChallengeData = {
            id: cid,
            name:        d.name        ?? "",
            emoji:       d.emoji       ?? "🏃",
            description: d.description ?? "",
            startDate:   toISODate(d.startDate),
            endDate:     toISODate(d.endDate),
            duration:    d.duration    ?? 30,
            currentDay:  d.currentDay  ?? 1,
            status:      d.status      ?? "active",
            inviteCode:  d.inviteCode  ?? "",
            totalTreasury: d.totalTreasury ?? 0,
            settings: {
              runSchedule:   d.settings?.runSchedule   ?? {},
              penaltyAmount: d.settings?.penaltyAmount ?? 0,
              currency:      d.settings?.currency      ?? "KZT",
              burpees:       d.settings?.burpees       ?? 0,
              startingLives: d.settings?.startingLives ?? 3,
              scoring: parseScoring(d.settings?.scoring),
            },
            // Preserve any subcollection data already loaded
            participants: existing?.participants ?? [],
            feed:         existing?.feed         ?? [],
            queue:        existing?.queue        ?? [],
            team:         existing?.team         ?? [],
          };
          const idx = prev.findIndex(c => c.id === cid);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = merged;
            return next;
          }
          return [...prev, merged];
        });
        setChallengeLoading(false);

        // Auto-select if this is the only challenge
        setSelectedId(prev => prev ?? (roleEntries.length === 1 ? cid : null));
      }, (err) => {
        // Permission denied (user removed from challenge) or network error.
        // Unblock the loading state so the UI can show the appropriate fallback.
        console.warn(`[AppContext] challenge ${cid} snapshot error:`, err.code);
        resolvedCount++;
        if (resolvedCount >= roleEntries.length) setChallengeLoading(false);
      })
    );

    return () => unsubs.forEach(u => u());
  }, [authLoading, currentUser, userProfile]);

  // ── Subscribe to active challenge subcollections ──────────────────────────
  useEffect(() => {
    if (!selectedId || !currentUser) return;

    const participantsUnsub = onSnapshot(
      query(participantsCol(selectedId)),
      (snap) => {
        const participants = snap.docs.map(snapToParticipant);
        setChallenges(prev => prev.map(c => c.id === selectedId ? { ...c, participants } : c));
      },
      (err) => console.error("[AppContext] participants subscription error:", err)
    );

    // Feed is loaded on-demand with pagination by CommunityScreen — no global subscription here.

    const taskUnsub = onSnapshot(
      query(tasksCol(selectedId), where("date", "==", todayISO())),
      (snap) => {
        setTodayTask(snap.docs.length > 0 ? snapToTask(snap.docs[0]) : null);
      },
      (err) => console.error("[AppContext] tasks subscription error:", err)
    );

    const achUnsub = onSnapshot(
      query(achievementsCol(selectedId)),
      (snap) => { setAchievements(snap.docs.map(snapToAchievement)); },
      (err) => console.error("[AppContext] achievements subscription error:", err)
    );

    return () => {
      participantsUnsub();
      taskUnsub();
      achUnsub();
    };
  }, [selectedId, currentUser]);

  // ── Derived state (memoized so the context value stays referentially stable
  // across renders that don't actually change the underlying data) ───────────
  const rawChallenge = useMemo(
    () => challenges.find(c => c.id === selectedId) ?? challenges[0],
    [challenges, selectedId],
  );

  // Compute currentDay dynamically from startDate so it is always accurate
  // regardless of what value is stored in the Firestore challenge doc.
  const challenge = useMemo(
    () => rawChallenge
      ? { ...rawChallenge, currentDay: challengeCurrentDay(rawChallenge.startDate, rawChallenge.duration) }
      : rawChallenge,
    [rawChallenge],
  );

  const meParticipant = useMemo<Participant | null>(
    () => currentUser
      ? (challenge?.participants.find(p => p.uid === currentUser.uid) ?? null)
      : null,
    [challenge, currentUser],
  );

  // Use participant's stored timezone so isRunDay and deadline are correct
  // for their local time, not the browser's OS clock timezone.
  const participantTz = meParticipant?.tz ?? detectTz();
  const { isRunDay, todayDeadline } = useMemo(() => {
    const day = todayRunDayInTz(participantTz);
    const deadline = challenge?.settings.runSchedule?.[day];
    return { isRunDay: !!deadline, todayDeadline: deadline ?? "06:00" };
  }, [challenge, participantTz]);

  const userRole: UserRole = meParticipant?.role ?? "participant";

  const isAdmin = userRole !== "participant";
  const isOwner = userRole === "owner";

  const scoring: ScoringConfig = useMemo(
    () => challenge?.settings.scoring ?? DEFAULT_SCORING,
    [challenge],
  );

  // ── Admin-only subscriptions (queue + team) ───────────────────────────────
  // Runs only after participants load and isAdmin is resolved. Regular
  // participants do not have read access to these collections.
  useEffect(() => {
    if (!selectedId || !currentUser || !isAdmin) return;

    const queueUnsub = onSnapshot(
      query(collection(db, "challenges", selectedId, "submissions"), where("status", "==", "pending")),
      (snap) => {
        const queue = snap.docs.map(snapToReviewItem);
        setChallenges(prev => prev.map(c => c.id === selectedId ? { ...c, queue } : c));
      },
      (err) => console.error("[AppContext] queue subscription error:", err)
    );

    const teamUnsub = onSnapshot(
      query(teamCol(selectedId)),
      (snap) => {
        const team = snap.docs.map(snapToTeamMember);
        setChallenges(prev => prev.map(c => c.id === selectedId ? { ...c, team } : c));
      },
      (err) => console.error("[AppContext] team subscription error:", err)
    );

    const postponementsUnsub = subscribeToPostponementQueue(
      selectedId,
      (items) => setPostponementQueue(items)
    );

    return () => { queueUnsub(); teamUnsub(); postponementsUnsub(); };
  }, [selectedId, currentUser, isAdmin]);

  // FLAG: updateChallenge only patches local React state. All production writes
  // should use the specific functions in src/lib/firestore.ts instead.
  const updateChallenge = useCallback((id: string, update: Partial<ChallengeData>) => {
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
  }, []);

  // True while auth is resolving OR while Firestore challenge docs are in-flight.
  // Consumers can gate rendering on this to avoid reading undefined challenge data.
  const loading = authLoading || challengeLoading;

  // Memoize the context value so consumers only re-render when a value they
  // depend on actually changes — not on every AppProvider render. State setters
  // (setChallenges, setSelectedId, setAdminTz, setAdminTzAuto) are stable and
  // intentionally omitted from the dependency list.
  const value = useMemo<AppContextType>(() => ({
    challenges, setChallenges,
    selectedId, setSelectedId,
    userRole,
    adminTz, setAdminTz,
    adminTzAuto, setAdminTzAuto,
    isRunDay,
    loading,
    todayTask, todayDeadline,
    challenge, meParticipant, isAdmin, isOwner, scoring,
    achievements,
    postponementQueue,
    updateChallenge,
  }), [
    challenges, selectedId, userRole, adminTz, adminTzAuto,
    isRunDay, loading, todayTask, todayDeadline,
    challenge, meParticipant, isAdmin, isOwner, scoring,
    achievements, postponementQueue, updateChallenge,
  ]);

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
