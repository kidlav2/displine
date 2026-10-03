/**
 * Participant self-service: a person joins through the challenge's common link,
 * an organizer links the request to a name on the roster, and from then on the
 * person marks their own run and task — for today only.
 *
 * Every write goes through these callables (Admin SDK), so the date window and
 * the "organizer's mark wins" rule are enforced on the server, not in the UI.
 */
import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { getFirestore, FieldValue, type DocumentData, type Firestore } from "firebase-admin/firestore";

const ALLOWED_ORIGINS = [
  "https://displine.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];

type Kind = "run" | "task";
type LateTier = "short" | "long";

// ── Helpers ─────────────────────────────────────────────────────────────────

function requireUid(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Войдите через Telegram.");
  return uid;
}

function str(v: unknown, max = 200): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Keeps digits and a leading +, so "+7 (701) 123-45-67" → "+77011234567". */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return raw.trim().startsWith("+") ? `+${digits}` : digits;
}

/** "YYYY-MM-DD" for `now` in the given IANA time zone. */
function todayIn(tz: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  }
}

function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function isoOf(v: unknown): string {
  if (typeof v === "string") return v.slice(0, 10);
  if (v && typeof (v as { toDate?: () => Date }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return "";
}

async function requireOrganizer(db: Firestore, challengeId: string, uid: string): Promise<void> {
  const snap = await db.doc(`challenges/${challengeId}/participants/${uid}`).get();
  const d = snap.data();
  if (!snap.exists || !(d?.isAdmin === true || d?.role === "owner" || d?.role === "helper")) {
    throw new HttpsError("permission-denied", "Только организатор может это сделать.");
  }
}

async function linkedParticipant(db: Firestore, challengeId: string, uid: string) {
  const link = await db.doc(`challenges/${challengeId}/links/${uid}`).get();
  const pid = link.data()?.participantId as string | undefined;
  if (!pid) throw new HttpsError("permission-denied", "Организатор ещё не подтвердил вашу заявку.");
  return { pid, ref: db.doc(`challenges/${challengeId}/participants/${pid}`) };
}

// ── Join request ────────────────────────────────────────────────────────────

/** Person opens the common link, signs in with Telegram and leaves name + WhatsApp phone. */
export const submitJoinRequest = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const uid = requireUid(request);
  const code = str(request.data?.code, 64);
  const firstName = str(request.data?.firstName, 60);
  const lastName = str(request.data?.lastName, 60);
  const phone = normalizePhone(str(request.data?.phone, 40));

  if (!code) throw new HttpsError("invalid-argument", "Нет кода приглашения.");
  if (!firstName || !lastName) throw new HttpsError("invalid-argument", "Укажите имя и фамилию.");
  if (phone.replace(/\D/g, "").length < 10) throw new HttpsError("invalid-argument", "Укажите номер телефона полностью.");

  const db = getFirestore();
  const invite = await db.doc(`invites/${code}`).get();
  const inv = invite.data();
  if (!invite.exists || !inv?.challengeId || inv.type === "team") {
    throw new HttpsError("not-found", "Ссылка недействительна. Попросите организатора новую.");
  }
  const challengeId = inv.challengeId as string;

  const link = await db.doc(`challenges/${challengeId}/links/${uid}`).get();
  if (link.exists) return { challengeId, status: "approved" };

  const token = (request.auth?.token ?? {}) as Record<string, unknown>;
  const profile = (await db.doc(`users/${uid}`).get()).data();
  const name = `${firstName} ${lastName}`;

  await db.doc(`challenges/${challengeId}/joinRequests/${uid}`).set({
    uid,
    name,
    firstName,
    lastName,
    phone,
    telegramUsername: (token.telegramUsername as string | undefined) ?? null,
    photoUrl: (profile?.photoUrl as string | undefined) ?? (token.picture as string | undefined) ?? null,
    status: "pending",
    createdAt: FieldValue.serverTimestamp(),
  });
  return { challengeId, status: "pending" };
});

/**
 * Organizer accepts a request onto an existing roster name (participantId) or as
 * a new person (participantId "new"), or rejects it.
 */
export const resolveJoinRequest = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const caller = requireUid(request);
  const challengeId = str(request.data?.challengeId, 128);
  const uid = str(request.data?.uid, 128);
  const decision = request.data?.decision === "approve" ? "approve" : "reject";
  const participantId = str(request.data?.participantId, 128);
  if (!challengeId || !uid) throw new HttpsError("invalid-argument", "Нет заявки.");

  const db = getFirestore();
  await requireOrganizer(db, challengeId, caller);

  const reqRef = db.doc(`challenges/${challengeId}/joinRequests/${uid}`);
  const reqSnap = await reqRef.get();
  const req = reqSnap.data();
  if (!reqSnap.exists || !req) throw new HttpsError("not-found", "Заявка не найдена.");

  if (decision === "reject") {
    await reqRef.update({ status: "rejected", resolvedAt: FieldValue.serverTimestamp(), resolvedBy: caller });
    return { ok: true };
  }
  if (!participantId) throw new HttpsError("invalid-argument", "Выберите человека из списка.");

  const challengeRef = db.doc(`challenges/${challengeId}`);
  const linkRef = db.doc(`challenges/${challengeId}/links/${uid}`);

  const pid = await db.runTransaction(async (tx) => {
    const [chSnap, existingLink] = await Promise.all([tx.get(challengeRef), tx.get(linkRef)]);
    if (!chSnap.exists) throw new HttpsError("not-found", "Челлендж не найден.");
    if (existingLink.exists) throw new HttpsError("already-exists", "Этот аккаунт уже привязан.");

    let pRef;
    if (participantId === "new") {
      pRef = db.collection(`challenges/${challengeId}/participants`).doc();
      tx.set(pRef, {
        uid: pRef.id,
        ini: initials(req.name),
        name: req.name,
        photoUrl: req.photoUrl ?? null,
        role: "participant",
        lives: Number(chSnap.data()?.settings?.startingLives) || 3,
        km: 0,
        active: true,
        isAdmin: false,
        joinDate: FieldValue.serverTimestamp(),
        tz: "Asia/Almaty",
        results: [],
        penalties: [],
        days: {},
        linkedUid: uid,
        telegramUsername: req.telegramUsername ?? null,
      });
    } else {
      pRef = db.doc(`challenges/${challengeId}/participants/${participantId}`);
      const pSnap = await tx.get(pRef);
      const p = pSnap.data();
      if (!pSnap.exists || p?.role !== "participant") throw new HttpsError("not-found", "Участник не найден.");
      if (p.linkedUid && p.linkedUid !== uid) throw new HttpsError("already-exists", `${p.name} уже привязан к другому аккаунту.`);
      tx.update(pRef, {
        linkedUid: uid,
        telegramUsername: req.telegramUsername ?? null,
        ...(p.photoUrl ? {} : { photoUrl: req.photoUrl ?? null }),
      });
    }

    tx.set(linkRef, { participantId: pRef.id, linkedAt: FieldValue.serverTimestamp(), linkedBy: caller });
    tx.update(reqRef, { status: "approved", participantId: pRef.id, resolvedAt: FieldValue.serverTimestamp(), resolvedBy: caller });
    tx.set(db.doc(`users/${uid}`), {
      uid,
      name: req.name,
      ini: initials(req.name),
      ...(req.photoUrl ? { photoUrl: req.photoUrl } : {}),
      challengeRoles: { [challengeId]: "participant" },
    }, { merge: true });
    return pRef.id;
  });

  return { ok: true, participantId: pid };
});

/** Undo a wrong link: the roster name stays, the account loses access. */
export const unlinkParticipant = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const caller = requireUid(request);
  const challengeId = str(request.data?.challengeId, 128);
  const participantId = str(request.data?.participantId, 128);
  if (!challengeId || !participantId) throw new HttpsError("invalid-argument", "Нет участника.");

  const db = getFirestore();
  await requireOrganizer(db, challengeId, caller);

  const pRef = db.doc(`challenges/${challengeId}/participants/${participantId}`);
  const p = (await pRef.get()).data();
  const uid = p?.linkedUid as string | undefined;
  if (!uid) return { ok: true };

  const batch = db.batch();
  batch.update(pRef, { linkedUid: FieldValue.delete(), telegramUsername: FieldValue.delete() });
  batch.delete(db.doc(`challenges/${challengeId}/links/${uid}`));
  batch.set(db.doc(`challenges/${challengeId}/joinRequests/${uid}`), { status: "rejected", resolvedAt: FieldValue.serverTimestamp(), resolvedBy: caller }, { merge: true });
  batch.set(db.doc(`users/${uid}`), { challengeRoles: { [challengeId]: FieldValue.delete() } }, { merge: true });
  await batch.commit();
  return { ok: true };
});

// ── Self marks ──────────────────────────────────────────────────────────────

function lateRunReason(tier: LateTier): string {
  return tier === "short" ? "Опоздание до 20 минут" : "Опоздание больше 20 минут";
}

function approvedPostponements(list: DocumentData[], pid: string, type: "running" | "task") {
  return list.filter(p => p.status === "approved" && p.participantUid === pid && p.type === type);
}

/**
 * The person marks their own run or task for today (in their time zone).
 * status: "done" | "late" (run only, with tier) | null to clear their own mark.
 * A mark the organizer set is final for the person.
 */
export const selfMark = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const uid = requireUid(request);
  const challengeId = str(request.data?.challengeId, 128);
  const kind: Kind = request.data?.kind === "task" ? "task" : "run";
  const rawStatus = request.data?.status;
  const status: "done" | "late" | null = rawStatus === "done" || rawStatus === "late" ? rawStatus : null;
  const tier: LateTier = request.data?.tier === "long" ? "long" : "short";
  if (!challengeId) throw new HttpsError("invalid-argument", "Нет челленджа.");
  if (status === "late" && kind !== "run") throw new HttpsError("invalid-argument", "Опоздание бывает только на пробежке.");

  const db = getFirestore();
  const { pid, ref: pRef } = await linkedParticipant(db, challengeId, uid);
  const challengeRef = db.doc(`challenges/${challengeId}`);

  const [chSnap, ppSnap] = await Promise.all([
    challengeRef.get(),
    db.collection(`challenges/${challengeId}/postponements`).where("participantUid", "==", pid).get(),
  ]);
  const ch = chSnap.data();
  if (!ch) throw new HttpsError("not-found", "Челлендж не найден.");

  const pSnap0 = await pRef.get();
  const today = todayIn((pSnap0.data()?.tz as string | undefined) || "Asia/Almaty");

  const start = isoOf(ch.startDate);
  const end = isoOf(ch.endDate) || (start ? addDays(start, (Number(ch.duration) || 1) - 1) : "");
  if (!start || today < start || (end && today > end)) {
    throw new HttpsError("failed-precondition", "Сегодня челлендж не идёт.");
  }

  const postponements = ppSnap.docs.map(d => d.data());
  const type = kind === "run" ? "running" : "task";
  const approved = approvedPostponements(postponements, pid, type);
  const away = approved.some(p => p.dateISO === today);
  const onto = approved.some(p => p.targetDateISO === today);
  const scheduled = kind === "run"
    ? weekdayOf(today) in (ch.settings?.runSchedule ?? {})
    : !!ch.issuedTaskDays?.[today]?.issued;
  if ((!scheduled || away) && !onto) {
    throw new HttpsError("failed-precondition", kind === "run" ? "Сегодня пробежки нет." : "Сегодня задания нет.");
  }

  const source = `attendance:${kind}:${today}`;
  const amountSetting = Number(ch.settings?.penaltyAmount) || 0;
  const burpeesSetting = Number(ch.settings?.burpees) || 0;

  let addedPenalty: Record<string, unknown> | null = null;
  let removedPenaltyId: string | null = null;
  const penaltyDocRef = db.collection(`challenges/${challengeId}/penalties`).doc();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(pRef);
    const p = snap.data();
    if (!p) throw new HttpsError("not-found", "Участник не найден.");
    const day = (p.days?.[today] ?? {}) as Record<string, unknown>;
    const current = day[kind];
    const bySelf = day[`${kind}By`] === "self";
    if (current !== undefined && !bySelf) {
      throw new HttpsError("failed-precondition", "Эту отметку уже поставил организатор. Изменить её может только он.");
    }

    const patch: Record<string, unknown> = {
      [`days.${today}.${kind}`]: status ?? FieldValue.delete(),
      [`days.${today}.${kind}By`]: status ? "self" : FieldValue.delete(),
    };

    // Late run: the person picks the tier and the same penalty as the organizer's
    // late mark is written. Anything else drops the auto-penalty for this day.
    const penalties = (p.penalties ?? []) as Array<Record<string, unknown>>;
    const auto = penalties.find(x => x.source === source);
    const wantPenalty = status === "late";
    const reason = lateRunReason(tier);
    const amount = wantPenalty && tier === "long" ? amountSetting : 0;
    const burpees = wantPenalty ? burpeesSetting : 0;
    const same = !!auto && auto.reason === reason && !auto.paid;

    if (auto && auto.paid && !(wantPenalty && auto.reason === reason)) {
      throw new HttpsError("failed-precondition", "Штраф за этот день уже оплачен — изменить отметку может организатор.");
    }

    if (!(wantPenalty && same)) {
      let list = penalties.filter(x => x.source !== source);
      let lives = Number(p.lives ?? 0);
      let treasuryDelta = 0;
      if (auto) {
        removedPenaltyId = (auto.penaltyId as string | undefined) ?? null;
        lives += Number(auto.livesLost ?? 0);
        treasuryDelta -= Number(auto.amount ?? 0);
      }
      if (wantPenalty && (amount > 0 || burpees > 0)) {
        addedPenalty = {
          date: today, reason, livesLost: 0, amount, paid: false,
          penaltyId: penaltyDocRef.id, source,
          ...(burpees > 0 ? { burpees } : {}),
        };
        list = [...list, addedPenalty];
        treasuryDelta += amount;
      }
      if (auto || addedPenalty) {
        patch.penalties = list;
        patch.lives = Math.max(0, lives);
        patch.active = Math.max(0, lives) > 0;
      }
      if (treasuryDelta) tx.update(challengeRef, { totalTreasury: FieldValue.increment(treasuryDelta) });
    }

    tx.update(pRef, patch);
  });

  if (addedPenalty) {
    const a = addedPenalty as Record<string, unknown>;
    await penaltyDocRef.set({
      participantUid: pid, reason: a.reason, livesLost: 0, amount: a.amount,
      ...(a.burpees ? { burpees: a.burpees } : {}),
      loggedBy: uid, paid: false, penaltyId: penaltyDocRef.id,
      date: FieldValue.serverTimestamp(), forDate: today, source,
    }).catch(err => console.warn("[selfMark] penalty doc write failed:", err));
  }
  if (removedPenaltyId) {
    await db.doc(`challenges/${challengeId}/penalties/${removedPenaltyId}`).delete()
      .catch(err => console.warn("[selfMark] penalty doc delete failed:", err));
  }

  return { ok: true, date: today };
});

/** The person asks to move a run or task; the organizer approves or rejects it. */
export const requestSelfPostponement = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  const uid = requireUid(request);
  const challengeId = str(request.data?.challengeId, 128);
  const type: "running" | "task" = request.data?.type === "task" ? "task" : "running";
  const dateISO = str(request.data?.dateISO, 10);
  const targetDateISO = str(request.data?.targetDateISO, 10);
  const reason = str(request.data?.reason, 300);
  const isIso = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!challengeId || !isIso(dateISO) || !isIso(targetDateISO)) throw new HttpsError("invalid-argument", "Укажите даты.");
  if (targetDateISO <= dateISO) throw new HttpsError("invalid-argument", "Перенести можно только на более позднюю дату.");
  if (!reason) throw new HttpsError("invalid-argument", "Напишите причину.");

  const db = getFirestore();
  const { pid, ref: pRef } = await linkedParticipant(db, challengeId, uid);
  const p = (await pRef.get()).data();
  if (!p) throw new HttpsError("not-found", "Участник не найден.");
  const today = todayIn((p.tz as string | undefined) || "Asia/Almaty");
  if (dateISO < today) throw new HttpsError("failed-precondition", "Прошедший день перенести нельзя.");

  const open = await db.collection(`challenges/${challengeId}/postponements`)
    .where("participantUid", "==", pid).get();
  if (open.docs.some(d => d.data().status === "pending" && d.data().dateISO === dateISO && d.data().type === type)) {
    throw new HttpsError("already-exists", "Запрос на этот день уже отправлен.");
  }

  const ref = await db.collection(`challenges/${challengeId}/postponements`).add({
    participantUid: pid,
    participantName: p.name ?? "",
    participantIni: p.ini ?? "??",
    type,
    taskId: null,
    taskTitle: type === "running" ? "Пробежка" : "Задание",
    dateISO,
    targetDateISO,
    status: "pending",
    reason,
    requestedAt: FieldValue.serverTimestamp(),
    requestedBy: uid,
  });
  return { ok: true, id: ref.id };
});
