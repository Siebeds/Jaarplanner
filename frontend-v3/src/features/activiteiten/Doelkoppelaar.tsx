import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { IcoonPlus } from "../../components/Iconen";
import { t } from "../../i18n";
import { Doelkiezer } from "./Doelkiezer";

/**
 * The goal picker, closed until asked for.
 *
 * A thema detail has one of these on the thema and one on every subthema, and each of its activiteiten
 * has one in its sheet. Left open, that is four or five permanent search fields on one screen, and the
 * screen is supposed to be about what is already linked. So it is a button until a teacher wants it,
 * which is the same reason the filter panel is a sheet rather than a sidebar.
 *
 * It closes again after a pick, and the picked code shows up in the list above it, so the confirmation
 * is the list rather than a message. Linking a second goal is one more click, and a picker that stayed
 * open would have to be closed by hand every time it was used once.
 */
export function Doelkoppelaar({
  onKies,
  bezig,
  alGekozen,
  toelichting,
}: {
  onKies: (leerplandoelCode: string) => void;
  bezig?: boolean;
  alGekozen: string[];
  /**
   * What this particular koppelaar links a doel to, for assistive technology.
   *
   * One subthemakaart can carry six of these: one for its subdoelen and one per activiteit. They all
   * read "Doel koppelen", so without this a screen reader announces the same button six times and
   * none of them says which activiteit it belongs to. Sighted users get that from position; this is
   * the same information through the other channel. The visible label is unchanged and is contained
   * in the spoken one, which is what WCAG 2.5.3 asks for.
   */
  toelichting?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Knop
        rang="stil"
        className="h-9 min-h-9 px-3 text-meta"
        aria-label={toelichting}
        onClick={() => setOpen(true)}
      >
        <IcoonPlus aria-hidden="true" className="h-4 w-4" />
        {t("doelkiezer.koppel")}
      </Knop>
    );
  }

  // Full width on purpose: this sits in a wrapping flex row next to the doelmerk and the codes, and
  // a search field sharing a line with them would be a 120px input. As a full-width child it takes
  // its own line, and the row above it stays readable.
  return (
    <div className="w-full rounded-veld border border-lijn bg-vlak-diep/40 p-2">
      <Doelkiezer
        onKies={(code) => {
          onKies(code);
          setOpen(false);
        }}
        bezig={bezig}
        alGekozen={alGekozen}
      />
      <div className="mt-2">
        <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={() => setOpen(false)}>
          {t("themabeheer.annuleer")}
        </Knop>
      </div>
    </div>
  );
}
