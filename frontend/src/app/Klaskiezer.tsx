import { useState } from "react";
import { Blad } from "../components/ui/Blad";
import { Knop } from "../components/ui/Knop";
import { Veld, Keuze } from "../components/ui/Veld";
import { IcoonChevron, IcoonKlas, IcoonPijlRechts } from "../components/Iconen";
import { useActieveSelectie } from "../lib/selectie";
import { useWijzigKlas } from "../lib/queries";
import { geenToegangZin, useGeenKlassenZin, useRechten } from "../lib/rechten";
import type { KlasWeergave } from "../lib/types";
import { t } from "../i18n";

/** Where the picker stands: the sidebar from `lg`, its 56px rail, or a card at the foot of Instellingen on a phone. */
export type Klaskiezervorm = "zijbalk" | "rail" | "kaart";

/**
 * Which klas the app is about: the one klas the agenda, the jaarplan and the dekking show.
 *
 * **It lives in the navigation, not in a screen's header** (owner, 2026-09-23, FB-071). In the header it stood beside
 * Chuck, and the cat read as one more button among the screen's controls. The klas is the app's context rather than a
 * screen's filter, and a teacher rarely changes it, so from `lg` it stands at the bottom of the sidebar above the
 * sign-in row, as a quiet field and never as a destination: no accent, no `aria-current`. A phone has no sidebar and
 * its bottom bar keeps its five tabs, so there it is a card at the foot of Instellingen (owner: "Via Instellingen").
 * One per viewport, never two.
 *
 * It is a chosen context, not an identity: nothing here says "your class".
 */
export function Klaskiezer({ vorm }: { vorm: Klaskiezervorm }) {
  const [open, setOpen] = useState(false);
  const { klas, schooljaar, schooljaren, klassen, laadt, fout, kiesSchooljaar, kiesKlas } = useActieveSelectie();
  // The jaarfase travels over `PUT /api/klassen/{id}`, the §3 "beheren" row: admin only (E6-02). Everyone else
  // still picks a schooljaar and a klas here; those are a context, not a write.
  const { mag } = useRechten();
  // The server offers only the klassen this gebruiker may read (FB-013), so an empty list is said for them.
  const geenKlassenZin = useGeenKlassenZin(t("context.geenKlassen"));

  const naam = klas ? klas.naam : t("context.geenKlas");
  const knop =
    vorm === "rail" ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t("context.kiesKlas", { klas: naam })}
        title={t("context.kiesKlas", { klas: naam })}
        className="flex min-h-11 w-full items-center justify-center rounded-veld text-inkt-zacht transition-colors duration-150 hover:bg-vlak hover:text-inkt"
      >
        <IcoonKlas aria-hidden="true" className="h-5 w-5 shrink-0" />
      </button>
    ) : vorm === "zijbalk" ? (
      // A field, not a destination: a border and the chevron of a select, so it never reads as a sixth place to go.
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-veld border border-lijn-veld bg-kaart px-3 text-left transition-colors duration-150 hover:border-inkt"
      >
        <IcoonKlas aria-hidden="true" className="h-5 w-5 shrink-0 text-inkt-zacht" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-inkt">{naam}</span>
          {schooljaar ? <span className="block truncate text-micro text-inkt-zacht">{schooljaar.naam}</span> : null}
        </span>
        <IcoonChevron aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zwak" />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-14 w-full items-center gap-3 rounded-kaart border border-lijn bg-kaart px-4 text-left transition-colors duration-150 hover:bg-vlak"
      >
        <IcoonKlas aria-hidden="true" className="h-5 w-5 shrink-0 text-inkt-zacht" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-medium text-inkt">{naam}</span>
          {schooljaar ? <span className="block truncate text-meta text-inkt-zacht">{schooljaar.naam}</span> : null}
        </span>
        <IcoonPijlRechts aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zwak" />
      </button>
    );

  return (
    <>
      {knop}

      <Blad
        open={open}
        onOpenChange={setOpen}
        titel={t("context.titel")}
        voet={
          <Knop rang="hoofd" vol onClick={() => setOpen(false)}>
            {t("context.bevestig")}
          </Knop>
        }
      >
        <div className="flex flex-col gap-4">
          <Veld label={t("context.schooljaar")}>
            {(id) => (
              <Keuze id={id} value={schooljaar?.id ?? ""} onChange={(e) => kiesSchooljaar(e.target.value)}>
                {schooljaren.map((jaar) => (
                  <option key={jaar.id} value={jaar.id}>
                    {jaar.naam}
                  </option>
                ))}
              </Keuze>
            )}
          </Veld>

          <Veld label={t("context.klas")}>
            {(id) =>
              klassen.length === 0 ? (
                <p className="text-meta text-inkt-zacht" id={id}>
                  {/* An empty list proves nothing while it loads or after it failed (the E5-03 rule). */}
                  {fout ? t("context.klassenLaadFout") : laadt ? t("context.klassenLaden") : geenKlassenZin}
                </p>
              ) : (
                <Keuze id={id} value={klas?.id ?? ""} onChange={(e) => kiesKlas(e.target.value)}>
                  {klassen.map((optie) => (
                    <option key={optie.id} value={optie.id}>
                      {optie.naam}
                    </option>
                  ))}
                </Keuze>
              )
            }
          </Veld>

          {klas && mag.beheer ? <Jaarfaseveld klas={klas} /> : null}
        </div>
      </Blad>
    </>
  );
}

/**
 * Which jaar/fase this class actually teaches, when its leerjaar cannot say.
 *
 * **It sits under the klas and not beside it, because it is a property OF that class rather than a third context to
 * choose.** Schooljaar and klas narrow what the screens are about; this one narrows what the class IS, and putting it
 * on the same footing would read as a filter a teacher could set differently per visit.
 *
 * **It is here rather than on a klasbeheer screen because there is no klasbeheer screen.** `Klas.Jaarfase`, its
 * validation and `PUT /api/klassen/{id}` shipped on 2026-08-25 and nothing ever wrote the field, so every kleutergroep
 * went on being measured against JK, K2 and K3 together. The owner reported the symptom on 2026-08-30 from the agenda:
 * a class named "K3 groen" whose dekkingsbalk read "van JK, K2, K3". This is the smallest surface that can fix it,
 * and it is where a teacher already goes to say which class they mean.
 *
 * **The server decides whether to ask.** `mogelijkeJaarfasen` is empty for an L1-L6 class, whose leerjaar already
 * names its code, and for a leerjaar that maps to nothing, which is the unresolved graadklas (Art. XIV). Both mean
 * "do not ask", and neither is something this component may work out for itself.
 */
function Jaarfaseveld({ klas }: { klas: KlasWeergave }) {
  const wijzig = useWijzigKlas();

  // `?? []` although the type says the field is always there. It is always there from a server that has this change,
  // and the browser reloads on its own while the API does not: an API still running the previous build answers a klas
  // without the field, and `.length` on that is a crash of the whole sheet rather than a field that fails to appear.
  const keuzes = klas.mogelijkeJaarfasen ?? [];

  if (keuzes.length === 0) return null;

  return (
    <Veld label={t("context.jaarFase")}>
      {(id) => (
        <>
          <Keuze
            id={id}
            aria-describedby={`${id}-hulp`}
            value={klas.jaarfase ?? ""}
            disabled={wijzig.isPending}
            // Saved on change rather than behind a button. The sheet's own button says "Klaar" and closes it, so a
            // second one here would be two saves to reason about; and the klas and schooljaar above it already commit
            // the moment they are picked.
            onChange={(e) => wijzig.mutate({ klas, jaarfase: e.target.value || null })}
          >
            <option value="">{t("context.jaarFaseLeeg")}</option>
            {keuzes.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Keuze>

          {/* The consequence, not the mechanism. What made the 1288 unarguable was that nothing on screen connected
              the denominator to this class never having been told which kleuterjaar it is.

              The codes are interpolated rather than written out, because this sentence may assert only what its own
              render condition guarantees (the E5-03 rule): the branch knows the server offered THESE codes, and it
              does not know that they are the three kleuterjaren. */}
          <p id={`${id}-hulp`} className="text-meta text-inkt-zacht">
            {t("context.jaarFaseHulp", { fasen: keuzes.join(", ") })}
          </p>

          {/* `attentie-inkt` and not `attentie`: the readable ink of that pair, which is what the other error lines
              in this app use on a plain surface. `role="alert"` because the select keeps focus after a failed save,
              so nothing else would announce it. */}
          {wijzig.isError ? (
            <p role="alert" className="text-meta font-medium text-attentie-inkt">
              {/* "Probeer het opnieuw" would be wrong for a refusal: trying again is refused again. */}
              {geenToegangZin(wijzig.error) ?? t("context.jaarFaseMislukt")}
            </p>
          ) : null}
        </>
      )}
    </Veld>
  );
}
