import { useMemo, useState } from "react";
import { TopBar } from "../../components/TopBar";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { FoutState } from "../../components/ui/EmptyState";
import { Field, Select } from "../../components/ui/Field";
import { DoelsoortBadge } from "../../components/ui/Badge";
import { DekkingStaaf, VerticaalStaafdiagram } from "../../components/ui/Charts";
import {
  useDekking,
  useDekkingVoorKlassen,
  useJaarplannenVoorKlassen,
  useKlassen,
  useLeerplandoelenBatch,
  useThemas,
} from "../../lib/queries";
import type { ActiviteitWeergave, Doelsoort, KlasWeergave, LeerplandoelDekking, SubthemaWeergave, ThemaWeergave } from "../../lib/types";
import { DOELSOORT_LABEL } from "../../lib/types";

/** "Heel het curriculum" (alle klassen samen) of één specifieke klas — het bereik waarbinnen deze
 * pagina alles hieronder — de doelenlijst, de grafieken — filtert. */
type PaginaBereik = "alle" | string;

const MAAND_KORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function DekkingPage() {
  const { data: klassen } = useKlassen();
  const [bereik, setBereik] = useState<PaginaBereik>("alle");
  const [alleenNietGedekt, setAlleenNietGedekt] = useState(false);
  const [doelsoortFilter, setDoelsoortFilter] = useState<Doelsoort | "">("");

  const alleKlasIds = useMemo(() => klassen?.map((k) => k.id) ?? [], [klassen]);
  const scopeKlasIds = useMemo(() => (bereik === "alle" ? alleKlasIds : [bereik]), [bereik, alleKlasIds]);
  const gekozenKlasId = bereik === "alle" ? undefined : bereik;

  // "Heel het curriculum" telt school-breed (elke klas bevraagd met bereik=HeelCurriculum, hieronder
  // samengevoegd). Eén specifieke klas gebruikt net als de rest van de app EigenJaarFase — anders zou
  // een K1-klas leerplandoelen van L6 als "niet gedekt" te zien krijgen, wat "niet gedekt" waardeloos
  // maakt (zie Dekkingsbereik.cs: EigenJaarFase is de default net om dat te vermijden).
  const { perKlas: dekkingPerKlas, isLoading: dekkingLaadt } = useDekkingVoorKlassen(alleKlasIds, "HeelCurriculum");
  const { data: eigenKlasDekking, isLoading: eigenKlasLaadt } = useDekking(gekozenKlasId, "EigenJaarFase");
  const { perKlas: jaarplannen, isLoading: jaarplannenLaden } = useJaarplannenVoorKlassen(alleKlasIds);
  const { data: themas, isLoading: themasLaden } = useThemas();

  const basisDoelen: LeerplandoelDekking[] = useMemo(() => {
    if (gekozenKlasId) return eigenKlasDekking?.doelen ?? [];
    for (const klasId of scopeKlasIds) {
      const d = dekkingPerKlas[klasId];
      if (d) return d.doelen;
    }
    return [];
  }, [gekozenKlasId, eigenKlasDekking, dekkingPerKlas, scopeKlasIds]);

  const codes = useMemo(() => basisDoelen.map((d) => d.code), [basisDoelen]);
  const { perCode: disciplineInfo, isLoading: disciplineLaadt } = useLeerplandoelenBatch(codes);

  // Een doel telt in dit bereik als "gedekt" zodra minstens één klas binnen het bereik het dekt —
  // "Heel het curriculum" toont dus of een doel ergens in de school gedekt is, niet een simpele som
  // (die dubbel zou tellen zodra meerdere klassen hetzelfde schoolbrede themadoel delen). Bij een
  // specifieke klas is er maar één bron: die klas' eigen (EigenJaarFase) dekking.
  const gedekteCodesInBereik = useMemo(() => {
    const codes = new Set<string>();
    if (gekozenKlasId) {
      eigenKlasDekking?.doelen.forEach((d) => {
        if (d.isGedekt) codes.add(d.code);
      });
      return codes;
    }
    scopeKlasIds.forEach((klasId) => {
      dekkingPerKlas[klasId]?.doelen.forEach((d) => {
        if (d.isGedekt) codes.add(d.code);
      });
    });
    return codes;
  }, [gekozenKlasId, eigenKlasDekking, dekkingPerKlas, scopeKlasIds]);

  const zichtbareDoelen = useMemo(() => {
    return basisDoelen
      .map((d) => ({ ...d, isGedekt: gedekteCodesInBereik.has(d.code) }))
      .filter((d) => {
        if (alleenNietGedekt && d.isGedekt) return false;
        if (doelsoortFilter && d.doelsoort !== doelsoortFilter) return false;
        return true;
      });
  }, [basisDoelen, gedekteCodesInBereik, alleenNietGedekt, doelsoortFilter]);

  const gegroepeerd = useMemo(() => groepeerPerDiscipline(zichtbareDoelen, disciplineInfo), [zichtbareDoelen, disciplineInfo]);

  const perKlasStaven = useMemo(
    () => berekenDekkingPerSubthema(klassen ?? [], themas ?? [], scopeKlasIds),
    [klassen, themas, scopeKlasIds],
  );

  const permaandData = useMemo(
    () => berekenDekkingPerMaand(themas ?? [], jaarplannen, scopeKlasIds),
    [themas, jaarplannen, scopeKlasIds],
  );

  const isLoading = (gekozenKlasId ? eigenKlasLaadt : dekkingLaadt) || jaarplannenLaden || themasLaden || disciplineLaadt;

  return (
    <div>
      <TopBar title="Dekking" />
      <div className="px-4 pb-6">
        <Field label="Bereik" className="mb-3">
          <Select value={bereik} onChange={(e) => setBereik(e.target.value)}>
            <option value="alle">Heel het curriculum</option>
            {klassen?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.naam}
              </option>
            ))}
          </Select>
        </Field>

        {isLoading && <Spinner label="Dekking berekenen…" />}
        {!isLoading && basisDoelen.length === 0 && <FoutState titel="Kon dekking niet laden" />}

        {!isLoading && basisDoelen.length > 0 && (
          <>
            <Card className="mb-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-zwak">
                {bereik === "alle" ? "Gedekt vs. niet gedekt — heel het curriculum" : "Gedekt vs. niet gedekt — deze klas"}
              </p>
              <DekkingStaaf
                label={bereik === "alle" ? "Alle klassen" : (klassen?.find((k) => k.id === bereik)?.naam ?? "")}
                gedekt={gedekteCodesInBereik.size}
                totaal={basisDoelen.length}
              />
            </Card>

            {perKlasStaven.length > 0 && (
              <Card className="mb-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-zwak">Dekking per klas via subthema</p>
                <p className="mb-3 text-xs text-ink-zwak">
                  Van de subdoelen die voor die klas uit de themadoelen zijn afgeleid: hoeveel zijn al gedekt door
                  een activiteit in een subthema van die klas.
                </p>
                <div className="flex flex-col gap-3">
                  {perKlasStaven.map((s) => (
                    <DekkingStaaf key={s.klasId} label={s.klasNaam} gedekt={s.gedekt} totaal={s.totaal} klein />
                  ))}
                </div>
              </Card>
            )}

            {permaandData.maanden.length > 0 && (
              <Card className="mb-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-zwak">Doelen gedekt per maand via activiteiten</p>
                <p className="mb-3 text-xs text-ink-zwak">
                  Op basis van de startmaand van elk subthema — een subthema dat over meerdere maanden loopt,
                  telt mee in zijn startmaand.
                </p>
                <VerticaalStaafdiagram data={permaandData.maanden} maxWaarde={permaandData.max} />
              </Card>
            )}

            <div className="mb-3 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-ink-zacht">
                <input
                  type="checkbox"
                  checked={alleenNietGedekt}
                  onChange={(e) => setAlleenNietGedekt(e.target.checked)}
                  className="h-4 w-4 accent-terra"
                />
                Alleen niet-gedekte tonen
              </label>
              <select
                value={doelsoortFilter}
                onChange={(e) => setDoelsoortFilter(e.target.value as Doelsoort | "")}
                className="h-9 rounded-lg border border-rand bg-surface px-2 text-xs text-ink"
              >
                <option value="">Alle doelsoorten</option>
                {(Object.keys(DOELSOORT_LABEL) as Doelsoort[]).map((d) => (
                  <option key={d} value={d}>
                    {DOELSOORT_LABEL[d]}
                  </option>
                ))}
              </select>
            </div>

            <DisciplineBoom groepen={gegroepeerd} />

            {zichtbareDoelen.length === 0 && (
              <p className="py-6 text-center text-sm text-ink-zwak">
                Geen doelen voor deze filters — probeer "Alleen niet-gedekte" uit te vinken.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// --- Discipline > domein > subdomein boom ---

type DoelMetDiscipline = LeerplandoelDekking & { disciplineNaam: string };

interface SubdomeinGroep {
  subdomein: string;
  doelen: DoelMetDiscipline[];
}
interface DomeinGroep {
  domein: string;
  subdomeinen: SubdomeinGroep[];
  aantal: number;
  aantalGedekt: number;
}
interface DisciplineGroep {
  naam: string;
  domeinen: DomeinGroep[];
  aantal: number;
  aantalGedekt: number;
}

function groepeerPerDiscipline(
  doelen: LeerplandoelDekking[],
  disciplineInfo: Record<string, { disciplineNaam: string | null } | undefined>,
): DisciplineGroep[] {
  const perDiscipline = new Map<string, Map<string, Map<string, DoelMetDiscipline[]>>>();
  doelen.forEach((d) => {
    const disciplineNaam = disciplineInfo[d.code]?.disciplineNaam ?? "Onbekende discipline";
    const perDomein = perDiscipline.get(disciplineNaam) ?? new Map();
    perDiscipline.set(disciplineNaam, perDomein);
    const perSubdomein = perDomein.get(d.domein) ?? new Map();
    perDomein.set(d.domein, perSubdomein);
    const lijst = perSubdomein.get(d.subdomein) ?? [];
    lijst.push({ ...d, disciplineNaam });
    perSubdomein.set(d.subdomein, lijst);
  });

  return Array.from(perDiscipline.entries())
    .map(([naam, perDomein]) => {
      const domeinen: DomeinGroep[] = Array.from(perDomein.entries())
        .map(([domein, perSubdomein]) => {
          const subdomeinen: SubdomeinGroep[] = Array.from(perSubdomein.entries())
            .map(([subdomein, lijst]) => ({ subdomein, doelen: lijst }))
            .sort((a, b) => a.subdomein.localeCompare(b.subdomein));
          const alleDoelen = subdomeinen.flatMap((s) => s.doelen);
          return { domein, subdomeinen, aantal: alleDoelen.length, aantalGedekt: alleDoelen.filter((d) => d.isGedekt).length };
        })
        .sort((a, b) => a.domein.localeCompare(b.domein));
      const alleDoelen = domeinen.flatMap((d) => d.subdomeinen.flatMap((s) => s.doelen));
      return { naam, domeinen, aantal: alleDoelen.length, aantalGedekt: alleDoelen.filter((d) => d.isGedekt).length };
    })
    .sort((a, b) => a.naam.localeCompare(b.naam));
}

function DisciplineBoom({ groepen }: { groepen: DisciplineGroep[] }) {
  const [open, setOpen] = useState<string | null>(groepen[0]?.naam ?? null);
  return (
    <div className="flex flex-col gap-2">
      {groepen.map((discipline) => (
        <div key={discipline.naam} className="overflow-hidden rounded-2xl border border-rand bg-surface">
          <button
            onClick={() => setOpen((o) => (o === discipline.naam ? null : discipline.naam))}
            className="flex w-full items-center justify-between gap-2 p-3 text-left"
          >
            <span className="font-bold text-ink">{discipline.naam}</span>
            <span className="text-xs font-semibold text-ink-zwak">
              {discipline.aantalGedekt}/{discipline.aantal} gedekt
            </span>
          </button>
          {open === discipline.naam && (
            <div className="border-t border-rand bg-surface-verhoogd/40 px-2 pb-2 pt-1">
              {discipline.domeinen.map((domein) => (
                <DomeinBlok key={domein.domein} domein={domein} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DomeinBlok({ domein }: { domein: DomeinGroep }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-rand bg-surface">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-2 p-2.5 text-left">
        <span className="text-sm font-bold text-ink">{domein.domein}</span>
        <span className="text-[11px] font-semibold text-ink-zwak">
          {domein.aantalGedekt}/{domein.aantal}
        </span>
      </button>
      {open && (
        <div className="border-t border-rand px-2 pb-2 pt-1">
          {domein.subdomeinen.map((subdomein) => (
            <div key={subdomein.subdomein} className="mt-1.5">
              <p className="px-1 text-xs font-semibold text-ink-zacht">{subdomein.subdomein}</p>
              <div className="mt-1 flex flex-col gap-1.5">
                {subdomein.doelen.map((doel) => (
                  <Card key={doel.code} className={doel.isGedekt ? "p-2.5" : "border-suggestie-geweigerd/30 p-2.5"}>
                    <div className="flex items-start gap-2">
                      <DoelsoortBadge doelsoort={doel.doelsoort} />
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-[11px] font-semibold text-ink-zacht">{doel.code}</p>
                        <p className="text-sm text-ink">{doel.tekst}</p>
                        {doel.isGedekt ? (
                          <p className="mt-1 text-xs font-semibold text-dekking-gedekt-foreground">
                            ✓ gedekt door: {doel.dekkendeThemas.join(", ")}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs font-semibold text-suggestie-geweigerd">Nog niet gedekt</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Per-klas dekking via subthema-activiteiten ---

function berekenDekkingPerSubthema(klassen: KlasWeergave[], themas: ThemaWeergave[], scopeKlasIds: string[]) {
  const scope = new Set(scopeKlasIds);
  const alleSubthemas = themas.flatMap((t) => t.subthemas);
  return klassen
    .filter((k) => scope.has(k.id))
    .map((klas) => {
      const subthemasVanKlas = alleSubthemas.filter((s) => s.klasId === klas.id);
      const gedekteCodes = new Set<string>();
      subthemasVanKlas.forEach((s) => {
        s.activiteiten.forEach((a: ActiviteitWeergave) => {
          a.doelkoppelingen
            .filter((d) => d.status === "Aanvaard" || d.status === "Manueel")
            .forEach((d) => gedekteCodes.add(d.leerplandoelCode));
        });
      });
      const subdoelCodes = new Set(subthemasVanKlas.flatMap((s) => s.subdoelen.map((sd) => sd.koppeling.leerplandoelCode)));
      // "Gedekt" en "totaal" moeten uit dezelfde laag komen, anders kan het percentage boven 100%
      // uitkomen (Subdoel en Activiteit zijn twee losse koppelingslagen, één dekt niet noodzakelijk een
      // deelverzameling van de andere). Tel daarom alleen de subdoelen die óók door een activiteit
      // gedekt zijn. Zolang er subdoelen bestaan, is dit dezelfde logica als de voortgangsbalk in het
      // subthema-zijpaneel; zijn er nog geen subdoelen (bv. nog niet aangemaakt), dan is er per
      // definitie niets om te "dekken" en tonen we 0%, net als het zijpaneel doet.
      const subdoelenGedekt = [...subdoelCodes].filter((c) => gedekteCodes.has(c)).length;
      const totaal = subdoelCodes.size;
      const gedekt = subdoelenGedekt;
      return { klasId: klas.id, klasNaam: klas.naam, gedekt, totaal };
    })
    .filter((s) => s.totaal > 0);
}

// --- Per-maand dekking via activiteiten (o.b.v. startmaand van het subthema) ---

function berekenDekkingPerMaand(
  themas: ThemaWeergave[],
  jaarplannen: Record<string, { plaatsingen: { themaId: string; blokStart: string; isVervallen: boolean }[] } | undefined>,
  scopeKlasIds: string[],
) {
  const scope = new Set(scopeKlasIds);
  const perMaandCodes = new Map<string, Set<string>>();

  themas.forEach((thema) => {
    thema.subthemas
      .filter((s: SubthemaWeergave) => scope.has(s.klasId))
      .forEach((subthema) => {
        const plaatsing = jaarplannen[subthema.klasId]?.plaatsingen.find(
          (p) => p.themaId === thema.id && !p.isVervallen,
        );
        if (!plaatsing) return;
        const maandKey = plaatsing.blokStart.slice(0, 7); // YYYY-MM
        const codes = perMaandCodes.get(maandKey) ?? new Set<string>();
        perMaandCodes.set(maandKey, codes);
        subthema.activiteiten.forEach((a: ActiviteitWeergave) => {
          a.doelkoppelingen
            .filter((d) => d.status === "Aanvaard" || d.status === "Manueel")
            .forEach((d) => codes.add(d.leerplandoelCode));
        });
      });
  });

  const sleutels = Array.from(perMaandCodes.keys()).sort();
  const maanden = sleutels.map((sleutel) => {
    const [, maand] = sleutel.split("-");
    return { label: MAAND_KORT[Number(maand) - 1], waarde: perMaandCodes.get(sleutel)!.size };
  });
  const max = Math.max(0, ...maanden.map((m) => m.waarde));
  return { maanden, max };
}
