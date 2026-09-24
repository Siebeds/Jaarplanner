import { useState } from "react";
import type { ActiviteitType } from "../../lib/types";
import type { Activiteitkleur } from "./kleuren";
import type { ActiviteitInvoer, ActiviteitMetKleur } from "./Activiteitformulier";

/** What the shared fields hold while the sheet is open; rendered by `Activiteitvelden`. */
export interface Activiteitveldwaarden {
  naam: string;
  setNaam: (naam: string) => void;
  /** "" is no soort (FB-050). */
  soort: ActiviteitType | "";
  setSoort: (soort: ActiviteitType | "") => void;
  hoek: string;
  setHoek: (hoek: string) => void;
  uitkomsten: string;
  setUitkomsten: (uitkomsten: string) => void;
  vraagId: string;
  setVraagId: (vraagId: string) => void;
  kleur: Activiteitkleur | null;
  setKleur: (kleur: Activiteitkleur | null) => void;
  lengte: number;
  setLengte: (lengte: number) => void;
  naamFout: boolean;
  setNaamFout: (fout: boolean) => void;
}

/** The fields' part of a save: everything but the create-only goal codes and "voor wie". */
export type Veldinvoer = Omit<ActiviteitInvoer, "leerplandoelCodes" | "gedeeld">;

/**
 * The state of the activiteit's own fields, shared by the create and the edit sheet, starting from `activiteit` when
 * there is one.
 *
 * `leesInvoer` is what Bewaren sends from these fields, or null when the name is empty, in which case it has already
 * turned the name's error on.
 */
export function useActiviteitvelden(activiteit?: ActiviteitMetKleur): {
  velden: Activiteitveldwaarden;
  leesInvoer: () => Veldinvoer | null;
} {
  const [naam, setNaam] = useState(activiteit?.naam ?? "");
  // "" is no soort. Never preselected on a new activiteit (FB-050): a soort nobody chose would still be saved as if
  // it had been chosen.
  const [soort, setSoort] = useState<ActiviteitType | "">(activiteit?.activiteitType ?? "");
  const [hoek, setHoek] = useState(activiteit?.hoek ?? "");
  const [uitkomsten, setUitkomsten] = useState(activiteit?.verwachteUitkomsten ?? "");
  const [vraagId, setVraagId] = useState(activiteit?.onderzoeksvraagId ?? "");
  const [kleur, setKleur] = useState<Activiteitkleur | null>(activiteit?.kleur ?? null);
  const [lengte, setLengte] = useState(activiteit?.lengteInLesuren ?? 1);
  const [naamFout, setNaamFout] = useState(false);

  function leesInvoer(): Veldinvoer | null {
    if (naam.trim().length === 0) {
      setNaamFout(true);
      return null;
    }
    return {
      naam: naam.trim(),
      activiteitType: soort === "" ? null : soort,
      // Never sent for a soort that is not Hoek: the server would drop it, and a value that is stored
      // nowhere but still in the form is a value a teacher believes they saved.
      hoek: soort === "Hoek" && hoek.trim() !== "" ? hoek.trim() : null,
      verwachteUitkomsten: uitkomsten.trim() === "" ? null : uitkomsten.trim(),
      onderzoeksvraagId: vraagId === "" ? null : vraagId,
      kleur,
      lengteInLesuren: lengte,
    };
  }

  return {
    velden: {
      naam,
      setNaam,
      soort,
      setSoort,
      hoek,
      setHoek,
      uitkomsten,
      setUitkomsten,
      vraagId,
      setVraagId,
      kleur,
      setKleur,
      lengte,
      setLengte,
      naamFout,
      setNaamFout,
    },
    leesInvoer,
  };
}
