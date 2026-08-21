import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

/**
 * One class's own facts, for the screens that need more about the selected klas than the shell's selector does
 * (E9-07).
 *
 * **Why this exists beside `schooljaren.ts`, which deliberately does not call `/api/klassen`.** That module's reason is
 * about the *selector*: `GET /api/schooljaren` already returns each year with the classes it contains, so using
 * `/api/klassen` there would mean re-deriving the Schooljaar→Klas containment the server already answered. This is the
 * other direction — one known class, and a field the containment payload does not carry.
 *
 * **The field that matters is {@link Klasdetail.jaarFasen}, and it is deliberately not re-derived here.** The rule that
 * turns a `Leerjaar` into Op.stap codes lives in `Jaarfasen.VoorLeerjaar`, which is the same function
 * `Dekkingsbereik.EigenJaarFase` measures against. A TypeScript copy would be a second answer to "what does this class
 * teach?", and the two would drift the first time the open Art. XIV graadklas decision moved one of them.
 */
export interface Klasdetail {
  id: string;
  schooljaarId: string;
  naam: string;
  leerjaar: number;
  aantalSubthemas: number;
  /**
   * The Op.stap jaar/fase codes this class teaches, as the server derives them.
   *
   * **Two things it does not mean, both pinned by backend tests, and a caller must honour both.**
   *
   * A kleutergroep returns **all three** kleuter codes: `Leerjaar` is `0` and cannot say which kleuterjaar, so this is
   * the widest honest answer rather than a guess (the E5-02 ruling of 2026-08-04 — let the teacher narrow on screen).
   *
   * An **empty** list means *could not be derived*, the unresolved graadklas case, and never *teaches nothing*. **A
   * caller must WIDEN on empty, never narrow to nothing:** a search scoped to an empty set makes every leerplandoel
   * unreachable, which is worse than the unscoped search E9-07 exists to replace.
   */
  jaarFasen: string[];
}

export const klasKey = (klasId: string) => ["klas", klasId] as const;

export function haalKlas(klasId: string): Promise<Klasdetail> {
  return apiFetch<Klasdetail>(`/api/klassen/${klasId}`);
}

/**
 * Server state for one class (ADR-0014).
 *
 * **A five-minute `staleTime`, unlike the dekking reads next door.** A class's naam, leerjaar and derived jaar/fase
 * codes change only when someone edits the class in beheer, which is rare and is not something a teacher does while
 * linking doelen. Refetching this on every mount of a picker would be a request per keystroke-adjacent render for an
 * answer that cannot have moved. Contrast dekking, which has no `staleTime` at all because every accept and drag
 * changes it.
 */
export function useKlas(klasId: string) {
  return useQuery({
    queryKey: klasKey(klasId),
    queryFn: () => haalKlas(klasId),
    staleTime: 5 * 60 * 1000,
    // No class chosen means there is nothing to ask about; without this the picker would fire `/api/klassen/` and
    // render an error at a teacher who has simply not picked a class yet.
    enabled: Boolean(klasId),
  });
}
