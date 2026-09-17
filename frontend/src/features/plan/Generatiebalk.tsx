import { useState } from "react";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { AiKnop } from "../../components/ui/Knop";
import { t, telWoord } from "../../i18n";
import type { JaarplanGeneratieResultaat, Themaplaatsing } from "../../lib/types";
import { aantalOpenThemas } from "./openvoorstellen";

/**
 * The AI generation of the year plan (FR-5.1, FR-8.1, ADR-0055): the button, the question before open proposals are
 * replaced, and one line on what the run did.
 *
 * **It asks only when something would go.** A run replaces the open, unlocked proposals and keeps everything else, so a
 * plan without open proposals is generated at once. The question counts thema's, not the parts a vacation cut them in.
 *
 * **The line says what the teacher can act on:** how many thema's were proposed, and which did not fit. A proposal the
 * server skipped because the thema was already planned or unknown is not the teacher's to fix, so it is not named.
 */
export function Generatiebalk({
  plaatsingen,
  bezig,
  resultaat,
  fout,
  onGenereer,
}: {
  plaatsingen: Themaplaatsing[];
  bezig: boolean;
  /** The report of the last run in this visit, or null. */
  resultaat: JaarplanGeneratieResultaat | null;
  /** The sentence for a failed run, or null. */
  fout: string | null;
  onGenereer: () => void;
}) {
  const [vraag, setVraag] = useState(false);
  const aantalOpen = aantalOpenThemas(plaatsingen);

  function genereer() {
    if (aantalOpen > 0) setVraag(true);
    else onGenereer();
  }

  const pasteNiet = (resultaat?.nietGeplaatst ?? [])
    .filter((n) => n.reden === "GeenPlaats" || n.reden === "GeenLesweek")
    .map((n) => n.themaNaam);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AiKnop bezig={bezig} disabled={bezig} onClick={genereer}>
          {bezig ? t("plan.genereerBezig") : t("plan.genereer")}
        </AiKnop>
        <div aria-live="polite">
          {resultaat && !fout ? (
            <p className="text-meta text-inkt-zacht">
              {resultaat.aantalNieuw === 0
                ? t("plan.generatieGeenNieuw")
                : telWoord(resultaat.aantalNieuw, "plan.generatieEenNieuw", "plan.generatieNieuw")}
              {pasteNiet.length > 0 ? ` ${t("plan.generatiePasteNiet", { themas: pasteNiet.join(", ") })}` : null}
            </p>
          ) : null}
        </div>
      </div>

      <div aria-live="polite">
        {fout ? (
          <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">{fout}</p>
        ) : null}
      </div>

      <Bevestiging
        open={vraag}
        titel={t("plan.generatieVraag")}
        gevolg={telWoord(aantalOpen, "plan.generatieGevolgEen", "plan.generatieGevolg")}
        bevestigLabel={t("plan.genereer")}
        onSluit={() => setVraag(false)}
        onBevestig={() => {
          setVraag(false);
          onGenereer();
        }}
      />
    </div>
  );
}

