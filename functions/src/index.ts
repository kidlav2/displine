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

  console.log("[verifyTelegramLogin] invoked — id_token present:", typeof id_token === "string" && id_token.length > 0, "nonce:", nonce ?? "(none)");

  if (typeof id_token !== "string" || !id_token) {
    throw new HttpsError("invalid-argument", "Missing id_token.");
  }

  const clientId = TELEGRAM_CLIENT_ID.value();
  console.log("[verifyTelegramLogin] TELEGRAM_CLIENT_ID resolved to:", JSON.stringify(clientId));

  if (!clientId) {
    console.error("[verifyTelegramLogin] TELEGRAM_CLIENT_ID is empty — check functions/.env or param config");
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
    console.log("[verifyTelegramLogin] JWT verified — iss:", payload.iss, "aud:", payload.aud, "sub:", payload.sub);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[verifyTelegramLogin] jwtVerify failed:", msg);
    throw new HttpsError("unauthenticated", `Telegram token rejected: ${msg}`);
  }

  // Verify nonce to prevent replay attacks
  if (!nonce) {
    console.error("[verifyTelegramLogin] No nonce in request — rejecting");
    throw new HttpsError("unauthenticated", "Missing nonce.");
  }
  if (payload.nonce !== nonce) {
    console.error("[verifyTelegramLogin] Nonce mismatch — JWT nonce:", payload.nonce, "request nonce:", nonce);
    throw new HttpsError("unauthenticated", "Nonce mismatch.");
  }
  console.log("[verifyTelegramLogin] Nonce OK");

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
