import { Component, type ErrorInfo, type ReactNode } from "react";

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
    if (!error) return this.props.children;
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-5">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Что-то пошло не так</h1>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Произошла непредвиденная ошибка. Обновите страницу — данные не потеряются.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-4 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-danger-subtle p-3 text-left text-xs text-danger-text">
              {error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="pressable mt-8 inline-flex h-12 w-full items-center justify-center rounded-lg bg-primary text-[15px] font-medium text-primary-foreground hover:bg-primary-hover"
          >
            Обновить страницу
          </button>
        </div>
      </div>
    );
  }
}
