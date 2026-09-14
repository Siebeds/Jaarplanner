import { useMinimumdoel } from "../../lib/queries";
import type { MinimumdoelSoort } from "../../lib/types";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { Leegte } from "../../components/ui/Leegte";
import { t, telWoord, type Vertaalsleutel } from "../../i18n";
import { cn } from "../../lib/cn";
import { Sectie } from "./Doeldetail";
import { MIJLPAAL } from "./mijlpaal";
import { redenZonderLeerplandoel } from "./redenZonderLeerplandoel";

/** The decree's three kinds, in the decree's own words (Art. III.1): a shortened label would be a paraphrase. */
const SOORT: Record<MinimumdoelSoort, Vertaalsleutel> = {
  TeBereikenIndividueel: "minimumdoel.soortTeBereikenIndividueel",
  TeBereikenPopulatie: "minimumdoel.soortTeBereikenPopulatie",
  NaTeStreven: "minimumdoel.soortNaTeStreven",
};

/**
 * One decreed minimumdoel and where Op.stap works it out (TB-010): the leerplandoelen that concord to it, per jaar/fase.
 *
 * Read-only throughout (Art. III.1). The decreed text comes first at reading size, as in the leerplandoel detail. Then a
 * row of the jaar/fasen with how many leerplandoelen each holds, which shows at a glance that an eindterm for the fourth
 * leerjaar is built up from L1; then those leerplandoelen themselves, each of which opens its own detail.
 *
 * The row is filled in ink, not in a doelsoort hue: it counts leerplandoelen whatever their doelsoort, and a doelsoort
 * hue would claim one (Art. XII). Each cell carries its number, so nothing depends on seeing the fill.
 */
export function Minimumdoeldetail({
  minimumdoelRef,
  onKies,
}: {
  minimumdoelRef: string;
  /** Open a concorded leerplandoel in the same place. */
  onKies: (code: string) => void;
}) {
  const { data, isPending, isError } = useMinimumdoel(minimumdoelRef);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Laadvlak className="h-6 w-32" />
        <Laadvlak className="h-20" />
        <Laadvlak className="h-32" />
      </div>
    );
  }

  if (isError || !data) return <Leegte titel={t("minimumdoel.fout")} />;

  const pad = [data.leergebied, data.rubriek, data.subrubriek].filter(Boolean).join(" / ");
  const metDoelen = data.jaarFasen.filter((fase) => fase.leerplandoelen.length > 0);
  const reden = redenZonderLeerplandoel(data);

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mono rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.6875rem] font-medium text-doelsoort-md-op">
            {data.ref}
          </span>
          <span className="text-meta text-inkt-zacht">{MIJLPAAL[data.leeftijd] ? t(MIJLPAAL[data.leeftijd]) : data.leeftijd}</span>
          {data.soort ? (
            <span className="rounded-full border border-lijn-sterk px-2 py-0.5 text-[0.6875rem] text-inkt-zacht">
              {t(SOORT[data.soort])}
            </span>
          ) : null}
          {data.nietMeerInOpstap ? (
            <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
              {t("doel.vervallen")}
            </span>
          ) : null}
        </div>

        {/* The decreed text lists its items on lines of their own ("\n- "): keep them there. */}
        <p className="whitespace-pre-line text-[1.0625rem] leading-[1.5] text-inkt">{data.omschrijving}</p>

        {pad ? <p className="text-meta text-inkt-zacht">{pad}</p> : null}
      </header>

      {data.aantalLeerplandoelen > 0 ? (
        <>
          <Sectie titel={t("minimumdoel.perJaarFase")}>
            <div
              role="img"
              aria-label={t("minimumdoel.perJaarFaseLabel", {
                lijst: metDoelen.map((fase) => `${fase.jaarFase}: ${fase.leerplandoelen.length}`).join(", "),
              })}
              className="grid gap-[3px]"
              style={{ gridTemplateColumns: `repeat(${data.jaarFasen.length}, minmax(0, 1fr))` }}
            >
              {data.jaarFasen.map((fase) => {
                const aantal = fase.leerplandoelen.length;
                return (
                  <div key={fase.jaarFase} aria-hidden="true" className="flex flex-col items-center gap-1">
                    <span
                      className={cn(
                        "mono flex h-7 w-full items-center justify-center rounded-md text-[0.6875rem] font-medium",
                        aantal > 0 ? "bg-inkt text-inkt-op" : "bg-vlak-diep text-inkt-zwak",
                      )}
                    >
                      {aantal > 0 ? aantal : ""}
                    </span>
                    <span className={cn("mono text-[0.625rem]", aantal > 0 ? "font-medium text-inkt" : "text-inkt-zwak")}>
                      {fase.jaarFase}
                    </span>
                  </div>
                );
              })}
            </div>
          </Sectie>

          <Sectie
            // "verwijst ernaar", not "uitgewerkt in": a stored goal KOV has since dropped still refers to it and is counted,
            // with its "Vervallen in Op.stap" badge below, so the heading claims no more than the concordance (the E5-03 rule).
            titel={telWoord(data.aantalLeerplandoelen, "minimumdoel.verwijzenEen", "minimumdoel.verwijzenMeer")}
          >
            <div className="flex flex-col gap-3">
              {metDoelen.map((fase) => (
                <div key={fase.jaarFase} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-2">
                  <span className="mono pt-2 text-[0.75rem] font-medium text-inkt">{fase.jaarFase}</span>
                  <ul className="flex flex-col gap-0.5 border-l border-lijn pl-1.5">
                    {fase.leerplandoelen.map((doel) => (
                      <li key={doel.code}>
                        <button
                          type="button"
                          onClick={() => onKies(doel.code)}
                          className="flex w-full flex-col gap-0.5 rounded-veld px-2 py-1.5 text-left transition-colors duration-150 hover:bg-vlak-diep"
                        >
                          <span className="flex items-center gap-2">
                            <span className="mono text-[0.6875rem] font-medium text-inkt-zacht">{doel.code}</span>
                            {doel.nietMeerInOpstap ? (
                              <span className="shrink-0 rounded bg-attentie-zacht px-1.5 text-[0.625rem] font-medium text-attentie-inkt">
                                {t("doel.vervallen")}
                              </span>
                            ) : null}
                          </span>
                          <span className="line-clamp-2 text-meta text-inkt">{doel.tekst}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Sectie>
        </>
      ) : (
        <Sectie titel={t("minimumdoel.leerplandoelen")}>
          <p className="text-meta text-inkt-zacht">{t("doelen.zonderLeerplandoelEen")}</p>
          {reden ? <p className="text-meta text-inkt-zacht">{reden}</p> : null}
        </Sectie>
      )}
    </article>
  );
}
