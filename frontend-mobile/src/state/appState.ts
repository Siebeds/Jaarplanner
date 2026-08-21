/**
 * App-wide selection state: which schooljaar/klas the teacher is working in ("mijn klas"), and
 * the lightweight local agenda store used by the Kalender feature.
 * <para>
 * The backend has no notion of a signed-in teacher or of scheduling one activiteit on one
 * calendar day (Activiteiten hang off a Subthema, which is placed on a themaperiode of several
 * weeks — never a single day, and there is no Docent entity at all). Rather than inventing a
 * server contract that does not exist, the day-level agenda is kept here, in the browser,
 * per klas, and is clearly labelled in the UI as local-only. "Agenda van mezelf vs. collega" is
 * therefore modelled as switching which klas's agenda you are viewing — the closest honest
 * proxy this data model offers to "whose planning is this".
 * </para>
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AgendaItem {
  /** Unique id for this agenda entry (not the activiteitId — the same activiteit may be planned twice). */
  id: string;
  /** Set when the entry came from an existing schoolinhoud-activiteit; absent for a free-typed entry (e.g. "middagpauze"). */
  activiteitId?: string;
  /** Only set alongside `activiteitId` — needed to look the activiteit back up in its thema (voor doelen bekijken/koppelen). */
  themaId?: string;
  subthemaId?: string;
  activiteitNaam: string;
  subthemaNaam: string;
  themaNaam: string;
  datum: string; // yyyy-MM-dd
  startUur: string; // HH:mm
  eindUur: string; // HH:mm
  beschrijving?: string;
  /** Personal colour-tag for this agenda entry; absent = the standard terra styling (unchanged default). */
  kleur?: string;
}

interface AppState {
  schooljaarId: string | null;
  setSchooljaarId: (id: string) => void;
  klasId: string | null;
  setKlasId: (id: string) => void;

  // Local-only agenda: klasId -> list of scheduled activiteiten.
  agenda: Record<string, AgendaItem[]>;
  plaatsInAgenda: (klasId: string, item: Omit<AgendaItem, "id">) => void;
  werkAgendaItemBij: (klasId: string, agendaItemId: string, wijziging: Partial<Omit<AgendaItem, "id">>) => void;
  verwijderUitAgenda: (klasId: string, agendaItemId: string) => void;
}

export const useAppState = create<AppState>()(
  persist(
    (set) => ({
      schooljaarId: null,
      setSchooljaarId: (id) => set({ schooljaarId: id }),
      klasId: null,
      setKlasId: (id) => set({ klasId: id }),

      agenda: {},
      plaatsInAgenda: (klasId, item) =>
        set((state) => {
          const bestaand = state.agenda[klasId] ?? [];
          const nieuw: AgendaItem = { ...item, id: crypto.randomUUID() };
          return { agenda: { ...state.agenda, [klasId]: [...bestaand, nieuw] } };
        }),
      werkAgendaItemBij: (klasId, agendaItemId, wijziging) =>
        set((state) => ({
          agenda: {
            ...state.agenda,
            [klasId]: (state.agenda[klasId] ?? []).map((i) => (i.id === agendaItemId ? { ...i, ...wijziging } : i)),
          },
        })),
      verwijderUitAgenda: (klasId, agendaItemId) =>
        set((state) => ({
          agenda: {
            ...state.agenda,
            [klasId]: (state.agenda[klasId] ?? []).filter((i) => i.id !== agendaItemId),
          },
        })),
    }),
    { name: "jaarplanner-onderweg" },
  ),
);

export type { AgendaItem };
