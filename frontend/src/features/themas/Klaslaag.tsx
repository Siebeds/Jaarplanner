import { useSchooljaren } from "../../app/schooljaren";
import { t, tAantal } from "../../i18n";
import type { Activiteit, Subthema } from "./types";
import { useThemaVoorKlas } from "./useThemas";

/**
 * The class-scoped half of a thema: this class's subthema's, their subdoelen and their activiteiten
 * (E1-14, Art. IX.2).
 *
 * **It asks the server for one class** (`…/voor-klas/{klasId}`), so no other class's content is in the tab to
 * begin with. With no class chosen it makes no request at all and says so: a section that silently showed
 * every class's derivations would be the exact cross-class bleed Art. IX.2 forbids, and one that spun forever
 * would be worse than a sentence.
 *
 * **Read-only in this landing, and it says so.** Adding, editing and deleting at this level is the second half
 * of E1-14; until it lands, the section states plainly that changes go through Import today rather than
 * showing controls that do nothing (the E3-06 rule). When the write affordances arrive, that sentence and its
 * catalogue key go away with it.
 */
export interface KlaslaagProps {
  themaId: string;
  /** The class chosen in the shell, or "" when none is. */
  klasId: string;
}

export function Klaslaag({ themaId, klasId }: KlaslaagProps) {
  const heeftKlas = klasId.length > 0;
  const thema = useThemaVoorKlas(themaId, heeftKlas ? klasId : undefined);
  const schooljaren = useSchooljaren();

  // The class's own name, so the heading reads "Van L3 derde leerjaar" rather than a GUID. The selector's list
  // is the only place names live; a class the URL names but the list does not contain gets a neutral fallback
  // rather than an invented name.
  const klasNaam = schooljaren.data
    ?.flatMap((schooljaar) => schooljaar.klassen)
    .find((klas) => klas.id === klasId)?.naam;

  const subthemas: Subthema[] = thema.data?.subthemas ?? [];

  return (
    <section aria-labelledby="thema-klas" className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <h3 id="thema-klas" className="text-sm font-bold uppercase tracking-wide text-petrol">
        {heeftKlas
          ? t("themabeheer.klasTitel", { klas: klasNaam ?? t("themabeheer.klasOnbekend") })
          : t("themabeheer.subthemasLabel")}
      </h3>

      {!heeftKlas ? (
        <p className="mt-1 max-w-prose text-sm text-ink-zacht">{t("themabeheer.klasGeenKeuze")}</p>
      ) : (
        <>
          <p className="mt-0.5 max-w-prose text-sm text-ink-zacht">{t("themabeheer.klasUitleg")}</p>

          {thema.isPending ? (
            <p className="mt-3 text-sm text-ink-zacht">{t("themabeheer.detailLaden")}</p>
          ) : thema.isError ? (
            <p role="alert" className="mt-3 text-sm font-medium text-suggestie-geweigerd">
              {t("themabeheer.detailFout")}
            </p>
          ) : subthemas.length === 0 ? (
            <p className="mt-3 text-sm text-ink-zacht">{t("themabeheer.subthemasGeen")}</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {subthemas.map((subthema) => (
                <li key={subthema.id} className="rounded-md border border-border/70 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="font-semibold text-ink">{subthema.naam}</span>
                    <span className="text-xs font-medium text-ink-zacht">
                      {tAantal(subthema.duurWeken, "themabeheer.duurEnkelvoud", "themabeheer.duur")}
                      {" · "}
                      {t("themabeheer.leeftijdWaarde", { leeftijd: subthema.leeftijd })}
                    </span>
                  </div>

                  {/*
                    The two questions that make a subthema kennisrijk (Art. IX.2, and the glossary calls the
                    onderzoeksvraag the driving question). They were in the transport type and on no screen,
                    so an onderzoeksvraag could exist in the database and be visible nowhere in the product
                    (antagonist round 1). Rendered only when filled: an empty label per subthema is the kind
                    of repetition that makes a list unscannable.
                  */}
                  {subthema.probleemstelling ? (
                    <p className="mt-1 text-sm text-ink">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
                        {t("themabeheer.probleemstellingLabel")}
                      </span>{" "}
                      {subthema.probleemstelling}
                    </p>
                  ) : null}
                  {subthema.onderzoeksvraag ? (
                    <p className="mt-1 text-sm text-ink">
                      <span className="text-xs font-semibold uppercase tracking-wide text-ink-zacht">
                        {t("themabeheer.onderzoeksvraagLabel")}
                      </span>{" "}
                      {subthema.onderzoeksvraag}
                    </p>
                  ) : null}

                  <p className="mt-1.5 text-xs font-semibold uppercase tracking-wide text-ink-zacht">
                    {t("themabeheer.subdoelenLabel")}
                  </p>
                  {subthema.subdoelen.length === 0 ? (
                    <p className="text-sm text-ink-zacht">{t("themabeheer.subdoelenGeen")}</p>
                  ) : (
                    <p className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-xs text-ink">
                      {subthema.subdoelen.map((subdoel) => (
                        <span key={subdoel.id}>{subdoel.koppeling.leerplandoelCode}</span>
                      ))}
                    </p>
                  )}

                  <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-ink-zacht">
                    {t("themabeheer.activiteitenLabel")}
                  </p>
                  {subthema.activiteiten.length === 0 ? (
                    <p className="text-sm text-ink-zacht">{t("themabeheer.activiteitenGeen")}</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {subthema.activiteiten.map((activiteit) => (
                        <Activiteitregel key={activiteit.id} activiteit={activiteit} />
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-xs text-ink-zacht">{t("themabeheer.klasAlleenLezen")}</p>
        </>
      )}
    </section>
  );
}

/** One activiteit: naam, type, the hoek and expected outcomes when it has them, and the codes it is linked to. */
function Activiteitregel({ activiteit }: { activiteit: Activiteit }) {
  return (
    <li className="text-sm text-ink">
      <span className="font-medium">{activiteit.naam}</span>
      <span className="text-ink-zacht">
        {" · "}
        {t(`activiteitType.${typeSleutel(activiteit.activiteitType)}`)}
        {/* The label and its punctuation live in the catalogue, not in a template here: only the Dutch knows
            whether it takes a colon. */}
        {activiteit.hoek ? ` · ${t("themabeheer.hoekWaarde", { hoek: activiteit.hoek })}` : ""}
      </span>
      {activiteit.doelkoppelingen.length > 0 ? (
        <span className="ml-1 font-mono text-xs text-ink-zacht">
          {activiteit.doelkoppelingen.map((koppeling) => koppeling.leerplandoelCode).join(", ")}
        </span>
      ) : null}
      {activiteit.verwachteUitkomsten ? (
        <p className="text-sm text-ink-zacht">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {t("themabeheer.verwachteUitkomstenLabel")}
          </span>{" "}
          {activiteit.verwachteUitkomsten}
        </p>
      ) : null}
    </li>
  );
}

/**
 * The catalogue key for an activiteittype: the wire sends `"Prentenboek"`, the catalogue keys are lower-case.
 *
 * Typed as the exact union rather than `string`, so adding an `ActiviteitType` without adding its Dutch label
 * is a compile error here instead of a `t()` call that renders its own key on screen.
 */
function typeSleutel(type: Activiteit["activiteitType"]) {
  return type.toLowerCase() as Lowercase<Activiteit["activiteitType"]>;
}
