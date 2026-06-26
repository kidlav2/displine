import { useState, useRef, useCallback } from "react";
import { Camera, ImageIcon, CheckCircle2, XCircle, Clock, ExternalLink, Lock, Loader2 } from "lucide-react";
import { useSearchParams } from "react-router";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";
import { useAuthContext } from "../contexts/AuthContext";
import { Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR } from "../constants/design";
import { SCORE } from "../constants/scoring";
import type { SubStatus } from "../types";

export function TasksScreen() {
  const [searchParams] = useSearchParams();
  const type = (searchParams.get("type") ?? "task") as "task" | "run";
  const { currentUser } = useAuthContext();

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dist, setDist] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<SubStatus>("idle");
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setPhotoUrl(localUrl);
    setUploading(true);

    try {
      const path = `submissions/${currentUser.uid}/${Date.now()}_${file.name}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const downloadUrl = await getDownloadURL(snap.ref);
      setPhotoUrl(downloadUrl);
    } catch {
      // Keep local preview even if upload fails — submit will retry
    } finally {
      setUploading(false);
    }
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }, [currentUser]);

  const canSubmit = !!photoUrl && (type === "task" || dist.length > 0);

  const submit = () => {
    if (!canSubmit) return;
    // Auto-validate minimum run duration if set on the task
    // TODO: read minDurationMin from todayTask once wired through context
    setStatus("pending");
    setTimeout(() => setStatus("approved"), 3000);
  };

  const scoreInfo = type === "run"
    ? `+${SCORE.running_on_time} pts on time · +${SCORE.running_late} pt if late`
    : `+${SCORE.task_completed} pts on completion`;

  if (status !== "idle") {
    const cfg = {
      pending:  { icon: <Clock size={28} className="text-amber-500" />,       ring: "border-amber-200 bg-amber-50",  title: "Under review",  sub: "The organizer will check your proof shortly." },
      approved: { icon: <CheckCircle2 size={28} className="text-green-500" />, ring: "border-green-200 bg-green-50", title: "Approved! ✓",   sub: `You earned ${type === "run" ? SCORE.running_on_time : SCORE.task_completed} pts.` },
      rejected: { icon: <XCircle size={28} className="text-red-500" />,        ring: "border-red-200 bg-red-50",     title: "Rejected",      sub: null },
    };
    const c = cfg[status];
    return (
      <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-6 lg:pt-8 flex flex-col items-center text-center gap-4">
        <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mt-12 ${c.ring}`}>{c.icon}</div>
        <p className="font-extrabold text-2xl">{c.title}</p>
        {c.sub && <p className="text-sm text-muted-foreground max-w-[230px]">{c.sub}</p>}
        {status === "rejected" && (
          <Card className="!p-4 w-full text-left border-red-100">
            <div className="flex items-center gap-1.5 mb-1"><Lock size={11} className="text-muted-foreground" /><SecLabel>Organizer comment</SecLabel></div>
            <p className="text-sm">Photo unclear — please resubmit with better lighting.</p>
          </Card>
        )}
        {status === "rejected" && (
          <button onClick={() => setStatus("idle")} className="px-8 py-3 rounded-xl border-2 border-foreground font-bold text-sm">Try again</button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 pb-6">
      {/* Hidden file input — accepts both camera and gallery */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <div>
        <SecLabel>{type === "run" ? "Morning run" : "Today's mission"}</SecLabel>
        <p className="font-extrabold text-xl mt-1">{type === "run" ? "Upload run result" : "Read for 30 Minutes"}</p>
        <p className="text-xs font-semibold mt-1 flex items-center gap-1" style={{ color: BRAND_COLOR }}>
          <span style={{ color: BRAND_COLOR }}>⚡</span>{scoreInfo}
        </p>
      </div>

      {/* Photo area */}
      <button
        onClick={() => fileRef.current?.click()}
        className={`w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors overflow-hidden relative ${photoUrl ? "border-green-400" : "border-border bg-card"}`}
      >
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="proof" className="absolute inset-0 w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 size={28} className="text-white animate-spin" />
              </div>
            )}
            {!uploading && (
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
            <p className="text-sm font-bold">Camera / Gallery</p>
            <p className="text-xs text-muted-foreground">Tap to add proof photo</p>
          </>
        )}
      </button>

      {type === "run" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="!p-4">
              <SecLabel>Distance</SecLabel>
              <div className="flex items-end gap-1.5 mt-2">
                <input type="number" placeholder="5.0" value={dist} onChange={e => setDist(e.target.value)}
                  className="flex-1 w-0 bg-transparent outline-none placeholder-muted-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, lineHeight: 1 }} />
                <span className="text-base font-bold text-muted-foreground mb-0.5">km</span>
              </div>
            </Card>
            <Card className="!p-4">
              <SecLabel>Duration</SecLabel>
              <div className="flex items-end gap-1.5 mt-2">
                <input type="number" placeholder="30" value={durationMin} onChange={e => setDurationMin(e.target.value)}
                  className="flex-1 w-0 bg-transparent outline-none placeholder-muted-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, fontWeight: 900, lineHeight: 1 }} />
                <span className="text-base font-bold text-muted-foreground mb-0.5">min</span>
              </div>
            </Card>
          </div>
          <button className="w-full py-3 rounded-xl border-2 border-border bg-card flex items-center justify-center gap-2 font-semibold text-sm">
            <ExternalLink size={14} /> Connect Strava
          </button>
        </>
      )}

      <Card className="!p-4">
        <SecLabel>Comment</SecLabel>
        <textarea
          placeholder="Tell us about your session…"
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={3}
          className="w-full bg-transparent outline-none text-sm resize-none placeholder-muted-foreground mt-2"
        />
      </Card>

      <button
        onClick={submit}
        disabled={!canSubmit || uploading}
        className="w-full py-3.5 rounded-xl font-extrabold text-sm text-white disabled:opacity-35"
        style={{ background: BRAND_COLOR }}
      >
        {uploading ? "Uploading…" : "Submit"}
      </button>
    </div>
  );
}
