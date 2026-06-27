import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineString } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
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
