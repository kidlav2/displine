import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString, defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { createRemoteJWKSet, jwtVerify } from "jose";

initializeApp();

// ── Telegram OIDC verification ────────────────────────────────────────────────
// Set via: firebase functions:params:set TELEGRAM_CLIENT_ID=<your numeric client id>
// Obtain the Client ID from @BotFather → Bot Settings → Web Login.
const TELEGRAM_CLIENT_ID = defineString("TELEGRAM_CLIENT_ID");

// JWKS fetcher is created at module level so jose handles caching across warm invocations
const TELEGRAM_JWKS = createRemoteJWKSet(
  new URL("https://oauth.telegram.org/.well-known/jwks.json")
);

interface VerifyTelegramPayload {
  id_token: string;
  nonce?: string;
}

const ALLOWED_ORIGINS = [
  "https://displine.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

export const verifyTelegramLogin = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const { id_token, nonce } = (request.data ?? {}) as VerifyTelegramPayload;

  if (typeof id_token !== "string" || !id_token) {
    throw new HttpsError("invalid-argument", "Missing id_token.");
  }

  const clientId = TELEGRAM_CLIENT_ID.value();
  if (!clientId) {
    console.error("[verifyTelegramLogin] TELEGRAM_CLIENT_ID is empty");
    throw new HttpsError("internal", "Server misconfiguration: missing client ID.");
  }

  // Verify JWT signature, issuer, audience, and expiry using Telegram's public JWKS
  let payload: Record<string, unknown>;
  try {
    const result = await jwtVerify(id_token, TELEGRAM_JWKS, {
      issuer:   "https://oauth.telegram.org",
      audience: clientId,
    });
    payload = result.payload as Record<string, unknown>;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verifyTelegramLogin] jwtVerify failed:", msg);
    throw new HttpsError("unauthenticated", `Telegram token rejected: ${msg}`);
  }

  // Verify nonce to prevent replay attacks
  if (!nonce) {
    throw new HttpsError("unauthenticated", "Missing nonce.");
  }
  if (payload.nonce !== nonce) {
    throw new HttpsError("unauthenticated", "Nonce mismatch.");
  }

  const telegramId = payload.id as number;
  if (!telegramId) {
    throw new HttpsError("unauthenticated", "Token missing Telegram user ID.");
  }

  const uid             = `tg_${telegramId}`;
  const displayName     = (payload.name as string | undefined) ?? "";
  const telegramUsername = (payload.preferred_username as string | undefined) ?? null;
  const photoUrl        = (payload.picture as string | undefined) ?? null;

  // Upsert Firebase Auth user so createCustomToken always succeeds
  const adminAuth = getAuth();
  try {
    await adminAuth.getUser(uid);
  } catch {
    await adminAuth.createUser({
      uid,
      displayName,
      ...(photoUrl ? { photoURL: photoUrl } : {}),
    });
  }

  const customToken = await adminAuth.createCustomToken(uid, { telegramId, telegramUsername });

  return { customToken, telegramId, telegramUsername, displayName, photoUrl };
});

// ── Dev reset (DEV ONLY — button is hidden in production builds) ─────────────
// Resets the calling user's own test data for one challenge day using Admin SDK,
// which bypasses security rules. Authorization is enforced server-side: the
// caller may only reset their own participant record (uid must equal auth.uid).
// No additional "dev account" gate is applied — the client-side import.meta.env.DEV
// gate on the button is sufficient to keep this off production UIs; and since
// the function only ever touches the caller's own records it is low-risk to leave
// the endpoint open to any authenticated user.

interface DevResetPayload {
  challengeId: string;
  uid: string;
  dateStr: string;
  startingLives: number;
}

export const devResetMyData = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }

  const { challengeId, uid, dateStr, startingLives } = (request.data ?? {}) as DevResetPayload;

  if (
    typeof challengeId !== "string" || !challengeId ||
    typeof uid !== "string" || !uid ||
    typeof dateStr !== "string" || !dateStr ||
    typeof startingLives !== "number" || startingLives < 0
  ) {
    throw new HttpsError("invalid-argument", "Missing or invalid arguments.");
  }

  // Server-side auth check: a user may only reset their own data.
  if (request.auth.uid !== uid) {
    throw new HttpsError("permission-denied", "You may only reset your own data.");
  }

  const db = getFirestore();

  const runSubId     = `${uid}_${dateStr}`;
  const taskSubId    = `${uid}_task_${dateStr}`;
  const subBase      = `challenges/${challengeId}/submissions`;
  const feedBase     = `challenges/${challengeId}/feed`;

  const runRef       = db.doc(`${subBase}/${runSubId}`);
  const taskRef      = db.doc(`${subBase}/${taskSubId}`);
  const runFeedRef   = db.doc(`${feedBase}/${runSubId}`);
  const taskFeedRef  = db.doc(`${feedBase}/${taskSubId}`);
  const pRef         = db.doc(`challenges/${challengeId}/participants/${uid}`);
  const chalRef      = db.doc(`challenges/${challengeId}`);

  // Read participant doc outside the transaction to compute the treasury rollback.
  const pSnap = await pRef.get();
  const existingPenalties = (pSnap.exists
    ? (pSnap.data()?.penalties ?? [])
    : []) as Array<{ amount?: number }>;
  const totalPenaltyAmount = existingPenalties.reduce((s, p) => s + (p.amount ?? 0), 0);

  // Transaction: delete submission + feed docs, reset participant, rollback treasury.
  await db.runTransaction(async (tx) => {
    const [runSnap, taskSnap, runFeedSnap, taskFeedSnap] = await Promise.all([
      tx.get(runRef),
      tx.get(taskRef),
      tx.get(runFeedRef),
      tx.get(taskFeedRef),
    ]);

    if (runSnap.exists)     tx.delete(runRef);
    if (taskSnap.exists)    tx.delete(taskRef);
    if (runFeedSnap.exists) tx.delete(runFeedRef);
    if (taskFeedSnap.exists) tx.delete(taskFeedRef);

    if (pSnap.exists) {
      tx.update(pRef, {
        results:   [],
        km:        0,
        penalties: [],
        lives:     startingLives,
        active:    true,
      });
    }

    if (totalPenaltyAmount > 0) {
      tx.update(chalRef, { totalTreasury: FieldValue.increment(-totalPenaltyAmount) });
    }
  });

  // Delete all penalty subcollection docs for this participant (outside transaction).
  const penSnap = await db
    .collection(`challenges/${challengeId}/penalties`)
    .where("participantUid", "==", uid)
    .get();

  if (!penSnap.empty) {
    const batch = db.batch();
    penSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  return { success: true };
});

// ── Daily task generation ─────────────────────────────────────────────────────

function todayUTCString(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function utcWeekdayShort(): string {
  return new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
}

export const generateDailyTasks = onSchedule("every day 00:05", async () => {
  const db = getFirestore();
  const today = todayUTCString();
  const todayDay = utcWeekdayShort();

  const challengesSnap = await db.collection("challenges")
    .where("status", "==", "active")
    .get();

  const writes: Promise<unknown>[] = [];

  for (const challengeDoc of challengesSnap.docs) {
    const challengeId = challengeDoc.id;

    const templatesSnap = await db
      .collection("challenges").doc(challengeId)
      .collection("taskTemplates")
      .where("active", "==", true)
      .get();

    for (const tpl of templatesSnap.docs) {
      const t = tpl.data();
      if (!Array.isArray(t.repeatDays) || !t.repeatDays.includes(todayDay)) continue;

      // Idempotency check: skip if a task with this templateId + date already exists
      const existing = await db
        .collection("challenges").doc(challengeId)
        .collection("tasks")
        .where("templateId", "==", tpl.id)
        .where("date", "==", today)
        .limit(1)
        .get();

      if (!existing.empty) continue;

      // For running templates, prefer per-day deadline if available
      const deadline = (t.deadlineByDay && t.deadlineByDay[todayDay])
        ?? t.deadline
        ?? "23:59";

      const taskData: Record<string, unknown> = {
        date:        today,
        title:       t.title       ?? "",
        description: t.description ?? "",
        deadline,
        type:        t.type        ?? "checklist",
        createdBy:   t.createdBy   ?? "",
        templateId:  tpl.id,
        createdAt:   FieldValue.serverTimestamp(),
      };
      if (t.checklistItems) taskData.checklistItems = t.checklistItems;
      if (t.expectedKm)     taskData.expectedKm     = t.expectedKm;

      writes.push(
        db.collection("challenges").doc(challengeId)
          .collection("tasks")
          .add(taskData)
      );
    }
  }

  await Promise.all(writes);
});

// ── Strava integration ────────────────────────────────────────────────────────
// Set via: firebase functions:params:set STRAVA_CLIENT_ID=<your numeric client id>
// Set via: firebase functions:secrets:set STRAVA_CLIENT_SECRET
const STRAVA_CLIENT_ID     = defineString("STRAVA_CLIENT_ID");
const STRAVA_CLIENT_SECRET = defineSecret("STRAVA_CLIENT_SECRET");

interface StravaTokenResponse {
  access_token:  string;
  refresh_token: string;
  expires_at:    number;
  athlete: {
    id:        number;
    firstname: string;
    lastname:  string;
  };
}

interface StravaActivity {
  id:               number;
  type:             string;   // legacy field: "Run"
  sport_type?:      string;   // newer field: "Run"
  start_date:       string;   // UTC ISO: "2024-01-15T00:45:00Z"
  start_date_local: string;   // local time ISO (despite the Z suffix): "2024-01-15T05:45:00Z"
  distance:         number;   // metres
  moving_time:      number;   // seconds
  name:             string;
}

/** Refresh the Strava access token if it expires within 5 minutes; return valid token. */
async function getStravaAccessToken(
  db: ReturnType<typeof getFirestore>,
  uid: string,
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const snap = await db.doc(`users/${uid}/integrations/strava`).get();
  if (!snap.exists) throw new Error(`No Strava integration for uid=${uid}`);

  const { accessToken, refreshToken, expiresAt } = snap.data() as {
    accessToken: string; refreshToken: string; expiresAt: number;
  };

  // Return existing token if it has more than 5 minutes left
  if (expiresAt > Math.floor(Date.now() / 1000) + 300) return accessToken;

  // Refresh
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status} ${await res.text()}`);

  const data = await res.json() as StravaTokenResponse;
  await db.doc(`users/${uid}/integrations/strava`).update({
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    data.expires_at,
  });
  return data.access_token;
}

/** Points for a score key, falling back to defaults when the challenge has no custom scoring. */
function stravaPoints(scoring: Array<{ key: string; points: number }>, key: string): number {
  const defaults: Record<string, number> = { running_on_time: 2, running_late: 1 };
  return scoring.find(e => e.key === key)?.points ?? defaults[key] ?? 0;
}

// ── connectStrava ─────────────────────────────────────────────────────────────

interface ConnectStravaPayload { code: string; }

export const connectStrava = onCall(
  { cors: ALLOWED_ORIGINS, secrets: [STRAVA_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

    const { code } = (request.data ?? {}) as ConnectStravaPayload;
    if (typeof code !== "string" || !code) {
      throw new HttpsError("invalid-argument", "Missing code.");
    }

    const res = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id:     STRAVA_CLIENT_ID.value(),
        client_secret: STRAVA_CLIENT_SECRET.value(),
        code,
        grant_type:    "authorization_code",
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[connectStrava] token exchange failed:", body);
      throw new HttpsError("internal", `Strava token exchange failed: ${res.status}`);
    }

    const data = await res.json() as StravaTokenResponse;
    const db  = getFirestore();
    const uid = request.auth.uid;
    const athleteName = `${data.athlete.firstname} ${data.athlete.lastname}`.trim();

    // Store tokens in server-only subcollection (rules: allow read,write: if false)
    await db.doc(`users/${uid}/integrations/strava`).set({
      accessToken:  data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:    data.expires_at,
      athleteId:    data.athlete.id,
      connectedAt:  FieldValue.serverTimestamp(),
    });

    // Surface the connection flag on the public user profile
    await db.doc(`users/${uid}`).update({
      stravaConnected:   true,
      stravaAthleteId:   data.athlete.id,
      stravaAthleteName: athleteName,
    });

    return { success: true, athleteId: data.athlete.id, athleteName };
  }
);

// ── disconnectStrava ──────────────────────────────────────────────────────────

export const disconnectStrava = onCall(
  { cors: ALLOWED_ORIGINS, secrets: [STRAVA_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

    const db  = getFirestore();
    const uid = request.auth.uid;

    const integSnap = await db.doc(`users/${uid}/integrations/strava`).get();
    if (integSnap.exists) {
      // Best-effort deauthorize on Strava's side so future tokens are invalidated
      const { accessToken } = integSnap.data() as { accessToken: string };
      try {
        await fetch("https://www.strava.com/oauth/deauthorize", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (e) {
        console.warn("[disconnectStrava] deauthorize failed (ignoring):", e);
      }
      await db.doc(`users/${uid}/integrations/strava`).delete();
    }

    await db.doc(`users/${uid}`).update({
      stravaConnected:   false,
      stravaAthleteId:   FieldValue.delete(),
      stravaAthleteName: FieldValue.delete(),
    });

    return { success: true };
  }
);

// ── syncStravaActivities ──────────────────────────────────────────────────────
// Runs every 4 hours. For each Strava-connected user, checks if today is a run
// day for any of their active challenges (in the participant's own timezone).
// If the deadline has passed and no submission exists yet, fetches Strava
// activities and auto-creates an approved submission + feed entry.

type SyncStatus =
  | { status: "not_a_run_day" }
  | { status: "before_deadline" }
  | { status: "already_submitted" }
  | { status: "no_run_today" }
  | { status: "synced"; km: number; isLate: boolean };

async function processSingleParticipant(
  db: ReturnType<typeof getFirestore>,
  clientId: string,
  clientSecret: string,
  uid: string,
  challengeId: string,
  participantData: FirebaseFirestore.DocumentData,
  challengeData: FirebaseFirestore.DocumentData,
  options: { skipDeadline?: boolean } = {},
): Promise<SyncStatus> {
  const runSchedule: Record<string, string> = challengeData.settings?.runSchedule ?? {};
  if (Object.keys(runSchedule).length === 0) return { status: "not_a_run_day" };

  const participantTz: string = participantData.tz ?? "UTC";
  const now = new Date();

  // "Today" in the participant's local timezone
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: participantTz }); // "YYYY-MM-DD"
  const weekday = now.toLocaleDateString("en-US", { weekday: "short", timeZone: participantTz }); // "Mon"

  // Check if today is a run day
  const deadline = runSchedule[weekday];
  if (!deadline) return { status: "not_a_run_day" };

  // Only sync after the deadline has passed (unless caller explicitly skips this)
  if (!options.skipDeadline) {
    const currentLocalTime = now.toLocaleTimeString("en-US", {
      timeZone:  participantTz,
      hour:      "2-digit",
      minute:    "2-digit",
      hour12:    false,
    }).substring(0, 5); // "HH:MM"
    if (currentLocalTime <= deadline) return { status: "before_deadline" };
  }

  // Idempotency: skip if a submission already exists for today
  const subId  = `${uid}_${dateStr}`;
  const subRef = db.doc(`challenges/${challengeId}/submissions/${subId}`);
  if ((await subRef.get()).exists) return { status: "already_submitted" };

  // Get a valid Strava access token (refreshes if needed)
  const accessToken = await getStravaAccessToken(db, uid, clientId, clientSecret);

  // Fetch activities from the last 24 hours (covers all timezones)
  const after = Math.floor(Date.now() / 1000) - 86400;
  const activitiesRes = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=30`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!activitiesRes.ok) {
    throw new Error(`Strava activities API error: ${activitiesRes.status}`);
  }

  const activities = await activitiesRes.json() as StravaActivity[];

  // Find a Run that started today in the participant's local timezone
  const run = activities.find(a =>
    (a.type === "Run" || a.sport_type === "Run") &&
    (a.start_date_local ?? "").startsWith(dateStr)
  );
  if (!run) return { status: "no_run_today" };

  // Determine on-time vs late by comparing local start time to deadline
  const startTimeLocal = (run.start_date_local ?? "").substring(11, 16); // "HH:MM"
  const isLate  = startTimeLocal > deadline;
  const scoreKey = isLate ? "running_late" : "running_on_time";
  const km       = Math.round((run.distance / 1000) * 100) / 100;
  const durationMin = Math.floor((run.moving_time ?? 0) / 60);
  const pts = stravaPoints(
    (challengeData.settings?.scoring ?? []) as Array<{ key: string; points: number }>,
    scoreKey,
  );

  const startTimestamp = Timestamp.fromDate(new Date(run.start_date));
  const text = `${km} км за ${durationMin} мин • Strava`;

  const submissionData = {
    participantUid:   uid,
    ini:              participantData.ini     ?? "??",
    name:             participantData.name    ?? "",
    isAdmin:          participantData.isAdmin ?? false,
    participantTz,
    type:             "running",
    taskTitle:        "Утренняя пробежка",
    text,
    photoUrl:         null,
    checkInPhotoUrl:  null,
    km,
    isLate,
    scoreKey,
    status:           "approved",
    checkIn:          startTimestamp,
    submittedAt:      FieldValue.serverTimestamp(),
    organizerComment: null,
    pointsEarned:     pts,
    stravaSource:     true,
    stravaActivityId: run.id,
  };

  const feedData = {
    participantId:    uid,
    ini:              participantData.ini     ?? "??",
    name:             participantData.name    ?? "",
    isAdmin:          participantData.isAdmin ?? false,
    type:             "running",
    taskTitle:        "Утренняя пробежка",
    text,
    time:             FieldValue.serverTimestamp(),
    checkInPhotoUrl:  null,
    photoUrl:         null,
    km,
    isLate,
    pointsEarned:     pts,
    submissionStatus: "approved",
    organizerComment: null,
    likes:            [],
    socialComments:   [],
    stravaSource:     true,
    stravaActivityId: run.id,
  };

  // Atomic batch: submission + feed + participant km/results
  const batch = db.batch();
  batch.set(subRef, submissionData);
  batch.set(db.doc(`challenges/${challengeId}/feed/${subId}`), feedData, { merge: true });
  batch.update(db.doc(`challenges/${challengeId}/participants/${uid}`), {
    results: FieldValue.arrayUnion({ type: "running", scoreKey }),
    km:      FieldValue.increment(km),
  });
  await batch.commit();

  console.log(`[syncStrava] uid=${uid} challenge=${challengeId}: ${km}km ${isLate ? "late" : "on-time"} (activityId=${run.id})`);
  return { status: "synced", km, isLate };
}

// ── manualSyncStrava ──────────────────────────────────────────────────────────
// Called by the user from the TasksScreen when they want to pull in a run they
// already completed. Skips the deadline check so it works any time of day.

export const manualSyncStrava = onCall(
  { cors: ALLOWED_ORIGINS, secrets: [STRAVA_CLIENT_SECRET] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be signed in.");

    const db           = getFirestore();
    const uid          = request.auth.uid;
    const clientId     = STRAVA_CLIENT_ID.value();
    const clientSecret = STRAVA_CLIENT_SECRET.value();

    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists || !userSnap.data()?.stravaConnected) {
      throw new HttpsError("failed-precondition", "Strava not connected.");
    }

    // Use challengeRoles from the user doc — same source AppContext uses on the client.
    // Avoids a status-filtered query that misses challenges lacking a "status" field.
    const challengeRoles = (userSnap.data()?.challengeRoles ?? {}) as Record<string, string>;
    const challengeIds = Object.keys(challengeRoles);

    const results: Array<{ challengeId: string } & SyncStatus> = [];

    for (const challengeId of challengeIds) {
      try {
        const [chalSnap, pSnap] = await Promise.all([
          db.doc(`challenges/${challengeId}`).get(),
          db.doc(`challenges/${challengeId}/participants/${uid}`).get(),
        ]);
        if (!chalSnap.exists || !pSnap.exists) continue;

        // Treat missing status field as "active" — same default as the client app.
        const status = chalSnap.data()?.status ?? "active";
        if (status !== "active") continue;

        const result = await processSingleParticipant(
          db, clientId, clientSecret,
          uid, challengeId,
          pSnap.data()!,
          chalSnap.data()!,
          { skipDeadline: true },
        );
        results.push({ challengeId, ...result });
      } catch (err) {
        console.error(`[manualSyncStrava] uid=${uid} challenge=${challengeId}:`, err);
        results.push({ challengeId, status: "no_run_today" });
      }
    }

    return { results };
  }
);

export const syncStravaActivities = onSchedule(
  { schedule: "0 */4 * * *", timeZone: "UTC", secrets: [STRAVA_CLIENT_SECRET] },
  async () => {
    const db           = getFirestore();
    const clientId     = STRAVA_CLIENT_ID.value();
    const clientSecret = STRAVA_CLIENT_SECRET.value();

    const usersSnap = await db.collection("users")
      .where("stravaConnected", "==", true)
      .get();

    if (usersSnap.empty) {
      console.log("[syncStrava] No Strava-connected users.");
      return;
    }

    for (const userDoc of usersSnap.docs) {
      const uid           = userDoc.id;
      const userData      = userDoc.data();
      const challengeRoles = (userData.challengeRoles ?? {}) as Record<string, string>;

      for (const challengeId of Object.keys(challengeRoles)) {
        try {
          const [chalSnap, pSnap] = await Promise.all([
            db.doc(`challenges/${challengeId}`).get(),
            db.doc(`challenges/${challengeId}/participants/${uid}`).get(),
          ]);
          if (!chalSnap.exists || !pSnap.exists) continue;
          if (chalSnap.data()?.status !== "active") continue;

          await processSingleParticipant(
            db, clientId, clientSecret,
            uid, challengeId,
            pSnap.data()!,
            chalSnap.data()!,
            { skipDeadline: false },
          );
        } catch (err) {
          console.error(`[syncStrava] uid=${uid} challenge=${challengeId} error:`, err);
        }
      }
    }
  }
);
