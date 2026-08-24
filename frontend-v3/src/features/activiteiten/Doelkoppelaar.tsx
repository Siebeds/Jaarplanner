import { useState } from "react";
import { Knop } from "../../components/ui/Knop";
import { IcoonPlus } from "../../components/Iconen";
import { t } from "../../i18n";
import { Doelkiezer } from "./Doelkiezer";

/**
 * The goal picker, closed until asked for.
 *
 * A thema detail has one of these on the thema and one on every subthema, and each of its activiteiten
 * has one in its sheet. Left open, that is four or five permanent search fields on one screen, and the
 * screen is supposed to be about what is already linked. So it is a button until a teacher wants it,
 * which is the same reason the filter panel is a sheet rather than a sidebar.
 *
 * It closes again after a pick, and the picked code shows up in the list above it, so the confirmation
 * is the list rather than a message. Linking a second goal is one more click, and a picker that stayed
 * open would have to be closed by hand every time it was used once.
 */
export function Doelkoppelaar({
  onKies,
  bezig,
  alGekozen,
}: {
  onKies: (leerplandoelCode: string) => void;
  bezig?: boolean;
  alGekozen: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={() => setOpen(true)}>
        <IcoonPlus aria-hidden="true" className="h-4 w-4" />
        {t("doelkiezer.koppel")}
      </Knop>
    );
  }

  return (
    <div className="rounded-veld border border-lijn bg-vlak-diep/40 p-2">
      <Doelkiezer
        onKies={(code) => {
          onKies(code);
          setOpen(false);
        }}
        bezig={bezig}
        alGekozen={alGekozen}
      />
      <div className="mt-2">
        <Knop rang="stil" className="h-9 min-h-9 px-3 text-meta" onClick={() => setOpen(false)}>
          {t("themabeheer.annuleer")}
        </Knop>
      </div>
    </div>
  );
}
