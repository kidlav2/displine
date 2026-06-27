import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props  { children: ReactNode; }
interface State  { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-4 bg-background">
          <p className="text-4xl">⚠️</p>
          <div className="space-y-2 max-w-xs">
            <p className="font-extrabold text-xl">Что-то пошло не так</p>
            <p className="text-sm text-muted-foreground">
              Произошла непредвиденная ошибка. Попробуйте перезагрузить страницу.
            </p>
            {import.meta.env.DEV && (
              <pre className="text-left text-xs text-red-500 bg-red-50 border border-red-200 p-3 rounded-xl mt-2 overflow-auto whitespace-pre-wrap break-all">
                {error.message}
              </pre>
            )}
          </div>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl font-extrabold text-sm text-white bg-[#FF4F00]"
          >
            Перезагрузить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
