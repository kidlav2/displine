/**
 * TODO: REPLACE WITH FIREBASE
 * All constants in this file are temporary mock/seed data used during development.
 * They will be removed once Firestore collections and Firebase Auth are wired up.
 */

import type { ChallengeData, ChallengeSettings, DayResult, FeedItem, Participant, ReviewItem, TeamMember } from "../../types";
import { calcScore } from "../../lib/scoring";

// ── Unsplash proof photos (replace with Firebase Storage URLs per submission) ──
export const PHOTOS = {
  run1:    "https://images.unsplash.com/photo-1513593771513-7b58b6c4af38?w=800&h=440&fit=crop&auto=format",
  run2:    "https://images.unsplash.com/photo-1603455778956-d71832eafa4e?w=800&h=440&fit=crop&auto=format",
  journal: "https://images.unsplash.com/photo-1620275765334-4ed948bb4502?w=800&h=440&fit=crop&auto=format",
  journal2:"https://images.unsplash.com/photo-1569360556894-15dca0c6ff1a?w=800&h=440&fit=crop&auto=format",
  reading: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=800&h=440&fit=crop&auto=format",
} as const;

// ── Mock achievements (replace with achievements subcollection per challenge) ──
export const ACHIEVEMENTS = [
  { icon: "🔥", title: "10 дней подряд",   desc: "10 дней без пропуска задания",          unlocked: true  },
  { icon: "⚡", title: "Первая неделя",    desc: "Завершили первую полную неделю",         unlocked: true  },
  { icon: "❤️", title: "Полные жизни",    desc: "5 жизней 5 дней подряд",                 unlocked: true  },
  { icon: "🏃", title: "Клуб 25 км",      desc: "Пробежали в сумме 25 км",                unlocked: true  },
  { icon: "🧘", title: "Внутренний покой", desc: "Выполнили 5 заданий по ведению дневника", unlocked: false },
  { icon: "🗓",  title: "На полпути",      desc: "Достигли дня 25",                        unlocked: false },
];

// ── Default challenge settings ──
export const DEFAULT_SETTINGS: ChallengeSettings = {
  runSchedule: { Tue: "06:00", Thu: "06:00", Sat: "06:00", Sun: "07:00" },
  penaltyAmount: 5000, currency: "₸", burpees: 20,
  startingLives: 5,
  scoring: [
    { key: "running_on_time", label: "Пробежка вовремя", points: 2 },
    { key: "running_late",    label: "Пробежка с оп.",   points: 1 },
    { key: "task_completed",  label: "Задание выполнено", points: 5 },
  ],
};

// ── Participant activity histories ──
const RESULTS_ALIYA: DayResult[] = [
  ...Array(10).fill({ type: "task", scoreKey: "task_completed" }),
  ...Array(2).fill({ type: "running", scoreKey: "running_on_time" }),
];
const RESULTS_DENIS: DayResult[] = [
  ...Array(8).fill({ type: "task", scoreKey: "task_completed" }),
  ...Array(2).fill({ type: "running", scoreKey: "running_on_time" }),
  { type: "task", scoreKey: "missed" },
  { type: "running", scoreKey: "running_late" },
];
const RESULTS_SAULE: DayResult[] = [
  ...Array(9).fill({ type: "task", scoreKey: "task_completed" }),
  ...Array(2).fill({ type: "running", scoreKey: "running_on_time" }),
  { type: "task", scoreKey: "missed" },
];
const RESULTS_RUSTEM: DayResult[] = [
  ...Array(7).fill({ type: "task", scoreKey: "task_completed" }),
  ...Array(2).fill({ type: "running", scoreKey: "running_late" }),
  ...Array(2).fill({ type: "task", scoreKey: "missed" }),
  { type: "running", scoreKey: "missed" },
];
const RESULTS_KARINA: DayResult[] = [
  ...Array(5).fill({ type: "task", scoreKey: "task_completed" }),
  { type: "running", scoreKey: "running_on_time" },
  ...Array(4).fill({ type: "task", scoreKey: "missed" }),
  { type: "running", scoreKey: "missed" },
];
const RESULTS_ZHASLAN: DayResult[] = [
  ...Array(3).fill({ type: "task", scoreKey: "task_completed" }),
  { type: "running", scoreKey: "running_late" },
  ...Array(8).fill({ type: "task", scoreKey: "missed" }),
];

// ── Participants (uid is the Firebase Auth UID; mock uses "u1", "u2", etc.) ──
export const INIT_PARTICIPANTS: Participant[] = [
  { uid: "u1", ini: "АМ", name: "Алия М.",    role: "owner",       lives: 5, km: 47.2, active: true,  isAdmin: true,  joinDate: "Jun 14", tz: "Asia/Almaty",     penalties: [], results: RESULTS_ALIYA   },
  { uid: "u2", ini: "ДК", name: "Денис К.",   role: "participant", lives: 4, km: 43.8, active: true,  isAdmin: false, joinDate: "Jun 14", tz: "Europe/Moscow",   penalties: [{ date: "Jun 18", reason: "Late submission", livesLost: 1, amount: 5000 }], results: RESULTS_DENIS   },
  { uid: "u3", ini: "СБ", name: "Сауле Б.",   role: "participant", lives: 5, km: 39.5, active: true,  isAdmin: false, joinDate: "Jun 14", tz: "Asia/Almaty",     penalties: [], results: RESULTS_SAULE   },
  { uid: "u4", ini: "РА", name: "Рустем А.",  role: "participant", lives: 3, km: 35.0, active: true,  isAdmin: false, joinDate: "Jun 14", tz: "Asia/Tashkent",   penalties: [{ date: "Jun 16", reason: "Missed run", livesLost: 1, amount: 5000 }, { date: "Jun 20", reason: "No proof photo", livesLost: 1, amount: 5000 }], results: RESULTS_RUSTEM  },
  { uid: "u5", ini: "КТ", name: "Карина Т.",  role: "participant", lives: 2, km: 28.3, active: true,  isAdmin: false, joinDate: "Jun 14", tz: "America/Toronto", penalties: [{ date: "Jun 15", reason: "Late check-in", livesLost: 1, amount: 5000 }, { date: "Jun 22", reason: "Skipped task", livesLost: 1, amount: 5000 }], results: RESULTS_KARINA  },
  { uid: "u6", ini: "ЖО", name: "Жасулан О.", role: "participant", lives: 0, km: 12.0, active: false, isAdmin: false, joinDate: "Jun 14", tz: "Asia/Almaty",     penalties: [{ date: "Jun 19", reason: "Missed run", livesLost: 1, amount: 5000 }], results: RESULTS_ZHASLAN },
];

// ── Activity feed (likes is now array of UIDs; "u_me" means the mock current user liked) ──
export const INIT_FEED: FeedItem[] = [
  {
    id: "f1", participantId: "u1", ini: "АМ", name: "Алия М.", isAdmin: true,
    type: "checklist", taskTitle: "Journaling", text: "completed Day 12 — Journaling ✍️",
    time: "2h ago", photoUrl: PHOTOS.journal, submissionStatus: "approved",
    organizerComment: null, pointsEarned: 5,
    likes: ["u2", "u3", "u4", "u5", "u6"], socialComments: [{ ini: "ДК", name: "Денис К.", text: "Keep it up! 🔥" }, { ini: "СБ", name: "Сауле Б.", text: "Inspiring!" }],
  },
  {
    id: "f2", participantId: "u2", ini: "ДК", name: "Денис К.", isAdmin: false,
    type: "running", taskTitle: "Morning run", text: "submitted run — 4.8 km",
    time: "3h ago", photoUrl: PHOTOS.run1, submissionStatus: "rejected",
    organizerComment: "Check-in timestamp missing — app was closed before 06:00. Resubmit with GPS trace.", isLate: false, km: 4.8, pointsEarned: 0,
    likes: ["u3", "u4"], socialComments: [{ ini: "АМ", name: "Алия М.", text: "You got this, try again!" }],
  },
  {
    id: "f3", participantId: "u3", ini: "СБ", name: "Сауле Б.", isAdmin: false,
    type: "running", taskTitle: "Morning run", text: "completed run — 5.1 km on time ✓",
    time: "5h ago", photoUrl: PHOTOS.run2, submissionStatus: "approved",
    organizerComment: null, isLate: false, km: 5.1, pointsEarned: 2,
    likes: ["u1", "u2", "u4", "u5", "u6", "u_me", "u7", "u8", "u9"], socialComments: [{ ini: "РА", name: "Рустем А.", text: "Legendary 🙌" }, { ini: "КТ", name: "Карина Т.", text: "Goals!" }],
  },
  {
    id: "f4", participantId: "u4", ini: "РА", name: "Рустем А.", isAdmin: false,
    type: "checklist", taskTitle: "Read for 30 min", text: "submitted — Read for 30 min",
    time: "6h ago", photoUrl: PHOTOS.reading, submissionStatus: "pending",
    organizerComment: null, pointsEarned: 0,
    likes: ["u1", "u2", "u3", "u5"], socialComments: [],
  },
  {
    id: "f5", participantId: "u5", ini: "КТ", name: "Карина Т.", isAdmin: false,
    type: "checklist", taskTitle: "Social media detox", text: "completed Day 11 — social media detox 📵",
    time: "1d ago", photoUrl: null, submissionStatus: "approved",
    organizerComment: null, pointsEarned: 5,
    likes: ["u1", "u2", "u3", "u4", "u6", "u7", "u8"], socialComments: [{ ini: "АМ", name: "Алия М.", text: "So hard but worth it!" }],
  },
  {
    id: "f6", participantId: "u1", ini: "АМ", name: "Алия М.", isAdmin: true,
    type: "checklist", taskTitle: "Journaling", text: "submitted Day 11 — Journaling",
    time: "1d ago", photoUrl: PHOTOS.journal2, submissionStatus: "rejected",
    organizerComment: "Photo too dark — items not visible. Please resubmit in better lighting.",
    pointsEarned: 0, likes: ["u2"], socialComments: [],
  },
  {
    id: "f7", participantId: "u6", ini: "ЖО", name: "Жасулан О.", isAdmin: false,
    type: "eliminated", taskTitle: "", text: "was eliminated — lost all 5 lives",
    time: "2d ago", photoUrl: null, submissionStatus: null,
    organizerComment: null, pointsEarned: 0,
    likes: ["u3"], socialComments: [{ ini: "ДК", name: "Денис К.", text: "Thanks for the journey 🙏" }],
  },
];

// ── Review queue ──
export const INIT_QUEUE: ReviewItem[] = [
  { id: "q1", participantId: "u1", ini: "АМ", name: "Алия М.",    isAdmin: true,  type: "checklist", task: "Journaling",     checkIn: "—",     resultT: "21:10", participantTz: "Asia/Almaty",     status: "pending",     km: null, organizerComment: null },
  { id: "q2", participantId: "u2", ini: "ДК", name: "Денис К.",   isAdmin: false, type: "running",   task: "Morning run",   checkIn: "05:48", resultT: "07:02", participantTz: "Europe/Moscow",   status: "in_progress", km: null, organizerComment: null },
  { id: "q3", participantId: "u3", ini: "СБ", name: "Сауле Б.",   isAdmin: false, type: "running",   task: "Morning run",   checkIn: "05:55", resultT: "07:15", participantTz: "Asia/Almaty",     status: "approved",    km: 5.1,  organizerComment: "Great pacing, approved!" },
  { id: "q4", participantId: "u4", ini: "РА", name: "Рустем А.",  isAdmin: false, type: "checklist", task: "Home declutter", checkIn: "—",     resultT: "23:58", participantTz: "Asia/Tashkent",  status: "late",        km: null, organizerComment: null },
  { id: "q5", participantId: "u5", ini: "КТ", name: "Карина Т.",  isAdmin: false, type: "checklist", task: "Read 30 min",   checkIn: "—",     resultT: "—",     participantTz: "America/Toronto", status: "missing",     km: null, organizerComment: null },
];

// ── Team members ──
export const INIT_TEAM: TeamMember[] = [
  { id: "t1", email: "nurlan@example.com",  name: "Нурлан А.", role: "owner",  status: "active",  since: "Jun 14, 2026" },
  { id: "t2", email: "aisha@example.com",   name: "Айша М.",   role: "helper", status: "active",  since: "Jun 14, 2026" },
  { id: "t3", email: "vitaliy@example.com", name: "Виталий К.",role: "helper", status: "invited", since: "Jun 20, 2026" },
];

// ── Challenges ──
const MAIN_CHALLENGE: ChallengeData = {
  id: "ch1", name: "50-Day Discipline", emoji: "🔥",
  description: "Daily tasks, morning runs, zero excuses.",
  startDate: "Jun 14, 2026", endDate: "Aug 2, 2026", duration: 50, currentDay: 12,
  status: "active", inviteCode: "DISC-7X4K",
  participants: INIT_PARTICIPANTS,
  feed: INIT_FEED, queue: INIT_QUEUE,
  settings: DEFAULT_SETTINGS,
  team: INIT_TEAM,
  totalTreasury: 45000,
};

export const INIT_CHALLENGES: ChallengeData[] = [
  MAIN_CHALLENGE,
  {
    id: "ch2", name: "Winter Grind", emoji: "❄️",
    description: "30 days of cold showers, reading, and runs.",
    startDate: "Jan 1, 2026", endDate: "Jan 30, 2026", duration: 30, currentDay: 30,
    status: "completed", inviteCode: "WGND-2P9R",
    participants: [
      { uid: "u10", ini: "АМ", name: "Алия М.",  role: "owner",       lives: 4, km: 28.0, active: true,  isAdmin: true,  joinDate: "Jan 1", tz: "Asia/Almaty",   penalties: [], results: [] },
      { uid: "u11", ini: "ДК", name: "Денис К.", role: "participant", lives: 3, km: 22.5, active: true,  isAdmin: false, joinDate: "Jan 1", tz: "Europe/Moscow", penalties: [], results: [] },
      { uid: "u12", ini: "МТ", name: "Мади Т.",  role: "participant", lives: 5, km: 31.2, active: true,  isAdmin: false, joinDate: "Jan 1", tz: "Asia/Almaty",   penalties: [], results: [] },
    ],
    feed: [], queue: [],
    settings: { ...DEFAULT_SETTINGS, runSchedule: { Mon: "06:00", Wed: "06:00", Fri: "06:00" }, penaltyAmount: 3000 },
    team: [{ id: "t1", email: "nurlan@example.com", name: "Нурлан А.", role: "owner", status: "active", since: "Jan 1, 2026" }],
    totalTreasury: 12000,
  },
  {
    id: "ch3", name: "Autumn Reset", emoji: "🍂",
    description: "40 days. Digital detox, journaling, and walks.",
    startDate: "Sep 15, 2026", endDate: "Oct 24, 2026", duration: 40, currentDay: 0,
    status: "upcoming", inviteCode: "ARST-5H1Q",
    participants: [],
    feed: [], queue: [],
    settings: { ...DEFAULT_SETTINGS, runSchedule: { Mon: "06:00", Wed: "06:00", Sat: "06:00" }, burpees: 30 },
    team: [{ id: "t1", email: "nurlan@example.com", name: "Нурлан А.", role: "owner", status: "active", since: "Jun 25, 2026" }],
    totalTreasury: 0,
  },
];

// ── Mock "current user" — replaced by Firebase Auth + participant document ──
// ⚠️ FLAG: In real data, the logged-in user IS one of the participants in the challenge.
// ME is NOT currently in INIT_PARTICIPANTS because in the mock they're separate.
// In production: currentUser.uid → participants/{uid} doc in the selected challenge.
// For demo mode, we synthesize a participant with uid "u_me" to simulate the logged-in user.
export const ME_UID = "u_me";

export const ME_MOCK_PARTICIPANT = {
  uid: ME_UID, ini: "ЕС", name: "Ерлан С.",
  role: "participant" as const,
  lives: 4, km: 28.5, active: true, isAdmin: false,
  joinDate: "Jun 14", tz: "Asia/Almaty",
  penalties: [],
  results: [
    ...Array(9).fill({ type: "task", scoreKey: "task_completed" }),
    ...Array(2).fill({ type: "running", scoreKey: "running_on_time" }),
    { type: "task", scoreKey: "missed" },
  ] as import("../../types").DayResult[],
};

// Keep these for backward compat during the mock→Firebase transition.
// Remove once all screens read from meParticipant in AppContext.
export const ME = { ini: ME_MOCK_PARTICIPANT.ini, name: ME_MOCK_PARTICIPANT.name, day: 12, total: 50, lives: ME_MOCK_PARTICIPANT.lives, treasury: MAIN_CHALLENGE.totalTreasury };
export const ME_RESULTS = ME_MOCK_PARTICIPANT.results;
export const ME_SCORE = calcScore(ME_RESULTS);
