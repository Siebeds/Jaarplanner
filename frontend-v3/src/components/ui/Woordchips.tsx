import { useId, useRef, useState, type ClipboardEvent, type Dispatch, type KeyboardEvent, type SetStateAction } from "react";
import { IcoonKruis } from "../Iconen";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * A list of single words, entered one at a time.
 *
 * **Why not a textarea with one word per line.** The wire type is `string[]`, and a textarea is a
 * shape that says "write prose" while meaning "one term per line". A teacher who types "wind, regen"
 * naturally gets one term out of it, and the hint under the field does not stop that: the control has
 * to make the model visible instead of describing it. A chip cannot be half a word.
 *
 * **Pasting is the case that decides it.** Woordenschat lists arrive from a Word document or a
 * colleague's mail, comma-separated or one per line. This splits a paste on commas, semicolons and
 * newlines, so the paste that used to become a single 40-character "word" becomes the eight words it
 * was. That is the whole reason this control exists rather than a nicer-looking textarea.
 *
 * Duplicates are dropped silently rather than refused. A repeated word in a woordenschat list is a
 * slip, never an intention, and a teacher who pastes over their own list should not have to read an
 * error to find out nothing was lost.
 */
export function Woordchips({
  woorden,
  onWijzig,
  label,
  gevuld,
  uitgeschakeld,
}: {
  woorden: string[];
  /**
   * A state setter rather than a plain callback, so every change is computed from the list at the
   * moment it is applied instead of from the list this render closed over.
   *
   * Not theoretical: a paste arriving in the same tick as an Enter would otherwise be built on the
   * pre-Enter list and silently drop the word Enter had just added. Found in a browser, not reasoned
   * about.
   */
  onWijzig: Dispatch<SetStateAction<string[]>>;
  label: string;
  /**
   * Filled chips instead of outlined ones.
   *
   * The two lists on a thema are not equals: kernwoordenschat is the set every child must end up
   * with, rijke woordenschat is the stretch. That difference is carried by weight, not by a second
   * hue, because every hue in this application already means something (Art. XII).
   */
  gevuld?: boolean;
  uitgeschakeld?: boolean;
}) {
  const id = useId();
  const invoer = useRef<HTMLInputElement>(null);
  const [tekst, setTekst] = useState("");

  function voegToe(ruw: string) {
    const nieuwe = ruw
      .split(/[,;\n\r\t]+/)
      .map((woord) => woord.trim())
      .filter((woord) => woord.length > 0);
    if (nieuwe.length === 0) return;

    onWijzig((huidige) => {
      // A Set keyed on the lowercase form: "Wind" and "wind" are the same word to a teacher, and
      // the first spelling entered is the one kept.
      const gezien = new Set(huidige.map((woord) => woord.toLowerCase()));
      const toegevoegd = nieuwe.filter((woord) => {
        const sleutel = woord.toLowerCase();
        if (gezien.has(sleutel)) return false;
        gezien.add(sleutel);
        return true;
      });
      return toegevoegd.length > 0 ? [...huidige, ...toegevoegd] : huidige;
    });
  }

  function opToets(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === ";") {
      // Enter inside a form submits it, and a teacher pressing Enter after a word means "next word".
      e.preventDefault();
      voegToe(tekst);
      setTekst("");
      return;
    }
    // Backspace in an empty field takes the last chip back, which is what every chip control does and
    // what a teacher who mistyped the previous word reaches for.
    if (e.key === "Backspace" && tekst.length === 0 && woorden.length > 0) {
      e.preventDefault();
      onWijzig((huidige) => huidige.slice(0, -1));
    }
  }

  function opPlakken(e: ClipboardEvent<HTMLInputElement>) {
    const geplakt = e.clipboardData.getData("text");
    if (!/[,;\n]/.test(geplakt)) return; // a single word: let the input handle it normally
    e.preventDefault();
    voegToe(geplakt);
    setTekst("");
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-meta font-medium text-inkt">
          {label}
        </label>
        <span className="mono shrink-0 text-micro text-inkt-zwak">{woorden.length}</span>
      </div>

      {/* Clicking the box anywhere lands in the field: the whole rectangle looks like one input, so
          it has to behave like one. The input itself keeps the focus ring, on itself and not on the
          box, so what is focused is what receives the next keystroke. */}
      <div
        onClick={() => invoer.current?.focus()}
        className={cn(
          "mt-1.5 flex flex-wrap items-center gap-1.5 rounded-veld border border-lijn-veld bg-kaart p-2",
          uitgeschakeld && "opacity-45",
        )}
      >
        {woorden.map((woord) => (
          <span
            key={woord}
            className={cn(
              "inline-flex items-center gap-1 rounded-full py-1 pl-2.5 pr-1 text-meta",
              gevuld ? "bg-vlak-diep font-medium text-inkt" : "border border-lijn text-inkt-zacht",
            )}
          >
            {woord}
            <button
              type="button"
              disabled={uitgeschakeld}
              aria-label={t("woorden.haalWeg", { woord })}
              onClick={(e) => {
                e.stopPropagation();
                onWijzig((huidige) => huidige.filter((ander) => ander !== woord));
              }}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-inkt-zwak transition-colors duration-150 hover:bg-kaart hover:text-inkt"
            >
              <IcoonKruis aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}

        <input
          ref={invoer}
          id={id}
          value={tekst}
          disabled={uitgeschakeld}
          onChange={(e) => setTekst(e.target.value)}
          onKeyDown={opToets}
          onPaste={opPlakken}
          // Committed on blur too: a teacher who types a word and then reaches for Bewaren has said
          // that word, and losing it because they never pressed Enter is the one failure this control
          // must not have.
          onBlur={() => {
            voegToe(tekst);
            setTekst("");
          }}
          className="min-h-8 min-w-32 flex-1 bg-transparent px-1 text-body text-inkt outline-none placeholder:text-inkt-zwak"
          placeholder={woorden.length === 0 ? t("woorden.eersteWoord") : t("woorden.volgendWoord")}
        />
      </div>
    </div>
  );
}
