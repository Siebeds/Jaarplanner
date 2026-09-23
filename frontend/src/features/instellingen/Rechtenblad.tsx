import { useId, useState, type ReactNode } from "react";
import { Blad } from "../../components/ui/Blad";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Knop } from "../../components/ui/Knop";
import { ApiError } from "../../lib/api";
import { useIk } from "../../lib/aanmelding";
import type { KlasWeergave, SchooljaarSamenvatting } from "../../lib/types";
import { t } from "../../i18n";
import { rechtPad, useRechtWijziging, type GebruikerBeheer } from "./gebruikerbeheer";

/**
 * Everything one person may do, in one sheet (E6-04): the admin right and themabeheer, the
 * klassen they teach in the chosen schooljaar (R15), and the jaarfasen they are hoofdleerkracht of in
 * it (R5, no klas needed: I20).
 *
 * **Every tick saves at once**, one request per tick, and the sheet says so once. A save button over
 * a dozen boxes would send a dozen requests that can half fail, and a refusal such as the last
 * admin's (ADR-0031 decision 7) belongs next to the one box that caused it. While a tick is on
 * its way the box shows what was asked and every box waits; when the server refuses, the box falls
 * back to what is stored and the reason is shown above the boxes, in the server's own Dutch.
 *
 * **Waiting boxes stay focusable** (E6-04 fix round 1). They are `aria-disabled` and ignore input
 * rather than `disabled`: a browser moves focus off an element the moment it becomes disabled, so a
 * keyboard user who ticked a box with Space landed on the page body and had to find their place
 * again after every save.
 *
 * **Giving up your own admin right asks first.** It is the one tick here you cannot undo
 * yourself: the Gebruikers screen goes with it. Someone else's right, and your own themabeheer, save
 * at once like every other box.
 *
 * The boxes are ink rather than the accent: a checked box is not one of the accent's five uses.
 */
export function Rechtenblad({
  gebruiker,
  schooljaar,
  klassen,
  jaarfasen,
  voorbij,
  onSluit,
  onVerwijder,
}: {
  gebruiker: GebruikerBeheer;
  schooljaar: SchooljaarSamenvatting | null;
  /** The klassen of `schooljaar`. */
  klassen: KlasWeergave[];
  /** The nine codes, in their order, from `GET /api/jaarfasen`. */
  jaarfasen: string[];
  /** Whether `schooljaar` has ended on the school's clock (R20). */
  voorbij: boolean;
  onSluit: () => void;
  onVerwijder: () => void;
}) {
  const wijzig = useRechtWijziging();
  const { data: ik } = useIk();
  const [afgeven, setAfgeven] = useState(false);

  const bezig = wijzig.isPending;
  const gevraagd = bezig ? wijzig.variables : undefined;
  const staat = (pad: string, opgeslagen: boolean) => (gevraagd?.pad === pad ? gevraagd.aan : opgeslagen);
  const zet = (pad: string, aan: boolean) => {
    if (!bezig) wijzig.mutate({ pad, aan });
  };
  const serverReden = wijzig.error instanceof ApiError ? wijzig.error.detail : undefined;

  const id = gebruiker.id;
  const isIkZelf = ik?.id === gebruiker.id;
  const klasIds = new Set(gebruiker.klastoewijzingen.map((k) => k.klasId));
  const fasen = new Set(
    gebruiker.hoofdleerkrachtaanstellingen.filter((a) => a.schooljaarId === schooljaar?.id).map((a) => a.jaarfase),
  );

  return (
    <>
      <Blad
        open
        onOpenChange={(open) => !open && onSluit()}
        titel={t("gebruikers.rechtenVan", { naam: gebruiker.naam })}
        voet={
          <div className="flex items-center justify-between gap-2">
            <Knop rang="rustig" onClick={onSluit}>
              {t("gebruikers.klaar")}
            </Knop>
            <Knop rang="stil" onClick={onVerwijder} bezig={bezig}>
              {t("gebruikers.verwijderen")}
            </Knop>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <div>
            <p className="break-all text-meta text-inkt-zacht">{gebruiker.email}</p>
            {gebruiker.isAangemeld ? null : (
              <>
                <p className="mt-1 text-meta font-medium text-inkt">{t("gebruikers.nietAangemeld")}</p>
                <p className="text-meta text-inkt-zacht">{t("gebruikers.nietAangemeldUitleg")}</p>
              </>
            )}
            <p className="mt-2 text-meta text-inkt-zacht">{t("gebruikers.meteenBewaard")}</p>
          </div>

          {wijzig.isError ? (
            <p role="alert" className="rounded-veld border border-attentie/40 bg-attentie-zacht p-3 text-meta font-medium text-attentie-inkt">
              {serverReden ?? t("gebruikers.wijzigenMislukt")}
            </p>
          ) : null}

          <Groep legende={t("gebruikers.rechten")}>
            <Vinkje
              label={t("gebruikers.admin")}
              uitleg={t("gebruikers.adminUitleg")}
              aan={staat(rechtPad.admin(id), gebruiker.isAdmin)}
              bezig={bezig}
              onZet={(aan) => {
                if (bezig) return;
                if (!aan && isIkZelf) {
                  setAfgeven(true);
                  return;
                }
                zet(rechtPad.admin(id), aan);
              }}
            />
            <Vinkje
              label={t("gebruikers.themabeheer")}
              uitleg={t("gebruikers.themabeheerUitleg")}
              aan={staat(rechtPad.themabeheer(id), gebruiker.heeftThemabeheer)}
              bezig={bezig}
              onZet={(aan) => zet(rechtPad.themabeheer(id), aan)}
            />
            <Vinkje
              label={t("gebruikers.leerlingzorg")}
              uitleg={t("gebruikers.leerlingzorgUitleg")}
              aan={staat(rechtPad.leerlingzorg(id), gebruiker.heeftLeerlingzorg)}
              bezig={bezig}
              onZet={(aan) => zet(rechtPad.leerlingzorg(id), aan)}
            />
          </Groep>

          {schooljaar ? (
            <>
              {voorbij ? (
                <p className="rounded-veld border border-lijn bg-vlak-diep px-3 py-2 text-meta text-inkt-zacht">
                  {t("gebruikers.jaarVoorbij")}
                </p>
              ) : null}

              <Groep legende={t("gebruikers.klassenIn", { schooljaar: schooljaar.naam })}>
                {klassen.length === 0 ? (
                  <p className="text-meta text-inkt-zacht">{t("klasbeheer.geenKlassen")}</p>
                ) : (
                  klassen.map((klas) => {
                    const pad = rechtPad.klas(id, klas.id);
                    return (
                      <Vinkje
                        key={klas.id}
                        label={klas.naam}
                        uitleg={klas.jaarfase ?? t("gebruikers.geenLeeftijd")}
                        aan={staat(pad, klasIds.has(klas.id))}
                        bezig={bezig}
                        onZet={(aan) => zet(pad, aan)}
                      />
                    );
                  })
                )}
              </Groep>

              <Groep legende={t("gebruikers.hoofdleerkrachtIn", { schooljaar: schooljaar.naam })} raster>
                {jaarfasen.map((code) => {
                  const pad = rechtPad.hoofdleerkracht(id, schooljaar.id, code);
                  return (
                    <Vinkje
                      key={code}
                      label={code}
                      aan={staat(pad, fasen.has(code))}
                      bezig={bezig}
                      onZet={(aan) => zet(pad, aan)}
                    />
                  );
                })}
              </Groep>
            </>
          ) : null}
        </div>
      </Blad>

      <Bevestiging
        open={afgeven}
        titel={t("gebruikers.afgevenTitel")}
        gevolg={t("gebruikers.afgevenGevolg")}
        bevestigLabel={t("gebruikers.afgevenBevestig")}
        bezig={bezig}
        onSluit={() => setAfgeven(false)}
        onBevestig={() =>
          wijzig.mutate({ pad: rechtPad.admin(id), aan: false }, { onSettled: () => setAfgeven(false) })
        }
      />
    </>
  );
}

function Groep({ legende, raster, children }: { legende: string; raster?: boolean; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-meta font-medium text-inkt">{legende}</legend>
      <div className={raster ? "mt-1 grid grid-cols-3 gap-x-2" : "mt-1 flex flex-col"}>{children}</div>
    </fieldset>
  );
}

/**
 * One right as a checkbox. The label holds the name only and the explanation is its description,
 * so a screen reader says "Admin, selectievakje" and then the explanation once, not the whole
 * paragraph as the name. The row is 44px tall, and the label is a second target for the box.
 *
 * While a save is on its way the box is `aria-disabled` and ignores input, but keeps focus (see the
 * sheet's note). A controlled box whose change is ignored simply stays as it was.
 */
function Vinkje({
  label,
  uitleg,
  aan,
  bezig,
  onZet,
}: {
  label: string;
  uitleg?: string;
  aan: boolean;
  bezig: boolean;
  onZet: (aan: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-start gap-3 py-2">
      <input
        id={id}
        type="checkbox"
        checked={aan}
        aria-disabled={bezig || undefined}
        onChange={(e) => {
          if (!bezig) onZet(e.target.checked);
        }}
        aria-describedby={uitleg ? `${id}-uitleg` : undefined}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-inkt aria-disabled:cursor-wait aria-disabled:opacity-60"
      />
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer text-body text-inkt">
          {label}
        </label>
        {uitleg ? (
          <p id={`${id}-uitleg`} className="text-meta text-inkt-zacht">
            {uitleg}
          </p>
        ) : null}
      </div>
    </div>
  );
}
