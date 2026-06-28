import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, ImageIcon, CheckCircle2, XCircle, Clock, ExternalLink, Loader2, RefreshCw, CalendarDays } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useAuthContext } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { submitProof, subscribeToTodayTaskSubmission, taskSubmitSubId, runCheckInSubId } from "../lib/firestore";
import { localNow } from "../lib/timezone";
import { todayISOInTz } from "../lib/dates";
import type { SubStatus } from "../types";

export function TasksScreen() {
  const [searchParams] = useSearchParams();
  const type = (searchParams.get("type") ?? "task") as "task" | "run";
  // subId is set when the user checked in from HomeScreen — we update that doc
  // instead of creating a new submission, so check-in and result are one record.
  const checkInSubId = searchParams.get("subId") ?? undefined;
  // Postponement context — set when submitting for a previously approved postponement
  const originalDateISO = searchParams.get("originalDateISO") ?? null;
  const postponementId  = searchParams.get("postponementId")  ?? null;
  const postponedTitle  = searchParams.get("taskTitle")        ?? null;
  const isPostponed     = !!(originalDateISO && postponementId);

  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuthContext();
  const { challenge, meParticipant, todayTask, todayDeadline, scoring } = useAppContext();
  const stravaConnected = !!userProfile?.stravaConnected;

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dist, setDist] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<SubStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [stravaActivityId, setStravaActivityId] = useState<number | null>(null);
  // For tasks: deterministic daily subId so resubmits update same doc
  const participantTodayISO = meParticipant ? todayISOInTz(meParticipant.tz) : "";
  // For postponed submissions, use the original day's date for all ID generation
  const effectiveISO = isPostponed ? originalDateISO! : participantTodayISO;

  const taskSubId = (type === "task" && currentUser && effectiveISO)
    ? taskSubmitSubId(currentUser.uid, effectiveISO)
    : undefined;
  // Postponed runs have no existing check-in doc; generate subId from original date
  const postponedRunSubId = (type === "run" && isPostponed && currentUser && originalDateISO)
    ? runCheckInSubId(currentUser.uid, originalDateISO)
    : undefined;
  // Use subId from URL (passed by HomeScreen) or fall back to generated one
  const effectiveSubId = checkInSubId ?? postponedRunSubId ?? taskSubId;

  // Subscribe to today's (or original day's) task submission to restore status after reload
  useEffect(() => {
    if (type !== "task" || !challenge?.id || !currentUser?.uid || !effectiveISO) return;
    return subscribeToTodayTaskSubmission(
      challenge.id, currentUser.uid, effectiveISO,
      (data) => {
        if (!data) return;
        if (data.status === "approved") {
          setStatus("approved");
        } else if (data.status === "pending") {
          setStatus("pending");
        } else if (data.status === "rejected") {
          setStatus("idle"); // stay on form
          setSubmitError(
            data.organizerComment
              ? `Отклонено: ${data.organizerComment}. Отправьте снова.`
              : "Организатор отклонил. Отправьте подтверждение снова."
          );
        }
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge?.id, currentUser?.uid, type, effectiveISO]);
  const [syncError, setSyncError] = useState(false);

  const handleManualSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    setSyncError(false);
    try {
      const fn = httpsCallable<unknown, { found: boolean; km?: number; durationMin?: number; photoUrl?: string | null; activityId?: number; activityName?: string }>(
        getFunctions(undefined, "us-central1"),
        "manualSyncStrava"
      );
      const { data } = await fn({});
      if (!data.found) {
        setSyncError(true);
        setSyncMsg("Пробежка в Strava за сегодня не найдена");
        return;
      }
      // Pre-fill the form with Strava data — user still presses "Отправить"
      if (data.km) setDist(String(data.km));
      if (data.photoUrl) setPhotoPreview(data.photoUrl);
      if (data.activityId) setStravaActivityId(data.activityId);
      setSyncMsg(`Найдено: ${data.km} км за ${data.durationMin} мин${data.activityName ? ` — ${data.activityName}` : ""}. Нажмите «Отправить».`);
    } catch (err) {
      setSyncError(true);
      setSyncMsg(`Ошибка: ${err instanceof Error ? err.message : "попробуйте снова"}`);
    } finally {
      setSyncing(false);
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 14 * 1024 * 1024) {
      setSubmitError("Файл слишком большой (максимум 14 МБ). Сожмите фото в настройках камеры.");
      e.target.value = "";
      return;
    }
    setSubmitError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = "";
  }, []);

  const hasPhoto = !!photoFile || !!photoPreview;
  const canSubmit = hasPhoto && (type === "task" || dist.length > 0);

  const submit = async () => {
    if (!canSubmit || submitting || !currentUser || !meParticipant) return;
    setSubmitting(true);
    setSubmitError(null);
    setUploadPct(0);
    try {
      const subType = type === "run" ? "running" : (todayTask?.type ?? "freeform");
      const taskLabel = isPostponed && postponedTitle
        ? postponedTitle
        : (type === "run" ? "Утренняя пробежка" : (todayTask?.title ?? "Задание"));

      // Determine late status using the participant's stored timezone, not the device clock.
      // Device timezone can differ from where the challenge was set up (e.g. participant
      // travels, or submits from a different country).
      const nowInTz = localNow(meParticipant.tz);
      const [nh, nm] = nowInTz.split(":").map(Number);
      const [dh, dm] = todayDeadline.split(":").map(Number);
      // Approved postponements grant an extension — never count as late
      const isLate = isPostponed ? false : (nh * 60 + nm) > (dh * 60 + dm);

      const scoreKey = type === "run"
        ? (isLate ? "running_late" : "running_on_time")
        : "task_completed";
      const pts = scoring.find(e => e.key === scoreKey)?.points ?? 0;

      await submitProof(
        challenge.id,
        {
          uid:     meParticipant.uid,
          ini:     meParticipant.ini,
          name:    meParticipant.name,
          isAdmin: meParticipant.isAdmin,
          tz:      meParticipant.tz,
        },
        {
          type:             subType as "running" | "checklist" | "freeform",
          taskTitle:        taskLabel,
          text:             comment.trim(),
          photoFile,
          km:               type === "run" ? (parseFloat(dist) || undefined) : undefined,
          isLate:           type === "run" ? isLate : false,
          pointsEarned:     pts,
          stravaSource:     stravaActivityId ? true : undefined,
          stravaActivityId: stravaActivityId ?? undefined,
          stravaPhotoUrl:   !photoFile && photoPreview ? photoPreview : undefined,
        },
        (pct) => setUploadPct(pct),
        effectiveSubId
      );
      setStatus("pending");
    } catch (err) {
      console.error("[TasksScreen] submitProof failed:", err);
      setSubmitError("Не удалось отправить. Проверьте соединение и попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "approved") {
    return (
      <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-6 lg:pt-8 flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 rounded-full border-2 border-green-200 bg-green-50 flex items-center justify-center mt-12">
          <CheckCircle2 size={28} className="text-green-500" />
        </div>
        <p className="font-extrabold text-2xl">Задание выполнено!</p>
        <p className="text-sm text-muted-foreground max-w-[230px]">
          Организатор проверил и одобрил ваше подтверждение. Очки начислены.
        </p>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-6 lg:pt-8 flex flex-col items-center text-center gap-4">
        <div className="w-20 h-20 rounded-full border-2 border-amber-200 bg-amber-50 flex items-center justify-center mt-12">
          <Clock size={28} className="text-amber-500" />
        </div>
        <p className="font-extrabold text-2xl">На проверке</p>
        <p className="text-sm text-muted-foreground max-w-[230px]">
          Организатор проверит ваше подтверждение в ближайшее время.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Результат появится в ленте активности после проверки.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 pb-6">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <div>
        {isPostponed && (
          <div className="flex items-center gap-2 mb-2 px-0.5">
            <CalendarDays size={13} className="text-purple-500 shrink-0" />
            <p className="text-xs font-bold text-purple-600">
              Перенесённое задание от {originalDateISO}
            </p>
          </div>
        )}
        <SecLabel>{type === "run" ? "Утренняя пробежка" : "Задание на сегодня"}</SecLabel>
        <p className="font-extrabold text-xl mt-1">
          {isPostponed && postponedTitle
            ? postponedTitle
            : (type === "run" ? "Загрузить результат пробежки" : (todayTask?.title ?? "Задание"))}
        </p>
        {todayTask?.description && type !== "run" && !isPostponed && (
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{todayTask.description}</p>
        )}
      </div>

      {/* Photo */}
      <button
        onClick={() => fileRef.current?.click()}
        className={`w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors overflow-hidden relative ${photoPreview ? "border-green-400" : "border-border bg-card"}`}
      >
        {photoPreview ? (
          <>
            <img src={photoPreview} alt="proof" className="absolute inset-0 w-full h-full object-cover" />
            {!submitting && (
              <div className="absolute bottom-2 right-2 bg-green-500 rounded-full p-1">
                <CheckCircle2 size={16} className="text-white" />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex gap-5">
              <Camera size={28} className="text-muted-foreground" />
              <ImageIcon size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-bold">Камера / Галерея</p>
            <p className="text-xs text-muted-foreground">Нажмите, чтобы добавить фото</p>
          </>
        )}
      </button>

      {type === "run" && (
        <>
          <Card className="!p-4 text-center">
            <SecLabel>Дистанция</SecLabel>
            <div className="flex items-end justify-center gap-1.5 mt-2">
              <input type="number" placeholder="5.0" value={dist} onChange={e => setDist(e.target.value)}
                className="w-20 bg-transparent outline-none placeholder-muted-foreground text-center"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, lineHeight: 1 }} />
              <span className="text-base font-bold text-muted-foreground mb-0.5">км</span>
            </div>
          </Card>
          {stravaConnected ? (
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="w-full py-3 rounded-xl border-2 border-border bg-card flex items-center justify-center gap-2 font-semibold text-sm disabled:opacity-60"
            >
              {syncing
                ? <><Loader2 size={14} className="animate-spin" /> Синхронизация…</>
                : <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ color: "#FC5200" }}>
                      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
                    </svg>
                    Загрузить из Strava
                  </>
              }
            </button>
          ) : (
            <button
              onClick={() => navigate("/app/profile")}
              className="w-full py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2"
              style={{ background: "#FC5200" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
              </svg>
              Connect with Strava
            </button>
          )}
          {syncMsg && (
            <p className={`text-xs text-center font-semibold ${syncError ? "text-red-500" : "text-green-600"}`}>
              {syncMsg}
            </p>
          )}
          {stravaConnected && (
            <p className="text-[10px] text-center text-muted-foreground">
              Powered by{" "}
              <span className="font-bold" style={{ color: "#FC5200" }}>Strava</span>
            </p>
          )}
        </>
      )}

      <Card className="!p-4">
        <SecLabel>Комментарий</SecLabel>
        <textarea
          placeholder="Расскажите о вашей тренировке или задании…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          className="w-full bg-transparent outline-none text-sm resize-none placeholder-muted-foreground mt-2"
        />
      </Card>

      {submitting && uploadPct > 0 && uploadPct < 100 && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${uploadPct}%`, background: BRAND_COLOR }} />
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2 px-1">
          <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-red-500">{submitError}</p>
        </div>
      )}

      <button
        onClick={submit}
        disabled={!canSubmit || submitting}
        className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35 flex items-center justify-center gap-2"
        style={{ background: BRAND_COLOR }}
      >
        {submitting ? <><Loader2 size={16} className="animate-spin" /> Загрузка…</> : "Отправить"}
      </button>
    </div>
  );
}
