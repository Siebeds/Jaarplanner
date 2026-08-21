import { useEffect, useMemo, useState } from "react";
import { SidePanel } from "../../components/ui/SidePanel";
import { Spinner } from "../../components/ui/Spinner";
import { Button } from "../../components/ui/Button";
import { Field, TextArea, TextInput } from "../../components/ui/Field";
import { useThema } from "../../lib/queries";
import { isoDatum } from "../../lib/utils";
import { AGENDA_KLEUR_OPTIES, isActiefOp } from "./kalenderHulp";
import type { ThemaplaatsingWeergave } from "../../lib/types";
import type { AgendaItem } from "../../state/appState";

type GekozenActiviteit = {
  activiteitId?: string;
  activiteitNaam: string;
  subthemaId?: string;
  subthemaNaam: string;
  themaId?: string;
  themaNaam: string;
};

/**
 * Unified "activiteit toevoegen aan mijn agenda" flow, usable from maand/week/dag zoom alike (de
 * kalender's "+" knop). Rendered as a non-blocking `SidePanel` so the kalender behind it stays
 * visible and its zoom-switcher stays clickable; closes automatically once opgeslagen.
 * <para>
 * Stappen: (1) de dag — alleen gevraagd als er geen vaste dag is meegegeven (dus niet als je al op
 * het dagoverzicht van een specifieke dag staat); (2) start- en einduur; (3) een bestaande
 * activiteit kiezen (thema → subthema → activiteit, enkel wat op die dag gepland staat) of vrij
 * een naam typen (bv. "middagpauze"); (4) een optionele beschrijving.
 * </para>
 * Local-only — zie state/appState.ts voor waarom hier geen server call gebeurt.
 */
export function ActiviteitKiezerSheet({
  open,
  onClose,
  vasteDag,
  plaatsingen,
  klasId,
  onKies,
}: {
  open: boolean;
  onClose: () => void;
  /** Wanneer gezet (dagoverzicht op een specifieke dag) ligt de dag vast en toont geen datumkiezer. */
  vasteDag: Date | null;
  plaatsingen: ThemaplaatsingWeergave[];
  klasId: string | null;
  onKies: (item: Omit<AgendaItem, "id">) => void;
}) {
  const [datum, setDatum] = useState(() => isoDatum(vasteDag ?? new Date()));
  const [startUur, setStartUur] = useState("09:00");
  const [eindUur, setEindUur] = useState("10:00");
  const [modus, setModus] = useState<"bestaand" | "vrij">("bestaand");
  const [themaId, setThemaId] = useState<string | null>(null);
  const [gekozenActiviteit, setGekozenActiviteit] = useState<GekozenActiviteit | null>(null);
  const [vrijeNaam, setVrijeNaam] = useState("");
  const [beschrijving, setBeschrijving] = useState("");
  const [kleur, setKleur] = useState<string | undefined>(undefined);

  // `SidePanel` blijft altijd gemonteerd (enkel verschoven via CSS), dus de lazy useState-initialisatie
  // hierboven loopt maar één keer — zonder deze sync zou `datum` blijven hangen op de dag van de eerste
  // keer dat dit paneel ooit werd aangemaakt in plaats van de `vasteDag` van de huidige opening te volgen.
  useEffect(() => {
    if (open) setDatum(isoDatum(vasteDag ?? new Date()));
  }, [open, vasteDag]);

  const { data: thema, isLoading } = useThema(themaId ?? undefined);
  const dagWerkelijk = useMemo(() => vasteDag ?? new Date(datum + "T00:00:00"), [vasteDag, datum]);
  const actievePlaatsingen = useMemo(
    () => plaatsingen.filter((p) => isActiefOp(p, dagWerkelijk)),
    [plaatsingen, dagWerkelijk],
  );

  function reset() {
    setDatum(isoDatum(vasteDag ?? new Date()));
    setStartUur("09:00");
    setEindUur("10:00");
    setModus("bestaand");
    setThemaId(null);
    setGekozenActiviteit(null);
    setVrijeNaam("");
    setBeschrijving("");
    setKleur(undefined);
  }

  function sluit() {
    reset();
    onClose();
  }

  const activiteitNaam = modus === "vrij" ? vrijeNaam.trim() : gekozenActiviteit?.activiteitNaam;
  const kanOpslaan = !!klasId && !!activiteitNaam && !!datum && !!startUur && !!eindUur && eindUur > startUur;

  function opslaan() {
    if (!kanOpslaan || !activiteitNaam) return;
    onKies({
      activiteitId: modus === "bestaand" ? gekozenActiviteit?.activiteitId : undefined,
      themaId: modus === "bestaand" ? gekozenActiviteit?.themaId : undefined,
      subthemaId: modus === "bestaand" ? gekozenActiviteit?.subthemaId : undefined,
      activiteitNaam,
      subthemaNaam: modus === "bestaand" ? (gekozenActiviteit?.subthemaNaam ?? "") : "Vrij ingevoerd",
      themaNaam: modus === "bestaand" ? (gekozenActiviteit?.themaNaam ?? "") : "—",
      datum,
      startUur,
      eindUur,
      beschrijving: beschrijving.trim() || undefined,
      kleur,
    });
    sluit();
  }

  return (
    <SidePanel open={open} onClose={sluit} title="Activiteit toevoegen aan agenda">
      <div className="flex flex-col gap-3">
        {vasteDag ? (
          <p className="rounded-xl bg-surface-verhoogd p-2.5 text-sm text-ink-zacht">
            📅 {vasteDag.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        ) : (
          <Field label="Dag">
            <TextInput type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
          </Field>
        )}

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

        <div className="flex rounded-2xl bg-surface-verhoogd p-1">
          {(["bestaand", "vrij"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModus(m)}
              className={`h-9 flex-1 rounded-xl text-sm font-semibold transition-colors ${
                modus === m ? "bg-terra text-terra-foreground shadow-kaart" : "text-ink-zacht"
              }`}
            >
              {m === "bestaand" ? "Bestaande activiteit" : "Vrij typen"}
            </button>
          ))}
        </div>

        {modus === "vrij" && (
          <Field label="Naam van de activiteit" hint='bv. "Middagpauze", "Turnles", "Oudercontact"'>
            <TextInput value={vrijeNaam} onChange={(e) => setVrijeNaam(e.target.value)} placeholder="Typ een naam…" autoFocus />
          </Field>
        )}

        {modus === "bestaand" && !themaId && (
          <div>
            <p className="mb-2 text-sm text-ink-zacht">Welk thema staat op deze dag gepland?</p>
            {actievePlaatsingen.length === 0 && (
              <p className="text-sm text-ink-zwak">
                Voor deze dag staat er geen thema in het jaarplan van deze klas. Kies "Vrij typen" of plan eerst
                een thema in via de themapagina.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {actievePlaatsingen.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setThemaId(p.themaId)}
                    className="w-full rounded-xl border border-rand bg-surface-verhoogd p-3 text-left text-sm font-semibold text-ink active:bg-terra-zacht"
                  >
                    {p.themaNaam}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {modus === "bestaand" && themaId && (
          <div>
            <button type="button" onClick={() => setThemaId(null)} className="mb-1 text-sm font-semibold text-terra">
              ← Ander thema
            </button>
            {isLoading && <Spinner label="Activiteiten laden…" />}
            {thema && thema.subthemas.filter((s) => s.klasId === klasId).length === 0 && (
              <p className="text-sm text-ink-zwak">Dit thema heeft nog geen subthema of activiteiten voor deze klas.</p>
            )}
            {thema?.subthemas
              .filter((s) => s.klasId === klasId)
              .map((s) => (
                <div key={s.id} className="mb-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-zwak">{s.naam}</p>
                  {s.activiteiten.length === 0 && <p className="text-xs text-ink-zwak">Nog geen activiteiten.</p>}
                  <ul className="flex flex-col gap-1.5">
                    {s.activiteiten.map((a) => {
                      const actief = gekozenActiviteit?.activiteitId === a.id;
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() =>
                              setGekozenActiviteit({
                                activiteitId: a.id,
                                activiteitNaam: a.naam,
                                subthemaId: s.id,
                                subthemaNaam: s.naam,
                                themaId: thema.id,
                                themaNaam: thema.naam,
                              })
                            }
                            className={`w-full rounded-lg p-2.5 text-left text-sm active:bg-terra-zacht ${
                              actief ? "bg-terra text-terra-foreground" : "bg-surface-verhoogd text-ink"
                            }`}
                          >
                            {a.naam}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
          </div>
        )}

        <Field label="Beschrijving (optioneel)">
          <TextArea
            value={beschrijving}
            onChange={(e) => setBeschrijving(e.target.value)}
            placeholder="Extra toelichting voor jezelf of een collega…"
          />
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

        <Button className="w-full" disabled={!kanOpslaan} onClick={opslaan}>
          Toevoegen aan agenda
        </Button>
      </div>
    </SidePanel>
  );
}
