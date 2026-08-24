import { Link } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Leegte } from "../../components/ui/Leegte";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPijlRechts } from "../../components/Iconen";
import { useThemabibliotheek } from "../../lib/queries";
import { t, telWoord } from "../../i18n";

/**
 * The school's own thema library (Art. IX.2).
 *
 * School-wide, so there is no class chip here: a thema belongs to the school and only its subthema's
 * are per class. The count of classes that derive from it is on the card instead, which is the honest
 * version of the same information.
 */
export function ThemasScherm() {
  const { data, isPending, isError } = useThemabibliotheek();

  return (
    <>
      <Schermkop titel={t("themas.titel")} />

      <Schermvlak>
        {isError ? (
          <Leegte titel={t("themas.fout")} />
        ) : isPending ? (
          <Laadlijst rijen={6} />
        ) : data.length === 0 ? (
          <Leegte titel={t("themas.leegTitel")} actie={<p className="text-meta text-inkt-zacht">{t("themas.leegActie")}</p>} />
        ) : (
          <>
            <p className="mono mb-4 text-meta text-inkt-zwak">{telWoord(data.length, "themas.eenThema", "themas.aantal")}</p>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.map((thema) => (
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

                    <p className="mono mt-auto text-meta text-inkt-zwak">
                      {telWoord(thema.duurWeken, "themas.eenWeek", "themas.weken")} ·{" "}
                      {telWoord(thema.themadoelen.length, "themas.eenDoel", "themas.doelen")} ·{" "}
                      {telWoord(thema.aantalAfgeleideKlassen, "themas.eenKlas", "themas.klassen")}
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
              ))}
            </ul>
          </>
        )}
      </Schermvlak>
    </>
  );
}
