import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import type React from "react";
import { AuthProvider } from "../contexts/AuthContext";
import { AppProvider } from "../contexts/AppContext";
import { ErrorBoundary } from "./ErrorBoundary";
import { router } from "./router";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <RouterProvider router={router} />
        </AppProvider>
      </AuthProvider>
      <Toaster
        position="top-center"
        offset={16}
        mobileOffset={{ top: "calc(env(safe-area-inset-top) + 12px)", left: 12, right: 12 }}
        gap={8}
        style={{
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "12px",
        } as React.CSSProperties}
        toastOptions={{ className: "font-sans text-sm shadow-raised" }}
      />
    </ErrorBoundary>
  );
}
