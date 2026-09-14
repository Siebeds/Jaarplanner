import { useMemo } from "react";
import { ApiError } from "./api";
import { useIk, type Ik } from "./aanmelding";
import { t } from "../i18n";

/**
 * What the signed-in gebruiker may do, decided in ONE place in the frontend (E6-02 slice 4, ADR-0030 §3).
 *
 * **It mirrors the server's `Rechtenmatrix` row for row** (`backend/src/Jaarplanner.Application/Toegang/
 * Rechtenmatrix.cs`): the same row names, the same columns per row, and one evaluator, `staatToe`, written in the same
 * order as the server's `StaatToe`. Changing a row there means changing the same row here, and `rechten.test.ts` holds
 * the §3 expectations both files are checked against.
 *
 * **It hides; it never protects.** The server refuses every action a row does not grant, whatever this file says.
 * What this file buys is the E3-06 rule: a control the server would refuse is not offered.
 *
 * **Fails closed.** Until `/api/ik` has answered, and when it failed, the gebruiker holds nothing here, so no control
 * that writes is shown for a moment and then taken away.
 */

/** The rows of §3, by the server's policy names (`Rechtenmatrix.Beleid`). */
export type Rij =
  | "Curriculumbeheer"
  | "Beheer"
  | "ThemaBewerken"
  | "ThemaVerwijderen"
  | "SchoolcontentImporteren"
  | "MenselijkeBeslissingenVerwijderen"
  | "ThemaOpbouw"
  | "Wizardinhoud"
  | "DoelsuggestiesMaken"
  | "DoelsuggestiesBeoordelen"
  | "SubthemaBeheren"
  | "StreefwoordenschatAanpassen"
  | "GedeeldeActiviteitBewerken"
  | "ActiviteitVerwijderen"
  | "SubdoelenBeheren"
  | "DoelenKoppelen"
  | "ActiviteitVerplaatsen"
  | "KlasplanningBewerken";

/** The §3 columns other than "Directie" (every row) and "Ander" (no enforced row), as the server's `Kolom` names them. */
export type Kolom =
  | "Themabeheer"
  | "Hoofdleerkracht"
  | "LeerkrachtLeeftijd"
  | "LeerkrachtLeeftijdZonderKoppelingen"
  | "LeerkrachtEigen"
  | "MakerZonderKoppelingen"
  | "ThemabeheerZonderAndermansInhoud";

/** §3 as data, one entry per server row, with the same columns. */
export const RECHTENMATRIX: Record<Rij, readonly Kolom[]> = {
  Curriculumbeheer: [],
  Beheer: [],
  ThemaBewerken: ["Themabeheer"],
  // I26. The column needs the server's `Themabron` (whether the thema holds anything but its own open wizard run's
  // items), which no read the frontend makes carries. Without it the column matches nothing here, exactly as a server
  // resource row fails closed without its resource, so the thema delete is offered to directie only.
  ThemaVerwijderen: ["ThemabeheerZonderAndermansInhoud"],
  SchoolcontentImporteren: ["Themabeheer"],
  MenselijkeBeslissingenVerwijderen: [],
  ThemaOpbouw: ["Themabeheer"],
  Wizardinhoud: ["Themabeheer"],
  DoelsuggestiesMaken: ["Themabeheer"],
  DoelsuggestiesBeoordelen: ["Themabeheer"],
  SubthemaBeheren: ["Hoofdleerkracht"],
  StreefwoordenschatAanpassen: ["Hoofdleerkracht", "LeerkrachtLeeftijd"],
  GedeeldeActiviteitBewerken: ["Hoofdleerkracht", "LeerkrachtLeeftijd"],
  ActiviteitVerwijderen: ["Hoofdleerkracht", "MakerZonderKoppelingen"],
  SubdoelenBeheren: ["Hoofdleerkracht"],
  DoelenKoppelen: ["Hoofdleerkracht"],
  ActiviteitVerplaatsen: ["Hoofdleerkracht", "LeerkrachtLeeftijdZonderKoppelingen"],
  KlasplanningBewerken: ["LeerkrachtEigen"],
};

/**
 * The resource a row is asked about: the server's `Leeftijdsinhoud`, `Activiteitbron` and `Klasplanning`.
 *
 * `heeftDoelkoppelingen` counts every link whatever its status, as `EfRechtenbronnen` does: the read payload carries
 * all of them, so `doelkoppelingen.length > 0` is the same fact the server decides on.
 */
export type Rechtbron =
  | { soort: "leeftijd"; leeftijd: string }
  | { soort: "activiteit"; leeftijd: string; makerId: string | null; heeftDoelkoppelingen: boolean }
  | { soort: "klas"; klasId: string };

/** GUIDs from System.Text.Json are lowercase on every route, so this is equality; the fold only guards a future one. */
function zelfdeId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Whether `ik` may do what `rij` describes, on `bron`. The server's `StaatToe`, clause for clause:
 * directie passes every row; otherwise any one matching column is enough (the union rule); a column that needs a
 * resource matches only a resource of its own kind, so a missing one fails closed.
 */
export function staatToe(ik: Ik | undefined, rij: Rij, bron?: Rechtbron): boolean {
  if (!ik) return false;
  if (ik.isDirectie) return true;

  const kolommen = RECHTENMATRIX[rij];

  if (kolommen.includes("Themabeheer") && ik.heeftThemabeheer) return true;

  const leeftijd = bron?.soort === "leeftijd" || bron?.soort === "activiteit" ? bron.leeftijd : null;
  if (leeftijd !== null) {
    if (kolommen.includes("Hoofdleerkracht") && ik.hoofdleerkrachtLeeftijden.includes(leeftijd)) return true;
    if (kolommen.includes("LeerkrachtLeeftijd") && ik.leerkrachtLeeftijden.includes(leeftijd)) return true;
  }

  if (bron?.soort === "activiteit" && !bron.heeftDoelkoppelingen) {
    // Footnote ³ (I19): moving one without links is content, so every leerkracht of that leeftijd may.
    if (kolommen.includes("LeerkrachtLeeftijdZonderKoppelingen") && ik.leerkrachtLeeftijden.includes(bron.leeftijd)) {
      return true;
    }
    // Footnote ² (R25, R33): the maker, whatever else they hold. An activiteit without a maker matches no one here.
    if (kolommen.includes("MakerZonderKoppelingen") && bron.makerId !== null && zelfdeId(bron.makerId, ik.id)) {
      return true;
    }
  }

  return (
    kolommen.includes("LeerkrachtEigen") &&
    bron?.soort === "klas" &&
    ik.eigenKlasIds.some((klasId) => zelfdeId(klasId, bron.klasId))
  );
}

/** What an activiteit row needs to be asked about: its subthema's leeftijd, its maker and whether a goal is linked. */
export interface Activiteitfeiten {
  leeftijd: string;
  makerId?: string | null;
  doelkoppelingen: readonly unknown[];
}

function activiteitbron(activiteit: Activiteitfeiten): Rechtbron {
  return {
    soort: "activiteit",
    leeftijd: activiteit.leeftijd,
    makerId: activiteit.makerId ?? null,
    heeftDoelkoppelingen: activiteit.doelkoppelingen.length > 0,
  };
}

/**
 * The answers the screens ask for, each one a row of the matrix on the resource the control is about.
 * Named after the action, so a call site reads as the rule it applies.
 */
export interface Mag {
  /** Gebruikers, klassen, schooljaren and rights (R2, R3, R16): directie. Includes the klaskiezer's jaarfase. */
  beheer: boolean;
  /** The Op.stap import (R3; ADR-0022): directie. */
  curriculumbeheer: boolean;
  /** Thema, themadoelen, kernwoordenschat (R4, R18). */
  themaBewerken: boolean;
  /** Deleting a thema: directie only in the frontend (I26; see `RECHTENMATRIX.ThemaVerwijderen`). */
  themaVerwijderen: boolean;
  /** The FR-1 import (R9, R27, R34). */
  schoolcontentImporteren: boolean;
  /** The import's "menselijke beslissingen verwijderen" option (R35): directie. */
  menselijkeBeslissingenVerwijderen: boolean;
  /** The thema-opbouw wizard and its AI assist (R29). No screen calls it yet (E6-05). */
  themaOpbouw: boolean;
  /** Having doelsuggesties made (R14). */
  doelsuggestiesMaken: boolean;
  /** Accepting, rejecting or adjusting them (R14). */
  doelsuggestiesBeoordelen: boolean;
  /** Making a subthema at SOME leeftijd: directie, or a hoofdleerkracht of at least one. The form then offers only those. */
  subthemaToevoegen: boolean;
  /** A subthema at this leeftijd: create, edit, delete, its onderzoeksvragen (R5, R21; I16). */
  subthemaBeheren: (leeftijd: string) => boolean;
  /** Moving a subthema from one leeftijd to another: the right at both (I13). */
  subthemaHerschikken: (van: string, naar: string) => boolean;
  /** The streefwoordenschat of a subthema at this leeftijd (R28). No editor exists yet (E10-01). */
  streefwoordenschatAanpassen: (leeftijd: string) => boolean;
  /** Creating a shared activiteit at this leeftijd, and editing an activiteit's content (R17, R23; I15). */
  activiteitBewerken: (leeftijd: string) => boolean;
  /** Deleting this activiteit: hoofdleerkracht, or its maker while no goal is linked (R25, R26, R33). */
  activiteitVerwijderen: (activiteit: Activiteitfeiten) => boolean;
  /** Moving this activiteit to another thema (R19, R23; I19). No screen moves one yet. */
  activiteitVerplaatsen: (activiteit: Activiteitfeiten) => boolean;
  /** Subdoelen of a subthema at this leeftijd (R24). */
  subdoelenBeheren: (leeftijd: string) => boolean;
  /** Linking goals to, or unlinking them from, shared activiteiten at this leeftijd, by hand or on create (R19). */
  doelenKoppelen: (leeftijd: string) => boolean;
  /**
   * Linking a doel ANYWHERE: on a thema (themadoel), a subthema (subdoel) or an activiteit. The register's "Koppel dit
   * doel" leads to all three, so it is offered to whoever may do at least one of them: directie, themabeheer, or a
   * hoofdleerkracht of some leeftijd.
   */
  ergensDoelKoppelen: boolean;
  /** Everything that writes a klas's planning: jaarplan, agenda, hoeken, algemene fiches (R7, R15; I21). */
  klasplanningBewerken: (klasId: string | null) => boolean;
}

/** The answers for one gebruiker, or for nobody while `/api/ik` has not answered. */
export function magVoor(ik: Ik | undefined): Mag {
  const rij = (naam: Rij, bron?: Rechtbron) => staatToe(ik, naam, bron);
  const opLeeftijd = (naam: Rij) => (leeftijd: string) => rij(naam, { soort: "leeftijd", leeftijd });
  const hoofdleerkrachtLeeftijden = ik?.hoofdleerkrachtLeeftijden ?? [];

  return {
    beheer: rij("Beheer"),
    curriculumbeheer: rij("Curriculumbeheer"),
    themaBewerken: rij("ThemaBewerken"),
    themaVerwijderen: rij("ThemaVerwijderen"),
    schoolcontentImporteren: rij("SchoolcontentImporteren"),
    menselijkeBeslissingenVerwijderen: rij("MenselijkeBeslissingenVerwijderen"),
    themaOpbouw: rij("ThemaOpbouw"),
    doelsuggestiesMaken: rij("DoelsuggestiesMaken"),
    doelsuggestiesBeoordelen: rij("DoelsuggestiesBeoordelen"),
    // Directie passes without a leeftijd; anyone else needs one where the row holds.
    subthemaToevoegen:
      ik?.isDirectie === true ||
      hoofdleerkrachtLeeftijden.some((leeftijd) => rij("SubthemaBeheren", { soort: "leeftijd", leeftijd })),
    subthemaBeheren: opLeeftijd("SubthemaBeheren"),
    subthemaHerschikken: (van, naar) =>
      rij("SubthemaBeheren", { soort: "leeftijd", leeftijd: van }) &&
      rij("SubthemaBeheren", { soort: "leeftijd", leeftijd: naar }),
    streefwoordenschatAanpassen: opLeeftijd("StreefwoordenschatAanpassen"),
    activiteitBewerken: opLeeftijd("GedeeldeActiviteitBewerken"),
    activiteitVerwijderen: (activiteit) => rij("ActiviteitVerwijderen", activiteitbron(activiteit)),
    activiteitVerplaatsen: (activiteit) => rij("ActiviteitVerplaatsen", activiteitbron(activiteit)),
    subdoelenBeheren: opLeeftijd("SubdoelenBeheren"),
    doelenKoppelen: opLeeftijd("DoelenKoppelen"),
    ergensDoelKoppelen:
      rij("ThemaBewerken") ||
      hoofdleerkrachtLeeftijden.some(
        (leeftijd) =>
          rij("SubdoelenBeheren", { soort: "leeftijd", leeftijd }) ||
          rij("DoelenKoppelen", { soort: "leeftijd", leeftijd }),
      ),
    klasplanningBewerken: (klasId) =>
      ik?.isDirectie === true || (klasId !== null && rij("KlasplanningBewerken", { soort: "klas", klasId })),
  };
}

/**
 * The signed-in gebruiker's answers. `laadt` is true until `/api/ik` has answered; `mag` then holds nothing, so a
 * screen may render as a reader until it knows better and never has to take a control away.
 */
export function useRechten(): { mag: Mag; laadt: boolean } {
  const { data, isPending } = useIk();
  const mag = useMemo(() => magVoor(data), [data]);
  return { mag, laadt: isPending };
}

/** Whether a failed request was the server refusing the action for want of a right (ADR-0030, E6-02 slice 3). */
export function isGeenToegang(fout: unknown): boolean {
  return fout instanceof ApiError && fout.status === 403;
}

/**
 * What to tell a teacher when the server refused an action: its own Dutch sentence (slice 3 pins "Je hebt geen toegang
 * tot deze actie."), or the catalogue's when a 403 came without one. Null for any other failure, so a call site keeps
 * its own wording for those: `geenToegangZin(fout) ?? t("…mislukt")`.
 *
 * It happens when a control went stale: rights changed while the page was open, or the resource did (someone linked a
 * goal to the activiteit a maker was about to delete). The query client then refetches, so the stale control goes.
 */
export function geenToegangZin(fout: unknown): string | null {
  if (!isGeenToegang(fout)) return null;
  return (fout as ApiError).detail ?? t("rechten.geenToegang");
}
