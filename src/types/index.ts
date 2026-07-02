export type ScoreKey = "running_on_time" | "running_late" | "task_completed" | "missed";

export type UserTab   = "home" | "tasks"   | "community" | "profile";
export type OwnerTab  = "home" | "review" | "community" | "manage" | "profile";
export type HelperTab = "home" | "review" | "community" | "profile";
export type AnyTab = UserTab | OwnerTab | HelperTab;

export type UserRole = "participant" | "helper" | "owner";
export type OrgRole  = "owner" | "helper";

export interface TeamMember {
  id: string; uid: string; email: string; name: string;
  role: OrgRole;
  status: "active" | "invited";
  since: string;
}

export type CommTab    = "leaderboard" | "feed" | "achievements";
export type SortKey    = "score" | "distance";
export type SubStatus  = "idle" | "pending" | "approved" | "rejected";
export type ReviewFilter  = "all" | "running" | "task" | "postponements";

export type PostponementStatus = "pending" | "approved" | "rejected";

export interface PostponementRequest {
  id: string;
  participantUid: string;
  participantName: string;
  participantIni: string;
  type: "task" | "running";
  taskId: string | null;
  taskTitle: string;
  dateISO: string;
  targetDateISO: string;
  status: PostponementStatus;
  reason: string;
  requestedAt: string;
  resolvedAt?: string;
  organizerNote?: string;
}
export type ManageSection = "main" | "create-task" | "create-achievement" | "participants" | "settings" | "team";
export type ChallengeStatus = "active" | "completed" | "upcoming";

export interface Penalty {
  date: string;
  reason: string;
  livesLost: number;
  amount: number;
  burpees?: number;
  paid?: boolean;
  penaltyId?: string;
}
export interface SocialComment { ini: string; name: string; text: string; }

export interface DayResult { type: "running" | "task"; scoreKey: ScoreKey; }

export interface Participant {
  uid: string;  // Firestore doc ID = Firebase Auth UID
  ini: string; name: string;
  photoUrl?: string | null;
  lives: number; km: number;
  active: boolean; isAdmin: boolean;
  joinDate: string; penalties: Penalty[];
  results: DayResult[];
  tz: string;
  role: UserRole;
}

export interface FeedItem {
  id: string;              // Firestore doc ID
  participantId: string;   // = participant UID
  ini: string; name: string; isAdmin: boolean;
  type: string; taskTitle: string;
  text: string; time: string;
  checkInPhotoUrl?: string | null;
  photoUrl: string | null;
  submissionStatus: "approved" | "pending" | "rejected" | null;
  organizerComment: string | null;
  km?: number; isLate?: boolean;
  pointsEarned: number;
  likes: string[];         // array of UIDs who liked (use .length for count, .includes(uid) for liked)
  socialComments: SocialComment[];
  stravaSource?: boolean;
}

export interface ReviewItem {
  id: string;              // Firestore doc ID (= submission doc ID)
  participantId: string;   // = participant UID
  ini: string; name: string; isAdmin: boolean;
  type: "running" | "checklist" | "freeform"; task: string;
  checkIn: string; resultT: string;
  checkInISO?: string;     // full ISO datetime of checkIn Timestamp; used to display Strava activity time
  participantTz: string;
  status: string; km: number | null;
  organizerComment: string | null;
  isLate: boolean;
  scoreKey: ScoreKey;
  text: string;
  checkInPhotoUrl?: string | null;
  photoUrl: string | null;
  stravaSource?: boolean;
}

/** Per-challenge scoring config — an ordered list of scoring entries. */
export type ScoringConfig = ScoringEntry[];

export interface ChallengeSettings {
  /** Map of weekday abbreviation → local deadline time. e.g. { Tue: "06:00", Sun: "07:00" } */
  runSchedule: Record<string, string>;
  penaltyAmount: number; currency: string; burpees: number;
  startingLives: number;
  scoring: ScoringConfig;
}

/** A single task instance for a specific date, shown to participants. */
export interface Task {
  id: string;
  date: string;           // "YYYY-MM-DD" UTC
  title: string;
  description: string;
  deadline: string;       // "HH:MM" in participant's local timezone
  type: "running" | "checklist" | "freeform";
  createdBy: string;
  templateId?: string;    // present when auto-generated from a recurring template
  checklistItems?: string[];           // checklist type: ordered list of step labels
  expectedKm?: number;                 // running type: optional target distance
  minDurationMin?: number;             // running type: minimum duration in minutes for auto-validation
}

/** Recurring task template — Cloud Function reads these to generate daily Task docs. */
export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  deadline: string;       // "HH:MM" fallback deadline
  type: "running" | "checklist" | "freeform";
  repeatDays: string[];   // ["Tue", "Thu", "Sat"]
  active: boolean;
  createdBy: string;
  checklistItems?: string[];                // checklist type: ordered step labels
  expectedKm?: number;                     // running type: optional target distance
  minDurationMin?: number;                 // running type: minimum run duration in minutes for auto-validation
  deadlineByDay?: Record<string, string>;  // running type: per-day deadlines e.g. { Tue: "06:00" }
}

export interface ChallengeData {
  id: string; name: string; emoji: string; description: string;
  startDate: string; endDate: string; duration: number; currentDay: number;
  status: ChallengeStatus; inviteCode: string;
  participants: Participant[];
  feed: FeedItem[];
  queue: ReviewItem[];
  settings: ChallengeSettings;
  team: TeamMember[];
  totalTreasury: number;   // sum of all penalty amounts paid into the pot
}

// ── Telegram ──────────────────────────────────────────────────────────────────
// User profile returned by the verifyTelegramLogin Cloud Function after OIDC JWT verification.
// Replaces the old TelegramAuthData (HMAC widget payload) which is now legacy.
export interface TelegramProfile {
  telegramId: number;
  telegramUsername: string | null;
  displayName: string;
  photoUrl: string | null;
}

// ── Firestore document shapes ─────────────────────────────────────────────────
// Stored in users/{uid}
export interface UserProfile {
  uid: string;
  name: string;
  ini: string;             // initials (e.g. "ЕС")
  phone?: string;
  email?: string;
  timezone: string;        // IANA tz string e.g. "Asia/Almaty"
  photoUrl?: string;
  telegramId?: number;
  telegramUsername?: string;
  bio?: string;
  socialLinks?: { instagram?: string; other?: string };
  // Map of challengeId → role. Used to query which challenges this user belongs to.
  challengeRoles: Record<string, UserRole>;
  // Strava integration
  stravaConnected?: boolean;
  stravaAthleteId?: number;
  stravaAthleteName?: string;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// Each entry maps a score key to a human-readable label + point value.
// The organizer can rename labels, change points, and add custom entries.
// "missed" is always 0 and not stored in the list.
export interface ScoringEntry {
  key: string;    // matches DayResult.scoreKey (e.g. "running_on_time")
  label: string;  // editable display label
  points: number;
}

// ── Achievements ─────────────────────────────────────────────────────────────
export type AchievementConditionType =
  | "km_total"    // p.km >= threshold
  | "tasks_total" // completed tasks >= threshold
  | "streak"      // longest consecutive non-missed streak >= threshold
  | "days_half"   // currentDay >= duration / 2
  | "first_week"  // any 7 non-missed results
  | "custom";     // manual unlock (freeform, always false client-side)

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  desc: string;
  conditionType: AchievementConditionType;
  conditionThreshold?: number;
}

export type EntryMode =
  | "no-invite"
  | "invite-invalid"
  | "challenge-ended"
  | "onboarding"
  | "org-login"
  | "app";

export type OnboardStep = "telegram" | "phone" | "verify" | "profile";

export type ErrorVariant = "no-invite" | "invite-invalid" | "challenge-ended" | "team-invite-expired" | "team-invite-used";

export interface NavTab { id: AnyTab; Icon: React.ElementType; label: string; }
