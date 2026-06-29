import { DndContext } from "@dnd-kit/core";
import { useUiStore } from "./store/uiStore";

/**
 * App skeleton (E0-05). Wires the three mandated state/DnD libraries:
 * - TanStack Query provider is mounted in main.tsx (server state).
 * - Zustand example store proves local UI state wiring.
 * - @dnd-kit/core DndContext proves the DnD library is installed/importable.
 *
 * Intentionally text-light: i18n (Dutch UI strings) is E0-06, and the
 * Radix/shadcn design system is E0-09. This is a neutral working skeleton.
 */
function App() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);

  return (
    <DndContext>
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-slate-900">
        <h1 className="text-3xl font-bold tracking-tight">Jaarplanner</h1>
        <p className="text-sm text-slate-500">Frontend skeleton (E0-05)</p>
        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
        >
          sidebar: {sidebarOpen ? "open" : "closed"}
        </button>
      </main>
    </DndContext>
  );
}

export default App;
