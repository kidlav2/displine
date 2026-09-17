import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../lib/firebase";
import { useAuthContext } from "../contexts/AuthContext";
import { AuthLayout, AuthMessage } from "../components/AuthLayout";
import { Button, Spinner } from "../components/atoms";

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
      setErrorMsg("Доступ к Strava не был разрешён.");
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
    <AuthLayout>
      {status === "loading" && (
        <AuthMessage icon={<Spinner />} title="Подключаем Strava" description="Это займёт несколько секунд." />
      )}
      {status === "success" && (
        <AuthMessage icon={<CircleCheck className="text-success-text" />} title="Strava подключена" description="Возвращаем вас в профиль…" />
      )}
      {status === "error" && (
        <AuthMessage icon={<TriangleAlert />} title="Не получилось подключить Strava" description={errorMsg}>
          <Button variant="primary" size="lg" block onClick={() => navigate("/app/profile", { replace: true })}>
            Вернуться в профиль
          </Button>
        </AuthMessage>
      )}
    </AuthLayout>
  );
}
