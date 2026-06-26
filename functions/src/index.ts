import * as crypto from "crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
