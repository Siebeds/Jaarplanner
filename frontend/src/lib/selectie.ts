import { useKlassen, useRapportklassen, useSchooljaren } from "./queries";
import { useSelectie } from "../state/selectie";

/**
 * Which list of klassen a screen chooses from. `planning` is `GET /api/klassen`, the klassen whose planning this
 * gebruiker reads, for every class-scoped screen. `rapport` is `GET /api/rapportklassen`, the klassen whose
 * ontwikkelingsrapporten they read (FB-008): not the same set, since Leerlingzorg reads no planning and a hoofdleerkracht
 * of K3 reads no report.
 */
export type Klassenbron = "planning" | "rapport";

/**
 * The schooljaar and klas the class-scoped screens work in.
 *
 * The store holds only what the teacher explicitly chose. This hook adds the fallback: with nothing
 * chosen yet, the first schooljaar and its first klas are the effective selection. That fallback is
 * DERIVED rather than written back into the store, which matters more than it looks: writing a
 * default from an effect means a render with no class, then a render with one, and any request in
 * between fires against the wrong scope or not at all.
 *
 * Both lists of klassen share the one chosen klas, so the agenda opens on the klas last picked in the report and the
 * other way round, whenever the other list holds it too. A klas only one list holds counts only for that list.
 */
export function useActieveSelectie(klassenbron: Klassenbron = "planning") {
  const { schooljaarId, klasId, kiesSchooljaar, kiesKlas } = useSelectie();
  const { data: schooljaren, isPending: schooljarenLaden, isLoadingError: schooljarenFout } = useSchooljaren();

  const actiefSchooljaarId = schooljaarId ?? schooljaren?.[0]?.id ?? null;

  // Only the list this screen chooses from is asked for. Narrowed here rather than by the request: neither endpoint has
  // a school-year filter.
  const planning = useKlassen(klassenbron === "planning");
  const rapport = useRapportklassen(klassenbron === "rapport");
  const { data: alleKlassen, isPending: klassenLaden, isLoadingError: klassenFout } =
    klassenbron === "rapport" ? rapport : planning;
  const klassen = (alleKlassen ?? []).filter((klas) => klas.schooljaarId === actiefSchooljaarId);

  // A klas chosen in another school year is not a klas in this one, so the id only counts when the
  // loaded list still contains it.
  const gekozenBestaat = klasId !== null && klassen.some((klas) => klas.id === klasId);
  const actiefKlasId = gekozenBestaat ? klasId : (klassen[0]?.id ?? null);

  return {
    schooljaarId: actiefSchooljaarId,
    klasId: actiefKlasId,
    schooljaar: schooljaren?.find((jaar) => jaar.id === actiefSchooljaarId) ?? null,
    klas: klassen.find((klas) => klas.id === actiefKlasId) ?? null,
    schooljaren: schooljaren ?? [],
    klassen,
    laadt: schooljarenLaden || klassenLaden,
    /**
     * One of the two lists failed to load the first time, so it has no data at all and reads as empty. The other list
     * may still be loading, so `laadt` can be true at the same moment. A screen that says "there is no schooljaar" or
     * "no klas" on an empty list must therefore check `laadt` and then this, before it trusts that list: an empty list
     * after a failure proves nothing (FB-001, antagonist rounds 2 and 4).
     *
     * **A failed refetch does not count** (`isLoadingError`, not `isError`; antagonist round 3). TanStack keeps the
     * loaded data when a background refetch fails, so the lists are still usable, and a screen that swapped them for a
     * load sentence would contradict its own header and drop whatever was being typed.
     */
    fout: schooljarenFout || klassenFout,
    kiesSchooljaar,
    kiesKlas,
  };
}
