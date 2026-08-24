import type { ReactNode } from "react";
import { useLeerplandoel } from "../../lib/queries";
import type { DoelKoppelingContext, KoppelingStatus } from "../../lib/types";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { Leegte } from "../../components/ui/Leegte";
import { t } from "../../i18n";
import { cn } from "../../lib/cn";

/**
 * Everything Op.stap holds about one leerplandoel, plus where this school already uses it.
 *
 * Read-only throughout (Art. III.1): the official content of a leerplandoel is reference data and
 * this screen offers no way to change a character of it.
 *
 * The order is deliberate. The goal text comes first at reading size, because that is the sentence
 * a teacher came for. Everything that places it in the curriculum follows, and the school's own use
 * of it comes last, since it is the only part that changes from week to week.
 */
export function Doeldetail({ code, onKies }: { code: string | null; onKies: (code: string) => void }) {
  const { data, isPending, isError } = useLeerplandoel(code);

  if (!code) return <Leegte titel={t("doel.kies")} />;

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        <Laadvlak className="h-6 w-32" />
        <Laadvlak className="h-20" />
        <Laadvlak className="h-32" />
      </div>
    );
  }

  if (isError || !data) return <Leegte titel={t("doel.fout")} />;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Doelsoortmerk soort={data.doelsoort} />
          <span className="mono text-meta font-medium text-inkt">{data.code}</span>
          <span className="mono rounded border border-lijn px-1.5 py-0.5 text-[0.625rem] text-inkt-zwak">
            {data.jaarFase}
          </span>
          {data.nietMeerInOpstap ? (
            <span className="rounded bg-attentie-zacht px-2 py-0.5 text-[0.6875rem] font-medium text-attentie-inkt">
              {t("doel.vervallen")}
            </span>
          ) : null}
        </div>

        <p className="text-[1.0625rem] leading-[1.5] text-inkt">{data.tekst}</p>

        <p className="text-meta text-inkt-zacht">
          {[data.disciplineNaam ?? data.disciplineNummer, data.domein, data.subdomein].join(" / ")}
        </p>
      </header>

      {data.minimumdoel ? (
        <Sectie titel={t("doel.minimumdoel")}>
          <div className="rounded-kaart border border-lijn bg-vlak/70 p-3">
            <span className="mono text-[0.6875rem] font-medium text-doelsoort-md">{data.minimumdoel.ref}</span>
            <p className="mt-1 text-body text-inkt">{data.minimumdoel.omschrijving}</p>
          </div>
        </Sectie>
      ) : null}

      {data.cluster ? <Sectie titel={t("doel.cluster")}>{<p className="text-body text-inkt">{data.cluster}</p>}</Sectie> : null}
      {data.voorbeelden ? (
        <Sectie titel={t("doel.voorbeelden")}>{<p className="whitespace-pre-line text-body text-inkt">{data.voorbeelden}</p>}</Sectie>
      ) : null}
      {data.toelichting ? (
        <Sectie titel={t("doel.toelichting")}>{<p className="whitespace-pre-line text-body text-inkt">{data.toelichting}</p>}</Sectie>
      ) : null}
      {data.woordenschat ? (
        <Sectie titel={t("doel.woordenschat")}>{<p className="whitespace-pre-line text-body text-inkt">{data.woordenschat}</p>}</Sectie>
      ) : null}

      {data.gerelateerdeDoelen.length > 0 ? (
        <Sectie titel={t("doel.gerelateerd")}>
          <ul className="flex flex-col gap-1">
            {data.gerelateerdeDoelen.map((ander) => (
              <li key={ander.code}>
                <button
                  type="button"
                  onClick={() => onKies(ander.code)}
                  className="flex w-full flex-col gap-0.5 rounded-veld px-2 py-2 text-left transition-colors duration-150 hover:bg-vlak-diep"
                >
                  <span className="flex items-center gap-2">
                    <span className="mono text-[0.6875rem] font-medium text-inkt-zacht">{ander.code}</span>
                    <span className="mono rounded border border-lijn px-1 text-[0.625rem] text-inkt-zwak">
                      {ander.jaarFase}
                    </span>
                  </span>
                  <span className="line-clamp-2 text-meta text-inkt">{ander.tekst}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sectie>
      ) : null}

      <Sectie titel={t("doel.gebruiktIn")}>
        {data.koppelingen.length === 0 ? (
          <p className="text-meta text-inkt-zwak">{t("doel.nergensGebruikt")}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {data.koppelingen.map((koppeling, index) => (
              <li key={`${koppeling.herkomst}-${koppeling.themaNaam}-${index}`}>
                <Koppelingsregel koppeling={koppeling} />
              </li>
            ))}
          </ul>
        )}
      </Sectie>
    </article>
  );
}

function Sectie({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-micro uppercase text-inkt-zwak">{titel}</h3>
      {children}
    </section>
  );
}

/**
 * The status colours come from the suggestiestatus tokens (Art. IV), and each one is written out
 * beside its dot: a teacher must be able to tell voorgesteld from aanvaard without seeing colour.
 */
const STATUSVLAK: Record<KoppelingStatus, string> = {
  Voorgesteld: "bg-suggestie-voorgesteld",
  Aanvaard: "bg-suggestie-aanvaard",
  Geweigerd: "bg-suggestie-geweigerd",
  Manueel: "bg-suggestie-manueel",
};

function Koppelingsregel({ koppeling }: { koppeling: DoelKoppelingContext }) {
  return (
    <div className="flex items-start gap-2.5 rounded-kaart border border-lijn bg-kaart p-2.5">
      <span aria-hidden="true" className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", STATUSVLAK[koppeling.status])} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body text-inkt">{koppeling.themaNaam}</p>
        <p className="text-meta text-inkt-zacht">
          {[
            t(`herkomst.${koppeling.herkomst}`),
            koppeling.onderdeel,
            koppeling.klasNaam ? t("doel.koppelingKlas", { klas: koppeling.klasNaam }) : null,
            t(`status.${koppeling.status}`),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </div>
  );
}
