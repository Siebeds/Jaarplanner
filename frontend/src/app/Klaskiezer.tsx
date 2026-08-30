import { useState } from "react";
import { Blad } from "../components/ui/Blad";
import { Knop } from "../components/ui/Knop";
import { Veld, Keuze } from "../components/ui/Veld";
import { IcoonChevron } from "../components/Iconen";
import { useActieveSelectie } from "../lib/selectie";
import { t } from "../i18n";

/**
 * Which klas the screen is about.
 *
 * It is rendered ONLY by screens whose data is actually scoped to a class. Doelen does not have it,
 * because leerplandoelen are school-wide reference data and a class chip on that screen would show a
 * filter that is not being applied.
 *
 * It is a chosen context, not an identity. There is no signed-in teacher yet (E7-11), so nothing
 * here says "your class".
 */
export function Klaskiezer() {
  const [open, setOpen] = useState(false);
  const { klas, schooljaar, schooljaren, klassen, kiesSchooljaar, kiesKlas } = useActieveSelectie();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 max-w-[14rem] items-center gap-1.5 rounded-full border border-lijn-veld bg-kaart px-3 text-meta font-medium text-inkt transition-colors duration-150 hover:border-inkt"
      >
        <span className="truncate">{klas ? klas.naam : t("context.geenKlas")}</span>
        <IcoonChevron aria-hidden="true" className="h-4 w-4 shrink-0 text-inkt-zwak" />
      </button>

      <Blad
        open={open}
        onOpenChange={setOpen}
        titel={t("context.titel")}
        voet={
          <Knop rang="hoofd" vol onClick={() => setOpen(false)}>
            {t("context.bevestig")}
          </Knop>
        }
      >
        <div className="flex flex-col gap-4">
          <Veld label={t("context.schooljaar")}>
            {(id) => (
              <Keuze id={id} value={schooljaar?.id ?? ""} onChange={(e) => kiesSchooljaar(e.target.value)}>
                {schooljaren.map((jaar) => (
                  <option key={jaar.id} value={jaar.id}>
                    {jaar.naam}
                  </option>
                ))}
              </Keuze>
            )}
          </Veld>

          <Veld label={t("context.klas")}>
            {(id) =>
              klassen.length === 0 ? (
                <p className="text-meta text-inkt-zacht" id={id}>
                  {t("context.geenKlassen")}
                </p>
              ) : (
                <Keuze id={id} value={klas?.id ?? ""} onChange={(e) => kiesKlas(e.target.value)}>
                  {klassen.map((optie) => (
                    <option key={optie.id} value={optie.id}>
                      {optie.naam}
                    </option>
                  ))}
                </Keuze>
              )
            }
          </Veld>
        </div>
      </Blad>
    </>
  );
}
