/**
 * Firestore collection references, document converters, and write actions.
 * All raw Firestore interaction goes through this file — screens call these
 * functions instead of importing firebase/firestore directly.
 */

import {
  collection, doc, getDoc, setDoc, updateDoc, deleteDoc,
  addDoc, arrayUnion, arrayRemove, increment, deleteField,
  onSnapshot, Timestamp, runTransaction, serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import { todayISOInTz } from "./dates";
import type {
  ChallengeData, ChallengeSettings, DayResult,
  FeedItem, Participant, Penalty, ReviewItem,
  SocialComment, Task, TaskTemplate, TeamMember, UserProfile, UserRole,
} from "../types";

/** Minimal public data stored in invites/{code} — readable without auth. */
export interface InviteData {
  challengeId: string;
  name: string;
  emoji: string;
  description: string;
  inviteCode: string;
  startingLives: number;
  ownerTelegramUsername?: string;
  /** "team" only set for role-embedding Path-B invites */
  type?: "team";
  role?: import("../types").OrgRole;
}

/** Thrown by resolveInviteCode / acceptTeamInvite when a team invite is expired or already used. */
export class TeamInviteError extends Error {
  constructor(public readonly reason: "used" | "expired") {
    super(reason);
    this.name = "TeamInviteError";
  }
}

// ── Collection helpers ────────────────────────────────────────────────────────

export const userRef       = (uid: string)                          => doc(db, "users", uid);
export const challengeRef  = (cid: string)                          => doc(db, "challenges", cid);
export const participantsCol = (cid: string)                        => collection(db, "challenges", cid, "participants");
export const participantRef  = (cid: string, uid: string)           => doc(db, "challenges", cid, "participants", uid);
export const feedCol         = (cid: string)                        => collection(db, "challenges", cid, "feed");
export const feedDocRef      = (cid: string, postId: string)        => doc(db, "challenges", cid, "feed", postId);
export const submissionsCol  = (cid: string)                        => collection(db, "challenges", cid, "submissions");
export const submissionRef   = (cid: string, sid: string)           => doc(db, "challenges", cid, "submissions", sid);
export const teamCol         = (cid: string)                        => collection(db, "challenges", cid, "team");
export const teamMemberRef   = (cid: string, mid: string)           => doc(db, "challenges", cid, "team", mid);
export const penaltiesCol    = (cid: string)                        => collection(db, "challenges", cid, "penalties");
export const achievementsCol   = (cid: string)                      => collection(db, "challenges", cid, "achievements");
export const tasksCol          = (cid: string)                      => collection(db, "challenges", cid, "tasks");
export const taskTemplatesCol  = (cid: string)                      => collection(db, "challenges", cid, "taskTemplates");
export const inviteRef         = (code: string)                     => doc(db, "invites", code);

// ── Converters: Firestore → UI types ─────────────────────────────────────────

function tsToString(ts: Timestamp | string | undefined): string {
  if (!ts) return "";
  if (typeof ts === "string") return ts;
  return ts.toDate().toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
}

export function snapToParticipant(snap: QueryDocumentSnapshot<DocumentData>): Participant {
  const d = snap.data();
  return {
    uid:      snap.id,
    ini:      d.ini      ?? "??",
    name:     d.name     ?? "Unknown",
    photoUrl: d.photoUrl ?? null,
    role:     d.role     ?? "participant",
    lives:    d.lives    ?? 0,
    km:       d.km       ?? 0,
    active:   d.active   ?? true,
    isAdmin:  d.isAdmin  ?? false,
    joinDate: tsToString(d.joinDate),
    tz:       d.tz       ?? "UTC",
    results:  (d.results ?? []) as DayResult[],
    penalties: (d.penalties ?? []).map((p: DocumentData) => ({
      date:      tsToString(p.date),
      reason:    p.reason    ?? "",
      livesLost: p.livesLost ?? 0,
      amount:    p.amount    ?? 0,
    })) as Penalty[],
  };
}

export function snapToFeedItem(snap: QueryDocumentSnapshot<DocumentData>): FeedItem {
  const d = snap.data();
  const timeRaw = d.time;
  const timeStr = timeRaw instanceof Timestamp
    ? timeRaw.toDate().toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })
    : (timeRaw ?? "");
  return {
    id:                snap.id,
    participantId:     d.participantId     ?? "",
    ini:               d.ini               ?? "??",
    name:              d.name              ?? "",
    isAdmin:           d.isAdmin           ?? false,
    type:              d.type              ?? "checklist",
    taskTitle:         d.taskTitle         ?? "",
    text:              d.text              ?? "",
    time:              timeStr,
    photoUrl:          d.photoUrl          ?? null,
    submissionStatus:  d.submissionStatus  ?? null,
    organizerComment:  d.organizerComment  ?? null,
    km:                d.km,
    isLate:            d.isLate,
    pointsEarned:      d.pointsEarned      ?? 0,
    likes:             (d.likes ?? []) as string[],
    socialComments:    (d.socialComments ?? []) as SocialComment[],
  };
}

export function snapToReviewItem(snap: QueryDocumentSnapshot<DocumentData>): ReviewItem {
  const d = snap.data();
  const checkInRaw = d.checkIn;
  const checkIn = checkInRaw instanceof Timestamp
    ? checkInRaw.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : (checkInRaw ?? "—");
  const resultTRaw = d.resultT ?? d.submittedAt;
  const resultT = resultTRaw instanceof Timestamp
    ? resultTRaw.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
    : (resultTRaw ?? "—");
  const isLate: boolean = d.isLate ?? false;
  const type = (d.type ?? "checklist") as "running" | "checklist" | "freeform";
  const scoreKey: import("../types").ScoreKey = d.scoreKey
    ?? (type === "running" ? (isLate ? "running_late" : "running_on_time") : "task_completed");
  return {
    id:              snap.id,
    participantId:   d.participantUid   ?? d.participantId ?? "",
    ini:             d.ini              ?? "??",
    name:            d.name             ?? "",
    isAdmin:         d.isAdmin          ?? false,
    type,
    task:            d.taskTitle        ?? d.task ?? "",
    checkIn,
    resultT,
    participantTz:   d.participantTz    ?? "UTC",
    status:          d.status           ?? "pending",
    km:              d.km               ?? null,
    organizerComment:d.organizerComment ?? null,
    isLate,
    scoreKey,
    text:            d.text             ?? "",
    photoUrl:        d.photoUrl         ?? null,
  };
}

export function snapToTeamMember(snap: QueryDocumentSnapshot<DocumentData>): TeamMember {
  const d = snap.data();
  return {
    id:     snap.id,
    uid:    d.uid    ?? snap.id,  // for active members uid === team doc id
    email:  d.email  ?? "",
    name:   d.name   ?? "",
    role:   d.role   ?? "helper",
    status: d.status ?? "invited",
    since:  tsToString(d.since),
  };
}

export function snapToTask(snap: QueryDocumentSnapshot<DocumentData>): Task {
  const d = snap.data();
  return {
    id:             snap.id,
    date:           d.date           ?? "",
    title:          d.title          ?? "",
    description:    d.description    ?? "",
    deadline:       d.deadline       ?? "23:59",
    type:           d.type           ?? "checklist",
    createdBy:      d.createdBy      ?? "",
    templateId:     d.templateId,
    checklistItems: d.checklistItems,
    expectedKm:     d.expectedKm,
  };
}

export function snapToTaskTemplate(snap: QueryDocumentSnapshot<DocumentData>): TaskTemplate {
  const d = snap.data();
  return {
    id:             snap.id,
    title:          d.title          ?? "",
    description:    d.description    ?? "",
    deadline:       d.deadline       ?? "23:59",
    type:           d.type           ?? "checklist",
    repeatDays:     (d.repeatDays    ?? []) as string[],
    active:         d.active         ?? true,
    createdBy:      d.createdBy      ?? "",
    checklistItems:  d.checklistItems,
    expectedKm:      d.expectedKm,
    minDurationMin:  d.minDurationMin,
    deadlineByDay:   d.deadlineByDay,
  };
}

export function snapToAchievement(snap: QueryDocumentSnapshot<DocumentData>): import("../types").Achievement {
  const d = snap.data();
  return {
    id:                 snap.id,
    icon:               d.icon               ?? "⭐",
    title:              d.title              ?? "",
    desc:               d.desc               ?? "",
    conditionType:      d.conditionType      ?? "custom",
    conditionThreshold: d.conditionThreshold,
  };
}

// ── Write actions ─────────────────────────────────────────────────────────────

/** Create or update the user's profile document after onboarding. */
export async function writeUserProfile(
  uid: string,
  profile: Omit<UserProfile, "uid">
): Promise<void> {
  // Firestore rejects undefined field values outright. Strip them here so
  // callers can safely spread Auth user fields without checking each one
  // (e.g. email is null for phone-auth users, phone is null for email users).
  const data = Object.fromEntries(
    Object.entries({ ...profile, uid }).filter(([, v]) => v !== undefined)
  );
  await setDoc(userRef(uid), data, { merge: true });
}

/** Add this challenge to the user's challengeRoles map. */
export async function addChallengeRole(
  uid: string,
  challengeId: string,
  role: UserRole
): Promise<void> {
  await updateDoc(userRef(uid), {
    [`challengeRoles.${challengeId}`]: role,
  });
}

/** Create a new challenge document and add the creator as owner-participant. */
export async function createChallenge(
  ownerUid: string,
  ownerProfile: Pick<UserProfile, "name" | "ini" | "timezone" | "telegramUsername">,
  data: Omit<ChallengeData, "id" | "participants" | "feed" | "queue" | "team" | "totalTreasury">
): Promise<string> {
  const challengeDocRef = doc(collection(db, "challenges"));
  const challengeId = challengeDocRef.id;

  await setDoc(challengeDocRef, {
    ...data,
    ownerUid,
    totalTreasury: 0,
    createdAt: serverTimestamp(),
  });

  // Write the public invite doc (readable without auth)
  await setDoc(inviteRef(data.inviteCode), {
    challengeId,
    name:          data.name,
    emoji:         data.emoji,
    description:   data.description,
    inviteCode:    data.inviteCode,
    startingLives: data.settings.startingLives,
    ...(ownerProfile.telegramUsername ? { ownerTelegramUsername: ownerProfile.telegramUsername } : {}),
  });

  // Add owner as a participant with owner role
  await setDoc(participantRef(challengeId, ownerUid), {
    uid: ownerUid,
    ini: ownerProfile.ini,
    name: ownerProfile.name,
    role: "owner",
    lives: data.settings.startingLives,
    km: 0,
    active: true,
    isAdmin: true,
    joinDate: serverTimestamp(),
    tz: ownerProfile.timezone,
    results: [],
    penalties: [],
  });

  // Register in user profile
  await addChallengeRole(ownerUid, challengeId, "owner");

  return challengeId;
}

// ── Running check-in (persist before result submission) ───────────────────────

/** Returns the deterministic submission doc ID for a participant's running check-in on a given day. */
export const runCheckInSubId  = (uid: string, dateStr: string) => `${uid}_${dateStr}`;
export const taskSubmitSubId  = (uid: string, dateStr: string) => `${uid}_task_${dateStr}`;

/**
 * Persist a running check-in to Firestore immediately when the participant
 * taps "check in." Creates a submission doc with status "checked_in" so the
 * state survives a browser reload or tab close before the result is submitted.
 *
 * Uses a deterministic doc ID (uid_YYYY-MM-DD) so:
 *  - Only one check-in per participant per day is possible.
 *  - HomeScreen can subscribe to it directly without a composite index query.
 */
export async function checkInForRun(
  challengeId: string,
  subId: string,
  participant: Pick<Participant, "uid" | "ini" | "name" | "isAdmin" | "tz">,
  checkInPhotoFile: File | null,
  onProgress?: (pct: number) => void
): Promise<void> {
  let checkInPhotoUrl: string | null = null;

  if (checkInPhotoFile) {
    const storageRef = ref(
      storage,
      `challenges/${challengeId}/submissions/${participant.uid}/${Date.now()}_checkin_${checkInPhotoFile.name}`
    );
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, checkInPhotoFile);
      task.on(
        "state_changed",
        (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => { checkInPhotoUrl = await getDownloadURL(task.snapshot.ref); resolve(); }
      );
    });
  }

  await setDoc(submissionRef(challengeId, subId), {
    participantUid:   participant.uid,
    ini:              participant.ini,
    name:             participant.name,
    isAdmin:          participant.isAdmin,
    participantTz:    participant.tz,
    type:             "running",
    taskTitle:        "Утренняя пробежка",
    text:             "",
    photoUrl:         null,        // result photo added when result is submitted
    km:               null,
    isLate:           false,
    status:           "checked_in",
    checkInAt:        serverTimestamp(),
    checkInPhotoUrl,
    submittedAt:      null,
    organizerComment: null,
    pointsEarned:     0,
  });
}

/**
 * Subscribe to today's running check-in for the given participant.
 * Calls back with { subId, checkInAt } when a check-in exists, or null when not.
 * HomeScreen uses this to restore persisted check-in state after a reload.
 */
export function subscribeToTodayCheckIn(
  challengeId: string,
  uid: string,
  dateStr: string,
  callback: (data: { subId: string; checkInAt: Date | null; submitted: boolean } | null) => void
): Unsubscribe {
  const subId = runCheckInSubId(uid, dateStr);
  return onSnapshot(submissionRef(challengeId, subId), (snap) => {
    if (!snap.exists()) { callback(null); return; }
    const d = snap.data();
    const ts = d.checkInAt;
    const checkInAt = ts instanceof Timestamp ? ts.toDate() : null;
    if (d.status === "checked_in") {
      callback({ subId, checkInAt, submitted: false });
    } else if (d.status === "pending" || d.status === "approved") {
      callback({ subId, checkInAt, submitted: true });
    } else {
      callback(null);
    }
  });
}

/** Subscribe to today's task submission (non-run) for a participant.
 * Returns the submission status so TasksScreen / HomeScreen can restore UI after reload.
 */
export function subscribeToTodayTaskSubmission(
  challengeId: string,
  uid: string,
  dateStr: string,
  callback: (data: { subId: string; status: "pending" | "approved" | "rejected"; organizerComment: string | null } | null) => void
): Unsubscribe {
  const subId = taskSubmitSubId(uid, dateStr);
  return onSnapshot(submissionRef(challengeId, subId), (snap) => {
    if (!snap.exists()) { callback(null); return; }
    const d = snap.data();
    const s = d.status as string;
    if (s === "pending" || s === "approved" || s === "rejected") {
      callback({ subId, status: s, organizerComment: d.organizerComment ?? null });
    } else {
      callback(null); // checked_in or unknown
    }
  });
}

/** Submit a proof (photo + optional distance). Writes to submissions + feed.
 *  If `existingSubId` is provided (a persisted check-in doc), updates that doc
 *  instead of creating a new one, then creates the feed entry. */
export async function submitProof(
  challengeId: string,
  participant: Pick<Participant, "uid" | "ini" | "name" | "isAdmin" | "tz">,
  payload: {
    type: "running" | "checklist" | "freeform";
    taskTitle: string;
    text: string;
    photoFile: File | null;
    km?: number;
    isLate?: boolean;
    pointsEarned: number;
  },
  onProgress?: (pct: number) => void,
  existingSubId?: string
): Promise<string> {
  let photoUrl: string | null = null;

  if (payload.photoFile) {
    // Path must match storage.rules: challenges/{id}/submissions/{userId}/{fileName}
    const storageRef = ref(storage, `challenges/${challengeId}/submissions/${participant.uid}/${Date.now()}_${payload.photoFile.name}`);
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, payload.photoFile!);
      task.on(
        "state_changed",
        (snap) => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => { photoUrl = await getDownloadURL(task.snapshot.ref); resolve(); }
      );
    });
  }

  const now = serverTimestamp();
  let submissionId: string;

  if (existingSubId) {
    // Upsert the check-in doc — works whether or not it was persisted:
    // setDoc with merge creates if absent, updates if present.
    submissionId = existingSubId;
    await setDoc(submissionRef(challengeId, submissionId), {
      participantUid:   participant.uid,
      ini:              participant.ini,
      name:             participant.name,
      isAdmin:          participant.isAdmin,
      participantTz:    participant.tz,
      type:             payload.type,
      taskTitle:        payload.taskTitle,
      text:             payload.text,
      photoUrl,
      km:               payload.km ?? null,
      isLate:           payload.isLate ?? false,
      submittedAt:      now,
      status:           "pending",
      organizerComment: null,
      pointsEarned:     0,
    }, { merge: true });
  } else {
    // No prior check-in. Use a deterministic daily ID so the submission can be
    // found by subscription after page reload, and resubmissions after rejection
    // overwrite the same doc (instead of creating orphan docs).
    const dateStr = todayISOInTz(participant.tz);
    submissionId = payload.type === "running"
      ? runCheckInSubId(participant.uid, dateStr)
      : taskSubmitSubId(participant.uid, dateStr);

    await setDoc(submissionRef(challengeId, submissionId), {
      participantUid:   participant.uid,
      ini:              participant.ini,
      name:             participant.name,
      isAdmin:          participant.isAdmin,
      participantTz:    participant.tz,
      type:             payload.type,
      taskTitle:        payload.taskTitle,
      text:             payload.text,
      photoUrl,
      km:               payload.km ?? null,
      isLate:           payload.isLate ?? false,
      submittedAt:      now,
      checkIn:          now,
      status:           "pending",
      organizerComment: null,
      pointsEarned:     0,
    }, { merge: true });
  }

  // Create / update the feed entry (merge so existing likes/comments survive)
  await setDoc(feedDocRef(challengeId, submissionId), {
    participantId:    participant.uid,
    ini:              participant.ini,
    name:             participant.name,
    isAdmin:          participant.isAdmin,
    type:             payload.type,
    taskTitle:        payload.taskTitle,
    text:             payload.text,
    time:             now,
    photoUrl,
    km:               payload.km ?? null,
    isLate:           payload.isLate ?? false,
    pointsEarned:     0,
    submissionStatus: "pending",
    organizerComment: null,
    likes:            [],
    socialComments:   [],
  }, { merge: true });

  return submissionId;
}

/** Organizer approve or reject a submission. Uses a transaction to atomically:
 *  1. Update the submission status
 *  2. Update the feed entry
 *  3. Append a DayResult to the participant's results array (approve only)
 */
export async function reviewSubmission(
  challengeId: string,
  submissionId: string,
  participantUid: string,
  decision: "approved" | "rejected",
  comment: string,
  scoreKey: import("../types").ScoreKey,
  applyLatePenalty?: boolean
): Promise<void> {
  const subRef  = submissionRef(challengeId, submissionId);
  const feedRef = feedDocRef(challengeId, submissionId);
  const pRef    = participantRef(challengeId, participantUid);

  // Read per-challenge scoring config from Firestore, fall back to defaults
  const chalSnap = await getDoc(challengeRef(challengeId));
  const rawScoring = chalSnap.exists() ? chalSnap.data()?.settings?.scoring : null;
  const { parseScoring } = await import("../constants/scoring");
  const scoring = parseScoring(rawScoring);

  // Late penalty overrides scoreKey to running_late regardless of what was sent
  const effectiveScoreKey: import("../types").ScoreKey =
    applyLatePenalty ? "running_late" : scoreKey;

  const entry = scoring.find(e => e.key === effectiveScoreKey);
  const pts = decision === "approved" ? (entry?.points ?? 0) : 0;

  await runTransaction(db, async (tx) => {
    const subSnap = await tx.get(subRef);
    if (!subSnap.exists()) throw new Error("Submission not found");
    const subData = subSnap.data();

    // Idempotency guard: skip if already reviewed (prevents double-approval race).
    if (subData.status !== "pending") return;

    // Need participant lives for late penalty deduction
    const pSnap = applyLatePenalty ? await tx.get(pRef) : null;
    const currentLives = pSnap?.data()?.lives ?? 0;

    tx.update(subRef, { status: decision, organizerComment: comment || null, pointsEarned: pts });
    tx.update(feedRef, { submissionStatus: decision, organizerComment: comment || null, pointsEarned: pts });

    if (decision === "approved") {
      tx.update(pRef, {
        results: arrayUnion({ type: subData.type, scoreKey: effectiveScoreKey }),
        km: subData.km ? increment(subData.km) : increment(0),
        ...(applyLatePenalty ? { lives: Math.max(0, currentLives - 1) } : {}),
      });
    }
  });
}

/** Toggle like on a feed post. */
export async function toggleLike(
  challengeId: string,
  postId: string,
  uid: string,
  currentlyLiked: boolean
): Promise<void> {
  await updateDoc(feedDocRef(challengeId, postId), {
    likes: currentlyLiked ? arrayRemove(uid) : arrayUnion(uid),
  });
}

/** Add a comment to a feed post. */
export async function addComment(
  challengeId: string,
  postId: string,
  comment: SocialComment
): Promise<void> {
  await updateDoc(feedDocRef(challengeId, postId), {
    socialComments: arrayUnion(comment),
  });
}

// ── System feed event helper ─────────────────────────────────────────────────

/** Actor info required for system feed events. */
export interface FeedActor {
  uid: string;
  name: string;
  ini: string;
  isAdmin: boolean;
}

/** Write a system/admin event to the challenge feed (no submission doc). */
async function writeFeedSystemEvent(
  challengeId: string,
  actor: FeedActor,
  type: string,
  text: string,
): Promise<void> {
  await addDoc(feedCol(challengeId), {
    participantId:    actor.uid,
    ini:              actor.ini,
    name:             actor.name,
    isAdmin:          actor.isAdmin,
    type,
    taskTitle:        "",
    text,
    time:             serverTimestamp(),
    photoUrl:         null,
    km:               null,
    isLate:           false,
    pointsEarned:     0,
    submissionStatus: null,
    organizerComment: null,
    likes:            [],
    socialComments:   [],
  });
}

/** Remove a life from a participant. Owner only. */
export async function removeLife(
  challengeId: string,
  participantUid: string,
  actor?: FeedActor,
  targetName?: string,
): Promise<void> {
  const pRef = participantRef(challengeId, participantUid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(pRef);
    if (!snap.exists()) return;
    const lives = Math.max(0, (snap.data().lives ?? 1) - 1);
    tx.update(pRef, { lives, active: lives > 0 });
  });
  if (actor && targetName) {
    await writeFeedSystemEvent(challengeId, actor, "system:remove_life",
      `снял жизнь у ${targetName}`);
  }
}

/** Log a manual penalty. Writes to penalties subcollection + deducts life. */
export async function logPenalty(
  challengeId: string,
  participantUid: string,
  penalty: Omit<Penalty, "date"> & { loggedBy: string },
  actor?: FeedActor,
  targetName?: string,
): Promise<void> {
  const pRef = participantRef(challengeId, participantUid);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(pRef);
    if (!snap.exists()) return;
    const current = snap.data();

    const newLives = Math.max(0, (current.lives ?? 1) - (penalty.livesLost ?? 0));
    tx.update(pRef, {
      lives:    newLives,
      active:   newLives > 0,
      penalties: arrayUnion({
        date:      Timestamp.now(),
        reason:    penalty.reason,
        livesLost: penalty.livesLost,
        amount:    penalty.amount,
      }),
    });
    tx.update(challengeRef(challengeId), {
      totalTreasury: increment(penalty.amount),
    });
  });

  // Also write to penalties subcollection for querying
  await addDoc(penaltiesCol(challengeId), {
    participantUid,
    reason:    penalty.reason,
    livesLost: penalty.livesLost,
    amount:    penalty.amount,
    loggedBy:  penalty.loggedBy,
    date:      serverTimestamp(),
  });
  if (actor && targetName) {
    const livesStr = penalty.livesLost > 0 ? ` −${penalty.livesLost} ❤️` : "";
    const amountStr = penalty.amount > 0 ? `, ${penalty.amount} руб.` : "";
    await writeFeedSystemEvent(challengeId, actor, "system:penalty",
      `оштрафовал ${targetName}: ${penalty.reason}${livesStr}${amountStr}`);
  }
}

/** Update top-level challenge fields (settings, name, emoji, etc.). */
export async function updateChallengeDoc(
  challengeId: string,
  patch: Partial<Pick<ChallengeData, "name" | "emoji" | "description" | "settings" | "currentDay" | "status" | "totalTreasury">>
): Promise<void> {
  await updateDoc(challengeRef(challengeId), patch as DocumentData);
}

/** Update a participant's lives directly (e.g., from ManageParticipants). */
export async function setParticipantLives(
  challengeId: string,
  participantUid: string,
  lives: number,
  actor?: FeedActor,
  targetName?: string,
): Promise<void> {
  await updateDoc(participantRef(challengeId, participantUid), {
    lives: Math.max(0, Math.min(5, lives)),
    active: lives > 0,
  });
  if (actor && targetName) {
    await writeFeedSystemEvent(challengeId, actor, "system:lives",
      `изменил жизни ${targetName} → ${lives}`);
  }
}

/**
 * Generate a one-time team invite link. Stores the invite in invites/{code} with
 * createdAt + usedAt:null. The team member doc is written when the invite is accepted.
 * Returns the generated invite code.
 */
export async function inviteTeamMember(
  challengeId: string,
  challengeName: string,
  challengeEmoji: string,
  role: import("../types").OrgRole
): Promise<string> {
  const code = `T${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
  await setDoc(inviteRef(code), {
    type:        "team",
    challengeId,
    name:        challengeName,
    emoji:       challengeEmoji,
    role,
    createdAt:   serverTimestamp(),
    usedAt:      null,
  });
  return code;
}

/**
 * Accept a team invite atomically. Validates the invite (single-use + 24 h expiry),
 * marks it as used, and creates the participant doc with the correct role.
 * Throws TeamInviteError if the invite is already used or expired.
 */
export async function acceptTeamInvite(
  inviteCode: string,
  uid: string,
  profile: { name: string; ini: string; tz: string; photoUrl?: string | null }
): Promise<{ challengeId: string; role: import("../types").OrgRole }> {
  const invRef = inviteRef(inviteCode);
  let challengeId = "";
  let role: import("../types").OrgRole = "helper";

  await runTransaction(db, async (tx) => {
    const invSnap = await tx.get(invRef);
    if (!invSnap.exists()) throw new TeamInviteError("expired");

    const d = invSnap.data();
    if (d.usedAt !== null && d.usedAt !== undefined) throw new TeamInviteError("used");

    const createdMs = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : 0;
    if (Date.now() - createdMs > 24 * 60 * 60 * 1000) throw new TeamInviteError("expired");

    challengeId = d.challengeId;
    role = d.role ?? "helper";

    const chalSnap = await tx.get(challengeRef(challengeId));
    const startingLives = chalSnap.exists() ? (chalSnap.data()?.settings?.startingLives ?? 3) : 3;

    tx.update(invRef, { usedAt: serverTimestamp() });

    tx.set(participantRef(challengeId, uid), {
      uid,
      ini:        profile.ini,
      name:       profile.name,
      photoUrl:   profile.photoUrl ?? null,
      role,
      lives:      startingLives,
      km:         0,
      active:     true,
      isAdmin:    true,
      joinDate:   serverTimestamp(),
      tz:         profile.tz,
      results:    [],
      penalties:  [],
      // Stored so Firestore rules can validate the invite in Path C of the participant
      // create rule without a separate server-side write.
      inviteCode,
    });

    tx.set(doc(teamCol(challengeId), uid), {
      email:     "",
      name:      profile.name,
      role,
      uid,
      status:    "active",
      since:     serverTimestamp(),
      invitedAt: serverTimestamp(),
    });
  });

  await addChallengeRole(uid, challengeId, role);
  return { challengeId, role };
}

/** Update team member role. */
export async function updateTeamMemberRole(
  challengeId: string,
  memberId: string,
  role: import("../types").OrgRole
): Promise<void> {
  await updateDoc(teamMemberRef(challengeId, memberId), { role });
}

/** Remove a team member. */
export async function removeTeamMember(
  challengeId: string,
  memberId: string
): Promise<void> {
  await deleteDoc(teamMemberRef(challengeId, memberId));
}

/** Promote an existing participant to helper or owner. Atomic transaction. */
export async function promoteParticipantToTeam(
  challengeId: string,
  uid: string,
  name: string,
  role: import("../types").OrgRole,
  actor?: FeedActor,
): Promise<void> {
  // Note: we intentionally do NOT update users/{uid}.challengeRoles here.
  // Security rules only allow a user to write their own profile, so updating
  // another user's doc from the browser is denied. The participant's effective
  // role is derived from their participants/{uid}.role doc, which IS updated
  // atomically below. challengeRoles is only used to decide which challenges
  // to load on startup — the promoted user's access remains correct.
  await runTransaction(db, async (tx) => {
    tx.update(participantRef(challengeId, uid), { role, isAdmin: true });
    tx.set(teamMemberRef(challengeId, uid), {
      name, role, uid,
      email:     "",
      status:    "active",
      since:     serverTimestamp(),
      invitedAt: serverTimestamp(),
    });
  });
  if (actor) {
    const roleLabel = role === "owner" ? "владельца" : "организатора";
    await writeFeedSystemEvent(challengeId, actor, "system:promoted",
      `повысил ${name} до ${roleLabel}`);
  }
}

/** Demote a team member back to plain participant. Atomic transaction. */
export async function demoteTeamMember(
  challengeId: string,
  uid: string,
  actor?: FeedActor,
  targetName?: string,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    tx.update(participantRef(challengeId, uid), { role: "participant", isAdmin: false });
    tx.delete(teamMemberRef(challengeId, uid));
  });
  if (actor && targetName) {
    await writeFeedSystemEvent(challengeId, actor, "system:demoted",
      `понизил ${targetName} до участника`);
  }
}

/**
 * Remove a participant from a challenge entirely.
 * Deletes their participant doc and (if applicable) team doc.
 * Feed and submission docs are left as historical record.
 * Note: users/{uid}.challengeRoles is NOT cleared here (security rules
 * prevent writing another user's profile). The removed user retains the
 * challenge in their roles map but their participant doc is gone, so they
 * effectively lose access to any participant-gated data.
 */
export async function removeParticipantFromChallenge(
  challengeId: string,
  uid: string,
  wasTeamMember: boolean,
  actor?: FeedActor,
  targetName?: string,
): Promise<void> {
  await runTransaction(db, async (tx) => {
    tx.delete(participantRef(challengeId, uid));
    if (wasTeamMember) tx.delete(teamMemberRef(challengeId, uid));
  });
  if (actor && targetName) {
    await writeFeedSystemEvent(challengeId, actor, "system:removed",
      `удалил ${targetName} из челленджа`);
  }
}

/**
 * Resolve a human-readable invite code to the minimal challenge data needed
 * for the onboarding screen. Reads from invites/{code} which is publicly
 * readable without auth.
 */
export async function resolveInviteCode(code: string): Promise<InviteData | null> {
  const snap = await getDoc(inviteRef(code));
  if (!snap.exists()) return null;
  const d = snap.data();

  if (d.type === "team") {
    if (d.usedAt !== null && d.usedAt !== undefined) throw new TeamInviteError("used");
    const createdMs = d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : 0;
    if (Date.now() - createdMs > 24 * 60 * 60 * 1000) throw new TeamInviteError("expired");
    return {
      challengeId:   d.challengeId ?? "",
      name:          d.name        ?? "",
      emoji:         d.emoji       ?? "🏃",
      description:   "",
      inviteCode:    code,
      startingLives: 3,
      type:          "team",
      role:          d.role ?? "helper",
    };
  }

  return {
    challengeId:   d.challengeId   ?? "",
    name:          d.name          ?? "",
    emoji:         d.emoji         ?? "🏃",
    description:   d.description   ?? "",
    inviteCode:    d.inviteCode    ?? code,
    startingLives: d.startingLives ?? 3,
    ...(d.ownerTelegramUsername ? { ownerTelegramUsername: d.ownerTelegramUsername } : {}),
  };
}

/** Create a one-off task for a specific date. */
export async function createAchievementDoc(
  challengeId: string,
  ach: Omit<import("../types").Achievement, "id">
): Promise<string> {
  const ref = await addDoc(achievementsCol(challengeId), {
    icon:               ach.icon,
    title:              ach.title,
    desc:               ach.desc,
    conditionType:      ach.conditionType,
    ...(ach.conditionThreshold !== undefined ? { conditionThreshold: ach.conditionThreshold } : {}),
    createdAt:          serverTimestamp(),
  });
  return ref.id;
}

export async function createTask(
  challengeId: string,
  task: Omit<Task, "id">,
  creatorUid: string
): Promise<string> {
  const data: Record<string, unknown> = {
    date:        task.date,
    title:       task.title,
    description: task.description,
    deadline:    task.deadline,
    type:        task.type,
    createdBy:   creatorUid,
    createdAt:   serverTimestamp(),
  };
  if (task.templateId != null)     data.templateId     = task.templateId;
  if (task.checklistItems != null) data.checklistItems = task.checklistItems;
  if (task.expectedKm != null)     data.expectedKm     = task.expectedKm;
  const ref = await addDoc(tasksCol(challengeId), data);
  return ref.id;
}

/** Create a recurring task template. Daily Cloud Function will generate Task docs from it. */
export async function createTaskTemplate(
  challengeId: string,
  template: Omit<TaskTemplate, "id">,
  creatorUid: string
): Promise<string> {
  const data: Record<string, unknown> = {
    title:       template.title,
    description: template.description,
    deadline:    template.deadline,
    type:        template.type,
    repeatDays:  template.repeatDays,
    active:      true,
    createdBy:   creatorUid,
    createdAt:   serverTimestamp(),
  };
  if (template.checklistItems  != null) data.checklistItems  = template.checklistItems;
  if (template.expectedKm      != null) data.expectedKm      = template.expectedKm;
  if (template.minDurationMin  != null) data.minDurationMin  = template.minDurationMin;
  if (template.deadlineByDay   != null) data.deadlineByDay   = template.deadlineByDay;
  const ref = await addDoc(taskTemplatesCol(challengeId), data);
  return ref.id;
}

/**
 * Add a participant to a challenge after they complete onboarding.
 * Also updates their user profile's challengeRoles map.
 */
export async function joinChallengeAsParticipant(
  challengeId: string,
  uid: string,
  profile: { name: string; ini: string; tz: string; photoUrl?: string | null },
  startingLives: number
): Promise<void> {
  await setDoc(participantRef(challengeId, uid), {
    uid,
    ini:      profile.ini,
    name:     profile.name,
    photoUrl: profile.photoUrl ?? null,
    role:     "participant",
    lives:    startingLives,
    km:       0,
    active:   true,
    isAdmin:  false,
    joinDate: serverTimestamp(),
    tz:       profile.tz,
    results:  [],
    penalties: [],
  });
  // Register the challenge role in the user's profile
  await addChallengeRole(uid, challengeId, "participant");
}

// ── Organizer notes ───────────────────────────────────────────────────────────

export const orgNoteRef = (cid: string, uid: string) =>
  doc(db, "challenges", cid, "orgNotes", uid);

/** Read a private organizer note for a participant. Returns "" if none exists. */
export async function getOrgNote(challengeId: string, participantUid: string): Promise<string> {
  const snap = await getDoc(orgNoteRef(challengeId, participantUid));
  return snap.exists() ? (snap.data()?.note ?? "") : "";
}

/** Persist a private organizer note for a participant. */
export async function saveOrgNote(challengeId: string, participantUid: string, note: string): Promise<void> {
  await setDoc(orgNoteRef(challengeId, participantUid), { note, updatedAt: serverTimestamp() }, { merge: true });
}
