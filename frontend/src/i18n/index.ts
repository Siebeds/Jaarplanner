import catalogus from "./nl.json";

/**
 * The Dutch string catalogue (Art. II.3). Every word a teacher reads that this frontend authors
 * lives in nl.json; components reference keys.
 *
 * Typed by dot path, so a key that does not exist is a compile error rather than a "doelen.titl"
 * rendered verbatim on screen. `catalogus.test.ts` guards the rules a type cannot: no em dashes,
 * no dead keys, no Dutch literal smuggled into a component.
 */
type Blad = string;

type Paden<T> = T extends Blad
  ? ""
  : {
      [K in keyof T & string]: T[K] extends Blad ? K : `${K}.${Paden<T[K]>}`;
    }[keyof T & string];

export type Vertaalsleutel = Paden<typeof catalogus>;

/**
 * Looks up `sleutel` and substitutes every `{naam}` placeholder from `waarden`.
 *
 * A missing key returns the key itself. That is deliberate: rendering "doelen.titl" is ugly on
 * screen and therefore gets noticed and fixed, where an empty string silently ships a blank label.
 */
export function t(sleutel: Vertaalsleutel, waarden?: Record<string, string | number>): string {
  const tekst = sleutel
    .split(".")
    .reduce<unknown>((knoop, deel) => (typeof knoop === "object" && knoop !== null ? (knoop as Record<string, unknown>)[deel] : undefined), catalogus);

  if (typeof tekst !== "string") return sleutel;
  if (!waarden) return tekst;

  return tekst.replace(/\{(\w+)\}/g, (heel, naam: string) => {
    const waarde = waarden[naam];
    return waarde === undefined ? heel : String(waarde);
  });
}

/** "1 doel" / "7 doelen": Dutch needs the singular spelled out, not an appended "(en)". */
export function telWoord(aantal: number, enkelvoud: Vertaalsleutel, meervoud: Vertaalsleutel): string {
  return aantal === 1 ? t(enkelvoud) : t(meervoud, { aantal });
}

export { catalogus };
