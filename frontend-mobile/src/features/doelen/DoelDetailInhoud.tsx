import { useState } from "react";
import { DoelsoortBadge, StatusBadge } from "../../components/ui/Badge";
import { Spinner } from "../../components/ui/Spinner";
import { FoutState } from "../../components/ui/EmptyState";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { IconSparkle } from "../../components/Icons";
import { useGenereerDoelsuggesties, useKoppelDoelAanThemas, useLeerplandoelDetail, useThemas, useWijzigSuggestieStatus } from "../../lib/queries";
import { DOELSOORT_LABEL } from "../../lib/types";

const HERKOMST_LABEL: Record<string, string> = {
  Themadoel: "Themadoel (schoolbreed anker)",
  Doelsuggestie: "AI-doelsuggestie op thema",
  Subdoel: "Subdoel (klasgebonden)",
  Activiteit: "Activiteit (klasgebonden)",
};

/**
 * The doel-detail content, shared between the standalone route (`DoelDetailPage`, full page, deep-linkable)
 * and `DoelDetailPanel` (a SidePanel opened from the Doelen-hiërarchie). `onNavigeerNaarDoel` lets the two
 * hosts decide what "open a gerelateerd doel" means: a router navigation on the page, or an in-place state
 * swap for drill-down within the panel.
 */
export function DoelDetailInhoud({ code, onNavigeerNaarDoel }: { code: string; onNavigeerNaarDoel: (code: string) => void }) {
  const { data: doel, isLoading, isError } = useLeerplandoelDetail(code);
  const voorbeeldActiviteiten = (doel?.koppelingen ?? []).filter((k) => k.herkomst === "Activiteit").slice(0, 5);

  return (
    <div>
      {isLoading && <Spinner />}
      {isError && <FoutState titel="Doel niet gevonden" beschrijving={`Geen leerplandoel met code ${code}.`} />}

      {doel && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <DoelsoortBadge doelsoort={doel.doelsoort} />
            <span className="text-xs font-semibold text-ink-zwak">{DOELSOORT_LABEL[doel.doelsoort]}</span>
          </div>
          <h1 className="mb-1 font-mono text-lg font-extrabold text-ink">{doel.code}</h1>
          <p className="mb-3 text-sm text-ink-zwak">
            {doel.jaarFase} · {doel.disciplineNaam ?? doel.disciplineNummer} · {doel.domein} · {doel.subdomein}
            {doel.cluster && <> · {doel.cluster}</>}
          </p>

          <Card className="mb-3">
            <p className="text-base leading-relaxed text-ink">{doel.tekst}</p>
          </Card>

          {doel.nietMeerInOpstap && (
            <Card className="mb-3 border-suggestie-geweigerd/40 bg-suggestie-geweigerd/10">
              <p className="text-sm font-semibold text-suggestie-geweigerd">
                ⚠️ Niet meer in Op.stap, maar nog in gebruik in schoolinhoud hieronder.
              </p>
            </Card>
          )}

          {doel.minimumdoelRef && (
            <Card className="mb-3 border-doelsoort-md/30 bg-doelsoort-md/5">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-doelsoort-md">Minimumdoel</p>
              {doel.minimumdoel ? (
                <>
                  <p className="text-sm font-semibold text-ink">
                    {doel.minimumdoel.leeftijd}-{doel.minimumdoel.nr} · {doel.minimumdoelRef}
                  </p>
                  <p className="mt-1 text-sm text-ink-zacht">{doel.minimumdoel.omschrijving}</p>
                </>
              ) : (
                <p className="text-sm text-ink-zacht">
                  Gekoppeld aan minimumdoel <span className="font-mono">{doel.minimumdoelRef}</span>, maar de
                  officiële omschrijving is nog niet geladen.
                </p>
              )}
            </Card>
          )}

          {(doel.voorbeelden || doel.toelichting || doel.woordenschat) && (
            <Card className="mb-3 flex flex-col gap-3">
              {doel.voorbeelden && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-zwak">Voorbeelden</p>
                  <p className="mt-0.5 text-sm text-ink-zacht">{doel.voorbeelden}</p>
                </div>
              )}
              {doel.toelichting && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-zwak">Toelichting</p>
                  <p className="mt-0.5 text-sm text-ink-zacht">{doel.toelichting}</p>
                </div>
              )}
              {doel.woordenschat && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-zwak">Woordenschat</p>
                  <p className="mt-0.5 text-sm text-ink-zacht">{doel.woordenschat}</p>
                </div>
              )}
            </Card>
          )}

          <KoppelAanThemaSectie code={doel.code} alGekoppeldeThemaNamen={doel.koppelingen.map((k) => k.themaNaam)} />

          <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-ink-zwak">
            Waar dit doel gebruikt wordt ({doel.koppelingen.length})
          </h2>
          {doel.koppelingen.length === 0 ? (
            <p className="text-sm text-ink-zwak">Nog nergens aan een thema, subthema of activiteit gekoppeld.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {doel.koppelingen.map((k, i) => (
                <li key={i}>
                  <Card className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{k.themaNaam}</p>
                      <p className="truncate text-xs text-ink-zwak">
                        {HERKOMST_LABEL[k.herkomst] ?? k.herkomst}
                        {k.onderdeel && <> · {k.onderdeel}</>}
                        {k.klasNaam && <> · {k.klasNaam}</>}
                      </p>
                    </div>
                    <StatusBadge status={k.status} />
                  </Card>
                </li>
              ))}
            </ul>
          )}

          {voorbeeldActiviteiten.length > 0 && (
            <>
              <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-ink-zwak">
                Voorbeeldactiviteiten ({voorbeeldActiviteiten.length})
              </h2>
              <p className="mb-2 text-xs text-ink-zwak">
                Bestaande activiteiten die dit doel al koppelen — geen AI-suggestie, echte schoolinhoud.
              </p>
              <ul className="flex flex-col gap-2">
                {voorbeeldActiviteiten.map((k, i) => (
                  <li key={i}>
                    <Card className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{k.onderdeel}</p>
                        <p className="truncate text-xs text-ink-zwak">
                          {k.themaNaam}
                          {k.klasNaam && <> · {k.klasNaam}</>}
                        </p>
                      </div>
                      <StatusBadge status={k.status} />
                    </Card>
                  </li>
                ))}
              </ul>
            </>
          )}

          {doel.minimumdoelRef && doel.gerelateerdeDoelen.length > 0 && (
            <>
              <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wide text-ink-zwak">
                Gerelateerde leerplandoelen ({doel.gerelateerdeDoelen.length})
              </h2>
              <p className="mb-2 text-xs text-ink-zwak">
                Deze leerplandoelen zijn gekoppeld aan hetzelfde minimumdoel {doel.minimumdoelRef}.
              </p>
              <ul className="flex flex-col gap-2">
                {doel.gerelateerdeDoelen.map((g) => (
                  <li key={g.code}>
                    <button type="button" onClick={() => onNavigeerNaarDoel(g.code)} className="block w-full text-left">
                      <Card className="active:bg-terra-zacht">
                        <p className="font-mono text-xs font-bold text-ink-zwak">{g.code}</p>
                        <p className="mt-0.5 text-sm text-ink">{g.tekst}</p>
                        <p className="mt-1 text-xs text-ink-zwak">
                          {g.jaarFase} · {g.domein} · {g.subdomein}
                        </p>
                      </Card>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** "Koppel dit doel aan een thema": manueel (multi-select) of AI-voorstel op een gekozen thema. */
function KoppelAanThemaSectie({ code, alGekoppeldeThemaNamen }: { code: string; alGekoppeldeThemaNamen: string[] }) {
  const { data: themas } = useThemas();
  const [modus, setModus] = useState<"manueel" | "ai" | null>(null);
  const [gekozenIds, setGekozenIds] = useState<string[]>([]);
  const [aiThemaId, setAiThemaId] = useState<string>("");
  const koppel = useKoppelDoelAanThemas();
  const genereer = useGenereerDoelsuggesties(aiThemaId);
  const wijzigStatus = useWijzigSuggestieStatus(aiThemaId);

  const beschikbareThemas = (themas ?? []).filter((t) => !alGekoppeldeThemaNamen.includes(t.naam));
  const suggestiesVoorDitDoel = genereer.data?.isGeslaagd
    ? genereer.data.bewaard.filter((s) => s.leerplandoelCode === code)
    : [];

  return (
    <Card className="mb-3 border-terra/30 bg-terra-zacht/20">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-terra-diep">Koppelen aan een thema</p>
      {!modus && (
        <div className="flex gap-2">
          <Button variant="secundair" size="klein" className="flex-1" onClick={() => setModus("manueel")}>
            Manueel
          </Button>
          <Button size="klein" className="flex-1" onClick={() => setModus("ai")}>
            <IconSparkle className="h-3.5 w-3.5" /> AI voorstellen
          </Button>
        </div>
      )}

      {modus === "manueel" && (
        <div>
          {beschikbareThemas.length === 0 && <p className="text-sm text-ink-zwak">Al aan elk bestaand thema gekoppeld.</p>}
          <ul className="mb-2 flex flex-col gap-1.5">
            {beschikbareThemas.map((t) => (
              <label key={t.id} className="flex items-center gap-2 rounded-xl border border-rand bg-surface p-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={gekozenIds.includes(t.id)}
                  onChange={(e) =>
                    setGekozenIds((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id)))
                  }
                />
                {t.naam}
              </label>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="geest" size="klein" onClick={() => setModus(null)}>
              Annuleer
            </Button>
            <Button
              size="klein"
              className="flex-1"
              disabled={gekozenIds.length === 0 || koppel.isPending}
              onClick={() =>
                koppel.mutate(
                  { themaIds: gekozenIds, leerplandoelCode: code },
                  { onSuccess: () => { setModus(null); setGekozenIds([]); } },
                )
              }
            >
              {koppel.isPending ? "Bezig…" : `Koppel aan ${gekozenIds.length || ""} thema${gekozenIds.length === 1 ? "" : "'s"}`}
            </Button>
          </div>
        </div>
      )}

      {modus === "ai" && (
        <div>
          <p className="mb-2 text-xs text-ink-zwak">
            Kies een thema. De AI doorzoekt de doelen die daarvoor in aanmerking komen en dit doel wordt getoond
            als het erin voorkomt.
          </p>
          <select
            value={aiThemaId}
            onChange={(e) => setAiThemaId(e.target.value)}
            className="mb-2 w-full rounded-xl border border-rand bg-surface px-3 py-2.5 text-sm text-ink"
          >
            <option value="">Kies een thema…</option>
            {(themas ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.naam}
              </option>
            ))}
          </select>
          <div className="mb-2 flex gap-2">
            <Button variant="geest" size="klein" onClick={() => setModus(null)}>
              Annuleer
            </Button>
            <Button size="klein" className="flex-1" disabled={!aiThemaId || genereer.isPending} onClick={() => genereer.mutate(undefined)}>
              {genereer.isPending ? "AI denkt na…" : "Genereer suggesties"}
            </Button>
          </div>
          {genereer.isError && (
            <p className="rounded-xl bg-suggestie-geweigerd/10 p-2.5 text-xs text-suggestie-geweigerd">
              Kon geen suggesties ophalen. Is de AI geconfigureerd op de backend?
            </p>
          )}
          {genereer.data && !genereer.data.isGeslaagd && (
            <p className="rounded-xl bg-suggestie-geweigerd/10 p-2.5 text-xs text-suggestie-geweigerd">
              De AI gaf geen bruikbaar antwoord. Probeer opnieuw.
            </p>
          )}
          {genereer.data?.isGeslaagd && (
            <>
              {suggestiesVoorDitDoel.length === 0 && (
                <p className="text-xs text-ink-zwak">De AI stelde dit doel niet voor bij dit thema.</p>
              )}
              {suggestiesVoorDitDoel.map((s) => (
                <div key={s.id} className="rounded-xl border border-rand bg-surface p-2.5">
                  {s.aiMotivatie && <p className="text-xs italic text-ink-zacht">"{s.aiMotivatie}"</p>}
                  <Button
                    size="klein"
                    className="mt-1.5"
                    disabled={wijzigStatus.isPending}
                    onClick={() => wijzigStatus.mutate({ suggestieId: s.id, status: "Aanvaard" })}
                  >
                    Aanvaarden
                  </Button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </Card>
  );
}
