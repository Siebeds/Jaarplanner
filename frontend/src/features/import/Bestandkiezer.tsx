import { useId } from "react";

import { t } from "../../i18n";

/**
 * The file control, for both importers (E1-13 clause 1).
 *
 * **Deliberately not a dropzone**, which is the default answer for every upload UI and the wrong one here.
 * The file comes out of Excel through the file explorer; the users are non-technical; and dragging already
 * means one specific thing in this application — moving a thema to a period (E3-07). One gesture, one
 * meaning. So this is a plain, large, labelled file button.
 *
 * It is the **native** `<input type="file">` restyled through the `file:` variants rather than a button that
 * clicks a hidden input. The native control is already a labelled form control: it is keyboard reachable, it
 * announces its own accessible name, and the browser's own file dialog is the one the reader knows. Hiding it
 * behind a `<button>` means re-implementing all three and getting one of them wrong.
 *
 * **The chosen filename is stated in our own text**, below the control, because the native control's own
 * rendering of it is browser-dependent, truncates without a title, and is not something a test can read
 * reliably. `accept` filters the dialog; it does not validate, so the server's own `.xlsx` check stays the
 * only guarantee (a renamed file reaches it either way).
 */
export function Bestandkiezer({
  label,
  bestand,
  onKies,
  disabled,
}: {
  /** The visible label. Each importer names its own file, so this is not shared copy. */
  label: string;
  bestand: File | null;
  /** Called with the chosen file, or null when the reader cleared the field. */
  onKies: (bestand: File | null) => void;
  disabled: boolean;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        disabled={disabled}
        onChange={(event) => onKies(event.target.files?.[0] ?? null)}
        className={[
          "mt-1.5 block w-full cursor-pointer rounded-md border border-input bg-card text-sm text-ink",
          "file:mr-3 file:cursor-pointer file:rounded-l-md file:border-0 file:bg-petrol file:px-4 file:py-3",
          "file:text-sm file:font-semibold file:text-petrol-foreground file:transition-colors",
          "file:duration-150 file:ease-uit hover:file:bg-petrol-helder",
          // No focus utilities here: `index.css` gives every element one `:focus-visible` ring for the whole
          // app precisely so nothing has to remember, and adding an outline on top of it renders two rings.
          "disabled:cursor-not-allowed disabled:text-ink-zacht disabled:file:bg-muted disabled:file:text-ink-zacht",
        ].join(" ")}
      />
      <p className="mt-1.5 text-xs text-ink-zacht">
        {bestand
          ? t("import.bestandGekozen", { naam: bestand.name })
          : t("import.geenBestandGekozen")}
      </p>
    </div>
  );
}
