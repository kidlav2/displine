import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { useAuthContext } from "../contexts/AuthContext";
import { jk } from "../constants/design";

const connectStravaFn = httpsCallable<
  { code: string },
  { success: boolean; athleteId: number; athleteName: string }
>(functions, "connectStrava");

export function StravaCallbackScreen() {
  const { currentUser, authLoading } = useAuthContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const calledRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (!currentUser) {
      navigate("/", { replace: true });
      return;
    }

    if (calledRef.current) return;
    calledRef.current = true;

    const code  = searchParams.get("code");
    const error = searchParams.get("error");

    if (error === "access_denied" || !code) {
      setStatus("error");
      setErrorMsg("Авторизация Strava отклонена.");
      return;
    }

    connectStravaFn({ code })
      .then(() => {
        setStatus("success");
        setTimeout(() => navigate("/app/profile", { replace: true }), 1500);
      })
      .catch((err: unknown) => {
        console.error("[StravaCallback] connectStrava failed:", err);
        setStatus("error");
        setErrorMsg("Не удалось подключить Strava. Попробуйте снова.");
      });
  }, [authLoading, currentUser, searchParams, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6" style={jk}>
      <div className="text-center space-y-4 max-w-xs">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: "#FC5200" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
        </div>

        {status === "loading" && (
          <>
            <p className="font-extrabold text-lg">Подключение Strava…</p>
            <p className="text-sm text-muted-foreground">Обмен токенами, подождите.</p>
          </>
        )}

        {status === "success" && (
          <>
            <p className="font-extrabold text-lg text-green-600">Strava подключена!</p>
            <p className="text-sm text-muted-foreground">Перенаправляем в профиль…</p>
          </>
        )}

        {status === "error" && (
          <>
            <p className="font-extrabold text-lg text-destructive">Ошибка подключения</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => navigate("/app/profile", { replace: true })}
              className="mt-2 px-6 py-2.5 rounded-xl font-extrabold text-sm text-white"
              style={{ background: "#FC5200" }}
            >
              Вернуться в профиль
            </button>
          </>
        )}
      </div>
    </div>
  );
}
