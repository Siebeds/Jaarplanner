import { useEffect, useState } from "react";
import { SidePanel } from "../../components/ui/SidePanel";
import { Sheet } from "../../components/ui/Sheet";
import { Button } from "../../components/ui/Button";
import { Field, Select, TextArea, TextInput } from "../../components/ui/Field";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconPencil, IconPlus, IconSparkle } from "../../components/Icons";
import { post, del } from "../../lib/api";
import {
  themasKeys,
  useKoppelActiviteitAanOnderzoeksvraag,
  useKoppelSubthemaAanDoel,
  useLeerplandoelenBatch,
  useMaakActiviteit,
  useMaakSubthema,
  useSubdoelSuggesties,
  useVerwijderOnderzoeksvraag,
  useVoegOnderzoeksvraagToe,
  useWijzigActiviteit,
  useWijzigOnderzoeksvraag,
  useWijzigSubthema,
} from "../../lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import type { ActiviteitType, ActiviteitWeergave, KlasWeergave, SubthemaWeergave, ThemaWeergave } from "../../lib/types";
import { ACTIVITEIT_TYPE_LABEL } from "../../lib/types";

const ACTIVITEIT_TYPES = Object.keys(ACTIVITEIT_TYPE_LABEL) as ActiviteitType[];

/** Case-insensitive match between a leerplandoel's jaarFase and a subthema's (freeform) leeftijd. */
function komtLeeftijdOvereen(jaarFase: string, leeftijd: string): boolean {
  return jaarFase.trim().toLowerCase() === leeftijd.trim().toLowerCase();
}

/**
 * The subthema sidepanel: opens when a teacher creates or opens a subthema. Shows/edits the title,
 * shows the subdoelen — derived automatically from the thema's own themadoelen filtered to this
 * subthema's leeftijd, no manual add/AI here (that happens once, at thema level) — and lists the
 * activiteiten with a coverage progress bar.
 */
export function SubthemaPanel({
  open,
  onClose,
  thema,
  klas,
  subthema,
  onAangemaakt,
}: {
  open: boolean;
  onClose: () => void;
  thema: ThemaWeergave;
  klas: KlasWeergave | null;
  subthema: SubthemaWeergave | undefined;
  onAangemaakt: (subthemaId: string) => void;
}) {
  const maakSubthema = useMaakSubthema(thema.id);

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={subthema ? subthema.naam : `Nieuw subthema${klas ? ` — ${klas.naam}` : ""}`}
      voetnoot={null}
    >
      {!subthema && klas && (
        <SubthemaAanmaakForm
          klas={klas}
          bezig={maakSubthema.isPending}
          onOpslaan={({ naam, duurWeken, leeftijd, onderzoeksvraag, probleemstelling }) =>
            maakSubthema.mutate(
              {
                naam,
                duurWeken,
                leeftijd,
                klasId: klas.id,
                onderzoeksvragen: onderzoeksvraag ? [{ vraag: onderzoeksvraag, probleemstelling }] : [],
              },
              { onSuccess: (nieuw) => onAangemaakt(nieuw.id) },
            )
          }
        />
      )}
      {subthema && <SubthemaEditor thema={thema} subthema={subthema} klas={klas} />}
    </SidePanel>
  );
}

function SubthemaAanmaakForm({
  klas,
  bezig,
  onOpslaan,
}: {
  klas: KlasWeergave;
  bezig: boolean;
  onOpslaan: (waarden: { naam: string; duurWeken: number; leeftijd: string; onderzoeksvraag?: string; probleemstelling?: string }) => void;
}) {
  const [naam, setNaam] = useState("");
  const [leeftijd, setLeeftijd] = useState("");
  const [duurWeken, setDuurWeken] = useState(2);
  const [probleemstelling, setProbleemstelling] = useState("");
  const [onderzoeksvraag, setOnderzoeksvraag] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!naam.trim() || !leeftijd.trim()) return;
        onOpslaan({
          naam: naam.trim(),
          duurWeken,
          leeftijd: leeftijd.trim(),
          probleemstelling: probleemstelling.trim() || undefined,
          onderzoeksvraag: onderzoeksvraag.trim() || undefined,
        });
      }}
    >
      <p className="mb-3 text-sm text-ink-zacht">
        Hoe vult {klas.naam} dit thema in? Bv. thema "Water" wordt hier "Onderwater" voor de derde kleuterklas.
      </p>
      <Field label="Naam van het subthema">
        <TextInput value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bv. Onderwater" required autoFocus />
      </Field>
      <Field label="Leeftijd / jaar-fase" hint="bv. K3 — moet de jaarFase-notatie van de leerplandoelen volgen om subdoelen af te leiden">
        <TextInput value={leeftijd} onChange={(e) => setLeeftijd(e.target.value)} placeholder="bv. K3" required />
      </Field>
      <Field label="Duur (in weken)">
        <TextInput type="number" min={1} max={10} value={duurWeken} onChange={(e) => setDuurWeken(Number(e.target.value))} />
      </Field>
      <Field label="Probleemstelling (optioneel)">
        <TextArea value={probleemstelling} onChange={(e) => setProbleemstelling(e.target.value)} />
      </Field>
      <Field label="Onderzoeksvraag (optioneel)">
        <TextArea value={onderzoeksvraag} onChange={(e) => setOnderzoeksvraag(e.target.value)} />
      </Field>
      <Button type="submit" className="w-full" disabled={bezig || !naam.trim() || !leeftijd.trim()}>
        {bezig ? "Bezig…" : "Subthema opslaan"}
      </Button>
    </form>
  );
}

function SubthemaEditor({ thema, subthema, klas }: { thema: ThemaWeergave; subthema: SubthemaWeergave; klas: KlasWeergave | null }) {
  const qc = useQueryClient();
  const [titelBewerken, setTitelBewerken] = useState(false);
  const [activiteitFormOpen, setActiviteitFormOpen] = useState(false);
  const [bewerkActiviteit, setBewerkActiviteit] = useState<ActiviteitWeergave | null>(null);

  const wijzigSubthema = useWijzigSubthema(subthema.id, thema.id);
  const koppelSubdoel = useKoppelSubthemaAanDoel(subthema.id, thema.id);
  const maakActiviteit = useMaakActiviteit(subthema.id, thema.id);

  const themadoelCodes = thema.themadoelen.map((t) => t.koppeling.leerplandoelCode);
  const { perCode: themadoelInfo } = useLeerplandoelenBatch(themadoelCodes);

  // Derive which of the thema's themadoelen apply to this subthema's leeftijd, and silently link any
  // that are not yet a Subdoel here — this is the "gebeurt automatisch" sync: no manual add/AI at this
  // level (Art. IX.2's Subdoel still gets a real, persisted link; the teacher just never has to ask for it).
  const passendeThemadoelCodes = thema.themadoelen
    .filter((t) => {
      const jaarFase = themadoelInfo[t.koppeling.leerplandoelCode]?.jaarFase;
      return jaarFase && komtLeeftijdOvereen(jaarFase, subthema.leeftijd);
    })
    .map((t) => t.koppeling.leerplandoelCode);
  const bestaandeSubdoelCodes = subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode);
  const ontbrekend = passendeThemadoelCodes.filter((code) => !bestaandeSubdoelCodes.includes(code));

  useEffect(() => {
    if (ontbrekend.length === 0 || koppelSubdoel.isPending) return;
    koppelSubdoel.mutate(ontbrekend[0]);
    // Only ever fire for the next missing code — each success refetches the thema and re-runs this
    // effect until nothing is left to sync, one link at a time so a slow network never double-fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ontbrekend[0], koppelSubdoel.isPending]);

  const subdoelCodes = subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode);
  const { perCode: subdoelInfo } = useLeerplandoelenBatch(subdoelCodes);

  // Alleen aanvaarde/manuele koppelingen tellen als "gedekt" — een voorgestelde (nog niet
  // beoordeelde) of geweigerde koppeling mag de dekking niet doen lijken alsof ze al vastligt.
  const gedekteCodes = new Set(
    subthema.activiteiten.flatMap((a) =>
      a.doelkoppelingen.filter((d) => d.status === "Aanvaard" || d.status === "Manueel").map((d) => d.leerplandoelCode),
    ),
  );
  const aantalGedekt = subdoelCodes.filter((c) => gedekteCodes.has(c)).length;
  const percentage = subdoelCodes.length > 0 ? Math.round((aantalGedekt / subdoelCodes.length) * 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-start justify-between gap-2">
        {titelBewerken ? (
          <TitelForm
            waarde={subthema.naam}
            bezig={wijzigSubthema.isPending}
            onOpslaan={(naam) =>
              wijzigSubthema.mutate(
                {
                  naam,
                  duurWeken: subthema.duurWeken,
                  klasId: subthema.klasId,
                  leeftijd: subthema.leeftijd,
                  onderzoeksvragen: subthema.onderzoeksvragen.map((o) => ({
                    vraag: o.vraag,
                    probleemstelling: o.probleemstelling ?? undefined,
                  })),
                },
                { onSuccess: () => setTitelBewerken(false) },
              )
            }
            onAnnuleer={() => setTitelBewerken(false)}
          />
        ) : (
          <>
            <p className="font-bold text-ink">{subthema.naam}</p>
            <button
              onClick={() => setTitelBewerken(true)}
              aria-label="Titel bewerken"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-zacht active:bg-terra-zacht"
            >
              <IconPencil className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
      <p className="mb-3 text-xs text-ink-zwak">
        {klas ? klas.naam : "onbekende klas"} · {subthema.leeftijd} · {subthema.duurWeken} wk
      </p>

      <OnderzoeksvragenSectie subthema={subthema} themaId={thema.id} />

      <p className="mb-1 text-xs font-bold uppercase tracking-wide text-ink-zwak">
        Subdoelen voor {subthema.leeftijd} ({subthema.subdoelen.length})
      </p>
      <p className="mb-2 text-xs text-ink-zwak">
        Afgeleid van de themadoelen van "{thema.naam}" — koppelen of AI-voorstellen gebeurt op themaniveau.
      </p>
      <ul className="mb-4 flex flex-col gap-1.5">
        {subthema.subdoelen.map((s) => (
          <li key={s.id} className="rounded-lg bg-surface-verhoogd px-2.5 py-1.5">
            <span className="font-mono text-xs font-semibold text-ink-zacht">{s.koppeling.leerplandoelCode}</span>
            {subdoelInfo[s.koppeling.leerplandoelCode] && (
              <p className="mt-0.5 line-clamp-2 text-xs text-ink-zacht">{subdoelInfo[s.koppeling.leerplandoelCode]!.tekst}</p>
            )}
          </li>
        ))}
        {subthema.subdoelen.length === 0 && (
          <EmptyState
            titel="Nog geen subdoelen"
            beschrijving={`Geen enkel themadoel van "${thema.naam}" is gemerkt voor jaar/fase "${subthema.leeftijd}". Koppel eerst passende themadoelen op themaniveau.`}
          />
        )}
      </ul>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-zwak">
          Activiteiten ({subthema.activiteiten.length})
        </p>
        <p className="text-xs font-semibold text-ink-zacht">{aantalGedekt}/{subdoelCodes.length} doelen gedekt</p>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-surface-verhoogd" role="progressbar" aria-valuenow={percentage} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full rounded-full ${percentage >= 100 ? "bg-dekking-gedekt-foreground" : "bg-terra"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        {subthema.activiteiten.map((a) => (
          <button
            key={a.id}
            onClick={() => setBewerkActiviteit(a)}
            className="flex flex-col items-start gap-1 rounded-xl bg-surface-verhoogd p-2.5 text-left active:bg-terra-zacht"
          >
            <p className="line-clamp-2 text-sm font-semibold text-ink">{a.naam}</p>
            <p className="text-[11px] text-ink-zwak">{ACTIVITEIT_TYPE_LABEL[a.activiteitType]}</p>
            {a.verwachteUitkomsten && <p className="line-clamp-2 text-[11px] text-ink-zacht">{a.verwachteUitkomsten}</p>}
            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-zacht">
              {a.doelkoppelingen.length} doel{a.doelkoppelingen.length === 1 ? "" : "en"}
            </span>
          </button>
        ))}
      </div>
      {subthema.activiteiten.length === 0 && <p className="mb-3 text-xs text-ink-zwak">Nog geen activiteiten.</p>}
      <Button variant="secundair" size="klein" className="w-full" onClick={() => setActiviteitFormOpen(true)}>
        <IconPlus className="h-3.5 w-3.5" /> Activiteit toevoegen
      </Button>

      <Sheet open={activiteitFormOpen} onClose={() => setActiviteitFormOpen(false)} title="Nieuwe activiteit">
        <ActiviteitForm
          themaId={thema.id}
          thema={thema}
          subthema={subthema}
          subdoelen={subthema.subdoelen.map((s) => ({ code: s.koppeling.leerplandoelCode, tekst: subdoelInfo[s.koppeling.leerplandoelCode]?.tekst }))}
          bezig={maakActiviteit.isPending}
          onOpslaan={async (waarden) => {
            const nieuw = await maakActiviteit.mutateAsync({
              naam: waarden.naam,
              activiteitType: waarden.activiteitType,
              hoek: waarden.hoek,
              verwachteUitkomsten: waarden.verwachteUitkomsten,
              onderzoeksvraagId: waarden.onderzoeksvraagId,
            });
            await Promise.all(waarden.geselecteerdeCodes.map((code) => post(`/api/activiteiten/${nieuw.id}/doelkoppelingen`, { leerplandoelCode: code })));
            qc.invalidateQueries({ queryKey: themasKeys.detail(thema.id) });
            setActiviteitFormOpen(false);
          }}
        />
      </Sheet>

      {bewerkActiviteit && (
        <Sheet open={!!bewerkActiviteit} onClose={() => setBewerkActiviteit(null)} title={bewerkActiviteit.naam}>
          <ActiviteitBewerkForm
            themaId={thema.id}
            thema={thema}
            subthema={subthema}
            activiteit={bewerkActiviteit}
            subdoelen={subthema.subdoelen.map((s) => ({ code: s.koppeling.leerplandoelCode, tekst: subdoelInfo[s.koppeling.leerplandoelCode]?.tekst }))}
            onGesloten={() => setBewerkActiviteit(null)}
          />
        </Sheet>
      )}
    </div>
  );
}

/**
 * Multi-onderzoeksvraag beheer op het subthema: elke onderzoeksvraag heeft een optionele
 * probleemstelling en kan losstaand door een activiteit worden "bekeken" (Activiteit.onderzoeksvraagId).
 * Toevoegen/bewerken/verwijderen gaan elk via hun eigen endpoint — geen full-replace via de subthema-PUT,
 * zodat een activiteit die naar een onderzoeksvraag linkt nooit per ongeluk een andere krijgt.
 */
function OnderzoeksvragenSectie({ subthema, themaId }: { subthema: SubthemaWeergave; themaId: string }) {
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const voegToe = useVoegOnderzoeksvraagToe(subthema.id, themaId);
  const wijzig = useWijzigOnderzoeksvraag(subthema.id, themaId);
  const verwijder = useVerwijderOnderzoeksvraag(subthema.id, themaId);

  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-zwak">
          Onderzoeksvragen ({subthema.onderzoeksvragen.length})
        </p>
        <button
          type="button"
          onClick={() => setNieuwOpen(true)}
          className="flex h-6 w-6 items-center justify-center rounded-full bg-terra-zacht text-terra active:opacity-70"
          aria-label="Onderzoeksvraag toevoegen"
        >
          <IconPlus className="h-3.5 w-3.5" />
        </button>
      </div>
      {subthema.onderzoeksvragen.length === 0 && !nieuwOpen && (
        <p className="text-xs text-ink-zwak">Nog geen onderzoeksvragen.</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {subthema.onderzoeksvragen.map((ov) =>
          bewerkId === ov.id ? (
            <li key={ov.id} className="rounded-xl bg-surface-verhoogd p-2.5">
              <OnderzoeksvraagForm
                waarden={{ vraag: ov.vraag, probleemstelling: ov.probleemstelling ?? "" }}
                bezig={wijzig.isPending}
                onOpslaan={(invoer) =>
                  wijzig.mutate({ onderzoeksvraagId: ov.id, invoer }, { onSuccess: () => setBewerkId(null) })
                }
                onAnnuleer={() => setBewerkId(null)}
              />
            </li>
          ) : (
            <li key={ov.id} className="rounded-xl bg-surface-verhoogd p-2.5 text-xs text-ink-zacht">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-ink">❓ {ov.vraag}</p>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setBewerkId(ov.id)}
                    aria-label="Onderzoeksvraag bewerken"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-ink-zacht active:bg-terra-zacht"
                  >
                    <IconPencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => verwijder.mutate(ov.id)}
                    aria-label="Onderzoeksvraag verwijderen"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-ink-zacht active:bg-terra-zacht"
                  >
                    ✕
                  </button>
                </div>
              </div>
              {ov.probleemstelling && <p className="mt-1">🔎 {ov.probleemstelling}</p>}
            </li>
          ),
        )}
        {nieuwOpen && (
          <li className="rounded-xl bg-surface-verhoogd p-2.5">
            <OnderzoeksvraagForm
              waarden={{ vraag: "", probleemstelling: "" }}
              bezig={voegToe.isPending}
              onOpslaan={(invoer) => voegToe.mutate(invoer, { onSuccess: () => setNieuwOpen(false) })}
              onAnnuleer={() => setNieuwOpen(false)}
            />
          </li>
        )}
      </ul>
    </div>
  );
}

function OnderzoeksvraagForm({
  waarden,
  bezig,
  onOpslaan,
  onAnnuleer,
}: {
  waarden: { vraag: string; probleemstelling: string };
  bezig: boolean;
  onOpslaan: (invoer: { vraag: string; probleemstelling?: string }) => void;
  onAnnuleer: () => void;
}) {
  const [vraag, setVraag] = useState(waarden.vraag);
  const [probleemstelling, setProbleemstelling] = useState(waarden.probleemstelling);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!vraag.trim()) return;
        onOpslaan({ vraag: vraag.trim(), probleemstelling: probleemstelling.trim() || undefined });
      }}
    >
      <Field label="Onderzoeksvraag">
        <TextInput value={vraag} onChange={(e) => setVraag(e.target.value)} placeholder="bv. Wat gebeurt er als planten geen water krijgen?" required autoFocus />
      </Field>
      <Field label="Probleemstelling (optioneel)">
        <TextArea value={probleemstelling} onChange={(e) => setProbleemstelling(e.target.value)} placeholder="bv. Planten hebben water nodig (én ook mensen)" />
      </Field>
      <div className="flex gap-1.5">
        <Button type="submit" size="klein" className="flex-1" disabled={bezig || !vraag.trim()}>
          {bezig ? "…" : "Opslaan"}
        </Button>
        <Button type="button" variant="geest" size="klein" onClick={onAnnuleer}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}

function TitelForm({
  waarde,
  bezig,
  onOpslaan,
  onAnnuleer,
}: {
  waarde: string;
  bezig: boolean;
  onOpslaan: (naam: string) => void;
  onAnnuleer: () => void;
}) {
  const [naam, setNaam] = useState(waarde);
  return (
    <form
      className="flex flex-1 items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (naam.trim()) onOpslaan(naam.trim());
      }}
    >
      <TextInput value={naam} onChange={(e) => setNaam(e.target.value)} autoFocus className="flex-1 py-1.5 text-sm" />
      <Button type="submit" size="klein" disabled={bezig || !naam.trim()}>
        {bezig ? "…" : "Ok"}
      </Button>
      <Button type="button" variant="geest" size="klein" onClick={onAnnuleer}>
        ✕
      </Button>
    </form>
  );
}

interface ActiviteitFormWaarden {
  naam: string;
  activiteitType: ActiviteitType;
  hoek?: string;
  verwachteUitkomsten?: string;
  geselecteerdeCodes: string[];
  onderzoeksvraagId?: string;
}

/**
 * Create form for an activiteit: naam, type, hoek and a multiselect of the subthema's subdoelen (which
 * this activiteit satisfies) — plus a subtle "AI suggereert" ghost-button. There is no activiteit-level AI
 * endpoint on the backend, so the suggestion reuses the subthema-level subdoel-suggesties hook (grounded on
 * thema+subthema, not the activiteit's own text) and pre-checks whichever suggested codes are among this
 * subthema's own subdoelen — an honest, advisory starting point the teacher still confirms (Art. IV.1).
 */
function ActiviteitForm({
  thema,
  subthema,
  subdoelen,
  bezig,
  onOpslaan,
}: {
  themaId: string;
  thema: ThemaWeergave;
  subthema: SubthemaWeergave;
  subdoelen: { code: string; tekst?: string }[];
  bezig: boolean;
  onOpslaan: (waarden: ActiviteitFormWaarden) => void;
}) {
  const [naam, setNaam] = useState("");
  const [type, setType] = useState<ActiviteitType>("Spel");
  const [hoek, setHoek] = useState("");
  const [uitkomsten, setUitkomsten] = useState("");
  const [geselecteerdeCodes, setGeselecteerdeCodes] = useState<string[]>([]);
  const [onderzoeksvraagId, setOnderzoeksvraagId] = useState("");
  const aiSuggestie = useSubdoelSuggesties();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!naam.trim()) return;
        onOpslaan({
          naam: naam.trim(),
          activiteitType: type,
          hoek: hoek.trim() || undefined,
          verwachteUitkomsten: uitkomsten.trim() || undefined,
          geselecteerdeCodes,
          onderzoeksvraagId: onderzoeksvraagId || undefined,
        });
      }}
    >
      <Field label="Naam">
        <TextInput value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bv. Water gieten in de zandbak" required autoFocus />
      </Field>
      {subthema.onderzoeksvragen.length > 0 && (
        <Field label="Welke onderzoeksvraag bekijkt deze activiteit? (optioneel)">
          <Select value={onderzoeksvraagId} onChange={(e) => setOnderzoeksvraagId(e.target.value)}>
            <option value="">Geen</option>
            {subthema.onderzoeksvragen.map((ov) => (
              <option key={ov.id} value={ov.id}>
                {ov.vraag}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Type activiteit">
        <Select value={type} onChange={(e) => setType(e.target.value as ActiviteitType)}>
          {ACTIVITEIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTIVITEIT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      {type === "Hoek" && (
        <Field label="Welke hoek?">
          <TextInput value={hoek} onChange={(e) => setHoek(e.target.value)} placeholder="bv. Watertafel" />
        </Field>
      )}
      <Field label="Beschrijving (optioneel)">
        <TextArea value={uitkomsten} onChange={(e) => setUitkomsten(e.target.value)} placeholder="Wat leren de kinderen hiervan?" />
      </Field>

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Welke subdoelen voldoet deze activiteit?</span>
          <button
            type="button"
            disabled={aiSuggestie.isPending || subdoelen.length === 0}
            onClick={() =>
              aiSuggestie.mutate(
                {
                  thema: { naam: thema.naam, invalshoeken: thema.invalshoeken, duurWeken: thema.duurWeken },
                  subthema: {
                    naam: subthema.naam,
                    leeftijd: subthema.leeftijd,
                    duurWeken: subthema.duurWeken,
                    probleemstelling: subthema.onderzoeksvragen[0]?.probleemstelling ?? undefined,
                    onderzoeksvraag: subthema.onderzoeksvragen[0]?.vraag,
                  },
                },
                {
                  onSuccess: (resultaat) => {
                    if (!resultaat.isGeslaagd) return;
                    const codes = subdoelen.map((s) => s.code).filter((code) => resultaat.suggesties.some((s) => s.code === code));
                    setGeselecteerdeCodes((huidige) => Array.from(new Set([...huidige, ...codes])));
                  },
                },
              )
            }
            className="flex items-center gap-1 text-xs font-semibold text-terra disabled:opacity-50"
          >
            <IconSparkle className="h-3.5 w-3.5" /> {aiSuggestie.isPending ? "AI denkt na…" : "AI suggereert"}
          </button>
        </div>
        {subdoelen.length === 0 && <p className="text-xs text-ink-zwak">Nog geen subdoelen op dit subthema.</p>}
        <div className="flex flex-col gap-1.5">
          {subdoelen.map((s) => (
            <label key={s.code} className="flex items-start gap-2 rounded-xl border border-rand bg-surface p-2.5 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={geselecteerdeCodes.includes(s.code)}
                onChange={(e) =>
                  setGeselecteerdeCodes((codes) => (e.target.checked ? [...codes, s.code] : codes.filter((c) => c !== s.code)))
                }
              />
              <span>
                <span className="font-mono text-xs font-semibold text-ink-zacht">{s.code}</span>
                {s.tekst && <span className="block text-xs text-ink-zacht">{s.tekst}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={bezig || !naam.trim()}>
        {bezig ? "Bezig…" : "Activiteit opslaan"}
      </Button>
    </form>
  );
}

/** Edit form: same fields as create, prefilled, and diffs the doel-multiselect against the activiteit's
 * current koppelingen on save (link the newly checked, unlink the newly unchecked) rather than replacing
 * blindly, so an AI-motivatie or status on an untouched koppeling never gets silently discarded. */
function ActiviteitBewerkForm({
  themaId,
  thema,
  subthema,
  activiteit,
  subdoelen,
  onGesloten,
}: {
  themaId: string;
  thema: ThemaWeergave;
  subthema: SubthemaWeergave;
  activiteit: ActiviteitWeergave;
  subdoelen: { code: string; tekst?: string }[];
  onGesloten: () => void;
}) {
  const qc = useQueryClient();
  const wijzig = useWijzigActiviteit(activiteit.id, themaId);
  const [naam, setNaam] = useState(activiteit.naam);
  const [type, setType] = useState<ActiviteitType>(activiteit.activiteitType);
  const [hoek, setHoek] = useState(activiteit.hoek ?? "");
  const [uitkomsten, setUitkomsten] = useState(activiteit.verwachteUitkomsten ?? "");
  const [geselecteerdeCodes, setGeselecteerdeCodes] = useState<string[]>(activiteit.doelkoppelingen.map((d) => d.leerplandoelCode));
  const [onderzoeksvraagId, setOnderzoeksvraagId] = useState(activiteit.onderzoeksvraagId ?? "");
  const [bezig, setBezig] = useState(false);
  const aiSuggestie = useSubdoelSuggesties();
  const koppelOnderzoeksvraag = useKoppelActiviteitAanOnderzoeksvraag(activiteit.id, themaId);

  async function opslaan() {
    setBezig(true);
    try {
      await wijzig.mutateAsync({
        naam: naam.trim(),
        activiteitType: type,
        hoek: hoek.trim() || undefined,
        verwachteUitkomsten: uitkomsten.trim() || undefined,
      });
      if (onderzoeksvraagId !== (activiteit.onderzoeksvraagId ?? "")) {
        await koppelOnderzoeksvraag.mutateAsync(onderzoeksvraagId || null);
      }
      const huidigeCodes = activiteit.doelkoppelingen.map((d) => d.leerplandoelCode);
      const nieuw = geselecteerdeCodes.filter((c) => !huidigeCodes.includes(c));
      const weg = activiteit.doelkoppelingen.filter((d) => !geselecteerdeCodes.includes(d.leerplandoelCode));
      await Promise.all([
        ...nieuw.map((code) => post(`/api/activiteiten/${activiteit.id}/doelkoppelingen`, { leerplandoelCode: code })),
        ...weg.map((d) => del(`/api/activiteiten/${activiteit.id}/doelkoppelingen/${d.id}`)),
      ]);
      qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) });
      onGesloten();
    } finally {
      setBezig(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!naam.trim()) return;
        opslaan();
      }}
    >
      <Field label="Naam">
        <TextInput value={naam} onChange={(e) => setNaam(e.target.value)} required autoFocus />
      </Field>
      <Field label="Type activiteit">
        <Select value={type} onChange={(e) => setType(e.target.value as ActiviteitType)}>
          {ACTIVITEIT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACTIVITEIT_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>
      {type === "Hoek" && (
        <Field label="Welke hoek?">
          <TextInput value={hoek} onChange={(e) => setHoek(e.target.value)} placeholder="bv. Watertafel" />
        </Field>
      )}
      <Field label="Beschrijving (optioneel)">
        <TextArea value={uitkomsten} onChange={(e) => setUitkomsten(e.target.value)} />
      </Field>
      {subthema.onderzoeksvragen.length > 0 && (
        <Field label="Welke onderzoeksvraag bekijkt deze activiteit? (optioneel)">
          <Select value={onderzoeksvraagId} onChange={(e) => setOnderzoeksvraagId(e.target.value)}>
            <option value="">Geen</option>
            {subthema.onderzoeksvragen.map((ov) => (
              <option key={ov.id} value={ov.id}>
                {ov.vraag}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Welke subdoelen voldoet deze activiteit?</span>
          <button
            type="button"
            disabled={aiSuggestie.isPending || subdoelen.length === 0}
            onClick={() =>
              aiSuggestie.mutate(
                {
                  thema: { naam: thema.naam, invalshoeken: thema.invalshoeken, duurWeken: thema.duurWeken },
                  subthema: {
                    naam: subthema.naam,
                    leeftijd: subthema.leeftijd,
                    duurWeken: subthema.duurWeken,
                    probleemstelling: subthema.onderzoeksvragen[0]?.probleemstelling ?? undefined,
                    onderzoeksvraag: subthema.onderzoeksvragen[0]?.vraag,
                  },
                },
                {
                  onSuccess: (resultaat) => {
                    if (!resultaat.isGeslaagd) return;
                    const codes = subdoelen.map((s) => s.code).filter((code) => resultaat.suggesties.some((s) => s.code === code));
                    setGeselecteerdeCodes((huidige) => Array.from(new Set([...huidige, ...codes])));
                  },
                },
              )
            }
            className="flex items-center gap-1 text-xs font-semibold text-terra disabled:opacity-50"
          >
            <IconSparkle className="h-3.5 w-3.5" /> {aiSuggestie.isPending ? "AI denkt na…" : "AI suggereert"}
          </button>
        </div>
        <div className="flex flex-col gap-1.5">
          {subdoelen.map((s) => (
            <label key={s.code} className="flex items-start gap-2 rounded-xl border border-rand bg-surface p-2.5 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={geselecteerdeCodes.includes(s.code)}
                onChange={(e) =>
                  setGeselecteerdeCodes((codes) => (e.target.checked ? [...codes, s.code] : codes.filter((c) => c !== s.code)))
                }
              />
              <span>
                <span className="font-mono text-xs font-semibold text-ink-zacht">{s.code}</span>
                {s.tekst && <span className="block text-xs text-ink-zacht">{s.tekst}</span>}
              </span>
            </label>
          ))}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={bezig || !naam.trim()}>
        {bezig ? "Bezig…" : "Wijzigingen opslaan"}
      </Button>
    </form>
  );
}
