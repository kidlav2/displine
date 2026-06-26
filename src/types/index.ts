export type ScoreKey = "running_on_time" | "running_late" | "task_completed" | "missed";

export type UserTab   = "home" | "tasks"   | "community" | "profile";
export type OwnerTab  = "home" | "review" | "community" | "manage" | "profile";
export type HelperTab = "home" | "review" | "community" | "profile";
export type AnyTab = UserTab | OwnerTab | HelperTab;

export type UserRole = "participant" | "helper" | "owner";
export type OrgRole  = "owner" | "helper";

export interface TeamMember {
  id: string; email: string; name: string;
  role: OrgRole;
  status: "active" | "invited";
  since: string;
}

export type CommTab    = "leaderboard" | "feed" | "achievements";
export type SortKey    = "score" | "distance";
export type SubStatus  = "idle" | "pending" | "approved" | "rejected";
export type ReviewFilter  = "all" | "running" | "checklist";
export type ManageSection = "main" | "create-task" | "create-achievement" | "participants" | "settings" | "team";
export type ChallengeStatus = "active" | "completed" | "upcoming";

export interface Penalty { date: string; reason: string; livesLost: number; amount: number; }
export interface SocialComment { ini: string; name: string; text: string; }

export interface DayResult { type: "running" | "task"; scoreKey: ScoreKey; }

export interface Participant {
  uid: string;  // Firestore doc ID = Firebase Auth UID
  ini: string; name: string;
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
  photoUrl: string | null;
  submissionStatus: "approved" | "pending" | "rejected" | null;
  organizerComment: string | null;
  km?: number; isLate?: boolean;
  pointsEarned: number;
  likes: string[];         // array of UIDs who liked (use .length for count, .includes(uid) for liked)
  socialComments: SocialComment[];
}

export interface ReviewItem {
  id: string;              // Firestore doc ID (= submission doc ID)
  participantId: string;   // = participant UID
  ini: string; name: string; isAdmin: boolean;
  type: "running" | "checklist"; task: string;
  checkIn: string; resultT: string;
  participantTz: string;
  status: string; km: number | null;
  organizerComment: string | null;
}

export interface ChallengeSettings {
  runDays: string[];
  penaltyAmount: number; currency: string; burpees: number;
  startingLives: number; runDeadline: string;
}

export interface ChallengeData {
  id: string; name: string; emoji: string; description: string;
  startDate: string; duration: number; currentDay: number;
  status: ChallengeStatus; inviteCode: string;
  participants: Participant[];
  feed: FeedItem[];
  queue: ReviewItem[];
  settings: ChallengeSettings;
  team: TeamMember[];
  totalTreasury: number;   // sum of all penalty amounts paid into the pot
}

// ── Telegram ──────────────────────────────────────────────────────────────────
// Payload received from the Telegram Login Widget callback
export interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
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
  // Map of challengeId → role. Used to query which challenges this user belongs to.
  challengeRoles: Record<string, UserRole>;
}

export type EntryMode =
  | "no-invite"
  | "invite-invalid"
  | "challenge-ended"
  | "onboarding"
  | "org-login"
  | "app";

export type OnboardStep = "telegram" | "phone" | "verify" | "profile";

export type ErrorVariant = "no-invite" | "invite-invalid" | "challenge-ended";

export interface NavTab { id: AnyTab; Icon: React.ElementType; label: string; }
