import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SidePanel } from "../../components/ui/SidePanel";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { Field, TextArea, TextInput } from "../../components/ui/Field";
import { IconChevronRight } from "../../components/Icons";
import { post, del } from "../../lib/api";
import { themasKeys, useLeerplandoelenBatch, useThema } from "../../lib/queries";
import { AGENDA_KLEUR_OPTIES } from "./kalenderHulp";
import type { AgendaItem } from "../../state/appState";

/**
 * View/edit an existing "mijn agenda"-item — the same fields as `ActiviteitKiezerSheet` (create),
 * prefilled, plus (when the item links to a real schoolinhoud-activiteit) a "hoeveel doelen"
 * summary and a doorklik naar het volledige doelen-koppelscherm, mirroring Thema > Subthema >
 * Activiteit (FR-9). A vrij-getypt item (bv. "middagpauze") has no activiteitId and so no doelen
 * to show — that section is simply omitted rather than shown empty.
 */
export function AgendaItemDetailPanel({
  open,
  onClose,
  item,
  onOpslaan,
  onVerwijder,
}: {
  open: boolean;
  onClose: () => void;
  item: AgendaItem | null;
  onOpslaan: (agendaItemId: string, wijziging: Partial<Omit<AgendaItem, "id">>) => void;
  onVerwijder: (agendaItemId: string) => void;
}) {
  const [datum, setDatum] = useState("");
  const [startUur, setStartUur] = useState("");
  const [eindUur, setEindUur] = useState("");
  const [beschrijving, setBeschrijving] = useState("");
  const [kleur, setKleur] = useState<string | undefined>(undefined);
  const [naam, setNaam] = useState("");
  const [doelenOpen, setDoelenOpen] = useState(false);

  // SidePanel blijft altijd gemonteerd — sync de formuliervelden telkens er een ander item wordt geopend.
  useEffect(() => {
    if (!item) return;
    setDatum(item.datum);
    setStartUur(item.startUur);
    setEindUur(item.eindUur);
    setBeschrijving(item.beschrijving ?? "");
    setKleur(item.kleur);
    setNaam(item.activiteitNaam);
    setDoelenOpen(false);
  }, [item]);

  const isGekoppeld = !!item?.activiteitId && !!item?.themaId;
  const { data: thema, isLoading: themaLaadt } = useThema(isGekoppeld ? item?.themaId : undefined);
  const subthema = thema?.subthemas.find((s) => s.id === item?.subthemaId);
  const activiteit = subthema?.activiteiten.find((a) => a.id === item?.activiteitId);

  const kanOpslaan = !!item && !!datum && !!startUur && !!eindUur && eindUur > startUur && (item.activiteitId ? true : !!naam.trim());

  function opslaan() {
    if (!item || !kanOpslaan) return;
    onOpslaan(item.id, {
      datum,
      startUur,
      eindUur,
      beschrijving: beschrijving.trim() || undefined,
      kleur,
      activiteitNaam: item.activiteitId ? item.activiteitNaam : naam.trim(),
    });
    onClose();
  }

  return (
    <SidePanel open={open} onClose={onClose} title="Activiteit bekijken / aanpassen">
      {!item && <Spinner label="Activiteit laden…" />}
      {item && (
      <div className="flex flex-col gap-3">
        {item.activiteitId ? (
          <div className="rounded-xl bg-surface-verhoogd p-2.5">
            <p className="text-sm font-bold text-ink">{item.activiteitNaam}</p>
            {item.themaNaam !== "—" && (
              <p className="text-xs text-ink-zacht">
                {item.themaNaam} · {item.subthemaNaam}
              </p>
            )}
          </div>
        ) : (
          <Field label="Naam van de activiteit">
            <TextInput value={naam} onChange={(e) => setNaam(e.target.value)} required autoFocus />
          </Field>
        )}

        <div className="flex gap-2">
          <Field label="Dag" className="flex-1">
            <TextInput type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
          </Field>
        </div>
        <div className="flex gap-2">
          <Field label="Startuur" className="flex-1">
            <TextInput type="time" value={startUur} onChange={(e) => setStartUur(e.target.value)} required />
          </Field>
          <Field label="Einduur" className="flex-1">
            <TextInput type="time" value={eindUur} onChange={(e) => setEindUur(e.target.value)} required />
          </Field>
        </div>
        {eindUur <= startUur && (
          <p className="-mt-2 text-xs font-semibold text-suggestie-geweigerd">Einduur moet na startuur liggen.</p>
        )}

        <Field label="Beschrijving (optioneel)">
          <TextArea value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} />
        </Field>

        <Field label="Kleur (optioneel)" hint="Kies je eigen kleurcode, of laat leeg voor de standaardkleur.">
          <div className="flex flex-wrap gap-2">
            {AGENDA_KLEUR_OPTIES.map((optie) => (
              <button
                key={optie.label}
                type="button"
                onClick={() => setKleur(optie.waarde)}
                aria-pressed={kleur === optie.waarde}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold ${
                  kleur === optie.waarde ? "border-ink bg-surface-verhoogd text-ink" : "border-rand text-ink-zacht"
                }`}
              >
                <span className={`h-3.5 w-3.5 rounded-full ${optie.chip}`} aria-hidden="true" />
                {optie.label}
                {kleur === optie.waarde && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </Field>

        {item.activiteitId && (
          <div className="rounded-xl border border-rand p-3">
            {themaLaadt && <Spinner label="Doelen laden…" />}
            {!themaLaadt && !activiteit && (
              <p className="text-sm text-ink-zwak">Deze activiteit kon niet meer teruggevonden worden in het thema.</p>
            )}
            {activiteit && !doelenOpen && (
              <button
                type="button"
                onClick={() => setDoelenOpen(true)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-semibold text-ink">
                  {activiteit.doelkoppelingen.length} doel{activiteit.doelkoppelingen.length === 1 ? "" : "en"} gekoppeld
                </span>
                <IconChevronRight className="h-4 w-4 text-ink-zwak" />
              </button>
            )}
            {activiteit && doelenOpen && thema && subthema && (
              <ActiviteitDoelenDetail themaId={thema.id} activiteit={activiteit} subdoelCodes={subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode)} />
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="gevaar" className="flex-1" onClick={() => onVerwijder(item.id)}>
            Verwijderen
          </Button>
          <Button className="flex-1" disabled={!kanOpslaan} onClick={opslaan}>
            Opslaan
          </Button>
        </div>
      </div>
      )}
    </SidePanel>
  );
}

/**
 * The doelen-detail + extra-doel-koppelen stap, reached by doorklikken op een gekoppelde activiteit —
 * dezelfde checkbox-tegen-subdoelen-lijst als Thema > Subthema > Activiteit (`ActiviteitBewerkForm`),
 * hier zelfstandig gehouden omdat dit paneel niet binnen een subthema-context leeft.
 */
function ActiviteitDoelenDetail({
  themaId,
  activiteit,
  subdoelCodes,
}: {
  themaId: string;
  activiteit: { id: string; doelkoppelingen: { id: string; leerplandoelCode: string }[] };
  subdoelCodes: string[];
}) {
  const qc = useQueryClient();
  const { perCode } = useLeerplandoelenBatch(subdoelCodes);
  const [geselecteerdeCodes, setGeselecteerdeCodes] = useState<string[]>(activiteit.doelkoppelingen.map((d) => d.leerplandoelCode));
  const [bezig, setBezig] = useState(false);

  async function opslaan() {
    setBezig(true);
    try {
      const huidigeCodes = activiteit.doelkoppelingen.map((d) => d.leerplandoelCode);
      const nieuw = geselecteerdeCodes.filter((c) => !huidigeCodes.includes(c));
      const weg = activiteit.doelkoppelingen.filter((d) => !geselecteerdeCodes.includes(d.leerplandoelCode));
      await Promise.all([
        ...nieuw.map((code) => post(`/api/activiteiten/${activiteit.id}/doelkoppelingen`, { leerplandoelCode: code })),
        ...weg.map((d) => del(`/api/activiteiten/${activiteit.id}/doelkoppelingen/${d.id}`)),
      ]);
      qc.invalidateQueries({ queryKey: themasKeys.detail(themaId) });
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="mt-2">
      {subdoelCodes.length === 0 && <p className="text-xs text-ink-zwak">Dit subthema heeft nog geen subdoelen om aan te koppelen.</p>}
      <div className="flex flex-col gap-1.5">
        {subdoelCodes.map((code) => {
          const detail = perCode[code];
          return (
            <label key={code} className="flex items-start gap-2 rounded-xl border border-rand bg-surface p-2.5 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={geselecteerdeCodes.includes(code)}
                onChange={(e) =>
                  setGeselecteerdeCodes((codes) => (e.target.checked ? [...codes, code] : codes.filter((c) => c !== code)))
                }
              />
              <span>
                <span className="font-mono text-xs font-semibold text-ink-zacht">{code}</span>
                {detail?.tekst && <span className="block text-xs text-ink-zacht">{detail.tekst}</span>}
              </span>
            </label>
          );
        })}
      </div>
      <Button className="mt-2 w-full" size="klein" disabled={bezig} onClick={opslaan}>
        {bezig ? "Bezig…" : "Doelkoppeling opslaan"}
      </Button>
    </div>
  );
}
