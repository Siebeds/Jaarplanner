import { useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Keuze, Veld } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { useEindvoorstel, useThemabibliotheek } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import { periode, volleDag } from "../../lib/datum";
import { t, telWoord } from "../../i18n";

/**
 * Placing a thema by hand (FR-7.2, ADR-0049): which thema, its first day, and its last day.
 *
 * **The server proposes the end** from the thema's duration in lesweken, as soon as a thema and a first day are
 * chosen, and says when the next thema or the end of the year makes it earlier. The teacher may change it; once she
 * has, a new proposal no longer overwrites what she typed.
 *
 * **Mounted fresh for every opening** (the caller gives it a new `key`), so the form starts from the day it was opened
 * for without an effect resetting it.
 *
 * **The parts are shown before saving** when a vacation falls inside: the thema is stored in those parts.
 */
export function Themaplaatsingblad({
  open,
  klasId,
  beginVoorstel,
  eersteSchooldag,
  laatsteSchooldag,
  bezig,
  fout,
  onPlaats,
  onSluit,
}: {
  open: boolean;
  klasId: string;
  /** The first day to start from, e.g. the Monday of the empty week that was pressed. */
  beginVoorstel: string | null;
  eersteSchooldag: string;
  laatsteSchooldag: string;
  bezig: boolean;
  /** Why the last attempt was refused, in the server's words. */
  fout: string | null;
  onPlaats: (keuze: { themaId: string; van: string; tot: string }) => void;
  onSluit: () => void;
}) {
  const { data: themas, isPending } = useThemabibliotheek();
  const [themaId, setThemaId] = useState("");
  const [van, setVan] = useState(beginVoorstel ?? "");
  // The end the teacher typed herself, or null while the proposal fills it.
  const [eigenTot, setEigenTot] = useState<string | null>(null);

  const voorstel = useEindvoorstel(klasId, themaId || null, van || null);
  const totZelfGekozen = eigenTot !== null;
  const tot = eigenTot ?? voorstel.data?.tot ?? "";

  const voorstelFout =
    voorstel.error instanceof ApiError && voorstel.error.detail ? voorstel.error.detail : null;
  const ongeldig = themaId === "" || van === "" || tot === "" || tot < van;
  const delen = voorstel.data && !totZelfGekozen ? voorstel.data.delen : [];

  return (
    <Blad
      open={open}
      onOpenChange={(open) => !open && onSluit()}
      titel={t("plan.voegThemaToe")}
      voet={
        <Knop
          rang="hoofd"
          vol
          disabled={bezig || ongeldig || voorstelFout !== null}
          onClick={() => onPlaats({ themaId, van, tot })}
        >
          {t("plan.toevoegen")}
        </Knop>
      }
    >
      {isPending ? (
        <Laadlijst rijen={3} />
      ) : !themas || themas.length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("plan.geenThemas")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Veld label={t("plan.thema")}>
            {(id) => (
              <Keuze id={id} value={themaId} onChange={(event) => setThemaId(event.target.value)}>
                <option value="">{t("plan.kiesThema")}</option>
                {themas.map((thema) => (
                  <option key={thema.id} value={thema.id}>
                    {`${thema.naam} (${telWoord(thema.duurWeken, "themas.eenWeek", "themas.weken")})`}
                  </option>
                ))}
              </Keuze>
            )}
          </Veld>

          <Veld label={t("plan.begindatum")}>
            {(id) => (
              <Invoer
                id={id}
                type="date"
                className="w-40"
                value={van}
                min={eersteSchooldag}
                max={laatsteSchooldag}
                onChange={(event) => setVan(event.target.value)}
              />
            )}
          </Veld>

          {voorstelFout ? (
            <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {voorstelFout}
            </p>
          ) : voorstel.data ? (
            <div className="flex flex-col gap-1 text-meta text-inkt-zacht">
              <p>{t("plan.voorgesteldEinde", { datum: volleDag(voorstel.data.tot) })}</p>
              {voorstel.data.beperktDoor === "VolgendThema" && voorstel.data.volgendThemaNaam ? (
                <p className="text-attentie-inkt">
                  {t("plan.beperktVolgend", { naam: voorstel.data.volgendThemaNaam })}
                </p>
              ) : null}
              {voorstel.data.beperktDoor === "Schooljaar" ? (
                <p className="text-attentie-inkt">{t("plan.beperktSchooljaar")}</p>
              ) : null}
            </div>
          ) : null}

          <Veld label={t("plan.einddatum")}>
            {(id) => (
              <Invoer
                id={id}
                type="date"
                className="w-40"
                value={tot}
                min={van || eersteSchooldag}
                max={laatsteSchooldag}
                onChange={(event) => setEigenTot(event.target.value)}
              />
            )}
          </Veld>

          {tot !== "" && van !== "" && tot < van ? (
            <p role="alert" className="text-meta font-medium text-attentie-inkt">
              {t("tijdraster.eindeVoorBegin")}
            </p>
          ) : null}

          {delen.length > 1 ? (
            <div className="text-meta text-inkt-zacht">
              <p>{t("plan.inDelen", { aantal: delen.length })}</p>
              <ul className="mono mt-1 flex flex-col gap-0.5 text-inkt">
                {delen.map((deel) => (
                  <li key={deel.van}>{periode(deel.van, deel.tot)}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {fout ? (
            <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {fout}
            </p>
          ) : null}
        </div>
      )}
    </Blad>
  );
}
