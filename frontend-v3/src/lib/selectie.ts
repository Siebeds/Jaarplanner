import { useKlassen, useSchooljaren } from "./queries";
import { useSelectie } from "../state/selectie";

/**
 * The schooljaar and klas the class-scoped screens work in.
 *
 * The store holds only what the teacher explicitly chose. This hook adds the fallback: with nothing
 * chosen yet, the first schooljaar and its first klas are the effective selection. That fallback is
 * DERIVED rather than written back into the store, which matters more than it looks: writing a
 * default from an effect means a render with no class, then a render with one, and any request in
 * between fires against the wrong scope or not at all.
 */
export function useActieveSelectie() {
  const { schooljaarId, klasId, kiesSchooljaar, kiesKlas } = useSelectie();
  const { data: schooljaren, isPending: schooljarenLaden } = useSchooljaren();

  const actiefSchooljaarId = schooljaarId ?? schooljaren?.[0]?.id ?? null;

  // Narrowed here rather than by the request: the klassen endpoint has no school-year filter.
  const { data: alleKlassen, isPending: klassenLaden } = useKlassen();
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
    kiesSchooljaar,
    kiesKlas,
  };
}
