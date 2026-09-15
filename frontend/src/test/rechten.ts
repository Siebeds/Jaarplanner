import type { QueryClient } from "@tanstack/react-query";
import type { Ik } from "../lib/aanmelding";

/**
 * Who is signed in, for a test (E6-02 slice 4). A screen hides every control whose right the gebruiker lacks, so a
 * test of a control has to say who is looking.
 *
 * `ikMet` starts from a gebruiker who holds nothing and adds what the test names; `metIk` puts that gebruiker in a
 * query client's cache under `["ik"]`, where `useIk` finds it without a request (its stale time is infinite).
 */
export const NIEMAND: Ik = {
  id: "ik-1",
  naam: "Test Gebruiker",
  email: "test@school.be",
  isDirectie: false,
  heeftThemabeheer: false,
  hoofdleerkrachtLeeftijden: [],
  leerkrachtLeeftijden: [],
  eigenKlasIds: [],
  rapportklasIds: [],
  lopendeRapportklasIds: [],
};

export function ikMet(delen: Partial<Ik> = {}): Ik {
  return { ...NIEMAND, ...delen };
}

export const DIRECTIE = ikMet({ isDirectie: true });

export function metIk(client: QueryClient, ik: Ik): QueryClient {
  client.setQueryData(["ik"], ik);
  return client;
}
