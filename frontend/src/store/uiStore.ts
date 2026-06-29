import { create } from "zustand";

/**
 * Minimal local UI store (Zustand) — proves the wiring per ADR-0014.
 * Zustand owns transient local UI state (e.g. sidebar open, selected period);
 * server state lives in TanStack Query. This sidebar toggle is a placeholder
 * example to be replaced as real UI state is introduced.
 */
interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
