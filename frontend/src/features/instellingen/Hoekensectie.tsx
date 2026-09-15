import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { Bevestiging } from "../../components/ui/Bevestiging";
import { Keuze } from "../../components/ui/Veld";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { IcoonPlus } from "../../components/Iconen";
import { ApiError } from "../../lib/api";
import { useGeenKlassenZin, useRechten } from "../../lib/rechten";
import { t, telWoord } from "../../i18n";
import type { KlasWeergave } from "../../lib/types";
import { Hoekformulier } from "./Hoekformulier";
import { Hoekovername } from "./Hoekovername";
import {
  useHoeken,
  useMaakHoek,
  useNeemHoekenOver,
  useVerwijderHoek,
  useWijzigHoek,
  type HoekOvername,
  type HoekWeergave,
} from "../hoeken/gegevens";

/**
 * The corners of one classroom: the boekenhoek, the bouwhoek, the zandtafel (owner, 2026-08-30).
 *
 * **A hoek is furniture, and that is why this part is scoped to one class where Klassen is not.** A
 * subthema is content a school authors once for an age; a corner is a thing standing in a room, and
 * K3 groen may genuinely have a bouwhoek that K3 blauw has not. So this part asks which room it is
 * talking about, and it asks once above the list rather than on every row, the same way Klassen asks
 * which school year.
 *
 * *It was a section under Klassen on the single Instellingen page before that page was split into
 * parts.* Its title is now the page's, drawn by `HoekenScherm`, which is why it opens with its
 * controls rather than a heading.
 *
 * **What is NOT here is the verrijking.** What a teacher puts in the boekenhoek for a fortnight
 * belongs to a period and lives on the agenda; what belongs here is the corner itself, which is there
 * in september and still there in june. Splitting them is the whole point of the model, so a screen
 * that offered both would undo it.
 *
 * **The count of placements is a fact on the row, not a warning.** A corner standing three times in
 * the agenda cannot be deleted, and the row says the three before she reaches for the bin rather than
 * only afterwards. The refusal itself still comes from the server: this count is the one this screen
 * fetched, and the only count that may block a delete is the one the server sees at that moment.
 *
 * **A room's corners are that klas's planning** (E6-02, ADR-0030 §3, R7): directie and its own leerkrachten add,
 * edit, delete and take them over. Anyone else picks any room and reads its corners, with one quiet line naming the
 * room, because the picker is what made the buttons go.
 */
export function Hoekensectie({ klassen, laadt }: { klassen: KlasWeergave[]; laadt: boolean }) {
  const [gekozen, setGekozen] = useState<string | null>(null);
  const [formulier, setFormulier] = useState<{ hoek?: HoekWeergave } | null>(null);
  const [teVerwijderen, setTeVerwijderen] = useState<HoekWeergave | null>(null);
  const [overnemen, setOvernemen] = useState(false);
  const [overname, setOvername] = useState<{ resultaat: HoekOvername; klasNaam: string } | null>(null);

  /**
   * Which room is on screen: what she picked, falling back to the first class the school has.
   *
   * **Derived during render rather than synchronised in an effect.** The effect version needed the
   * class list in its dependencies and called setState inside itself, so every change to the class
   * list cost a second render pass, and a deleted class left this picker pointing at a row
   * that was gone until that pass ran. Reading it here cannot be stale, because there is no moment
   * between the two.
   */
  const klasId =
    gekozen !== null && klassen.some((k) => k.id === gekozen) ? gekozen : (klassen[0]?.id ?? null);

  const { data: hoeken, isPending } = useHoeken(klasId);
  const maak = useMaakHoek(klasId);
  const wijzig = useWijzigHoek(klasId);
  const verwijder = useVerwijderHoek(klasId);
  const neemOver = useNeemHoekenOver(klasId);

  const bezig = formulier?.hoek ? wijzig.isPending : maak.isPending;
  const fout = formulier?.hoek ? wijzig.error : maak.error;
  const andere = klassen.filter((k) => k.id !== klasId);

  // `bekend`, not "not loading": a failed `/api/ik` proves nothing about rights (fix round 1, F3).
  const { mag, bekend: rechtenBekend } = useRechten();
  const geenKlassenZin = useGeenKlassenZin(t("klasbeheer.geenKlassen"));
  const magBewerken = mag.klasplanningBewerken(klasId);
  const klasNaam = klassen.find((k) => k.id === klasId)?.naam;

  return (
    <div className="flex flex-col gap-3">
      {/* Which room these corners are in on the left, once above the list, and what she can do in it
          on the right: the same row Klassen opens with. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex flex-wrap items-center gap-2 text-meta text-inkt-zacht">
          {t("hoeken.klas")}
          <Keuze
            value={klasId ?? ""}
            disabled={klassen.length === 0}
            onChange={(e) => {
              setGekozen(e.target.value);
              setOvername(null);
            }}
            className="w-auto"
          >
            {klassen.map((klas) => (
              <option key={klas.id} value={klas.id}>
                {klas.naam}
              </option>
            ))}
          </Keuze>
        </label>

        {magBewerken ? (
          <div className="flex flex-wrap items-center gap-2">
            <Knop
              rang="stil"
              className="h-9 min-h-9 px-3 text-meta"
              disabled={klasId === null}
              onClick={() => {
                neemOver.reset();
                setOvername(null);
                setOvernemen(true);
              }}
            >
              {t("hoeken.overnemen")}
            </Knop>
            <Knop
              rang="rustig"
              className="h-9 min-h-9 px-3 text-meta"
              disabled={klasId === null}
              onClick={() => {
                maak.reset();
                setOvername(null);
                setFormulier({});
              }}
            >
              <IcoonPlus aria-hidden="true" className="h-4 w-4" />
              {t("hoeken.toevoegen")}
            </Knop>
          </div>
        ) : null}
      </div>

      {rechtenBekend && !magBewerken && klasNaam ? (
        <p className="text-meta text-inkt-zacht">{t("rechten.hoekenAlleenBekijken", { klas: klasNaam })}</p>
      ) : null}

      {laadt || (klasId !== null && isPending) ? (
        <Laadlijst rijen={2} />
      ) : klassen.length === 0 ? (
        // No class, no room. Said here rather than left as an empty list under a dead picker. Only directie makes
        // klassen, in Klassen next to this part; anyone else is told what the list means for them (FB-013).
        <p className="text-body text-inkt-zacht">{mag.beheer ? t("hoeken.geenKlassen") : geenKlassenZin}</p>
      ) : (hoeken ?? []).length === 0 ? (
        <p className="text-body text-inkt-zacht">{t("hoeken.geenHoeken")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(hoeken ?? []).map((hoek) => (
            <li key={hoek.id}>
              <Hoekrij
                hoek={hoek}
                onBewerk={
                  magBewerken
                    ? () => {
                        wijzig.reset();
                        setOvername(null);
                        setFormulier({ hoek });
                      }
                    : undefined
                }
                onVerwijder={
                  magBewerken
                    ? () => {
                        // The takeover report goes too. It describes what the LAST takeover did, and left
                        // standing under a row she has just deleted it reads as feedback on the delete.
                        verwijder.reset();
                        setOvername(null);
                        setTeVerwijderen(hoek);
                      }
                    : undefined
                }
              />
            </li>
          ))}
        </ul>
      )}

      {/* The delete the server refused, with the reason it gave. Under the list rather than in the
          dialog because the dialog is closed by then, and the refusal names a count of placements,
          which is a fact about a row that is still on screen. */}
      {verwijder.isError ? (
        <p
          role="alert"
          className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt"
        >
          {verwijder.error instanceof ApiError && verwijder.error.detail
            ? verwijder.error.detail
            : t("hoeken.verwijderMislukt")}
        </p>
      ) : null}

      {overname ? <Overnamebericht {...overname} /> : null}

      {formulier ? (
        <Hoekformulier
          open
          // Keyed on the hoek, so reopening the sheet for another one refills the fields instead of
          // showing the previous corner's half-edited name.
          key={formulier.hoek?.id ?? "nieuw"}
          hoek={formulier.hoek}
          bezig={bezig}
          fout={fout}
          onSluit={() => setFormulier(null)}
          onBewaar={(invoer) => {
            if (formulier.hoek) {
              wijzig.mutate(
                { hoekId: formulier.hoek.id, invoer },
                { onSuccess: () => setFormulier(null) },
              );
            } else {
              maak.mutate(invoer, { onSuccess: () => setFormulier(null) });
            }
          }}
        />
      ) : null}

      <Hoekovername
        open={overnemen}
        klassen={andere}
        bezig={neemOver.isPending}
        fout={neemOver.error}
        onSluit={() => setOvernemen(false)}
        onNeemOver={(vanKlasId) =>
          neemOver.mutate(vanKlasId, {
            onSuccess: (resultaat) => {
              setOvernemen(false);
              setOvername({
                resultaat,
                klasNaam: andere.find((k) => k.id === vanKlasId)?.naam ?? "",
              });
            },
          })
        }
      />

      <Bevestiging
        open={teVerwijderen !== null}
        titel={t("hoeken.verwijderTitel", { naam: teVerwijderen?.naam ?? "" })}
        // Its verrijkingen go with it (FB-020), and the count is said before, never after. Nothing is said when there
        // are none: a warning about nothing trains her to skip the warning.
        gevolg={
          teVerwijderen && teVerwijderen.aantalVerrijkingen > 0
            ? telWoord(teVerwijderen.aantalVerrijkingen, "hoeken.verwijderGevolgEen", "hoeken.verwijderGevolgAantal")
            : undefined
        }
        bevestigLabel={t("themabeheer.verwijder")}
        bezig={verwijder.isPending}
        onSluit={() => setTeVerwijderen(null)}
        onBevestig={() => {
          if (!teVerwijderen) return;
          verwijder.mutate(teVerwijderen.id, { onSuccess: () => setTeVerwijderen(null) });
        }}
      />
    </div>
  );
}

/** One corner: what it is called, what is permanently in it, and how often it stands in the agenda. */
function Hoekrij({
  hoek,
  onBewerk,
  onVerwijder,
}: {
  hoek: HoekWeergave;
  /** Both absent for a gebruiker who may not change this room's corners: the row is then read-only. */
  onBewerk?: () => void;
  onVerwijder?: () => void;
}) {
  return (
    // Stacked on a phone and side by side from `sm`, which is the shape the Klassen row above uses.
    // Copied deliberately rather than reinvented: two rows on one screen that differ only in how they
    // reflow read as a rendering fault.
    <div className="flex flex-col gap-3 rounded-kaart border border-lijn bg-kaart p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-body font-medium text-inkt">{hoek.naam}</p>
        {hoek.omschrijving ? (
          <p className="mt-0.5 text-meta text-inkt-zacht">{hoek.omschrijving}</p>
        ) : null}
        {hoek.aantalPlaatsingen > 0 ? (
          <p className="mt-2 text-meta text-inkt-zwak">
            {telWoord(hoek.aantalPlaatsingen, "hoeken.eenPlaatsing", "hoeken.aantalPlaatsingen")}
          </p>
        ) : null}
      </div>

      {/* WORDS, NOT ICONS, AND ONLY BECAUSE OF WHERE THIS ROW SITS.
          The thema page moved this pair to a pencil and a bin on 2026-08-30, because a thema with
          three subthema's of three activiteiten carried twenty-six buttons spelling the two words out.
          This list is a handful of rows on a settings screen, and the row DIRECTLY ABOVE IT still
          spells them out, so the icons made one screen speak two languages about the same two
          actions. That neighbour cannot simply follow: its edit button doubles as "Leeftijd
          instellen", which is a call to action and not a generic edit, and a pencil cannot say it. */}
      {onBewerk || onVerwijder ? (
        <div className="flex shrink-0 items-center gap-2">
          {onBewerk ? (
            <Knop rang="rustig" className="h-9 min-h-9 px-3 text-meta" onClick={onBewerk}>
              {t("themabeheer.bewerk")}
            </Knop>
          ) : null}
          {onVerwijder ? (
            <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={onVerwijder}>
              {t("themabeheer.verwijder")}
            </Knop>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * What the last takeover did.
 *
 * **Each sentence is built from the number it reports and asserts nothing else.** The three states
 * are genuinely different facts: nothing was there to take, some were copied, and some were skipped
 * because she already has them. Naming the skipped corners rather than counting them is the point:
 * "1 overgeslagen" leaves her wondering which one, and the answer is one she can act on.
 */
function Overnamebericht({ resultaat, klasNaam }: { resultaat: HoekOvername; klasNaam: string }) {
  const aantal = resultaat.overgenomen.length;
  const overgeslagen = resultaat.overgeslagen;

  return (
    <p role="status" className="rounded-veld bg-vlak px-3 py-2 text-meta text-inkt-zacht">
      {aantal === 0 && overgeslagen.length === 0
        ? t("hoeken.overnameNiets", { klas: klasNaam })
        : aantal === 0
          ? t("hoeken.overnameAlAanwezig", { klas: klasNaam })
          : telWoord(aantal, "hoeken.overnameEen", "hoeken.overnameAantal")}
      {overgeslagen.length > 0 && aantal > 0
        ? ` ${t("hoeken.overnameOvergeslagen", { namen: overgeslagen.join(", ") })}`
        : null}
    </p>
  );
}
