import { useState } from "react";
import { Globe, Instagram, Link, CheckCircle2, LogOut, Loader2 } from "lucide-react";
import { signOut } from "firebase/auth";
import { updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router";
import { httpsCallable } from "firebase/functions";
import { Av, Hearts, Card, SecLabel } from "../components/atoms";
import { BRAND_COLOR, bc } from "../constants/design";
import { TimezoneSettings } from "../components/atoms";
import { calcScore } from "../lib/scoring";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { auth, functions } from "../lib/firebase";
import { writeUserProfile, participantRef } from "../lib/firestore";

const disconnectStravaFn = httpsCallable<Record<string, never>, { success: boolean }>(
  functions, "disconnectStrava"
);

export function ProfileScreen() {
  const { challenge, meParticipant, adminTz, adminTzAuto, setAdminTz, setAdminTzAuto, scoring } = useAppContext();
  const { currentUser, userProfile } = useAuthContext();
  const navigate = useNavigate();

  const [bio, setBio]               = useState(userProfile?.bio ?? "");
  const [instagram, setInstagram]   = useState(userProfile?.socialLinks?.instagram ?? "");
  const [otherLink, setOtherLink]   = useState(userProfile?.socialLinks?.other ?? "");
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [tzSaved, setTzSaved]       = useState(false);
  const [tzSaving, setTzSaving]     = useState(false);
  const [stravaLoading, setStravaLoading] = useState(false);

  const handleTzChange = async (tz: string) => {
    setAdminTz(tz);
    setAdminTzAuto(false);
    if (!currentUser) return;
    setTzSaving(true);
    try {
      await Promise.all([
        writeUserProfile(currentUser.uid, {
          ...(userProfile ?? { name: "", ini: "", timezone: "UTC", challengeRoles: {} }),
          timezone: tz,
        }),
        updateDoc(participantRef(challenge.id, currentUser.uid), { tz }),
      ]);
      setTzSaved(true);
      setTimeout(() => setTzSaved(false), 4000);
    } catch (e) {
      console.error("[ProfileScreen] timezone save failed:", e);
    } finally {
      setTzSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login", { replace: true });
  };

  const handleConnectStrava = () => {
    const clientId   = import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined;
    const redirectUri = encodeURIComponent(`${window.location.origin}/strava-callback`);
    const url = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all&approval_prompt=auto`;
    window.location.href = url;
  };

  const handleDisconnectStrava = async () => {
    if (!confirm("Отключить Strava? Автосинхронизация пробежек прекратится.")) return;
    setStravaLoading(true);
    try {
      await disconnectStravaFn({});
    } catch (e) {
      console.error("[ProfileScreen] disconnectStrava failed:", e);
    } finally {
      setStravaLoading(false);
    }
  };

  const saveBio = async () => {
    if (!currentUser || saving) return;
    setSaving(true);
    try {
      await writeUserProfile(currentUser.uid, {
        ...(userProfile ?? { name: "", ini: "", timezone: "UTC", challengeRoles: {} }),
        bio: bio.trim() || undefined,
        socialLinks: (instagram.trim() || otherLink.trim())
          ? { instagram: instagram.trim() || undefined, other: otherLink.trim() || undefined }
          : undefined,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const results = meParticipant?.results ?? [];
  const myScore = calcScore(results, scoring);
  const pct = Math.round((challenge.currentDay / challenge.duration) * 100);

  return (
    <div className="max-w-[560px] mx-auto px-4 lg:px-6 pt-5 lg:pt-8 space-y-4 pb-6">
      <div className="flex flex-col items-center text-center pt-2">
        <Av ini={meParticipant?.ini ?? "?"} photoUrl={meParticipant?.photoUrl} sz="lg" accent />
        <p className="font-extrabold text-2xl mt-3">{meParticipant?.name ?? "—"}</p>
        <p className="text-sm text-muted-foreground">{challenge.emoji} {challenge.name}</p>
      </div>

      <Card className="!p-4">
        <div className="flex justify-between items-baseline mb-2.5">
          <SecLabel>Прогресс</SecLabel>
          <span className="text-xs font-bold" style={{ color: BRAND_COLOR }}>День {challenge.currentDay} / {challenge.duration}</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BRAND_COLOR }} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">осталось {challenge.duration - challenge.currentDay} дней</p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-4">
          <SecLabel>Очки в челлендже</SecLabel>
          <p style={{ ...bc, fontSize: 30, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{myScore}</p>
          <p className="text-xs text-muted-foreground mt-1">очков всего</p>
        </Card>
        <Card className="!p-4">
          <SecLabel>Дистанция</SecLabel>
          <p style={{ ...bc, fontSize: 30, fontWeight: 900, lineHeight: 1, marginTop: 6 }}>{meParticipant?.km ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">км пробежано</p>
        </Card>
      </div>

      <Card className="!p-4">
        <SecLabel>Оставшиеся жизни</SecLabel>
        <div className="flex gap-3 justify-center py-3">
          <Hearts n={meParticipant?.lives ?? 0} sz={28} />
        </div>
      </Card>

      {/* Bio + social links */}
      <Card className="!p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <SecLabel>О себе</SecLabel>
          <span className="text-[10px] text-muted-foreground tabular-nums">{bio.length}/500</span>
        </div>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Расскажите немного о себе…"
          rows={3}
          maxLength={500}
          className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm outline-none resize-none placeholder-muted-foreground"
        />
        <div className="flex items-center gap-2">
          <Instagram size={14} className="text-muted-foreground shrink-0" />
          <input
            value={instagram}
            onChange={e => setInstagram(e.target.value)}
            placeholder="instagram.com/username"
            className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none placeholder-muted-foreground"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link size={14} className="text-muted-foreground shrink-0" />
          <input
            value={otherLink}
            onChange={e => setOtherLink(e.target.value)}
            placeholder="Другая ссылка (сайт, LinkedIn…)"
            className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm outline-none placeholder-muted-foreground"
          />
        </div>
        <button
          onClick={saveBio}
          disabled={saving}
          className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: BRAND_COLOR }}
        >
          {saved ? <><CheckCircle2 size={14} /> Сохранено</> : saving ? "Сохранение…" : "Сохранить профиль"}
        </button>
      </Card>

      <Card className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe size={15} className="text-muted-foreground" />
          <SecLabel>Часовой пояс</SecLabel>
          {adminTzAuto && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 ml-1">авто</span>
          )}
          {tzSaving && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground ml-1">сохранение…</span>
          )}
        </div>
        <TimezoneSettings tz={adminTz} isAuto={adminTzAuto} onChange={handleTzChange} />
        {tzSaved && (
          <p className="text-[11px] text-green-600 font-semibold mt-3 leading-snug flex items-center gap-1.5">
            <CheckCircle2 size={13} />
            Часовой пояс обновлён — изменения вступят в силу со следующего дня для всех новых заданий. Уже отправленные сегодня задания не пересчитываются.
          </p>
        )}
        {!tzSaved && (
          <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
            Влияет на расчёт дней пробежки и дедлайнов. Уже отправленные задания не пересчитываются при смене часового пояса.
          </p>
        )}
      </Card>

      {/* Strava integration */}
      <Card className="!p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#FC5200" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
          </div>
          <div className="flex-1">
            <SecLabel>Strava</SecLabel>
            {userProfile?.stravaConnected ? (
              <p className="text-xs text-green-600 font-semibold mt-0.5">
                Подключено · {userProfile.stravaAthleteName ?? `Атлет #${userProfile.stravaAthleteId}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Пробежки синхронизируются автоматически</p>
            )}
          </div>
        </div>
        {userProfile?.stravaConnected ? (
          <button
            onClick={handleDisconnectStrava}
            disabled={stravaLoading}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-destructive border border-destructive/30 hover:bg-destructive/5 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {stravaLoading ? <Loader2 size={14} className="animate-spin" /> : null}
            Отключить Strava
          </button>
        ) : (
          <button
            onClick={handleConnectStrava}
            className="w-full py-3 rounded-xl font-extrabold text-sm text-white flex items-center justify-center gap-2"
            style={{ background: "#FC5200" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
            </svg>
            Connect with Strava
          </button>
        )}
      </Card>

      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-destructive border border-destructive/30 hover:bg-destructive/5 transition-colors"
      >
        <LogOut size={15} />
        Выйти из аккаунта
      </button>
    </div>
  );
}
