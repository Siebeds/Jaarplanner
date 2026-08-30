import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Which schooljaar and klas the teacher is working in.
 *
 * Persisted to localStorage because it is a working context rather than data: reopening the app on
 * Monday morning should land where Friday left off. It holds ids only, never a copy of the klas, so
 * a rename on the server is never shadowed by a stale local copy.
 *
 * There is no signed-in teacher yet (E7-11), so this is a chosen context and not an identity. No
 * screen may present it as "your" class on the strength of this store alone.
 */
interface SelectieState {
  schooljaarId: string | null;
  klasId: string | null;
  kiesSchooljaar: (id: string) => void;
  kiesKlas: (id: string) => void;
}

export const useSelectie = create<SelectieState>()(
  persist(
    (set) => ({
      schooljaarId: null,
      klasId: null,
      // Choosing another school year invalidates the class: a klas belongs to one schooljaar, so
      // keeping the old id would leave the app pointing at a class this year does not have.
      kiesSchooljaar: (id) => set({ schooljaarId: id, klasId: null }),
      kiesKlas: (id) => set({ klasId: id }),
    }),
    { name: "jaarplanner-selectie" },
  ),
);
