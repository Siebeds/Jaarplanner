import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * A non-blocking side panel: unlike `Sheet` (bottom sheet, full backdrop, body-scroll-locked), this docks to
 * the right and has **no backdrop** — the page behind it (the kalender) stays fully visible and clickable, so
 * a teacher can keep switching maand/week/dag while adding an activiteit. Closes on Escape, the explicit
 * close button, or (by the caller) once the activiteit is saved. Never closes on an outside click, since
 * there is nothing to "click outside of" by design.
 */
export function SidePanel({
  open,
  onClose,
  title,
  children,
  voetnoot,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Overridable hint at the bottom — defaults to the kalender-specific note this component was built for. */
  voetnoot?: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="false"
      aria-label={title}
      aria-hidden={!open}
      className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-[420px] flex-col border-l border-rand bg-surface shadow-zweven transition-transform duration-200 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-rand px-5 py-4">
        <h2 className="text-base font-bold text-ink">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Sluiten"
          className="flex h-9 w-9 items-center justify-center rounded-full text-ink-zacht active:bg-terra-zacht"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {voetnoot !== null && (
        <p className="border-t border-rand px-5 py-2 text-[11px] text-ink-zwak">
          {voetnoot ??
            "De kalender blijft zichtbaar — je kan van maand-, week- of dagweergave blijven wisselen terwijl dit paneel open staat."}
        </p>
      )}
    </div>,
    document.body,
  );
}
