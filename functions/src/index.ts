import * as crypto from "crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();

const TELEGRAM_BOT_TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");

interface TelegramAuthPayload {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

function verifyTelegramHash(data: TelegramAuthPayload, botToken: string): boolean {
  const { hash, ...rest } = data;

  // Build the data-check-string: key=value pairs sorted alphabetically, joined by \n
  const dataCheckString = Object.entries(rest)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  // secret_key = SHA256(bot_token)
  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  // HMAC-SHA256(data_check_string, secret_key)
  const computed = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return computed === hash;
}

export const verifyTelegramLogin = onCall(
  { secrets: [TELEGRAM_BOT_TOKEN] },
  async (request) => {
    const payload = request.data as TelegramAuthPayload;

    if (
      typeof payload?.id !== "number" ||
      typeof payload?.auth_date !== "number" ||
      typeof payload?.hash !== "string"
    ) {
      throw new HttpsError("invalid-argument", "Invalid Telegram auth payload.");
    }

    // Reject stale auth data (older than 24 hours)
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.auth_date;
    if (ageSeconds > 86400) {
      throw new HttpsError("unauthenticated", "Telegram auth data has expired.");
    }

    const botToken = TELEGRAM_BOT_TOKEN.value();
    if (!verifyTelegramHash(payload, botToken)) {
      throw new HttpsError("unauthenticated", "Telegram auth hash is invalid.");
    }

    const uid = `tg_${payload.id}`;
    const displayName = [payload.first_name, payload.last_name].filter(Boolean).join(" ");

    // Upsert the Firebase Auth user so custom token issuance always works
    const adminAuth = getAuth();
    try {
      await adminAuth.getUser(uid);
    } catch {
      await adminAuth.createUser({
        uid,
        displayName,
        ...(payload.photo_url ? { photoURL: payload.photo_url } : {}),
      });
    }

    const customToken = await adminAuth.createCustomToken(uid, {
      telegramId:       payload.id,
      telegramUsername: payload.username ?? null,
    });

    return {
      customToken,
      telegramId:       payload.id,
      telegramUsername: payload.username ?? null,
      displayName,
      photoUrl:         payload.photo_url ?? null,
    };
  }
);

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
