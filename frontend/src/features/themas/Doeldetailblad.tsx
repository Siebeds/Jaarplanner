import { useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { t } from "../../i18n";
import { Doeldetail } from "../doelen/Doeldetail";
import { Minimumdoeldetail } from "../doelen/Minimumdoeldetail";

type Keuze = { soort: "leerplandoel"; code: string } | { soort: "minimumdoel"; ref: string };

/**
 * The detail of a doel linked on the thema page, in a sheet (TB-016).
 *
 * The same two details the Doelen-register shows, so a doel reads identically wherever a teacher opens
 * it, and the same way onward: a related leerplandoel or the concorded minimumdoel opens in this sheet
 * rather than sending the teacher off the thema they are working on.
 *
 * **No "Koppel dit doel" here.** The register offers it because a doel found there is linked to
 * nothing yet; a doel opened from this page is already linked, and linking another is the job of the
 * control above the list the teacher just pressed.
 *
 * `code` is the doel the page asked for, `null` when the sheet is shut. Where the teacher went from
 * there is this sheet's own state, and it follows a new `code`. It is NOT cleared on close, so the
 * sheet keeps its content while it slides away instead of emptying itself halfway.
 *
 * **Focus goes back to the row that opened it.** A row is not a `Dialog.Trigger`, so without this Radix
 * dropped focus on the page's body when the sheet closed. `terugNaar` is kept here for the same reason
 * as the content: by the time the close focus runs, the page has already cleared what it passed.
 */
export function Doeldetailblad({
  code,
  terugNaar,
  onSluit,
}: {
  code: string | null;
  /** The element that opened the sheet, to receive focus again when it closes. */
  terugNaar?: HTMLElement | null;
  onSluit: () => void;
}) {
  const [keuze, setKeuze] = useState<Keuze | null>(code ? { soort: "leerplandoel", code } : null);
  const [terug, setTerug] = useState<HTMLElement | null>(terugNaar ?? null);
  const [gevolgd, setGevolgd] = useState(code);

  // Adjusting state during render rather than in an effect, so the sheet never paints one frame of the
  // previous doel after a new one was pressed.
  if (code !== gevolgd) {
    setGevolgd(code);
    if (code) {
      setKeuze({ soort: "leerplandoel", code });
      setTerug(terugNaar ?? null);
    }
  }

  const kiesLeerplandoel = (ander: string) => setKeuze({ soort: "leerplandoel", code: ander });

  return (
    <Blad
      open={code !== null}
      onOpenChange={(open) => !open && onSluit()}
      titel={keuze?.soort === "minimumdoel" ? t("minimumdoel.titel") : t("doel.titel")}
      onCloseAutoFocus={(event) => {
        // A row unlinked while its sheet was open is gone; Radix's own fallback is then the best left.
        if (!terug?.isConnected) return;
        event.preventDefault();
        terug.focus();
      }}
    >
      {keuze?.soort === "minimumdoel" ? (
        <Minimumdoeldetail minimumdoelRef={keuze.ref} onKies={kiesLeerplandoel} />
      ) : (
        <Doeldetail
          code={keuze?.code ?? null}
          onKies={kiesLeerplandoel}
          onKiesMinimumdoel={(ref) => setKeuze({ soort: "minimumdoel", ref })}
        />
      )}
    </Blad>
  );
}
