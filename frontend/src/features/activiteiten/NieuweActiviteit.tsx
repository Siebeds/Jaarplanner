import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Segment } from "../../components/ui/Segment";
import { useRechten } from "../../lib/rechten";
import type { OnderzoeksvraagWeergave, SubdoelWeergave } from "../../lib/types";
import { t } from "../../i18n";
import { Doellijst } from "../themas/Fiche";
import { Gekoppelddoel } from "../themas/Gekoppelddoel";
import { beslist } from "../themas/subthemabalans";
import { Activiteitsheet, Activiteitvelden, Bewaarvoet, Doelenkop, type ActiviteitInvoer } from "./Activiteitformulier";
import { useActiviteitvelden } from "./activiteitvelden";
import { Doelkoppelaar } from "./Doelkoppelaar";
import { Subdoelvinklijst } from "./Subdoelvinklijst";

/**
 * Making a new activiteit under a subthema, from wherever a teacher is standing (TB-074: the create variant of the
 * activiteit sheet; the shared parts are in `Activiteitformulier`).
 *
 * **A new activiteit is the creator's own** (ADR-0049 E1). A gebruiker who may also create a shared one (a
 * hoofdleerkracht, admin) chooses "voor wie"; one who may only create a shared one gets that without a choice. Goals
 * on a new own activiteit are the creator's to link (E3), so the picker shows for it; on a new shared one it follows
 * the R19 row (`mag.doelenKoppelen`). Both are read from the subthema's `leeftijd`.
 *
 * **The goals travel with the create.** There is no activiteit id yet, so the per-link endpoints cannot be reached:
 * the chosen codes are held here and sent in `leerplandoelCodes`, which the server links inside the same save. They
 * are left off entirely for a gebruiker who was offered no picker (R19).
 *
 * **The subthema's subdoelen are offered to tick** (FB-051) when the caller passes them: they are the goals it most
 * likely serves, so they stand above the search as one line each, and a ticked one travels with the create like a
 * searched one. The search stays below for "andere doelen" and no longer offers a subdoel, which is already a row
 * above.
 */
export function NieuweActiviteit({
  open,
  leeftijd,
  onderzoeksvragen,
  subdoelen,
  onBewaar,
  onSluit,
  bezig,
  fout,
  extra,
}: {
  open: boolean;
  /** The leeftijd of the subthema the activiteit goes under: it decides "voor wie" and the goal picker. */
  leeftijd: string;
  /** The questions of the owning subthema. An activiteit may point at one of these, or at none. */
  onderzoeksvragen: OnderzoeksvraagWeergave[];
  /** The subdoelen of the subthema, offered to tick; omitted, no such list (FB-051). */
  subdoelen?: SubdoelWeergave[];
  onBewaar: (invoer: ActiviteitInvoer) => void;
  onSluit: () => void;
  bezig: boolean;
  fout?: unknown;
  /** A section of the caller's own, rendered below the fields and above the goals. */
  extra?: ReactNode;
}) {
  const id = useId();
  const { mag } = useRechten();
  const magEigen = mag.eigenActiviteitMaken(leeftijd);
  const magGedeeld = mag.gedeeldeActiviteitMaken(leeftijd);
  const [kiesGedeeld, setKiesGedeeld] = useState(false);
  // Without the own right, a shared one is the only one this gebruiker may make; with both, it is their choice.
  const gedeeld = magGedeeld && (!magEigen || kiesGedeeld);
  const magDoelen = gedeeld ? mag.doelenKoppelen(leeftijd) : magEigen;
  const { velden, leesInvoer } = useActiviteitvelden();

  // Held here rather than written through, because there is nothing to write to yet: they travel with the create
  // request. See `ActiviteitInvoer.leerplandoelCodes`.
  const [codes, setCodes] = useState<string[]>([]);
  // Only decided subdoelen: an undecided one is not a subdoel yet (see `beslist`).
  const subdoelCodes = (subdoelen ?? [])
    .filter((subdoel) => beslist(subdoel.koppeling.status))
    .map((subdoel) => subdoel.koppeling.leerplandoelCode);
  const andereCodes = codes.filter((code) => !subdoelCodes.includes(code));
  const voegToe = (code: string) => setCodes((vorige) => (vorige.includes(code) ? vorige : [...vorige, code]));
  const haalWeg = (code: string) => setCodes((vorige) => vorige.filter((c) => c !== code));

  function verstuur(event: FormEvent) {
    event.preventDefault();
    const invoer = leesInvoer();
    if (!invoer) return;
    onBewaar({ ...invoer, ...(magDoelen ? { leerplandoelCodes: codes } : {}), gedeeld });
  }

  return (
    <Activiteitsheet
      open={open}
      onSluit={onSluit}
      titel={t("activiteit.nieuwTitel")}
      voet={<Bewaarvoet formulier={id} bezig={bezig} onSluit={onSluit} />}
      fout={fout}
      extra={extra}
      inhoud={
        <form id={id} onSubmit={verstuur} className="flex flex-col gap-5">
          {magEigen && magGedeeld ? (
            <div>
              <Segment
                label={t("activiteit.voorWie")}
                waarde={kiesGedeeld ? "gedeeld" : "eigen"}
                opties={[
                  { waarde: "eigen", label: t("activiteit.alleenVoorMij") },
                  { waarde: "gedeeld", label: t("activiteit.gedeeldMetSubthema") },
                ]}
                onKies={(waarde) => setKiesGedeeld(waarde === "gedeeld")}
                className="w-full @md:w-auto"
              />
              <p className="mt-1.5 text-meta text-inkt-zacht">{t("activiteit.voorWieUitleg")}</p>
            </div>
          ) : null}
          <Activiteitvelden id={id} velden={velden} onderzoeksvragen={onderzoeksvragen} bezig={bezig} />
        </form>
      }
      doelen={(toonDoel) =>
        // Saved with the activiteit, so the line under the heading says so: the edit sheet writes on the spot, and a
        // sentence may only assert what its own case guarantees.
        magDoelen ? (
          <section className="border-t border-lijn pt-5">
            <Doelenkop aantal={codes.length} uitleg={t("activiteit.doelenBijBewaren")} />

            {subdoelen ? (
              <div className="mt-3">
                <Subdoelvinklijst
                  codes={subdoelCodes}
                  gekozen={codes}
                  bezig={bezig}
                  onWissel={(code, aan) => (aan ? voegToe(code) : haalWeg(code))}
                  onToon={toonDoel}
                />
                <h4 className="mt-4 text-meta font-medium text-inkt">{t("activiteit.andereDoelen")}</h4>
              </div>
            ) : null}

            {andereCodes.length > 0 ? (
              <div className="mt-2">
                <Doellijst>
                  {/* No status here: nothing is stored yet. See `Gekoppelddoel`. */}
                  {andereCodes.map((code) => (
                    <Gekoppelddoel
                      key={code}
                      koppeling={{ leerplandoelCode: code }}
                      ontkoppelLabel={t("activiteit.codeWeg", { code })}
                      ontkoppelBezig={bezig}
                      onOntkoppel={() => haalWeg(code)}
                      onToon={toonDoel}
                    />
                  ))}
                </Doellijst>
              </div>
            ) : null}

            <div className="mt-3">
              {/* A subdoel is not offered here: it is a row to tick above. */}
              <Doelkoppelaar onKies={voegToe} bezig={bezig} alGekozen={[...codes, ...subdoelCodes]} />
            </div>
          </section>
        ) : null
      }
    />
  );
}
