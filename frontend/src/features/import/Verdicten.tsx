import { t } from "../../i18n";

/**
 * The result panel's spine: **two verdicts that are never collapsed into one** (E1-13 clause 3).
 *
 * `isBestandGeldig` and `isVolledigVerwerkt` are two separate truths, and merging them is the exact defect
 * E1-07's own audit rejected server-side — this screen is the layer where it would have reached a teacher. A
 * file can parse without a single problem and still silently drop a typo'd goal code, a 4th themadoel or a
 * subthema naming a klas that does not exist. Reported as one "OK", that upload reads as a success.
 *
 * So the duality is **structural rather than conventional**: the prop is a tuple of exactly two, which a
 * caller cannot satisfy with one summary flag, and each verdict carries its own icon, its own word and its
 * own count. A component that took `Verdict[]` would let the next author pass a single element and lose the
 * rule without touching this file.
 *
 * **Two failure registers, not one.** A problem in the file is a fault the reader must fix (`fout`); content
 * that was dropped although the file was readable is a warning about what did *not* land (`waarschuwing`).
 * They look different because they ask for different things. Colour is never the only carrier: every state
 * also has its glyph and its word (Art. XII, WCAG 2.2 AA).
 *
 * No hue is introduced. `suggestie-geweigerd` is the hue every failure alert in this app already uses and
 * `attentie` is the one warning hue the chrome is allowed (Art. XII); `Toegevoegd`/`Bijgewerkt`/`Ongewijzigd`
 * get none at all (see `Schoolcontentdiff`).
 */
export interface Verdict {
  /** True when this verdict is the good one. Never derived from the other verdict. */
  goed: boolean;
  /** The verdict in one word, e.g. "Gelezen". */
  label: string;
  /** One sentence stating the outcome, with its count when there is one. */
  uitleg: string;
  /** Which register the failure belongs to: a fault in the file, or content that was lost. */
  ernst: "fout" | "waarschuwing";
}

/** The two verdicts of one run. Exactly two, by type. */
export type Verdictenpaar = readonly [Verdict, Verdict];

export function Verdicten({ verdicten }: { verdicten: Verdictenpaar }) {
  return (
    <ul aria-label={t("import.verdict.groepLabel")} className="flex flex-col gap-2">
      {verdicten.map((verdict) => (
        <li
          key={verdict.label}
          className={[
            "flex items-start gap-2.5 rounded-md px-3 py-2.5",
            verdict.goed
              ? "bg-petrol-wash"
              : verdict.ernst === "fout"
                ? "bg-suggestie-geweigerd/10"
                : "bg-attentie-zacht",
          ].join(" ")}
        >
          {/* `aria-hidden`, because the word beside it says the same thing. A screen reader that also read
              "black up-pointing triangle" would announce the state twice, once unintelligibly. */}
          <span
            aria-hidden="true"
            className={[
              "shrink-0 text-sm leading-6",
              verdict.goed
                ? "text-petrol"
                : verdict.ernst === "fout"
                  ? "text-suggestie-geweigerd"
                  : "text-attentie-ink",
            ].join(" ")}
          >
            {verdict.goed ? "✓" : verdict.ernst === "fout" ? "✕" : "▲"}
          </span>

          {/* The label and the sentence wrap as one block, so at ~390px the sentence flows under the label
              instead of forming a narrow second column beside it. */}
          <span className="min-w-0 text-sm leading-6">
            <span
              className={[
                "font-semibold",
                verdict.goed
                  ? "text-petrol"
                  : verdict.ernst === "fout"
                    ? "text-suggestie-geweigerd"
                    : "text-attentie-ink",
              ].join(" ")}
            >
              {verdict.label}
            </span>{" "}
            <span className="text-ink">{verdict.uitleg}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
