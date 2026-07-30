import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

/**
 * The schooljaren + their klassen, for the shell's selector (E0-10).
 *
 * One request: `GET /api/schooljaren` already returns each year **with the classes it contains**, so the
 * Schooljaar→Klas containment of Art. IX.3 is rendered as the server models it rather than reassembled
 * in the client from two lists. That is also why this does not call `GET /api/klassen` — it exists, but
 * using it would mean grouping classes by `schooljaarId` here, i.e. re-deriving a relationship the
 * server already answered.
 *
 * Server state, so TanStack Query owns it (ADR-0014). The *selection* is not here — it lives in the URL
 * (ADR-0021, `useSelectie`).
 */

/** A class as listed inside its school year (`KlasVerwijzing`). */
export interface KlasVerwijzing {
  id: string;
  naam: string;
  leerjaar: number;
}

/** A school year as listed by the API (`SchooljaarWeergave`, fields this screen uses). */
export interface SchooljaarKeuze {
  id: string;
  naam: string;
  start: string;
  eind: string;
  klassen: KlasVerwijzing[];
}

const schooljarenKey = ["schooljaren"] as const;

export function haalSchooljaren(): Promise<SchooljaarKeuze[]> {
  return apiFetch<SchooljaarKeuze[]>("/api/schooljaren");
}

export function useSchooljaren() {
  return useQuery({
    queryKey: schooljarenKey,
    queryFn: haalSchooljaren,
  });
}
