import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { Invoer, Keuze, Veld } from "../../components/ui/Veld";
import { IcoonPlus } from "../../components/Iconen";
import { ACTIVITEIT_TYPES, type ActiviteitType } from "../../lib/types";
import { t } from "../../i18n";
import { useMaakActiviteitMetDoel } from "./mutaties";

/**
 * Making a new activiteit for this doel, under this subthema, without leaving the sheet.
 *
 * This is the path the register exists for. A teacher reading the curriculum thinks "this belongs
 * under Herfst, as something we do not have yet", and until now the only way to act on that was to
 * remember the code, leave the register, find the thema, find the subthema, add an activiteit, open
 * it, and search the code back. Everything in this component is in service of collapsing that into
 * one field and one button.
 *
 * **Three fields, not the eleven an activiteit can carry.** `Activiteitformulier` is the full
 * editor and it stays the place to write a hoek, verwachte uitkomsten, a colour or an onderzoeksvraag.
 * Here the teacher is mid-thought about a doel, so this asks for what an activiteit cannot exist
 * without and lets the rest be filled in later from the thema screen. Naming the trade in the copy
 * would be noise; the fields themselves say it.
 *
 * **The doel is linked in the same request** (`leerplandoelCodes` on the create payload), so there is
 * no window in which the activiteit exists without the doel that caused it.
 */
export function Nieuweactiviteitregel({
  subthemaId,
  subthemaNaam,
  code,
  klasId,
}: {
  subthemaId: string;
  subthemaNaam: string;
  code: string;
  klasId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [naam, setNaam] = useState("");
  const [type, setType] = useState<ActiviteitType>(ACTIVITEIT_TYPES[0]);
  const [lesuren, setLesuren] = useState(1);

  const maak = useMaakActiviteitMetDoel();

  function sluit() {
    setOpen(false);
    setNaam("");
    setType(ACTIVITEIT_TYPES[0]);
    setLesuren(1);
    maak.reset();
  }

  if (!open) {
    return (
      <Knop
        rang="stil"
        className="mt-1 h-9 min-h-9 w-full justify-start px-2.5 text-meta"
        // Same reason the Doelkoppelaar carries one: a sheet can hold a dozen of these buttons and
        // they all read the same, so the spoken label names the subthema this one belongs to.
        aria-label={t("koppelen.nieuweActiviteitUitleg", { subthema: subthemaNaam })}
        onClick={() => setOpen(true)}
      >
        <IcoonPlus aria-hidden="true" className="h-4 w-4" />
        {t("koppelen.nieuweActiviteit")}
      </Knop>
    );
  }

  const naamIngevuld = naam.trim().length > 0;

  return (
    <form
      className="mt-2 flex flex-col gap-3 rounded-veld border border-lijn bg-vlak-diep/40 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!naamIngevuld || maak.isPending) return;
        maak.mutate(
          {
            subthemaId,
            invoer: {
              naam: naam.trim(),
              activiteitType: type,
              hoek: null,
              verwachteUitkomsten: null,
              onderzoeksvraagId: null,
              kleur: null,
              lengteInLesuren: lesuren,
              leerplandoelCodes: [code],
            },
          },
          { onSuccess: sluit },
        );
      }}
    >
      <Veld label={t("koppelen.activiteitNaam")}>
        {(id) => (
          <Invoer
            id={id}
            value={naam}
            autoFocus
            disabled={maak.isPending}
            onChange={(e) => setNaam(e.target.value)}
            placeholder={t("koppelen.activiteitNaamVoorbeeld")}
          />
        )}
      </Veld>

      <div className="grid grid-cols-2 gap-3">
        <Veld label={t("koppelen.activiteitType")}>
          {(id) => (
            <Keuze id={id} value={type} disabled={maak.isPending} onChange={(e) => setType(e.target.value as ActiviteitType)}>
              {ACTIVITEIT_TYPES.map((waarde) => (
                <option key={waarde} value={waarde}>
                  {t(`activiteitsoort.${waarde}`)}
                </option>
              ))}
            </Keuze>
          )}
        </Veld>

        <Veld label={t("koppelen.activiteitLesuren")}>
          {(id) => (
            <Invoer
              id={id}
              type="number"
              min={1}
              max={20}
              value={lesuren}
              disabled={maak.isPending}
              onChange={(e) => setLesuren(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
            />
          )}
        </Veld>
      </div>

      {/* The class the activiteit will belong to, stated before it is made rather than discovered
          after. An activiteit inherits its subthema's klas and leeftijd (Art. IX.2), and a teacher
          who switched class in the shell three screens ago has no other way to see which one that is. */}
      {klasId === null ? (
        <p className="text-meta text-attentie-inkt">{t("koppelen.geenKlas")}</p>
      ) : null}

      {maak.isError ? (
        <p role="alert" className="text-meta text-dekking-niet-gedekt">
          {t("koppelen.maakMislukt")}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Knop
          type="submit"
          rang="hoofd"
          className="h-9 min-h-9 px-3 text-meta"
          disabled={!naamIngevuld || maak.isPending || klasId === null}
        >
          {maak.isPending ? t("koppelen.bezigMaken") : t("koppelen.maakEnKoppel")}
        </Knop>
        <Knop rang="stil" type="button" className="h-9 min-h-9 px-3 text-meta" disabled={maak.isPending} onClick={sluit}>
          {t("koppelen.annuleer")}
        </Knop>
      </div>
    </form>
  );
}
