import { DndContext } from "@dnd-kit/core";
import { useUiStore } from "./store/uiStore";
import { t } from "./i18n";

/**
 * App skeleton (E0-05) + i18n seam (E0-06). Wires the mandated state/DnD libraries:
 * - TanStack Query provider is mounted in main.tsx (server state).
 * - Zustand example store proves local UI state wiring.
 * - @dnd-kit/core DndContext proves the DnD library is installed/importable.
 *
 * All user-facing copy is sourced from `nl.json` via `t()` (Art. II.3, ADR-0005);
 * the only literal in JSX text is the brand word "Jaarplanner" (proper noun, not
 * translatable copy). The Radix/shadcn design system and full a11y tooling are E0-09.
 */
function App() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <DndContext>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-slate-900">
        {/* Brand / proper noun, not translatable copy — exempt from the i18n guard. */}
        {/* eslint-disable-next-line no-restricted-syntax */}
        <h1 className="text-3xl font-bold tracking-tight">Jaarplanner</h1>
        <p className="text-sm text-slate-500">{t("app.ondertitel")}</p>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={
            sidebarOpen ? t("zijbalk.toggleSluiten") : t("zijbalk.toggleOpenen")
          }
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          {sidebarOpen ? t("zijbalk.open") : t("zijbalk.gesloten")}
        </button>
      </main>
    </DndContext>
  );
}

export default App;
