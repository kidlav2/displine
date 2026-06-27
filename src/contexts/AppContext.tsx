import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type React from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import type { ChallengeData, Participant, Task, UserRole } from "../types";
import { detectTz } from "../lib/timezone";
import { getTodayRunDay, todayISO } from "../lib/dates";
import { useAuthContext } from "./AuthContext";
import {
  challengeRef, feedCol, participantsCol, tasksCol, teamCol,
  snapToParticipant, snapToFeedItem, snapToReviewItem, snapToTask, snapToTeamMember,
} from "../lib/firestore";

interface AppContextType {
  challenges: ChallengeData[];
  setChallenges: React.Dispatch<React.SetStateAction<ChallengeData[]>>;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  adminTz: string;
  setAdminTz: (tz: string) => void;
  adminTzAuto: boolean;
  setAdminTzAuto: (auto: boolean) => void;
  isRunDay: boolean;
  setIsRunDay: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  todayTask: Task | null;
  todayDeadline: string;
  // Derived helpers
  challenge: ChallengeData;
  meParticipant: Participant | null;
  isAdmin: boolean;
  isOwner: boolean;
  updateChallenge: (id: string, update: Partial<ChallengeData>) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, userProfile, authLoading } = useAuthContext();

  const [challenges, setChallenges] = useState<ChallengeData[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminTz, setAdminTz]       = useState<string>(detectTz);
  const [adminTzAuto, setAdminTzAuto] = useState(true);
  const [isRunDayState, setIsRunDay] = useState(false);
  // Start true — we don't know yet whether there are challenges to load
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [todayTask, setTodayTask]   = useState<Task | null>(null);

  // DEV-only role override; in production role comes from meParticipant.
  const [demoRole, setDemoRole] = useState<UserRole | null>(null);

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
    const unsubs = roleEntries.map(([cid]) =>
      onSnapshot(challengeRef(cid), (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        setChallenges(prev => {
          const existing = prev.find(c => c.id === cid);
          const merged: ChallengeData = {
            id: cid,
            name:        d.name        ?? "",
            emoji:       d.emoji       ?? "🏃",
            description: d.description ?? "",
            startDate:   d.startDate   ?? "",
            duration:    d.duration    ?? 30,
            currentDay:  d.currentDay  ?? 1,
            status:      d.status      ?? "active",
            inviteCode:  d.inviteCode  ?? "",
            totalTreasury: d.totalTreasury ?? 0,
            settings: d.settings ?? {
              runSchedule: {}, penaltyAmount: 0, currency: "KZT",
              burpees: 0, startingLives: 3,
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
      }
    );

    const feedUnsub = onSnapshot(
      query(feedCol(selectedId), orderBy("time", "desc")),
      (snap) => {
        const feed = snap.docs.map(snapToFeedItem);
        setChallenges(prev => prev.map(c => c.id === selectedId ? { ...c, feed } : c));
      }
    );

    // FLAG: submissions collection needs a composite index on (status, submittedAt)
    // if you want to also orderBy. For now, equality filter only — no index required.
    const queueUnsub = onSnapshot(
      query(collection(db, "challenges", selectedId, "submissions"), where("status", "==", "pending")),
      (snap) => {
        const queue = snap.docs.map(snapToReviewItem);
        setChallenges(prev => prev.map(c => c.id === selectedId ? { ...c, queue } : c));
      }
    );

    const teamUnsub = onSnapshot(
      query(teamCol(selectedId)),
      (snap) => {
        const team = snap.docs.map(snapToTeamMember);
        setChallenges(prev => prev.map(c => c.id === selectedId ? { ...c, team } : c));
      }
    );

    const taskUnsub = onSnapshot(
      query(tasksCol(selectedId), where("date", "==", todayISO())),
      (snap) => {
        setTodayTask(snap.docs.length > 0 ? snapToTask(snap.docs[0]) : null);
      }
    );

    return () => {
      participantsUnsub();
      feedUnsub();
      queueUnsub();
      teamUnsub();
      taskUnsub();
    };
  }, [selectedId, currentUser]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const challenge = challenges.find(c => c.id === selectedId) ?? challenges[0];

  const meParticipant: Participant | null = currentUser
    ? (challenge?.participants.find(p => p.uid === currentUser.uid) ?? null)
    : null;

  // isRunDay: derived from the challenge's runSchedule setting in production.
  // In DEV, setIsRunDay from DemoControls can override this.
  const derivedIsRunDay = !!(challenge?.settings.runSchedule?.[getTodayRunDay()]);
  const isRunDay = import.meta.env.DEV ? isRunDayState : derivedIsRunDay;
  const todayDeadline = challenge?.settings.runSchedule?.[getTodayRunDay()] ?? "06:00";

  // In production, role comes from Firestore (meParticipant.role).
  // In DEV, allow DemoControls to override via setUserRole.
  const userRole: UserRole = (import.meta.env.DEV && demoRole)
    ? demoRole
    : (meParticipant?.role ?? "participant");

  const setUserRole = (role: UserRole) => {
    if (import.meta.env.DEV) setDemoRole(role);
  };

  const isAdmin = userRole !== "participant";
  const isOwner = userRole === "owner";

  // FLAG: updateChallenge only patches local React state. All production writes
  // should use the specific functions in src/lib/firestore.ts instead.
  const updateChallenge = useCallback((id: string, update: Partial<ChallengeData>) => {
    setChallenges(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
  }, []);

  // True while auth is resolving OR while Firestore challenge docs are in-flight.
  // Consumers can gate rendering on this to avoid reading undefined challenge data.
  const loading = authLoading || challengeLoading;

  return (
    <AppContext.Provider value={{
      challenges, setChallenges,
      selectedId, setSelectedId,
      userRole, setUserRole,
      adminTz, setAdminTz,
      adminTzAuto, setAdminTzAuto,
      isRunDay, setIsRunDay,
      loading,
      todayTask, todayDeadline,
      challenge, meParticipant, isAdmin, isOwner,
      updateChallenge,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
