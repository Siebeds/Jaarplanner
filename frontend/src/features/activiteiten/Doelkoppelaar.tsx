import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { Toevoegknop } from "../../components/ui/Toevoegknop";
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
  compact,
}: {
  onKies: (leerplandoelCode: string) => void;
  bezig?: boolean;
  alGekozen: string[];
  /**
   * Icon only, for a row that already sits inside a card that has one of these.
   *
   * A subthemakaart carries one koppelaar for its subdoelen and one per activiteit, and spelled out
   * they are the same button two or three times in one card, which is what made it read as a toolbar
   * (owner, 2026-08-30: "veel te veel knoppen"). The card-level one keeps its words because it is the
   * one being scanned for; the row-level ones become the plus alone.
   *
   * `toelichting` stops being optional in spirit here: with the visible label gone it is the ONLY
   * thing that says what this plus links a doel to, so the caller must pass it. It is not made
   * required in the type because the same component still has a labelled mode where it is genuinely
   * optional, and a required prop that is only required half the time is a worse lie than this note.
   */
  compact?: boolean;
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
    return compact ? (
      <Knop
        rang="stil"
        className="h-9 min-h-9 w-9 px-0"
        aria-label={toelichting ?? t("doelkiezer.koppel")}
        disabled={bezig}
        onClick={() => setOpen(true)}
      >
        <IcoonPlus aria-hidden="true" className="h-4 w-4" />
      </Knop>
    ) : (
      // `Toevoegknop`, the one shape every add-or-link control on this app wears. It used to be a
      // borderless `stil` button sitting two sections above an outlined "Subthema toevoegen", which
      // is the inconsistency the owner reported on 2026-08-30: same intention, different weight, and
      // the difference tracked nothing.
      <Toevoegknop
        label={t("doelkiezer.koppel")}
        aria-label={toelichting}
        disabled={bezig}
        onClick={() => setOpen(true)}
      />
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
