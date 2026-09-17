import { useEffect } from "react";

/** Keeps the tab title in sync with the current screen: "Рейтинг · Displine". */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Displine` : "Displine";
  }, [title]);
}
