import { t, type Vertaalsleutel } from "../../i18n";

const GETAL = new Intl.NumberFormat("nl-BE");

/** "5.835": a first Op.stap import counts in thousands, and a Dutch reader groups them with a dot. */
export function getal(aantal: number): string {
  return GETAL.format(aantal);
}

/**
 * The Dutch name of a changed field. The server reports the model's identifier (`nameof(...)`: `MinimumdoelRef`,
 * `JaarFase`), which is not a word directie reads (E1-22, antagonist round 1 MINOR). An identifier this map does not know
 * is shown as the server sent it rather than guessed at.
 */
const VELD: Record<string, Vertaalsleutel> = {
  Doelsoort: "importeren.veld.Doelsoort",
  JaarFase: "importeren.veld.JaarFase",
  Domein: "importeren.veld.Domein",
  Subdomein: "importeren.veld.Subdomein",
  Cluster: "importeren.veld.Cluster",
  Tekst: "importeren.veld.Tekst",
  Voorbeelden: "importeren.veld.Voorbeelden",
  Toelichting: "importeren.veld.Toelichting",
  Woordenschat: "importeren.veld.Woordenschat",
  MinimumdoelRef: "importeren.veld.MinimumdoelRef",
  OpstapSleutel: "importeren.veld.OpstapSleutel",
  Leeftijd: "importeren.veld.Leeftijd",
  Nr: "importeren.veld.Nr",
  Omschrijving: "importeren.veld.Omschrijving",
  // The decree's ordering and kind (TB-010): a minimumdoel imported before them reports all four once, on the import
  // that fills them in.
  Leergebied: "importeren.veld.Leergebied",
  Rubriek: "importeren.veld.Rubriek",
  Subrubriek: "importeren.veld.Subrubriek",
  Soort: "importeren.veld.Soort",
};

export function veldLabel(veld: string): string {
  const sleutel = VELD[veld];
  return sleutel ? t(sleutel) : veld;
}
