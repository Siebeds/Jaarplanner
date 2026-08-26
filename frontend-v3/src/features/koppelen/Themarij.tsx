import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { IcoonChevron, IcoonPlus, IcoonVink } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { MAX_THEMADOELEN } from "../../lib/types";
import type { Subthemabestemming, Themabestemming } from "./bestemmingen";
import {
  useKoppelDoelAanActiviteit,
  useKoppelDoelAanSubthema,
  useKoppelDoelAanThema,
} from "./mutaties";
import { Nieuweactiviteitregel } from "./Nieuweactiviteitregel";

/**
 * One thema, its subthema's, and their activiteiten, as places this doel could go.
 *
 * **Two kinds of row, and the difference is deliberate.** A thema and a subthema have children, so
 * pressing the row opens them and linking is a named button beside it. An activiteit has no
 * children, so pressing the row *is* the link. The rule is "the row does the ordinary thing": on a
 * thema the ordinary thing is going deeper, because a thema anchors at most three school-wide
 * themadoelen and most teachers are heading for an activiteit.
 *
 * **A row the doel already sits on states that instead of offering the link again.** Linking twice
 * is refused by the server, and a button that produces an error for doing the obvious thing is worse
 * than no button. The word "Gekoppeld" carries it, with the tick as reinforcement rather than as the
 * signal (Art. XII, WCAG 2.2 AA 1.4.1).
 */
export function Themarij({
  tak,
  code,
  klasId,
  standaardOpen,
}: {
  tak: Themabestemming;
  code: string;
  klasId: string | null;
  standaardOpen: boolean;
}) {
  const [open, setOpen] = useState(standaardOpen);
  const koppelThema = useKoppelDoelAanThema();

  const aantalSubthemas = tak.thema.subthemas.length;

  return (
    <div className="overflow-hidden rounded-kaart border border-lijn bg-kaart">
      <div className="flex items-start gap-2 p-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-veld text-left"
        >
          <IcoonChevron
            aria-hidden="true"
            className={cn("mt-0.5 h-4 w-4 shrink-0 text-inkt-zwak transition-transform duration-200", open && "rotate-180")}
          />
          <span className="min-w-0">
            <span className="block truncate text-sectie text-inkt">{tak.thema.naam}</span>
            <span className="mt-0.5 block text-meta text-inkt-zacht">
              {[
                telWoord(aantalSubthemas, "koppelen.eenSubthema", "koppelen.aantalSubthemas"),
                t("koppelen.themadoelenTelling", { aantal: tak.thema.themadoelen.length, max: MAX_THEMADOELEN }),
              ].join(" · ")}
            </span>
          </span>
        </button>

        {/* Closed, a thema row states what is inside it and nothing else.
            The link button used to sit here, and nine of them down the list turned the first look at
            the sheet into a wall of identical controls for the rarest action on it: a thema anchors
            at most three school-wide themadoelen, while most teachers are on their way to an
            activiteit. It now appears when the thema is opened, one row down, where it competes with
            nothing. */}
        {tak.alGekoppeld ? <Gekoppeldmerk /> : null}
      </div>

      <Koppelfout zichtbaar={koppelThema.isError} />

      {open ? (
        <div className="border-t border-lijn bg-vlak/50 p-2">
          <div className="flex px-1 pb-2 pt-1">
            <Koppelactie
              alGekoppeld={tak.alGekoppeld}
              // A full thema is not an error state and does not get the attention styling of one:
              // three themadoelen is what a finished thema looks like. It is said, and the button
              // is gone.
              geblokkeerd={tak.themaVol}
              geblokkeerdeTekst={t("koppelen.themaVol", { max: MAX_THEMADOELEN })}
              label={t("koppelen.koppelAanThema")}
              toelichting={t("koppelen.koppelAanThemaUitleg", { thema: tak.thema.naam })}
              bezig={koppelThema.isPending}
              onKoppel={() => koppelThema.mutate({ themaId: tak.thema.id, leerplandoelCode: code })}
            />
          </div>

          {tak.subthemas.length === 0 ? (
            // Not a dead end dressed as one: a thema without subthema's for this class is a normal
            // state, and the sentence says what would have to happen rather than only what is absent.
            <p className="px-2 py-3 text-meta text-inkt-zacht">{t("koppelen.geenSubthemas")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {tak.subthemas.map((subtak) => (
                <li key={subtak.subthema.id}>
                  <Subthemarij subtak={subtak} code={code} klasId={klasId} standaardOpen={standaardOpen} />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Subthemarij({
  subtak,
  code,
  klasId,
  standaardOpen,
}: {
  subtak: Subthemabestemming;
  code: string;
  klasId: string | null;
  standaardOpen: boolean;
}) {
  const [open, setOpen] = useState(standaardOpen);
  const koppelSubthema = useKoppelDoelAanSubthema();

  return (
    <div className="rounded-veld border border-lijn bg-kaart">
      <div className="flex items-start gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-veld text-left"
        >
          <IcoonChevron
            aria-hidden="true"
            className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 text-inkt-zwak transition-transform duration-200", open && "rotate-180")}
          />
          <span className="min-w-0">
            <span className="block truncate text-body font-medium text-inkt">{subtak.subthema.naam}</span>
            <span className="mt-0.5 block text-meta text-inkt-zacht">
              {[
                // Labelled, because the value is free text the school types: the demo data holds "6"
                // and "5-6" where this screen was written expecting "K3". Beside a count of
                // activiteiten, a bare "6" reads as a second count. The label is neutral enough to
                // stay true whichever of the three the school wrote.
                t("koppelen.leeftijd", { leeftijd: subtak.subthema.leeftijd }),
                telWoord(subtak.subthema.activiteiten.length, "koppelen.eenActiviteit", "koppelen.aantalActiviteiten"),
              ].join(" · ")}
            </span>
          </span>
        </button>

        <Koppelactie
          alGekoppeld={subtak.alGekoppeld}
          label={t("koppelen.koppelAanSubthema")}
          toelichting={t("koppelen.koppelAanSubthemaUitleg", { subthema: subtak.subthema.naam })}
          bezig={koppelSubthema.isPending}
          onKoppel={() => koppelSubthema.mutate({ subthemaId: subtak.subthema.id, leerplandoelCode: code })}
        />
      </div>

      <Koppelfout zichtbaar={koppelSubthema.isError} />

      {open ? (
        <div className="border-t border-lijn px-2.5 py-2">
          <ul className="flex flex-col gap-1">
            {subtak.activiteiten.map(({ activiteit, alGekoppeld }) => (
              <li key={activiteit.id}>
                <Activiteitrij activiteitId={activiteit.id} naam={activiteit.naam} alGekoppeld={alGekoppeld} code={code} />
              </li>
            ))}
          </ul>

          <Nieuweactiviteitregel
            subthemaId={subtak.subthema.id}
            subthemaNaam={subtak.subthema.naam}
            code={code}
            klasId={klasId}
          />
        </div>
      ) : null}
    </div>
  );
}

/**
 * An activiteit. The whole row links, because there is nothing else it could do.
 *
 * No chevron and no separate button: an activiteit is the leaf, so a row that opened something would
 * be opening nothing, and a row with one button on it is a row that should have been the button.
 */
function Activiteitrij({
  activiteitId,
  naam,
  alGekoppeld,
  code,
}: {
  activiteitId: string;
  naam: string;
  alGekoppeld: boolean;
  code: string;
}) {
  const koppel = useKoppelDoelAanActiviteit();

  if (alGekoppeld) {
    return (
      <div className="flex items-center gap-2 rounded-veld px-2.5 py-2">
        <IcoonVink aria-hidden="true" className="h-4 w-4 shrink-0 text-suggestie-aanvaard" />
        <span className="min-w-0 flex-1 truncate text-meta text-inkt-zacht">{naam}</span>
        <span className="shrink-0 text-meta font-medium text-inkt-zacht">{t("koppelen.gekoppeld")}</span>
      </div>
    );
  }

  if (koppel.isError) {
    return (
      <div className="rounded-veld px-2.5 py-2">
        <p className="truncate text-body text-inkt">{naam}</p>
        <Koppelfout zichtbaar />
        <button
          type="button"
          onClick={() => koppel.mutate({ activiteitId, leerplandoelCode: code })}
          className="mt-1 text-meta font-medium text-accent underline decoration-dotted underline-offset-2 transition-colors duration-150 hover:text-accent-diep"
        >
          {t("koppelen.opnieuw")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={koppel.isPending}
      onClick={() => koppel.mutate({ activiteitId, leerplandoelCode: code })}
      // The spoken label names the activiteit; the visible one is its name, which the spoken label
      // contains (WCAG 2.5.3). Without it a screen reader hears "Bladerslinger" with no verb.
      aria-label={t("koppelen.koppelAanActiviteitUitleg", { activiteit: naam })}
      className="flex w-full items-center gap-2 rounded-veld border border-transparent px-2.5 py-2 text-left transition-colors duration-150 hover:border-accent hover:bg-accent-zacht/50 disabled:pointer-events-none disabled:opacity-45"
    >
      <IcoonPlus aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zwak" />
      <span className="min-w-0 flex-1 truncate text-body text-inkt">{naam}</span>
    </button>
  );
}

/**
 * That the doel is already here.
 *
 * The word carries it and the tick reinforces it, never the other way round (Art. XII, WCAG 2.2 AA
 * 1.4.1). It shows on a CLOSED thema row too, which is the reason it is a component of its own: a
 * teacher must be able to see where the doel already sits without opening all nine thema's, and that
 * is also the answer to why moving the link button inside did not take this with it.
 */
function Gekoppeldmerk() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 px-2 py-1.5 text-meta font-medium text-inkt-zacht">
      <IcoonVink aria-hidden="true" className="h-4 w-4 text-suggestie-aanvaard" />
      {t("koppelen.gekoppeld")}
    </span>
  );
}

/**
 * A link that did not happen, said out loud.
 *
 * Without this the row simply stayed as it was: the mutation failed, nothing moved, and the only
 * honest reading available to a teacher was that the click had not registered. `role="alert"` so it
 * reaches a screen reader too, since the visual change is one line appearing below the fold of a row.
 *
 * It says the link failed and to try again, and nothing about why. The server's reasons here are a
 * duplicate link and an unknown code, neither of which this sheet can produce: it hides rows that are
 * already linked and it only ever sends a code it was given. So a specific cause would be a guess,
 * and the E5-03 rule says to say less rather than to say something else.
 */
function Koppelfout({ zichtbaar }: { zichtbaar: boolean }) {
  if (!zichtbaar) return null;
  return (
    <p role="alert" className="px-3 pb-2.5 text-meta text-dekking-niet-gedekt">
      {t("koppelen.koppelMislukt")}
    </p>
  );
}

/**
 * The link control for a thema or a subthema: a button, an "already linked" statement, or a reason
 * it cannot be offered. One component so the three stay the same size and in the same place, and a
 * row does not visibly reflow when its state changes under a click.
 */
function Koppelactie({
  alGekoppeld,
  geblokkeerd = false,
  geblokkeerdeTekst,
  label,
  toelichting,
  bezig,
  onKoppel,
}: {
  alGekoppeld: boolean;
  geblokkeerd?: boolean;
  geblokkeerdeTekst?: string;
  label: string;
  toelichting: string;
  bezig: boolean;
  onKoppel: () => void;
}) {
  if (alGekoppeld) return <Gekoppeldmerk />;

  if (geblokkeerd) {
    return <span className="shrink-0 px-2 py-1.5 text-meta text-inkt-zwak">{geblokkeerdeTekst}</span>;
  }

  return (
    <Knop
      // `rustig` rather than `stil`, because these two are the only real buttons in the tree and a
      // borderless one did not read as one: on its own line above the subthema's, "Koppel aan thema"
      // looked like a section heading. Everything around it is a row you press, so the control that
      // does something different has to be the one that is drawn differently.
      rang="rustig"
      className="h-9 min-h-9 shrink-0 px-3 text-meta"
      disabled={bezig}
      aria-label={toelichting}
      onClick={onKoppel}
    >
      {label}
    </Knop>
  );
}
