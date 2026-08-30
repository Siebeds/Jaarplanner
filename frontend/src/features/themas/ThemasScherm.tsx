import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { knopklassen } from "../../components/ui/knopklassen";
import { cn } from "../../lib/cn";
import { Leegte } from "../../components/ui/Leegte";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPijlRechts } from "../../components/Iconen";
import { useThemabibliotheek } from "../../lib/queries";
import { Knop } from "../../components/ui/Knop";
import { IcoonPlus } from "../../components/Iconen";
import { Themaformulier } from "./Themaformulier";
import { useMaakThema } from "./mutaties";
import { t, telWoord } from "../../i18n";
import type { Vertaalsleutel } from "../../i18n";
import { useState } from "react";

/**
 * The school's own thema library (Art. IX.2).
 *
 * School-wide, so there is no class chip here: a thema belongs to the school and only its subthema's
 * are per class. The count of classes that derive from it is on the card instead, which is the honest
 * version of the same information.
 */
export function ThemasScherm() {
  const { data, isPending, isError } = useThemabibliotheek();
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const maak = useMaakThema();

  return (
    <>
      <Schermkop
        titel={t("themas.titel")}
        rechts={
          <div className="flex shrink-0 items-center gap-2">
            <Link to="/inladen" className={cn(knopklassen("stil"), "h-9 min-h-9 px-3 text-meta")}>
              {t("navigatie.inladen")}
            </Link>
            <Knop
              rang="hoofd"
              className="h-9 min-h-9 px-3 text-meta"
              onClick={() => {
                maak.reset();
                setNieuwOpen(true);
              }}
            >
              <IcoonPlus aria-hidden="true" className="h-4 w-4" />
              {t("themas.nieuw")}
            </Knop>
          </div>
        }
      />

      <Schermvlak>
        {isError ? (
          <Leegte titel={t("themas.fout")} />
        ) : isPending ? (
          <Laadlijst rijen={6} />
        ) : data.length === 0 ? (
          <Leegte
            titel={t("themas.leegTitel")}
            actie={
              <Knop rang="hoofd" onClick={() => setNieuwOpen(true)}>
                {t("themas.nieuw")}
              </Knop>
            }
          />
        ) : (
          <>
            <p className="mono mb-4 text-meta text-inkt-zwak">{telWoord(data.length, "themas.eenThema", "themas.aantal")}</p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.map((thema) => {
                const tellingen = tel(thema);
                return (
                <li key={thema.id}>
                  <Link
                    to={`/themas/${thema.id}`}
                    className="group flex h-full flex-col gap-3 rounded-kaart border border-lijn bg-kaart p-4 shadow-licht transition-colors duration-150 hover:border-lijn-veld"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-display text-sectie text-inkt">{thema.naam}</h2>
                      <IcoonPijlRechts
                        aria-hidden="true"
                        className="mt-0.5 h-4 w-4 shrink-0 text-inkt-zwak transition-transform duration-150 group-hover:translate-x-0.5"
                      />
                    </div>

                    {thema.invalshoeken ? (
                      <p className="line-clamp-2 text-meta text-inkt-zacht">{thema.invalshoeken}</p>
                    ) : null}

                    {/* What has been built on this thema, at a glance. One wrapping line rather than
                        four columns: at this card width "activiteiten" does not fit a quarter of it,
                        and a truncated label is a label that has to be guessed. School-wide totals,
                        because this IS the school-wide library, and counts say how much exists
                        without showing any class's content (Art. IX.2).

                        The numbers carry the weight and the words step back, which is what makes the
                        line scannable down a column of cards without becoming a table. */}
                    <p className="mt-auto flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-lijn pt-3 text-meta text-inkt-zwak">
                      <Cijfer waarde={thema.duurWeken} enkel="themas.weekEen" meer="themas.weekMeer" />
                      <Cijfer
                        waarde={thema.aantalAfgeleideKlassen}
                        enkel="themas.klasEen"
                        meer="themas.klasMeer"
                      />
                      <Cijfer waarde={tellingen.subthemas} enkel="themas.subthemaEen" meer="themas.subthemaMeer" />
                      <Cijfer
                        waarde={tellingen.activiteiten}
                        enkel="themas.activiteitEen"
                        meer="themas.activiteitMeer"
                      />
                      <Cijfer waarde={tellingen.doelen} enkel="themas.doelEen" meer="themas.doelMeer" />
                    </p>

                    {/* Art. IX.2 wants two or three school-wide themadoelen per thema. The server
                        computes whether this thema has them; the card says so where it is decided. */}
                    {!thema.heeftVoldoendeThemadoelen ? (
                      <p className="rounded bg-attentie-zacht px-2 py-1 text-[0.6875rem] font-medium text-attentie-inkt">
                        {t("themas.teWeinigDoelen")}
                      </p>
                    ) : null}
                  </Link>
                </li>
                );
              })}
            </ul>
          </>
        )}
      </Schermvlak>

      {/* Keyed on the open flag so a cancelled draft is not still in the fields next time. */}
      {nieuwOpen ? (
        <Themaformulier
          open
          bezig={maak.isPending}
          fout={maak.isError ? maak.error : undefined}
          onSluit={() => setNieuwOpen(false)}
          onBewaar={(invoer) => maak.mutate(invoer, { onSuccess: () => setNieuwOpen(false) })}
        />
      ) : null}
    </>
  );
}

/**
 * The three counts the bibliotheek endpoint gained, read defensively.
 *
 * `ThemaBibliotheekItem` in `lib/types.ts` does not carry them yet, and that file is held by another
 * session. Read through a local shape rather than reaching into their file; fold it in when the claim
 * is released. `?? 0` rather than a non-null assertion, so an older server renders zeroes instead of
 * "NaN".
 */
type MetTellingen = {
  aantalSubthemas?: number;
  aantalActiviteiten?: number;
  aantalDoelkoppelingen?: number;
};

function tel(thema: unknown) {
  const t = thema as MetTellingen;
  return {
    subthemas: t.aantalSubthemas ?? 0,
    activiteiten: t.aantalActiviteiten ?? 0,
    doelen: t.aantalDoelkoppelingen ?? 0,
  };
}

/**
 * One figure and its word, side by side.
 *
 * The number is set in the mono face at body size and the word stays small: that pairing is what
 * lets five of them sit on one line and still be read as five separate facts. A zero is muted, so a
 * thema nobody has built on yet reads as empty rather than as four numbers to check.
 */
function Cijfer({
  waarde,
  enkel,
  meer,
}: {
  waarde: number;
  enkel: Vertaalsleutel;
  meer: Vertaalsleutel;
}) {
  // Dutch takes the plural for zero, so only 1 differs. Written out rather than passed through
  // telWoord, because that helper puts the number inside the sentence and here the number is set
  // apart on purpose.
  return (
    <span className="whitespace-nowrap">
      <span className={waarde === 0 ? "mono text-body text-inkt-zwak" : "mono text-body font-medium text-inkt"}>
        {waarde}
      </span>{" "}
      {t(waarde === 1 ? enkel : meer)}
    </span>
  );
}
