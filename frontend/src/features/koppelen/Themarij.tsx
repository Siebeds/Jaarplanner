import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { IcoonChevron, IcoonPlus, IcoonVink } from "../../components/Iconen";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import { geenToegangZin, useRechten } from "../../lib/rechten";
import type { Subthemabestemming, Themabestemming } from "./bestemmingen";
import { useKoppelDoelAanActiviteit, useKoppelDoelAanSubthema } from "./mutaties";
import { Nieuweactiviteitregel } from "./Nieuweactiviteitregel";

/**
 * One thema, its subthema's, and their activiteiten, as places this doel could go.
 *
 * **Two kinds of row, and the difference is deliberate.** A thema and a subthema have children, so
 * pressing the row opens them. A subthema also takes the doel as a subdoel, through a named button
 * beside it. An activiteit has no children, so pressing the row *is* the link.
 *
 * **A thema takes no leerplandoel.** Its themadoelen are minimumdoelen, linked on the thema page (FB-043), so the
 * thema row only opens. It still says "Gekoppeld" when an older themadoel or the FR-1 import put this doel on it.
 *
 * **A row the doel already sits on states that instead of offering the link again.** Linking twice
 * is refused by the server, and a button that produces an error for doing the obvious thing is worse
 * than no button. The word "Gekoppeld" carries it, with the tick as reinforcement rather than as the
 * signal (Art. XII, WCAG 2.2 AA 1.4.1).
 *
 * **Each level is offered to whoever may link there** (E6-02, ADR-0030 §3): a subthema and its activiteiten to admin and that leeftijd's hoofdleerkrachten (R24, R19), and a new
 * activiteit made with this doel on it likewise, since its create carries a goal code (R19). A level the gebruiker may
 * not link to still shows where the doel already sits; it just offers nothing to press.
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
              {telWoord(aantalSubthemas, "koppelen.eenSubthema", "koppelen.aantalSubthemas")}
            </span>
          </span>
        </button>

        {/* Closed, a thema row states what is inside it and nothing else. */}
        {tak.alGekoppeld ? <Gekoppeldmerk /> : null}
      </div>

      {open ? (
        <div className="border-t border-lijn bg-vlak/50 p-2">
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
  const { mag } = useRechten();
  const leeftijd = subtak.subthema.leeftijd;
  // A new activiteit here is the gebruiker's own when she may make one (ADR-0049 E1), and then its goal is hers to
  // link (E3); otherwise a shared one, which needs the R19 goal-link right as well.
  const magEigenMaken = mag.eigenActiviteitMaken(leeftijd);
  const magNieuwMetDoel = magEigenMaken || (mag.gedeeldeActiviteitMaken(leeftijd) && mag.doelenKoppelen(leeftijd));

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

        {/* A subdoel (R24). The mark stays for everyone, since it says where the doel already sits. */}
        {mag.subdoelenBeheren(leeftijd) ? (
          <Koppelactie
            alGekoppeld={subtak.alGekoppeld}
            label={t("koppelen.koppelAanSubthema")}
            toelichting={t("koppelen.koppelAanSubthemaUitleg", { subthema: subtak.subthema.naam })}
            bezig={koppelSubthema.isPending}
            onKoppel={() => koppelSubthema.mutate({ subthemaId: subtak.subthema.id, leerplandoelCode: code })}
          />
        ) : subtak.alGekoppeld ? (
          <Gekoppeldmerk />
        ) : null}
      </div>

      <Koppelfout zichtbaar={koppelSubthema.isError} fout={koppelSubthema.error} />

      {open ? (
        <div className="border-t border-lijn px-2.5 py-2">
          <ul className="flex flex-col gap-1">
            {subtak.activiteiten.map(({ activiteit, alGekoppeld }) => (
              <li key={activiteit.id}>
                <Activiteitrij
                  activiteitId={activiteit.id}
                  naam={activiteit.naam}
                  alGekoppeld={alGekoppeld}
                  magKoppelen={mag.activiteitDoelenKoppelen({ ...activiteit, leeftijd })}
                  code={code}
                />
              </li>
            ))}
          </ul>

          {/* Making an activiteit WITH this doel on it: an own one (ADR-0049 E1, E3), or a shared one with the goal-link
              right at this leeftijd (R19). Always
              rendered, and the regel checks its own failure before these rights, as `Activiteitrij` does: a refusal
              refetches the rights, and a regel gated here would take its reason with it (F10). */}
          <Nieuweactiviteitregel
            subthemaId={subtak.subthema.id}
            subthemaNaam={subtak.subthema.naam}
            code={code}
            klasId={klasId}
            magMaken={magNieuwMetDoel}
            gedeeld={!magEigenMaken}
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
  magKoppelen,
  code,
}: {
  activiteitId: string;
  naam: string;
  alGekoppeld: boolean;
  /** R19 at this activiteit's leeftijd. Without it the row is a name, not a control. */
  magKoppelen: boolean;
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

  // Before the rights check, and that order matters: a refusal refetches the rights, and a row that went on to lose
  // its link control would otherwise take the reason with it.
  if (koppel.isError) {
    const geweigerd = geenToegangZin(koppel.error) !== null;
    return (
      <div className="rounded-veld px-2.5 py-2">
        <p className="truncate text-body text-inkt">{naam}</p>
        <Koppelfout zichtbaar fout={koppel.error} />
        {/* No retry after a refusal: it would be refused again. */}
        {geweigerd ? null : (
          <button
            type="button"
            onClick={() => koppel.mutate({ activiteitId, leerplandoelCode: code })}
            className="mt-1 text-meta font-medium text-accent underline decoration-dotted underline-offset-2 transition-colors duration-150 hover:text-accent-diep"
          >
            {t("koppelen.opnieuw")}
          </button>
        )}
      </div>
    );
  }

  if (!magKoppelen) {
    return (
      <div className="flex items-center gap-2 rounded-veld px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-body text-inkt">{naam}</span>
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
 *
 * **One cause it does name: a refusal** (E6-02). A 403 is a fact the server stated, not a guess, and "probeer het
 * opnieuw" would be false for it, since trying again is refused again.
 */
function Koppelfout({ zichtbaar, fout }: { zichtbaar: boolean; fout?: unknown }) {
  if (!zichtbaar) return null;
  return (
    <p role="alert" className="px-3 pb-2.5 text-meta text-dekking-niet-gedekt">
      {geenToegangZin(fout) ?? t("koppelen.koppelMislukt")}
    </p>
  );
}

/**
 * The link control for a subthema: a button or an "already linked" statement. One component so the two stay the same
 * size and in the same place, and a row does not visibly reflow when its state changes under a click.
 */
function Koppelactie({
  alGekoppeld,
  label,
  toelichting,
  bezig,
  onKoppel,
}: {
  alGekoppeld: boolean;
  label: string;
  toelichting: string;
  bezig: boolean;
  onKoppel: () => void;
}) {
  if (alGekoppeld) return <Gekoppeldmerk />;

  return (
    <Knop
      // `rustig` rather than `stil`, because this is the only real button in the tree and a borderless one did not
      // read as one: beside a row you press, it looked like part of the row. Everything around it is a row you press, so the control that
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
