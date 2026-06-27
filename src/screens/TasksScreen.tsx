import { useState, useRef, useCallback, useEffect } from "react";
import { Camera, ImageIcon, CheckCircle2, XCircle, Clock, ExternalLink, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { useAuthContext } from "../contexts/AuthContext";
import { useAppContext } from "../contexts/AppContext";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { submitProof, subscribeToTodayTaskSubmission, taskSubmitSubId } from "../lib/firestore";
import { localNow } from "../lib/timezone";
import { todayISOInTz } from "../lib/dates";
import type { SubStatus } from "../types";

export function TasksScreen() {
  const [searchParams] = useSearchParams();
  const type = (searchParams.get("type") ?? "task") as "task" | "run";
  // subId is set when the user checked in from HomeScreen — we update that doc
  // instead of creating a new submission, so check-in and result are one record.
  const checkInSubId = searchParams.get("subId") ?? undefined;

  const { currentUser } = useAuthContext();
  const { challenge, meParticipant, todayTask, todayDeadline, scoring } = useAppContext();

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dist, setDist] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<SubStatus>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // For tasks: deterministic daily subId so resubmits update same doc
  const participantTodayISO = meParticipant ? todayISOInTz(meParticipant.tz) : "";
  const taskSubId = (type === "task" && currentUser && participantTodayISO)
    ? taskSubmitSubId(currentUser.uid, participantTodayISO)
    : undefined;
  // Use subId from URL (passed by HomeScreen) or fall back to generated one
  const effectiveSubId = checkInSubId ?? taskSubId;

  // Subscribe to today's task submission to restore status after reload
  useEffect(() => {
    if (type !== "task" || !challenge?.id || !currentUser?.uid || !participantTodayISO) return;
    return subscribeToTodayTaskSubmission(
      challenge.id, currentUser.uid, participantTodayISO,
      (data) => {
        if (!data) return;
        if (data.status === "pending" || data.status === "approved") {
          setStatus("pending"); // reuse pending screen for both
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
  }, [challenge?.id, currentUser?.uid, type, participantTodayISO]);
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

  const canSubmit = !!photoFile && (type === "task" || dist.length > 0);

  const submit = async () => {
    if (!canSubmit || submitting || !currentUser || !meParticipant) return;
    setSubmitting(true);
    setSubmitError(null);
    setUploadPct(0);
    try {
      const subType = type === "run" ? "running" : (todayTask?.type ?? "freeform");

      // Determine late status using the participant's stored timezone, not the device clock.
      // Device timezone can differ from where the challenge was set up (e.g. participant
      // travels, or submits from a different country).
      const nowInTz = localNow(meParticipant.tz);
      const [nh, nm] = nowInTz.split(":").map(Number);
      const [dh, dm] = todayDeadline.split(":").map(Number);
      const isLate = (nh * 60 + nm) > (dh * 60 + dm);

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
          type:        subType as "running" | "checklist" | "freeform",
          taskTitle:   type === "run" ? "Утренняя пробежка" : (todayTask?.title ?? "Задание"),
          text:        comment.trim(),
          photoFile,
          km:          type === "run" ? (parseFloat(dist) || undefined) : undefined,
          isLate:      type === "run" ? isLate : false,
          pointsEarned: pts,
        },
        (pct) => setUploadPct(pct),
        effectiveSubId  // updates the persisted doc (run check-in or task's daily ID)
      );
      setStatus("pending");
    } catch (err) {
      console.error("[TasksScreen] submitProof failed:", err);
      setSubmitError("Не удалось отправить. Проверьте соединение и попробуйте снова.");
    } finally {
      setSubmitting(false);
    }
  };

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
        <SecLabel>{type === "run" ? "Утренняя пробежка" : "Задание на сегодня"}</SecLabel>
        <p className="font-extrabold text-xl mt-1">
          {type === "run" ? "Загрузить результат пробежки" : (todayTask?.title ?? "Задание")}
        </p>
        {todayTask?.description && type !== "run" && (
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
          <div className="grid grid-cols-2 gap-3">
            <Card className="!p-4">
              <SecLabel>Дистанция</SecLabel>
              <div className="flex items-end gap-1.5 mt-2">
                <input type="number" placeholder="5.0" value={dist} onChange={e => setDist(e.target.value)}
                  className="flex-1 w-0 bg-transparent outline-none placeholder-muted-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, lineHeight: 1 }} />
                <span className="text-base font-bold text-muted-foreground mb-0.5">км</span>
              </div>
            </Card>
          </div>
          <button className="w-full py-3 rounded-xl border-2 border-border bg-card flex items-center justify-center gap-2 font-semibold text-sm">
            <ExternalLink size={14} /> Подключить Strava
          </button>
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
