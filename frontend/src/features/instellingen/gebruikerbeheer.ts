import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { del, get, post, put } from "../../lib/api";

/**
 * Directie's beheer of gebruikers and their rights (E6-04, ADR-0030 §3: directie only), as
 * `/api/gebruikers` serves it. Only a directie screen may ask for it: the server answers 403 to
 * anyone else, which is why every query here takes whether it is allowed to run.
 *
 * Every write answers the gebruiker as they are afterwards, and that answer goes straight into the
 * cache before the refetch. So a ticked box stays ticked between the save and the next read, rather
 * than flicking back for a moment and then forward again.
 */

/** A klas the gebruiker teaches. */
export interface KlastoewijzingBeheer {
  klasId: string;
  klasNaam: string;
  /** The klas's stated leeftijd, or null on a klas written before it was required. */
  jaarfase: string | null;
  schooljaarId: string;
  /** Whether it gives a leeftijd right on shared content today: a running year AND a stated leeftijd (R20, I12). */
  teltVoorGedeeldeInhoud: boolean;
}

/** A hoofdleerkracht appointment for one (schooljaar, jaarfase). */
export interface AanstellingBeheer {
  schooljaarId: string;
  jaarfase: string;
  /** Whether its schooljaar has not ended yet, so it gives the right today (R20). */
  teltVoorGedeeldeInhoud: boolean;
}

export interface GebruikerBeheer {
  id: string;
  naam: string;
  /** The Microsoft sign-in name they were invited under (ADR-0031 decision 3). */
  email: string;
  isDirectie: boolean;
  heeftThemabeheer: boolean;
  /** False until their first login binds the invitation: the state ADR-0031's residual risk lives in. */
  isAangemeld: boolean;
  klastoewijzingen: KlastoewijzingBeheer[];
  hoofdleerkrachtaanstellingen: AanstellingBeheer[];
}

export interface GebruikersOverzicht {
  gebruikers: GebruikerBeheer[];
  /** Every schooljaar whose last day has passed on the school's clock, computed by the server (R20). */
  voorbijeSchooljaarIds: string[];
}

const SLEUTEL = ["gebruikersbeheer"] as const;

/** The overview. `ingeschakeld` is false for anyone who is not directie: they would only get a 403. */
export function useGebruikersOverzicht(ingeschakeld: boolean) {
  return useQuery({
    queryKey: SLEUTEL,
    queryFn: () => get<GebruikersOverzicht>("/api/gebruikers"),
    enabled: ingeschakeld,
  });
}

/** The addresses of the rights, one resource each: `PUT` gives, `DELETE` takes away. */
export const rechtPad = {
  directie: (gebruikerId: string) => `/api/gebruikers/${gebruikerId}/directierecht`,
  themabeheer: (gebruikerId: string) => `/api/gebruikers/${gebruikerId}/themabeheer`,
  klas: (gebruikerId: string, klasId: string) => `/api/gebruikers/${gebruikerId}/klassen/${klasId}`,
  hoofdleerkracht: (gebruikerId: string, schooljaarId: string, jaarfase: string) =>
    `/api/gebruikers/${gebruikerId}/hoofdleerkracht/${schooljaarId}/${encodeURIComponent(jaarfase)}`,
};

function zetInCache(qc: QueryClient, gebruiker: GebruikerBeheer) {
  qc.setQueryData<GebruikersOverzicht>(SLEUTEL, (oud) => {
    if (!oud) return oud;
    const bestaat = oud.gebruikers.some((g) => g.id === gebruiker.id);
    return {
      ...oud,
      gebruikers: bestaat
        ? oud.gebruikers.map((g) => (g.id === gebruiker.id ? gebruiker : g))
        : [...oud.gebruikers, gebruiker],
    };
  });
}

/**
 * Refetches what a rights change can move: the overview, and `ik`, because directie may be
 * changing their own rights. `ik` never goes stale by itself (`useIk`), so it is told to here.
 */
function ververs(qc: QueryClient) {
  void qc.invalidateQueries({ queryKey: SLEUTEL });
  void qc.invalidateQueries({ queryKey: ["ik"] });
}

export interface Uitnodiging {
  email: string;
  naam: string;
}

export function useNodigUit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uitnodiging: Uitnodiging) => post<GebruikerBeheer>("/api/gebruikers", uitnodiging),
    onSuccess: (gebruiker) => {
      zetInCache(qc, gebruiker);
      ververs(qc);
    },
  });
}

/** One right, given (`aan`) or taken away. The server refuses taking the last directie's right (409). */
export interface RechtWijziging {
  pad: string;
  aan: boolean;
}

export function useRechtWijziging() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pad, aan }: RechtWijziging) => (aan ? put<GebruikerBeheer>(pad) : del<GebruikerBeheer>(pad)),
    onSuccess: (gebruiker) => {
      zetInCache(qc, gebruiker);
      ververs(qc);
    },
  });
}

/** Removes a gebruiker. The server refuses the last directie (409) and says why. */
export function useVerwijderGebruiker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gebruikerId: string) => del<void>(`/api/gebruikers/${gebruikerId}`),
    onSuccess: (_, gebruikerId) => {
      qc.setQueryData<GebruikersOverzicht>(SLEUTEL, (oud) =>
        oud ? { ...oud, gebruikers: oud.gebruikers.filter((g) => g.id !== gebruikerId) } : oud,
      );
      ververs(qc);
    },
  });
}
