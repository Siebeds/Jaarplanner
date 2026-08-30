import { Blad } from "./Blad";
import { Knop } from "./Knop";
import { t } from "../../i18n";

/**
 * The last step before something is gone.
 *
 * **It names what will be lost, not just what will be deleted.** A thema takes its subthema's,
 * activiteiten and goal links with it, and a teacher who only sees the thema's name cannot know that.
 * The caller passes that sentence, because only the caller knows the counts.
 *
 * The destructive button is the primary one here and it says the verb, not "OK". A dialog whose
 * buttons are "OK" and "Annuleren" makes the reader re-read the question to find out which one does
 * the thing.
 */
export function Bevestiging({
  open,
  titel,
  gevolg,
  bevestigLabel,
  bezig,
  onBevestig,
  onSluit,
}: {
  open: boolean;
  titel: string;
  /** What else disappears with it. Omitted when nothing does. */
  gevolg?: string;
  bevestigLabel: string;
  bezig?: boolean;
  onBevestig: () => void;
  onSluit: () => void;
}) {
  return (
    <Blad
      open={open}
      onOpenChange={(o) => !o && onSluit()}
      titel={titel}
      voet={
        <div className="flex items-center gap-2">
          <Knop
            rang="hoofd"
            vol
            type="button"
            disabled={bezig}
            onClick={onBevestig}
            // Ink rather than red. Red means "niet gedekt" everywhere else in this application, and
            // borrowing it here would put a coverage signal on a delete button. The darkest surface
            // on the page plus a verb that names the deletion is unambiguous without a hue.
            className="bg-inkt text-inkt-op hover:bg-inkt active:bg-inkt"
          >
            {bezig ? t("algemeen.bezig") : bevestigLabel}
          </Knop>
          <Knop rang="stil" type="button" disabled={bezig} onClick={onSluit}>
            {t("themabeheer.annuleer")}
          </Knop>
        </div>
      }
    >
      <p className="text-body text-inkt">{gevolg ?? t("algemeen.nietTerugTeDraaien")}</p>
    </Blad>
  );
}
