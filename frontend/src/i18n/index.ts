import nl from "./nl.json";

/**
 * Minimal, dependency-free i18n lookup for the MVP scaffold (ADR-0005, Art. II.3).
 *
 * The app is Dutch-only for now, so there is no runtime language switching and no
 * need for a full i18n library (react-i18next). `nl.json` is the single source of
 * Dutch UI text; this helper resolves a dot-notation key against it and returns the
 * string. Keys are typed against the JSON so a typo or a missing key is a compile error.
 *
 * Convention: nested JSON grouped by feature/area (`app`, `zijbalk`, …). Callers use
 * the flattened dot path, e.g. `t("zijbalk.open")`. Catalogue values are Dutch; keys
 * are stable technical identifiers (English/Dutch mix is fine — they are not user-facing).
 */

type NlCatalogue = typeof nl;

/** Recursively builds the union of dot-notation paths whose leaves are strings. */
type DotKeys<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends object
      ? `${K}.${DotKeys<T[K]>}`
      : never;
}[keyof T & string];

export type TranslationKey = DotKeys<NlCatalogue>;

/** Values substituted into `{placeholder}` slots of a catalogue string. */
export type TranslationParams = Record<string, string | number>;

/**
 * Resolve a translation key to its Dutch string from `nl.json`.
 *
 * Optional `params` fill `{placeholder}` slots in the catalogue value (simple, dependency-free
 * interpolation), e.g. `t("matching.aanvaardenAria", { code: "NAT-K3-01" })` against
 * `"Leerplandoel {code} aanvaarden"`. Missing slots are left untouched.
 *
 * @throws never at runtime for valid keys; an unknown key is rejected at compile time.
 *         As a defensive runtime fallback (e.g. catalogue edited out of sync) the key
 *         itself is returned so the UI degrades visibly rather than crashing.
 */
export function t(key: TranslationKey, params?: TranslationParams): string {
  const value = key
    .split(".")
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === "object"
          ? (node as Record<string, unknown>)[segment]
          : undefined,
      nl,
    );

  let result = typeof value === "string" ? value : key;

  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      result = result.replaceAll(`{${name}}`, String(replacement));
    }
  }

  return result;
}
