import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { Button, ConfirmDialog, Row } from "./atoms";
import { STRAVA_COLOR } from "../constants/design";
import { useAuthContext } from "../contexts/AuthContext";
import { functions } from "../lib/firebase";
import { notify } from "../lib/notify";

const disconnectStravaFn = httpsCallable<Record<string, never>, { success: boolean }>(functions, "disconnectStrava");

export function StravaRow() {
  const { userProfile } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const connected = !!userProfile?.stravaConnected;

  const connect = () => {
    const clientId = import.meta.env.VITE_STRAVA_CLIENT_ID as string | undefined;
    const redirectUri = encodeURIComponent(`${window.location.origin}/strava-callback`);
    window.location.href = `https://www.strava.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=activity:read_all&approval_prompt=auto`;
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      await disconnectStravaFn({});
      setConfirm(false);
    } catch (err) {
      console.error("[Settings] disconnectStrava failed:", err);
      notify.error("Не удалось отключить Strava.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full" style={{ background: STRAVA_COLOR }} aria-hidden>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium sm:text-sm">Strava</span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {connected
            ? `Подключено · ${userProfile?.stravaAthleteName ?? `атлет #${userProfile?.stravaAthleteId}`}`
            : "Для личных тренировок"}
        </span>
      </span>
      {connected
        ? <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>Отключить</Button>
        : <Button size="sm" variant="secondary" onClick={connect}>Подключить</Button>}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Отключить Strava?"
        description="Приложение перестанет получать ваши тренировки. Подключить снова можно в любой момент."
        confirmLabel="Отключить"
        loading={loading}
        onConfirm={disconnect}
      />
    </Row>
  );
}

