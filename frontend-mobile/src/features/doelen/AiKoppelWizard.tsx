import { useState } from "react";
import { Sheet } from "../../components/ui/Sheet";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";
import { post, put } from "../../lib/api";
import { useOngekoppeldeDoelen, useThemas, useMaakThema, themasKeys } from "../../lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import type { DoelMatchResultaat, DoelMatchSuggestieWeergave, OngekoppeldDoelWeergave } from "../../lib/types";

type Kandidaat = { suggestieId: string; themaId: string; themaNaam: string; leerplandoelCode: string; motivatie: string | null };

/**
 * The doelen-page's global "AI doelen laten koppelen aan thema's" — a two-step, always-teacher-
 * validated wizard, never an auto-apply (Art. IV.1: AI is advisory). Step 1 runs the existing
 * per-thema AI matcher against every thema and lets the teacher pick which matches to accept
 * (never re-links an already-linked doel — the backend itself skips duplicates). Step 2 covers the
 * doelen no thema claims at all: there is no backend "invent a new thema" AI capability, so this is
 * explicitly a client-side, non-AI heuristic (grouped by domein) — labelled as such rather than
 * dressed up as AI, per the constitution's ban on fabricated AI content.
 */
export function AiKoppelWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [stap, setStap] = useState<1 | 2>(1);
  const { data: themas } = useThemas();
  const qc = useQueryClient();

  const [bezigStap1, setBezigStap1] = useState(false);
  const [kandidaten, setKandidaten] = useState<Kandidaat[]>([]);
  const [geselecteerd, setGeselecteerd] = useState<Set<string>>(new Set());
  const [fouten, setFouten] = useState<string[]>([]);
  const [koppelBezig, setKoppelBezig] = useState(false);
  const [uitgevoerd1, setUitgevoerd1] = useState(false);

  const { data: ongekoppeld, isLoading: ongekoppeldLaadt } = useOngekoppeldeDoelen({ enabled: stap === 2 });
  const maakThema = useMaakThema();
  const [geselecteerdeGroepen, setGeselecteerdeGroepen] = useState<Set<string>>(new Set());
  const [stap2Bezig, setStap2Bezig] = useState(false);
  const [stap2Klaar, setStap2Klaar] = useState<string | null>(null);

  async function startStap1() {
    if (!themas || themas.length === 0) return;
    setBezigStap1(true);
    setFouten([]);
    const gevonden: Kandidaat[] = [];
    const nieuweFouten: string[] = [];
    for (const thema of themas) {
      try {
        const resultaat = await post<DoelMatchResultaat>(`/api/themas/${thema.id}/doelsuggesties/genereer`, {});
        if (!resultaat.isGeslaagd) {
          nieuweFouten.push(`${thema.naam}: ${resultaat.fout ?? "AI-matching mislukt"}`);
          continue;
        }
        resultaat.bewaard.forEach((s: DoelMatchSuggestieWeergave) => {
          if (s.status === "Voorgesteld") {
            gevonden.push({
              suggestieId: s.id,
              themaId: thema.id,
              themaNaam: thema.naam,
              leerplandoelCode: s.leerplandoelCode,
              motivatie: s.aiMotivatie,
            });
          }
        });
      } catch {
        nieuweFouten.push(`${thema.naam}: kon geen suggesties ophalen. Is de AI geconfigureerd?`);
      }
    }
    setKandidaten(gevonden);
    setGeselecteerd(new Set(gevonden.map((k) => k.suggestieId)));
    setFouten(nieuweFouten);
    setBezigStap1(false);
    setUitgevoerd1(true);
  }

  function toggel(id: string) {
    setGeselecteerd((huidig) => {
      const nieuw = new Set(huidig);
      if (nieuw.has(id)) nieuw.delete(id);
      else nieuw.add(id);
      return nieuw;
    });
  }

  async function koppelGeselecteerde() {
    setKoppelBezig(true);
    const teKoppelen = kandidaten.filter((k) => geselecteerd.has(k.suggestieId));
    await Promise.all(
      teKoppelen.map((k) => put(`/api/themas/${k.themaId}/doelsuggesties/${k.suggestieId}/status`, { status: "Aanvaard" })),
    );
    const themaIds = new Set(teKoppelen.map((k) => k.themaId));
    themaIds.forEach((id) => qc.invalidateQueries({ queryKey: themasKeys.detail(id) }));
    qc.invalidateQueries({ queryKey: ["leerplandoelen-ongekoppeld"] });
    setKoppelBezig(false);
    setStap(2);
  }

  const groepen = groepeerPerDomein(ongekoppeld ?? []);

  function toggelGroep(domein: string) {
    setGeselecteerdeGroepen((huidig) => {
      const nieuw = new Set(huidig);
      if (nieuw.has(domein)) nieuw.delete(domein);
      else nieuw.add(domein);
      return nieuw;
    });
  }

  async function maakNieuweThemas() {
    setStap2Bezig(true);
    const teMaken = groepen.filter((g) => geselecteerdeGroepen.has(g.domein));
    for (const groep of teMaken) {
      const nieuwThema = await maakThema.mutateAsync({ naam: groep.domein, duurWeken: 4 });
      await Promise.all(groep.doelen.map((d) => post(`/api/themas/${nieuwThema.id}/themadoelen`, { leerplandoelCode: d.code })));
    }
    qc.invalidateQueries({ queryKey: ["leerplandoelen-ongekoppeld"] });
    setStap2Bezig(false);
    setStap2Klaar(`${teMaken.length} nieuw(e) thema('s) aangemaakt.`);
  }

  function sluitEnReset() {
    setStap(1);
    setKandidaten([]);
    setUitgevoerd1(false);
    setFouten([]);
    setGeselecteerdeGroepen(new Set());
    setStap2Klaar(null);
    onClose();
  }

  return (
    <Sheet open={open} onClose={sluitEnReset} title="AI doelen koppelen aan thema's">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-zwak">
        <StapBolletje actief={stap === 1} nummer={1} label="Bestaande thema's" />
        <span className="h-px flex-1 bg-rand" />
        <StapBolletje actief={stap === 2} nummer={2} label="Nieuwe thema's" />
      </div>

      {stap === 1 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-zacht">
            De AI overloopt elk bestaand thema en stelt koppelingen voor met doelen die er nog niet aan hangen. Reeds
            gekoppelde doelen worden nooit herkoppeld. Kies hieronder welke voorstellen je aanvaardt.
          </p>
          {!uitgevoerd1 && (
            <Button onClick={startStap1} disabled={bezigStap1 || !themas || themas.length === 0}>
              {bezigStap1 ? "Bezig met overlopen van thema's…" : "Start AI-analyse"}
            </Button>
          )}
          {bezigStap1 && <Spinner label={`Thema's worden overlopen…`} />}
          {fouten.length > 0 && (
            <div className="rounded-xl border border-doelsoort-a bg-doelsoort-a/10 p-3 text-xs text-ink-zacht">
              {fouten.map((f) => (
                <p key={f}>⚠️ {f}</p>
              ))}
            </div>
          )}
          {uitgevoerd1 && kandidaten.length === 0 && !bezigStap1 && (
            <p className="rounded-xl border border-rand bg-surface-verhoogd p-3 text-sm text-ink-zacht">
              Geen nieuwe voorstellen gevonden.
            </p>
          )}
          {kandidaten.length > 0 && (
            <div className="flex flex-col gap-2">
              {kandidaten.map((k) => (
                <label
                  key={k.suggestieId}
                  className="flex items-start gap-2.5 rounded-xl border border-rand bg-surface p-2.5"
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={geselecteerd.has(k.suggestieId)}
                    onChange={() => toggel(k.suggestieId)}
                  />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-ink">
                      {k.leerplandoelCode} → <span className="text-terra">{k.themaNaam}</span>
                    </p>
                    {k.motivatie && <p className="mt-0.5 text-xs text-ink-zwak">{k.motivatie}</p>}
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="mt-1 flex gap-2">
            {kandidaten.length > 0 && (
              <Button onClick={koppelGeselecteerde} disabled={koppelBezig || geselecteerd.size === 0}>
                {koppelBezig ? "Bezig met koppelen…" : `Koppel ${geselecteerd.size} geselecteerde doel(en)`}
              </Button>
            )}
            <Button variant="geest" onClick={() => setStap(2)}>
              Volgende stap →
            </Button>
          </div>
        </div>
      )}

      {stap === 2 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-zacht">
            Er bestaat geen AI die zelf nieuwe thema's bedenkt — onderstaand voorstel is een eenvoudige, niet-AI
            groepering van doelen die aan geen enkel thema hangen, per domein. Vink aan welke groepen je als nieuw
            thema wil aanmaken.
          </p>
          {ongekoppeldLaadt && <Spinner label="Ongekoppelde doelen laden…" />}
          {!ongekoppeldLaadt && groepen.length === 0 && (
            <p className="rounded-xl border border-rand bg-surface-verhoogd p-3 text-sm text-ink-zacht">
              Alle doelen zijn al aan een thema gekoppeld. 🎉
            </p>
          )}
          {groepen.map((groep) => (
            <label
              key={groep.domein}
              className="flex items-start gap-2.5 rounded-xl border border-rand bg-surface p-2.5"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={geselecteerdeGroepen.has(groep.domein)}
                onChange={() => toggelGroep(groep.domein)}
              />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold text-ink">
                  Nieuw thema "{groep.domein}" <span className="font-normal text-ink-zwak">({groep.doelen.length} doelen)</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-zwak">{groep.doelen.map((d) => d.code).join(", ")}</p>
              </div>
            </label>
          ))}
          {stap2Klaar && (
            <p className="rounded-xl border border-doelsoort-g bg-doelsoort-g/10 p-3 text-sm text-ink">{stap2Klaar}</p>
          )}
          <div className="mt-1 flex gap-2">
            {groepen.length > 0 && !stap2Klaar && (
              <Button onClick={maakNieuweThemas} disabled={stap2Bezig || geselecteerdeGroepen.size === 0}>
                {stap2Bezig ? "Bezig met aanmaken…" : `Maak ${geselecteerdeGroepen.size} thema('s) aan`}
              </Button>
            )}
            <Button variant="geest" onClick={sluitEnReset}>
              {stap2Klaar ? "Sluiten" : "Overslaan en sluiten"}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function groepeerPerDomein(doelen: OngekoppeldDoelWeergave[]): { domein: string; doelen: OngekoppeldDoelWeergave[] }[] {
  const groepen = new Map<string, OngekoppeldDoelWeergave[]>();
  for (const doel of doelen) {
    const lijst = groepen.get(doel.domein) ?? [];
    lijst.push(doel);
    groepen.set(doel.domein, lijst);
  }
  return Array.from(groepen.entries()).map(([domein, lijst]) => ({ domein, doelen: lijst }));
}

function StapBolletje({ actief, nummer, label }: { actief: boolean; nummer: number; label: string }) {
  return (
    <span className={`flex items-center gap-1.5 ${actief ? "text-terra" : ""}`}>
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${actief ? "bg-terra text-white" : "bg-surface-verhoogd"}`}
      >
        {nummer}
      </span>
      {label}
    </span>
  );
}
