import { useEffect } from "react";

/* Keyboard first: the SVRC's whole design assumes someone clearing forty
 * items, not browsing three. */
export function useQueueKeys(handlers: {
  onInterested(): void;
  onPass(): void;
  onUndo(): void;
  onOpen(): void;
}): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      /* The reason box is a text field on the same screen as single-letter
       * shortcuts. Without this, typing "pass on this" fires Pass four
       * times -- and the decision is the one thing on this screen that must
       * not happen by accident. */
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case "i": handlers.onInterested(); break;
        case "p": handlers.onPass(); break;
        case "u": handlers.onUndo(); break;
        case "enter": handlers.onOpen(); break;
        default: return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}
