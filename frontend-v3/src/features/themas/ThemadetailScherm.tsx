import { Link, useParams } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Knop } from "../../components/ui/Knop";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak, Laadlijst } from "../../components/ui/Laadvlak";
import { useBeoordeelSuggestie, useDoelsuggesties, useGenereerDoelsuggesties, useThema } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import type { DoelKoppelingWeergave, SubthemaWeergave } from "../../lib/types";
import { t, telWoord } from "../../i18n";
import type { ReactNode } from "react";

/**
 * One thema: its school-wide anchors, the AI's goal proposals waiting for a verdict, and the
 * subthema's each class builds under it.
 *
 * The suggestion block is the human-in-the-loop surface (Art. IV). Nothing the model proposes is
 * applied: every row sits at `Voorgesteld` until a teacher accepts or rejects it, and the motivation
 * is shown beside the proposal rather than hidden behind it, because the motivation is what the
 * teacher is judging.
 */
export function ThemadetailScherm() {
  const { themaId } = useParams<{ themaId: string }>();
  const { data: thema, isPending, isError } = useThema(themaId);
  const { data: suggesties } = useDoelsuggesties(themaId);
  const genereer = useGenereerDoelsuggesties(themaId ?? "");
  const beoordeel = useBeoordeelSuggestie(themaId ?? "");

  if (isError) {
    return (
      <>
        <Schermkop titel={t("themas.titel")} />
        <Schermvlak>
          <Leegte titel={t("thema.fout")} actie={<Terug />} />
        </Schermvlak>
      </>
    );
  }

  if (isPending || !thema) {
    return (
      <>
        <Schermkop titel={t("themas.titel")} />
        <Schermvlak>
          <Laadvlak className="mb-4 h-24" />
          <Laadlijst rijen={5} />
        </Schermvlak>
      </>
    );
  }

  // A verdict has been recorded on everything that is no longer Voorgesteld, so only the open ones
  // are waiting for the teacher.
  const openSuggesties = (suggesties ?? []).filter((suggestie) => suggestie.status === "Voorgesteld");

  return (
    <>
      <Schermkop titel={thema.naam} />

      <Schermvlak>
        <Terug />

        <p className="mono mt-3 text-meta text-inkt-zwak">
          {telWoord(thema.duurWeken, "thema.eenWeek", "thema.weken")} ·{" "}
          {telWoord(thema.subthemas.length, "thema.eenSubthema", "thema.subthemas")}
        </p>

        {thema.invalshoeken ? <p className="mt-3 text-body text-inkt">{thema.invalshoeken}</p> : null}

        {thema.kernwoordenschat.length > 0 ? (
          <Sectie titel={t("thema.kernwoordenschat")}>
            <Woordenrij woorden={thema.kernwoordenschat} />
          </Sectie>
        ) : null}

        {thema.rijkeWoordenschat.length > 0 ? (
          <Sectie titel={t("thema.rijkeWoordenschat")}>
            <Woordenrij woorden={thema.rijkeWoordenschat} />
          </Sectie>
        ) : null}

        <Sectie titel={t("thema.themadoelen")}>
          {thema.themadoelen.length === 0 ? (
            <p className="text-meta text-inkt-zwak">{t("thema.geenThemadoelen")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {thema.themadoelen.map((themadoel) => (
                <li key={themadoel.id}>
                  <Koppelingregel koppeling={themadoel.koppeling} />
                </li>
              ))}
            </ul>
          )}
        </Sectie>

        <Sectie
          titel={t("thema.suggesties")}
          actie={
            <Knop
              rang="rustig"
              className="h-9 min-h-9 px-3 text-meta"
              disabled={genereer.isPending}
              onClick={() => genereer.mutate()}
            >
              {genereer.isPending ? t("thema.suggestiesBezig") : t("thema.suggestiesVragen")}
            </Knop>
          }
        >
          {genereer.isError ? (
            <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {genereer.error instanceof ApiError && genereer.error.detail
                ? genereer.error.detail
                : t("thema.suggestiesMislukt")}
            </p>
          ) : null}

          {openSuggesties.length === 0 ? (
            <p className="text-meta text-inkt-zwak">{t("thema.geenSuggesties")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {openSuggesties.map((suggestie) => (
                <li key={suggestie.id} className="rounded-kaart border border-lijn bg-kaart p-3">
                  <div className="flex items-center gap-2">
                    {suggestie.doelsoort ? <Doelsoortmerk soort={suggestie.doelsoort} /> : null}
                    <span className="mono text-[0.6875rem] font-medium text-inkt-zacht">{suggestie.leerplandoelCode}</span>
                    <Statusmerk status={suggestie.status} className="ml-auto" />
                  </div>

                  {suggestie.tekst ? <p className="mt-1.5 text-body text-inkt">{suggestie.tekst}</p> : null}

                  {suggestie.aiMotivatie ? (
                    <p className="mt-2 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">
                      {suggestie.aiMotivatie}
                    </p>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <Knop
                      rang="hoofd"
                      className="h-9 min-h-9 px-3 text-meta"
                      disabled={beoordeel.isPending}
                      onClick={() => beoordeel.mutate({ suggestieId: suggestie.id, status: "Aanvaard" })}
                    >
                      {t("thema.aanvaard")}
                    </Knop>
                    <Knop
                      rang="rustig"
                      className="h-9 min-h-9 px-3 text-meta"
                      disabled={beoordeel.isPending}
                      onClick={() => beoordeel.mutate({ suggestieId: suggestie.id, status: "Geweigerd" })}
                    >
                      {t("thema.weiger")}
                    </Knop>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Sectie>

        <Sectie titel={t("thema.subthemasTitel")}>
          {thema.subthemas.length === 0 ? (
            <p className="text-meta text-inkt-zwak">{t("thema.geenSubthemas")}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {thema.subthemas.map((subthema) => (
                <li key={subthema.id}>
                  <Subthemakaart subthema={subthema} />
                </li>
              ))}
            </ul>
          )}
        </Sectie>
      </Schermvlak>
    </>
  );
}

function Terug() {
  return (
    <Link
      to="/themas"
      className="inline-flex h-9 items-center rounded-full border border-lijn px-3 text-meta font-medium text-inkt-zacht transition-colors duration-150 hover:border-lijn-veld hover:text-inkt"
    >
      {t("thema.terug")}
    </Link>
  );
}

function Sectie({ titel, actie, children }: { titel: string; actie?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-7 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-micro uppercase text-inkt-zwak">{titel}</h2>
        {actie}
      </div>
      {children}
    </section>
  );
}

function Woordenrij({ woorden }: { woorden: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {woorden.map((woord) => (
        <li key={woord} className="rounded-full border border-lijn bg-kaart px-2.5 py-1 text-meta text-inkt-zacht">
          {woord}
        </li>
      ))}
    </ul>
  );
}

function Koppelingregel({ koppeling }: { koppeling: DoelKoppelingWeergave }) {
  return (
    <div className="flex items-center gap-2 rounded-kaart border border-lijn bg-kaart px-3 py-2">
      <span className="mono truncate text-[0.6875rem] font-medium text-inkt-zacht">{koppeling.leerplandoelCode}</span>
      <Statusmerk status={koppeling.status} className="ml-auto" />
    </div>
  );
}

function Subthemakaart({ subthema }: { subthema: SubthemaWeergave }) {
  return (
    <article className="rounded-kaart border border-lijn bg-kaart p-4 shadow-licht">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-sectie text-inkt">{subthema.naam}</h3>
        <p className="mono text-meta text-inkt-zwak">
          {subthema.leeftijd} · {telWoord(subthema.duurWeken, "thema.eenWeek", "thema.weken")}
        </p>
      </header>

      {subthema.onderzoeksvragen.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {subthema.onderzoeksvragen.map((vraag) => (
            <li key={vraag.id} className="border-l-2 border-lijn-sterk pl-3">
              <p className="text-body text-inkt">{vraag.vraag}</p>
              {vraag.probleemstelling ? <p className="text-meta text-inkt-zacht">{vraag.probleemstelling}</p> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {subthema.activiteiten.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {subthema.activiteiten.map((activiteit) => (
            <li
              key={activiteit.id}
              className="rounded-full border border-lijn bg-vlak px-2.5 py-1 text-meta text-inkt-zacht"
            >
              {activiteit.naam}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mono mt-3 text-meta text-inkt-zwak">
        {telWoord(subthema.subdoelen.length, "thema.eenSubdoel", "thema.subdoelen")} ·{" "}
        {telWoord(subthema.activiteiten.length, "thema.eenActiviteit", "thema.activiteiten")}
      </p>
    </article>
  );
}
