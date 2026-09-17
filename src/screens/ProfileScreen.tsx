import { useRef, useState } from "react";
import type React from "react";
import { useNavigate } from "react-router";
import { Camera, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { updateDoc } from "firebase/firestore";
import { getDownloadURL, ref as storageRef, uploadBytesResumable } from "firebase/storage";
import {
  Av, Button, ConfirmDialog, Field, Input, LinkRow, Page, PageHeader, Section, Spinner, TimezoneSettings,
} from "../components/atoms";
import { StravaRow } from "../components/StravaRow";
import { ROLE_LABELS } from "../constants/design";
import { useAppContext } from "../contexts/AppContext";
import { useAuthContext } from "../contexts/AuthContext";
import { auth, storage } from "../lib/firebase";
import { leaveChallenge, participantRef, writeUserProfile } from "../lib/firestore";
import { notify } from "../lib/notify";
import { useDocumentTitle } from "../lib/useDocumentTitle";

const nameToIni = (n: string) => {
  const parts = n.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return n.trim().slice(0, 2).toUpperCase();
};

export function ProfileScreen() {
  const { challenge, meParticipant, adminTz, adminTzAuto, setAdminTz, setAdminTzAuto, setSelectedId, userRole } = useAppContext();
  const { currentUser, userProfile } = useAuthContext();
  const navigate = useNavigate();
  useDocumentTitle("Профиль");

  const savedName = userProfile?.name ?? meParticipant?.name ?? "";
  const [name, setName] = useState(savedName);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileBase = userProfile ?? { name: "", ini: "", timezone: "UTC", challengeRoles: {} };

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!currentUser || !trimmed || trimmed === savedName) return;
    setSaving(true);
    try {
      const ini = nameToIni(trimmed);
      await Promise.all([
        writeUserProfile(currentUser.uid, { ...profileBase, name: trimmed, ini }),
        updateDoc(participantRef(challenge.id, currentUser.uid), { name: trimmed, ini }),
      ]);
      notify.success("Имя сохранено");
    } catch (err) {
      console.error("[Profile] save failed:", err);
      notify.error("Не удалось сохранить имя.");
    } finally {
      setSaving(false);
    }
  };

  const changeTz = async (tz: string) => {
    setAdminTz(tz);
    setAdminTzAuto(false);
    if (!currentUser) return;
    try {
      await Promise.all([
        writeUserProfile(currentUser.uid, { ...profileBase, timezone: tz }),
        updateDoc(participantRef(challenge.id, currentUser.uid), { tz }),
      ]);
      notify.success("Часовой пояс обновлён");
    } catch (err) {
      console.error("[Profile] timezone save failed:", err);
      notify.error("Не удалось сохранить часовой пояс.");
    }
  };

  const changeAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setPhotoUploading(true);
    try {
      const task = uploadBytesResumable(storageRef(storage, `users/${currentUser.uid}/avatar`), file);
      await new Promise<void>((resolve, reject) => task.on("state_changed", null, reject, resolve));
      const photoUrl = await getDownloadURL(task.snapshot.ref);
      await Promise.all([
        writeUserProfile(currentUser.uid, { ...profileBase, photoUrl }),
        updateDoc(participantRef(challenge.id, currentUser.uid), { photoUrl }),
      ]);
    } catch (err) {
      console.error("[Profile] avatar upload failed:", err);
      notify.error("Не удалось загрузить фото.");
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const leave = async () => {
    if (!currentUser || !meParticipant) return;
    setLeaving(true);
    try {
      await leaveChallenge(challenge.id, currentUser.uid, meParticipant.role === "helper", {
        uid: currentUser.uid, name: meParticipant.name, ini: meParticipant.ini, isAdmin: meParticipant.isAdmin,
      });
      // Navigate straight to the right place instead of racing RootLayout on "/".
      const remaining = Object.keys(userProfile?.challengeRoles ?? {}).filter(id => id !== challenge.id);
      if (remaining.length === 0) navigate("/", { replace: true });
      else if (remaining.length === 1) { setSelectedId(remaining[0]); navigate("/app/day", { replace: true }); }
      else navigate("/challenges", { replace: true });
    } catch (err) {
      console.error("[Profile] leaveChallenge failed:", err);
      notify.error("Не удалось покинуть челлендж.");
      setLeaving(false);
    }
  };

  const ini = meParticipant?.ini ?? userProfile?.ini ?? "?";
  const photoUrl = meParticipant?.photoUrl ?? userProfile?.photoUrl;

  return (
    <Page width="sm">
      <PageHeader back={{ label: "Настройки", onClick: () => navigate("/app/settings") }} title="Профиль" />

      <div className="space-y-8">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-4">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={changeAvatar} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
              className="group relative shrink-0 rounded-full"
              aria-label="Изменить фото"
            >
              <Av ini={ini} photoUrl={photoUrl} sz="lg" />
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                {photoUploading ? <Spinner className="text-white" label="Загрузка фото" /> : <Camera className="size-5" aria-hidden />}
              </span>
            </button>
            <div className="min-w-0">
              <p className="truncate text-[17px] font-semibold">{savedName || "—"}</p>
              <p className="truncate text-[13px] text-muted-foreground">
                {ROLE_LABELS[userRole]} · {challenge.name}
              </p>
            </div>
          </div>

          <form onSubmit={saveName} className="mt-5 flex items-end gap-2">
            <Field label="Имя" className="flex-1">
              {({ id }) => (
                <Input id={id} value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
              )}
            </Field>
            <Button type="submit" variant="secondary" loading={saving} disabled={!name.trim() || name.trim() === savedName} className="h-11 sm:h-10">
              Сохранить
            </Button>
          </form>
        </section>

        <Section title="Часовой пояс" description="Используется для расчёта дней и дедлайнов." grouped={false}>
          <TimezoneSettings tz={adminTz} isAuto={adminTzAuto} onChange={changeTz} />
        </Section>

        <Section title="Интеграции">
          <StravaRow />
        </Section>

        <Section title="Аккаунт">
          <LinkRow
            icon={<LogOut />}
            title="Выйти из аккаунта"
            description={currentUser?.email ?? undefined}
            tone="danger"
            onClick={async () => { await signOut(auth); navigate("/", { replace: true }); }}
          />
          {meParticipant && meParticipant.role !== "owner" && (
            <LinkRow title="Покинуть челлендж" description={`Вы потеряете доступ к «${challenge.name}»`} tone="danger" onClick={() => setLeaveOpen(true)} />
          )}
        </Section>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={o => { if (!leaving) setLeaveOpen(o); }}
        title="Покинуть челлендж?"
        description={`Вы больше не сможете отмечать участников «${challenge.name}». Вернуться можно только по новому приглашению.`}
        confirmLabel="Покинуть"
        loading={leaving}
        onConfirm={leave}
      />
    </Page>
  );
}
