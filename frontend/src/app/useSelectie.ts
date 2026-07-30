import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * The klas/schooljaar selection, read from and written to the **URL** (ADR-0021 decision 2).
 *
 * The URL is the single source of truth: no Zustand copy, no context. That is not a style choice —
 * E0-10 requires deep-linkable screens, so the URL has to be authoritative for a shared link to open
 * the right class; and a value with two writable homes diverges, with "the link opened someone else's
 * class" as the first symptom.
 *
 * Ids are returned verbatim, including a value that matches no class. Validating here would mean this
 * hook needed the server list, and silently rewriting a teacher's URL would hide a broken bookmark
 * rather than showing it. The selector renders what it can find; a screen that loads by id surfaces its
 * own not-found state.
 *
 * Selection changes **replace** the history entry rather than pushing one. Choosing from a dropdown is a
 * filter, not a navigation: with a push, switching class three times would mean pressing Back three
 * times to leave the screen. Deep links are unaffected — the URL still carries the choice.
 */
export const SCHOOLJAAR_PARAM = "schooljaar";
export const KLAS_PARAM = "klas";

export interface Selectie {
  /** Chosen school year id, or "" when nothing is chosen. */
  schooljaarId: string;
  /** Chosen class id, or "" when nothing is chosen. */
  klasId: string;
  /** Choose a school year. Clears the class — a class belongs to exactly one year (Art. IX.3). */
  kiesSchooljaar: (schooljaarId: string) => void;
  kiesKlas: (klasId: string) => void;
}

export function useSelectie(): Selectie {
  const [searchParams, setSearchParams] = useSearchParams();

  const schooljaarId = searchParams.get(SCHOOLJAAR_PARAM) ?? "";
  const klasId = searchParams.get(KLAS_PARAM) ?? "";

  const kiesSchooljaar = useCallback(
    (nieuwSchooljaarId: string) => {
      const volgende = new URLSearchParams(searchParams);

      if (nieuwSchooljaarId) {
        volgende.set(SCHOOLJAAR_PARAM, nieuwSchooljaarId);
      } else {
        volgende.delete(SCHOOLJAAR_PARAM);
      }

      // Art. IX.3 makes a Klas belong to exactly one Schooljaar, so a class id from the previous year
      // cannot be valid here. Keeping it would leave the URL asserting a containment the server rejects.
      volgende.delete(KLAS_PARAM);

      setSearchParams(volgende, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const kiesKlas = useCallback(
    (nieuwKlasId: string) => {
      const volgende = new URLSearchParams(searchParams);

      if (nieuwKlasId) {
        volgende.set(KLAS_PARAM, nieuwKlasId);
      } else {
        volgende.delete(KLAS_PARAM);
      }

      setSearchParams(volgende, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return { schooljaarId, klasId, kiesSchooljaar, kiesKlas };
}
