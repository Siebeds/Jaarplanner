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
  | "KlasplanningBewerken"
  | "KlasplanningBekijken"
  | "OntwikkelingsrapportLezen"
  | "LeerlingenBeheren"
  | "RapportInvullen"
  | "RapportsetBewerken"
  | "WoordwebBewerken";

/** The §3 columns other than "Directie" (every row) and "Ander" (no enforced row), as the server's `Kolom` names them. */
export type Kolom =
  | "Themabeheer"
  | "Hoofdleerkracht"
  | "LeerkrachtLeeftijd"
  | "LeerkrachtLeeftijdZonderKoppelingen"
  | "LeerkrachtEigen"
  | "MakerZonderKoppelingen"
  | "ThemabeheerZonderAndermansInhoud"
  | "LeerkrachtRapportLezen"
  | "LeerkrachtRapportInvullen"
  | "Rapportsetleerkracht"
  | "HoofdleerkrachtLezen"
  | "LeerkrachtLeeftijdLezen"
  | "LeerkrachtEigenLezen"
  | "Leerlingzorg"
  | "Eigenaar";

/** §3 as data, one entry per server row, with the same columns. */
export const RECHTENMATRIX: Record<Rij, readonly Kolom[]> = {
  Curriculumbeheer: [],
  Beheer: [],
  ThemaBewerken: ["Themabeheer"],
  // I26. On the server the column asks the `Themabron`: whether the thema holds anything but its own open wizard run's
  // items, and whether one of those carries a goal link the gebruiker may not remove. The frontend knows one case of it
  // for sure, the EMPTY thema (no subthema, and so no subdoel or activiteit, since both hang under a subthema), for
  // which the server's resolver reports no one else's content and no linked leeftijd. That is the `thema` resource
  // below. A thema holding only its open run's items is the server's too, but no read here carries a run's items, so
  // that case stays closed until E6-05 reads the run. *Until fix round 1 this said the frontend could know no case at
  // all, and offered the delete to directie only.*
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
  // Reading a klas's planning (FB-013, ADR-0040): themabeheer every klas; a hoofdleerkracht and a leerkracht the klassen
  // of their jaarfase; a klastoewijzing its own klas. Columns of their own, as on the server. No screen asks it about one
  // klas: the server filters `GET /api/klassen` by it, and the klas→leeftijden mapping lives there. The screens ask the
  // resource-free part only (`alleKlassenInzien`, `geenKlasInzien`).
  KlasplanningBekijken: ["Themabeheer", "HoofdleerkrachtLezen", "LeerkrachtLeeftijdLezen", "LeerkrachtEigenLezen"],
  // The ontwikkelingsrapport rows (ADR-0030 footnote ⁶, ADR-0035 §3.3; FB-001). "LK eigen" here means a klas that
  // grants K3, and it fills in only during the klas's schooljaar (R26), so both columns read their own list from
  // `/api/ik` rather than `eigenKlasIds`, which has no end date (I21). Leerlingzorg (R18, FB-008) reads every klas's
  // reports, and this is the only row its column is on: it fills in nothing, and downloads nothing (D5).
  OntwikkelingsrapportLezen: ["LeerkrachtRapportLezen", "Leerlingzorg"],
  LeerlingenBeheren: ["LeerkrachtRapportInvullen"],
  // FB-003: the star, the text and the besluit of a report, by the same column as the children.
  RapportInvullen: ["LeerkrachtRapportInvullen"],
  // FB-002 (R6, D4): a klastoewijzing on a klas that can hold children, in a running schooljaar, which is exactly
  // `lopendeRapportklasIds` being non-empty. That list comes from the one klas→leeftijden mapping, so directie's
  // graadklas decision moves this row with it. Directie does NOT pass it: see `ZONDER_DIRECTIE`.
  RapportsetBewerken: ["Rapportsetleerkracht"],
  // FB-036 (ADR-0042 W2, D3): a woordweb is its owner's; directie passes every row. Keeping one needs no row (D2).
  WoordwebBewerken: ["Eigenaar"],
};

/**
 * The rows directie does not pass (the server's `Matrixrij.ZonderDirectie`). One today: the K3 set of rapportdoelen and
 * the sterrenschaal, which only the K3 leerkrachten change while directie views them (ADR-0035 R31, the one exception to
 * R3 "directie sees and edits everything").
 */
export const ZONDER_DIRECTIE: ReadonlySet<Rij> = new Set<Rij>(["RapportsetBewerken"]);

/**
 * The resource a row is asked about: the server's `Leeftijdsinhoud`, `Activiteitbron` and `Klasplanning`.
 *
 * `heeftDoelkoppelingen` counts every link whatever its status, as `EfRechtenbronnen` does: the read payload carries
 * all of them, so `doelkoppelingen.length > 0` is the same fact the server decides on.
 */
export type Rechtbron =
  | { soort: "leeftijd"; leeftijd: string }
  | { soort: "activiteit"; leeftijd: string; makerId: string | null; heeftDoelkoppelingen: boolean }
  | { soort: "klas"; klasId: string }
  /**
   * The part of the server's `Themabron` the frontend can know: whether the thema is empty. `useThema` reads every
   * leeftijd's chapters, so `subthemas.length === 0` is the same fact the server's resolver decides on for it.
   */
  | { soort: "thema"; leeg: boolean }
  /** A klas as the ontwikkelingsrapport rows ask about it: the server's `Rapportklas`. */
  | { soort: "rapportklas"; klasId: string }
  /** A klas as reading its planning asks about it: the server's `Klasinzage`, with the leeftijden the server mapped it to. */
  | { soort: "klasinzage"; klasId: string; leeftijden: readonly string[] }
  /** A woordweb with its owner: the server's `Woordwebbron` (FB-036). */
  | { soort: "woordweb"; eigenaarId: string };

/** GUIDs from System.Text.Json are lowercase on every route, so this is equality; the fold only guards a future one. */
function zelfdeId(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Whether `ik` may do what `rij` describes, on `bron`. The server's `StaatToe`, clause for clause:
 * directie passes every row but those in `ZONDER_DIRECTIE` (R31); otherwise any one matching column is enough (the
 * union rule); a column that needs a resource matches only a resource of its own kind, so a missing one fails closed.
 */
export function staatToe(ik: Ik | undefined, rij: Rij, bron?: Rechtbron): boolean {
  if (!ik) return false;
  // R31 as the owner read it (2026-09-15, "Nooit wie directie heeft"): a ZONDER_DIRECTIE row is closed to directie
  // outright, even with a K3 klas of its own, because directie assigns klassen and could otherwise open it for itself.
  if (ik.isDirectie) return !ZONDER_DIRECTIE.has(rij);

  const kolommen = RECHTENMATRIX[rij];

  // Resource-free, like the server's column: some klas of theirs can hold children and its schooljaar still runs (D4).
  // `?? []` as for the report rows: an `/api/ik` answer without the list grants nothing.
  if (kolommen.includes("Rapportsetleerkracht") && (ik.lopendeRapportklasIds ?? []).length > 0) return true;

  if (kolommen.includes("Themabeheer") && ik.heeftThemabeheer) return true;

  // I26: themabeheer deletes a thema that holds nothing anyone else made. An empty thema holds nothing at all, and no
  // goal link either, so the server's check on linked leeftijden has nothing to ask. See `RECHTENMATRIX.ThemaVerwijderen`.
  if (
    kolommen.includes("ThemabeheerZonderAndermansInhoud") &&
    ik.heeftThemabeheer &&
    bron?.soort === "thema" &&
    bron.leeg
  ) {
    return true;
  }

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

  if (bron?.soort === "klasinzage") {
    // FB-013: HL and "LK leeftijd" on a klas of one of their leeftijden, "LK eigen" on their own klas.
    if (kolommen.includes("HoofdleerkrachtLezen") && bron.leeftijden.some((l) => ik.hoofdleerkrachtLeeftijden.includes(l))) {
      return true;
    }
    if (kolommen.includes("LeerkrachtLeeftijdLezen") && bron.leeftijden.some((l) => ik.leerkrachtLeeftijden.includes(l))) {
      return true;
    }
    if (kolommen.includes("LeerkrachtEigenLezen") && ik.eigenKlasIds.some((klasId) => zelfdeId(klasId, bron.klasId))) {
      return true;
    }
  }

  if (bron?.soort === "rapportklas") {
    // `?? []`: an `/api/ik` answer from before FB-001 has neither list, and a right must fail closed.
    const heeft = (lijst: readonly string[] | undefined) => (lijst ?? []).some((klasId) => zelfdeId(klasId, bron.klasId));
    if (kolommen.includes("LeerkrachtRapportInvullen") && heeft(ik.lopendeRapportklasIds)) return true;
    if (kolommen.includes("LeerkrachtRapportLezen") && heeft(ik.rapportklasIds)) return true;
    // Leerlingzorg (R18, FB-008): every klas's reports. `=== true`: an answer without the field grants nothing.
    if (kolommen.includes("Leerlingzorg") && ik.heeftLeerlingzorg === true) return true;
  }

  // ADR-0042 W2: the owner of a woordweb, whatever else she holds. Only a woordweb resource matches this column.
  if (kolommen.includes("Eigenaar") && bron?.soort === "woordweb" && zelfdeId(bron.eigenaarId, ik.id)) return true;

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
  /**
   * Deleting this thema (R3; I26): directie always, themabeheer on an empty thema. A thema holding only its own open
   * wizard run's items waits for E6-05 (see `RECHTENMATRIX.ThemaVerwijderen`).
   */
  themaVerwijderen: (thema: { subthemas: readonly unknown[] }) => boolean;
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
   * Linking a doel somewhere in a tree of thema's scoped to these leeftijden: on a thema (themadoel, R4), or on a
   * subthema or an activiteit at one of them (subdoel R24, activiteit R19). The register's destination sheet lists the
   * chosen klas's subthema's, so its "Koppel dit doel" asks with that klas's leeftijden: a hoofdleerkracht of K3 with
   * an L1 klas picked would otherwise open a sheet with nothing to press (fix round 1, F1).
   */
  doelKoppelenVoor: (leeftijden: readonly string[]) => boolean;
  /** Everything that writes a klas's planning: jaarplan, agenda, hoeken, algemene fiches (R7, R15; I21). */
  klasplanningBewerken: (klasId: string | null) => boolean;
  /**
   * Whether this gebruiker reads every klas: directie or themabeheer, the part of `KlasplanningBekijken` that needs no
   * klas (FB-013). Only then does an empty klassen list mean the schooljaar has none; for anyone else the server offers
   * only the klassen they may read.
   */
  alleKlassenInzien: boolean;
  /**
   * Whether this gebruiker holds no relation that opens any klas: no directie, no themabeheer, no hoofdleerkracht
   * appointment, no klastoewijzing (FB-013, ADR-0040 Z4). False until `/api/ik` has answered with a gebruiker, so a
   * screen never says "you have no right" on a failed answer.
   */
  geenKlasInzien: boolean;
  /**
   * Whether this gebruiker reads reports at all (ADR-0035 D18): directie, a leerkracht of a klas that grants K3, or
   * Leerlingzorg (FB-008). Anyone else would find a list of children with nothing they may see.
   */
  ontwikkelingsrapportZien: boolean;
  /**
   * Whether this gebruiker reads the reports of every klas that can hold children: directie or Leerlingzorg (FB-008).
   * Only then does an empty list of such klassen mean the schooljaar has none; anyone else reads only their own.
   */
  alleRapportklassenLezen: boolean;
  /**
   * Reading this klas's children and reports: directie, the klas's own K3 leerkrachten, also after its year (R26), and
   * Leerlingzorg, on every klas (R18, FB-008).
   */
  ontwikkelingsrapportLezen: (klasId: string) => boolean;
  /** Adding, renaming and deleting this klas's children: directie, and its K3 leerkrachten during its year (R26, D8). */
  leerlingenBeheren: (klasId: string) => boolean;
  /** Filling in a report of this klas (star, text, besluit): directie, and its K3 leerkrachten during its year (R26). */
  rapportInvullen: (klasId: string) => boolean;
  /**
   * Whether this gebruiker reads this klas's children only because they taught it in a schooljaar that has ended:
   * a K3 leerkracht of the klas, not directie, and no longer allowed to write (R26). Exactly the case a screen may
   * explain with "dit schooljaar is voorbij" (the E5-03 rule): reading without writing for any other reason
   * (Leerlingzorg, FB-008) is not this.
   */
  rapportAlleenNogLezen: (klasId: string) => boolean;
  /** Changing the one K3 set of rapportdoelen and the sterrenschaal: a K3 leerkracht in a running schooljaar, never
   * directie (R6, R31, D4). */
  rapportsetBewerken: boolean;
  /**
   * Whether the Ontwikkelingsrapport destination is offered in the navigation (ADR-0035 D18, widened by the owner on
   * 2026-09-15): whoever may read a report (`ontwikkelingsrapportZien`), and a hoofdleerkracht of K3, who manages the
   * K3 subdoelen the set is made of and may view the set and the scale, though not the children. Anyone else can still
   * open the set and the scale by address (FB-002 AC5); the tab is not offered to them.
   */
  ontwikkelingsrapportTab: boolean;
  /** Changing this woordweb and asking the AI for words: its owner, and directie (ADR-0042 W2, D3). */
  woordwebBewerken: (eigenaarId: string) => boolean;
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
    themaVerwijderen: (thema) => rij("ThemaVerwijderen", { soort: "thema", leeg: thema.subthemas.length === 0 }),
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
    doelKoppelenVoor: (leeftijden) =>
      rij("ThemaBewerken") ||
      leeftijden.some(
        (leeftijd) =>
          rij("SubdoelenBeheren", { soort: "leeftijd", leeftijd }) ||
          rij("DoelenKoppelen", { soort: "leeftijd", leeftijd }),
      ),
    klasplanningBewerken: (klasId) =>
      ik?.isDirectie === true || (klasId !== null && rij("KlasplanningBewerken", { soort: "klas", klasId })),
    // Without a klas the row passes only on its resource-free columns: directie and themabeheer.
    alleKlassenInzien: rij("KlasplanningBekijken"),
    // `?? []`: an answer without the lists (an older API, a test that stubs every request alike) must not crash every
    // screen that asks for rights. It then reads as "no relation", which only a known gebruiker turns into a sentence.
    geenKlasInzien:
      ik !== undefined &&
      !rij("KlasplanningBekijken") &&
      (ik.hoofdleerkrachtLeeftijden ?? []).length === 0 &&
      (ik.leerkrachtLeeftijden ?? []).length === 0 &&
      (ik.eigenKlasIds ?? []).length === 0,
    ontwikkelingsrapportZien:
      ik?.isDirectie === true || ik?.heeftLeerlingzorg === true || (ik?.rapportklasIds ?? []).length > 0,
    alleRapportklassenLezen: ik?.isDirectie === true || ik?.heeftLeerlingzorg === true,
    ontwikkelingsrapportLezen: (klasId) => rij("OntwikkelingsrapportLezen", { soort: "rapportklas", klasId }),
    leerlingenBeheren: (klasId) => rij("LeerlingenBeheren", { soort: "rapportklas", klasId }),
    rapportInvullen: (klasId) => rij("RapportInvullen", { soort: "rapportklas", klasId }),
    // The klas is one they taught (`rapportklasIds`), not merely one they read: Leerlingzorg reads without writing too,
    // and for them "dit schooljaar is voorbij" would be a reason that is not theirs.
    rapportAlleenNogLezen: (klasId) =>
      ik !== undefined &&
      !ik.isDirectie &&
      (ik.rapportklasIds ?? []).some((id) => zelfdeId(id, klasId)) &&
      !rij("LeerlingenBeheren", { soort: "rapportklas", klasId }),
    // Deliberately no `isDirectie` short-circuit here, unlike some answers above: this is the row directie does not pass.
    rapportsetBewerken: rij("RapportsetBewerken"),
    ontwikkelingsrapportTab:
      ik?.isDirectie === true ||
      ik?.heeftLeerlingzorg === true ||
      (ik?.rapportklasIds ?? []).length > 0 ||
      // "K3" is the leeftijd of a hoofdleerkracht's appointment, not a klas's jaarfase, so this is no klas→leeftijden
      // mapping (that stays the server's, `Leeftijdsrechten.VoorKlas`).
      hoofdleerkrachtLeeftijden.includes("K3"),
    woordwebBewerken: (eigenaarId) => rij("WoordwebBewerken", { soort: "woordweb", eigenaarId }),
  };
}

/**
 * The signed-in gebruiker's answers.
 *
 * - `laadt` is true until `/api/ik` has answered, successfully or not.
 * - `bekend` is true only once it answered WITH a gebruiker. Only then does an absent right mean the gebruiker lacks
 *   it. A failed `/api/ik` leaves `laadt` false and `bekend` false: `mag` holds nothing, so no write control is
 *   offered, and a sentence that says the gebruiker lacks a right must wait for `bekend`. Otherwise it would tell a
 *   directie whose `/api/ik` failed that they may only read (fix round 1, F3, the E5-03 rule).
 *
 * Until then `mag` holds nothing, so a screen renders as a reader until it knows better and never has to take a
 * control away.
 */
export function useRechten(): { mag: Mag; laadt: boolean; bekend: boolean } {
  const { data, isPending } = useIk();
  const mag = useMemo(() => magVoor(data), [data]);
  return { mag, laadt: isPending, bekend: data !== undefined };
}

/**
 * What an empty klassen list means for the signed-in gebruiker, as one sentence (FB-013, ADR-0040). The server offers
 * only the klassen a gebruiker may read, so "this schooljaar has no klassen" is true only for whoever reads them all:
 * - no relation that opens any klas (known from `/api/ik`): that, in plain words;
 * - directie or themabeheer: `alleKlassenZin`, the screen's own sentence;
 * - anyone else, and anyone while `/api/ik` has not answered: no klas they may read, which the server's list guarantees.
 */
export function useGeenKlassenZin(alleKlassenZin: string): string {
  const { mag, bekend } = useRechten();
  if (bekend && mag.geenKlasInzien) return t("context.geenInzage");
  return mag.alleKlassenInzien ? alleKlassenZin : t("context.geenKlassenInzage");
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
