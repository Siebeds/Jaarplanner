import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Aandachtsmelding } from "../../components/ui/Aandachtsmelding";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Knop } from "../../components/ui/Knop";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Bewerkknop, Verwijderknop } from "../../components/ui/Rijknoppen";
import { Invoer, Veld } from "../../components/ui/Veld";
import { useRechten } from "../../lib/rechten";
import { t } from "../../i18n";
import { Foutregel } from "./Foutregel";
import { foutzin } from "./rapporthulp";
import { Rapportwissel } from "./Rapportwissel";
import {
  useGradaties,
  useMaakGradatie,
  useOrdenGradaties,
  useSterkleuren,
  useVerwijderGradatie,
  useWijzigGradatie,
  verschoven,
  type Gradatie,
} from "./rapportset";
import { Ster, Sterlabel } from "./Ster";
import { sterkleurnaam } from "./sterkleuren";
import { Verschuifknop } from "./Verschuifknop";

/**
 * The one K3 sterrenschaal (FB-002, FR-13.2, ADR-0035 R5 to R7): each gradatie a star with a label, in an order.
 *
 * **One scale for all of K3, with no schooljaar** (R5, R7). The sentence under the title says so once, with its cost:
 * a change also reaches reports already written. It is unconditional, because it is true of every change here.
 *
 * **Only a K3 leerkracht in a running schooljaar changes it; admin views it** (R6, R31, D4). For anyone else the
 * screen is the list alone, and one sentence says it may be viewed and not changed, which is all its condition proves.
 *
 * **The scale starts with the owner's example** (owner, 2026-09-15): "Volledig bereikt" in green and "Nog niet volledig"
 * in orange, which the server seeds. The colour is always chosen from the fixed six by name, never a swatch alone.
 */
export function SterrenschaalScherm() {
  const { mag, bekend } = useRechten();
  const magBewerken = mag.rapportsetBewerken;
  const gradaties = useGradaties();
  const orden = useOrdenGradaties();
  const verwijder = useVerwijderGradatie();

  const [bewerkt, setBewerkt] = useState<string | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<Gradatie | null>(null);
  const lijst = gradaties.data ?? [];

  const verschuif = (index: number, richting: -1 | 1) => {
    const volgorde = verschoven(
      lijst.map((gradatie) => gradatie.id),
      index,
      richting,
    );
    if (volgorde) orden.mutate(volgorde);
  };

  const melding = verwijder.isError
    ? foutzin(verwijder.error, "ontwikkelingsrapport.verwijderMislukt")
    : orden.isError
      ? foutzin(orden.error, "ontwikkelingsrapport.ordenMislukt")
      : null;

  return (
    <>
      <Schermkop titel={t("ontwikkelingsrapport.titel")} smal zonderKat onder={<Rapportwissel />} />

      <Schermvlak smal>
        <section aria-labelledby="schaal-titel" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="schaal-titel" className="font-display text-hoofdstuk text-inkt">
              {t("ontwikkelingsrapport.sterrenschaal")}
            </h2>
            <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.schaalUitleg")}</p>
            {bekend && !magBewerken ? (
              <p className="text-meta text-inkt-zacht">{t("ontwikkelingsrapport.schaalAlleenBekijken")}</p>
            ) : null}
          </div>

          {gradaties.isPending ? (
            <Laadlijst rijen={2} />
          ) : gradaties.isError ? (
            <Foutregel zin={t("ontwikkelingsrapport.schaalLaadFout")} />
          ) : lijst.length === 0 ? (
            <p className="text-body text-inkt-zacht">{t("ontwikkelingsrapport.geenGradaties")}</p>
          ) : (
            <ol className="divide-y divide-lijn rounded-kaart border border-lijn bg-kaart">
              {lijst.map((gradatie, index) => (
                <li key={gradatie.id}>
                  {magBewerken && bewerkt === gradatie.id ? (
                    <Gradatieformulier gradatie={gradatie} onKlaar={() => setBewerkt(null)} />
                  ) : (
                    <div className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                      <Sterlabel kleur={gradatie.kleur} label={gradatie.label} groot />
                      {magBewerken ? (
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Verschuifknop
                            richting="hoger"
                            label={t("ontwikkelingsrapport.hogerZetten", { naam: gradatie.label })}
                            disabled={index === 0 || orden.isPending}
                            onClick={() => verschuif(index, -1)}
                          />
                          <Verschuifknop
                            richting="lager"
                            label={t("ontwikkelingsrapport.lagerZetten", { naam: gradatie.label })}
                            disabled={index === lijst.length - 1 || orden.isPending}
                            onClick={() => verschuif(index, 1)}
                          />
                          <Bewerkknop
                            label={t("ontwikkelingsrapport.wijzigGradatie", { naam: gradatie.label })}
                            onClick={() => setBewerkt(gradatie.id)}
                          />
                          <Verwijderknop
                            label={t("ontwikkelingsrapport.verwijderGradatie", { naam: gradatie.label })}
                            onClick={() => {
                              verwijder.reset();
                              setTeVerwijderen(gradatie);
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}

          {melding ? <Aandachtsmelding>{melding}</Aandachtsmelding> : null}

          {magBewerken ? <Gradatieformulier /> : null}
        </section>
      </Schermvlak>

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t("ontwikkelingsrapport.verwijderGradatieTitel", { naam: teVerwijderen?.label ?? "" })}
        gevolg={t("ontwikkelingsrapport.verwijderGradatieGevolg")}
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijder.isPending}
        onSluit={() => setTeVerwijderen(null)}
        onBevestig={() => {
          if (!teVerwijderen) return;
          verwijder.mutate(teVerwijderen.id, { onSettled: () => setTeVerwijderen(null) });
        }}
      />
    </>
  );
}

/**
 * A gradatie's label and colour: a new one under the list, or an existing one in place of its row. Escape or Annuleren
 * puts the row back unchanged.
 */
function Gradatieformulier({ gradatie, onKlaar }: { gradatie?: Gradatie; onKlaar?: () => void }) {
  const maak = useMaakGradatie();
  const wijzig = useWijzigGradatie();
  const actie = gradatie ? wijzig : maak;

  const [label, setLabel] = useState(gradatie?.label ?? "");
  const [kleur, setKleur] = useState<string | null>(gradatie?.kleur ?? null);
  const [fout, setFout] = useState<string | null>(null);
  const labelVeld = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (gradatie) labelVeld.current?.focus();
  }, [gradatie]);

  function bewaar(e: FormEvent) {
    e.preventDefault();
    const schoon = label.trim();
    if (schoon === "") {
      setFout(t("ontwikkelingsrapport.labelVerplicht"));
      labelVeld.current?.focus();
      return;
    }
    if (kleur === null) {
      setFout(t("ontwikkelingsrapport.kleurVerplicht"));
      return;
    }
    setFout(null);
    if (gradatie) {
      wijzig.mutate({ id: gradatie.id, invoer: { label: schoon, kleur } }, { onSuccess: onKlaar });
    } else {
      maak.mutate(
        { label: schoon, kleur },
        {
          onSuccess: () => {
            setLabel("");
            setKleur(null);
            labelVeld.current?.focus();
          },
        },
      );
    }
  }

  const zin = fout ?? (actie.isError ? foutzin(actie.error, "ontwikkelingsrapport.bewaarMislukt") : null);

  return (
    <form
      onSubmit={bewaar}
      onKeyDown={
        gradatie
          ? (e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                onKlaar?.();
              }
            }
          : undefined
      }
      noValidate
      className={
        gradatie
          ? "flex flex-col gap-3 bg-vlak px-4 py-3"
          : "flex flex-col gap-3 rounded-kaart border border-lijn bg-kaart p-4"
      }
    >
      {gradatie ? null : (
        <h3 className="text-body font-medium text-inkt">{t("ontwikkelingsrapport.nieuweGradatie")}</h3>
      )}
      <Veld label={t("ontwikkelingsrapport.label")}>
        {(id) => (
          <Invoer id={id} ref={labelVeld} value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
        )}
      </Veld>
      <Kleurkeuze gekozen={kleur} onKies={setKleur} />
      <div className="flex flex-wrap items-center gap-2">
        <Knop rang="hoofd" type="submit" disabled={actie.isPending}>
          {actie.isPending
            ? t("algemeen.bezig")
            : gradatie
              ? t("themabeheer.bewaar")
              : t("ontwikkelingsrapport.gradatieToevoegen")}
        </Knop>
        {gradatie ? (
          <Knop rang="stil" disabled={actie.isPending} onClick={onKlaar}>
            {t("themabeheer.annuleer")}
          </Knop>
        ) : null}
      </div>
      {zin ? <Foutregel zin={zin} /> : null}
    </form>
  );
}

/**
 * The fixed palette as a radio group: a star AND the colour's name per option, so the choice never rests on telling two
 * swatches apart (Art. XII). The native radio is kept, visually hidden, so the arrow keys, the group's name and the
 * checked state all come from the browser; the chip shows focus and choice with a border, not a hue.
 */
function Kleurkeuze({ gekozen, onKies }: { gekozen: string | null; onKies: (kleur: string) => void }) {
  const kleuren = useSterkleuren();
  const naam = useId();
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-meta font-medium text-inkt-zacht">{t("ontwikkelingsrapport.kleur")}</legend>
      <div className="flex flex-wrap gap-2">
        {(kleuren.data ?? []).map((kleur) => (
          <label
            key={kleur}
            className={[
              "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border bg-kaart px-3 text-meta font-medium text-inkt",
              "transition-colors duration-150 hover:border-inkt-zacht",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
              gekozen === kleur ? "border-inkt bg-vlak-diep" : "border-lijn",
            ].join(" ")}
          >
            <input
              type="radio"
              name={naam}
              value={kleur}
              checked={gekozen === kleur}
              onChange={() => onKies(kleur)}
              className="sr-only"
            />
            <Ster kleur={kleur} />
            {sterkleurnaam(kleur)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
