import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Sheet } from "../../components/ui/Sheet";
import { Field, Select, TextInput } from "../../components/ui/Field";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconPencil, IconPlus } from "../../components/Icons";
import {
  useJaarplannenVoorKlassen,
  useKlassen,
  useVerplaatsPlaatsing,
  useVerwijderPlaatsing,
  useVoegPlaatsingToe,
} from "../../lib/queries";
import { SubthemaPanel } from "./SubthemaPanel";
import type { KlasWeergave, SubthemaWeergave, ThemaplaatsingWeergave, ThemaWeergave } from "../../lib/types";

function eindDatum(begin: string, duurWeken: number): string {
  const d = new Date(begin);
  d.setDate(d.getDate() + duurWeken * 7 - 1);
  return d.toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
}

function formatteerDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * "Klasinplanning via subthema": de klasinplanning (welke klassen krijgen dit thema, en wanneer) en de
 * invulling ervan (het subthema per klas) zijn hier bewust één onderdeel — een klas inplannen zonder ooit
 * een subthema in te vullen liet een lege belofte achter, en een subthema zonder inplanning wist niet
 * wanneer het aan bod komt. Nieuwe klasinplanning (+ rechtsonder, zelfde stijl als Themadoelen) opent
 * daarom meteen het subthema-zijpaneel om titel/subdoelen/activiteiten in te vullen.
 */
export function KlasinplanningSectie({ thema }: { thema: ThemaWeergave }) {
  const { data: klassen } = useKlassen();
  const klasIds = klassen?.map((k) => k.id) ?? [];
  const { perKlas: jaarplannen } = useJaarplannenVoorKlassen(klasIds);

  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [subthemaPanelKlasId, setSubthemaPanelKlasId] = useState<string | null>(null);
  const [bewerkDatumKlasId, setBewerkDatumKlasId] = useState<string | null>(null);

  const aangeduideKlassen = (klassen ?? []).filter((k) =>
    jaarplannen[k.id]?.plaatsingen.some((p) => p.themaId === thema.id && !p.isVervallen && p.status !== "Geweigerd"),
  );
  const klassenZonderPlaatsing = (klassen ?? []).filter((k) => !aangeduideKlassen.some((a) => a.id === k.id));

  // Opgezocht in de volledige klassenlijst, niet in `aangeduideKlassen`: die laatste hangt af van het
  // jaarplan dat na het inplannen nog moet herladen, en het zijpaneel moet meteen kunnen openen zodra de
  // klasinplanning is aangemaakt, niet pas na die refetch.
  const panelKlas = (klassen ?? []).find((k) => k.id === subthemaPanelKlasId) ?? null;
  const panelSubthema = thema.subthemas.find((s) => s.klasId === subthemaPanelKlasId);

  return (
    <Card>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-ink-zwak">
        Klasinplanning via subthema ({aangeduideKlassen.length})
      </h2>
      <p className="mb-3 text-xs text-ink-zwak">
        Voor elke klas die dit thema krijgt, plan je een begindatum in — de einddatum volgt automatisch uit de
        duur van het thema ({thema.duurWeken} weken) — en vul je in hoe die klas het thema zelf invult via een
        subthema.
      </p>

      {aangeduideKlassen.length === 0 && (
        <EmptyState
          titel="Nog geen klas ingepland"
          beschrijving="Voeg via de knop hieronder een klasinplanning toe."
        />
      )}

      {aangeduideKlassen.length > 0 && (
        <ul className="flex flex-col gap-2">
          {aangeduideKlassen.map((k) => (
            <KlasinplanningRij
              key={k.id}
              klas={k}
              plaatsing={jaarplannen[k.id]?.plaatsingen.find((p) => p.themaId === thema.id)}
              subthema={thema.subthemas.find((s) => s.klasId === k.id)}
              bewerkenDatum={bewerkDatumKlasId === k.id}
              onBewerkDatum={() => setBewerkDatumKlasId(k.id)}
              onAnnuleerBewerkDatum={() => setBewerkDatumKlasId(null)}
              onOpenSubthema={() => setSubthemaPanelKlasId(k.id)}
            />
          ))}
        </ul>
      )}

      <div className="mt-3 flex justify-end">
        <Button size="icoon" className="rounded-full" title="Nieuwe klasinplanning" onClick={() => setNieuwOpen(true)}>
          <IconPlus className="h-4 w-4" />
        </Button>
      </div>

      <Sheet open={nieuwOpen} onClose={() => setNieuwOpen(false)} title="Nieuwe klasinplanning">
        <NieuweKlasinplanningForm
          themaId={thema.id}
          duurWeken={thema.duurWeken}
          klassen={klassenZonderPlaatsing}
          onAangemaakt={(klasId) => {
            setNieuwOpen(false);
            setSubthemaPanelKlasId(klasId);
          }}
        />
      </Sheet>

      <SubthemaPanel
        open={subthemaPanelKlasId !== null}
        onClose={() => setSubthemaPanelKlasId(null)}
        thema={thema}
        klas={panelKlas}
        subthema={panelSubthema}
        onAangemaakt={() => {
          /* het zijpaneel toont het nieuwe subthema zodra de thema-query herlaadt */
        }}
      />
    </Card>
  );
}

function KlasinplanningRij({
  klas,
  plaatsing,
  subthema,
  bewerkenDatum,
  onBewerkDatum,
  onAnnuleerBewerkDatum,
  onOpenSubthema,
}: {
  klas: KlasWeergave;
  plaatsing: ThemaplaatsingWeergave | undefined;
  subthema: SubthemaWeergave | undefined;
  bewerkenDatum: boolean;
  onBewerkDatum: () => void;
  onAnnuleerBewerkDatum: () => void;
  onOpenSubthema: () => void;
}) {
  const verplaats = useVerplaatsPlaatsing(klas.id);
  const verwijder = useVerwijderPlaatsing(klas.id);
  const [blokStart, setBlokStart] = useState(plaatsing?.blokStart.slice(0, 10) ?? "");

  return (
    <li className="overflow-hidden rounded-xl border border-rand bg-surface-verhoogd">
      <div className="flex items-start gap-2 p-3">
        <button
          onClick={onOpenSubthema}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-semibold text-ink">
            {klas.naam}
            {subthema && <span className="font-normal text-ink-zacht"> — {subthema.naam}</span>}
          </p>
          {subthema ? (
            <span className="mt-1 inline-block rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-ink-zacht">
              {subthema.activiteiten.length} activiteit{subthema.activiteiten.length === 1 ? "" : "en"}
            </span>
          ) : (
            <p className="mt-0.5 text-sm text-terra">+ subthema invullen (titel, beschrijving, …)</p>
          )}
        </button>
        {plaatsing && !bewerkenDatum && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={onBewerkDatum}
              aria-label="Datum bewerken"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-zacht active:bg-terra-zacht"
            >
              <IconPencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (confirm(`${klas.naam} niet meer inplannen voor dit thema?`)) verwijder.mutate(plaatsing.id);
              }}
              disabled={verwijder.isPending}
              className="text-xs font-semibold text-suggestie-geweigerd"
            >
              Verwijderen
            </button>
          </div>
        )}
      </div>

      {plaatsing && !bewerkenDatum && (
        <p className="px-3 pb-3 -mt-2 text-xs text-ink-zwak">
          {formatteerDatum(plaatsing.blokStart)} –{" "}
          {plaatsing.blokEind
            ? formatteerDatum(plaatsing.blokEind)
            : eindDatum(plaatsing.blokStart, plaatsing.duurWeken)}
        </p>
      )}

      {plaatsing && bewerkenDatum && (
        <form
          className="flex items-center gap-2 px-3 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!blokStart) return;
            verplaats.mutate(
              { plaatsingId: plaatsing.id, blokStart },
              { onSuccess: onAnnuleerBewerkDatum },
            );
          }}
        >
          <TextInput
            type="date"
            value={blokStart}
            onChange={(e) => setBlokStart(e.target.value)}
            className="h-9 flex-1"
          />
          <Button type="submit" size="klein" disabled={verplaats.isPending || !blokStart}>
            {verplaats.isPending ? "…" : "Opslaan"}
          </Button>
          <Button type="button" size="klein" variant="geest" onClick={onAnnuleerBewerkDatum}>
            Annuleer
          </Button>
        </form>
      )}
    </li>
  );
}

function NieuweKlasinplanningForm({
  themaId,
  duurWeken,
  klassen,
  onAangemaakt,
}: {
  themaId: string;
  duurWeken: number;
  klassen: KlasWeergave[];
  onAangemaakt: (klasId: string) => void;
}) {
  const [klasId, setKlasId] = useState("");
  const [blokStart, setBlokStart] = useState(() => new Date().toISOString().slice(0, 10));
  const voegToe = useVoegPlaatsingToe(klasId);

  if (klassen.length === 0) {
    return <p className="text-sm text-ink-zwak">Alle klassen hebben dit thema al ingepland.</p>;
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!klasId || !blokStart) return;
        voegToe.mutate({ themaId, blokStart }, { onSuccess: () => onAangemaakt(klasId) });
      }}
    >
      <Field label="Welke klas krijgt dit thema?">
        <Select value={klasId} onChange={(e) => setKlasId(e.target.value)} required>
          <option value="">Kies een klas…</option>
          {klassen.map((k) => (
            <option key={k.id} value={k.id}>
              {k.naam}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Begindatum">
        <TextInput type="date" value={blokStart} onChange={(e) => setBlokStart(e.target.value)} required />
      </Field>
      {blokStart && (
        <p className="mb-3 text-xs text-ink-zwak">
          Einddatum (automatisch, o.b.v. {duurWeken} weken): <strong>{eindDatum(blokStart, duurWeken)}</strong>
        </p>
      )}
      <p className="mb-3 text-xs text-ink-zwak">
        Na het inplannen open je meteen het subthema om titel, subdoelen en activiteiten in te vullen.
      </p>
      <Button type="submit" className="w-full" disabled={voegToe.isPending || !klasId || !blokStart}>
        {voegToe.isPending ? "Bezig…" : "Inplannen en subthema starten"}
      </Button>
    </form>
  );
}
