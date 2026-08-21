import { useEffect } from "react";
import { useKlassen, useSchooljaren } from "../lib/queries";
import { useAppState } from "../state/appState";
import { Sheet } from "./ui/Sheet";
import { Select, Field } from "./ui/Field";
import { useState } from "react";
import { IconSwap } from "./Icons";
import { Button } from "./ui/Button";

/**
 * The always-visible klas/schooljaar chooser. This app has no teacher login (E7-11, still open
 * app-wide), so "mijn klas" vs. "collega's klas" is modelled as switching which klas is active —
 * the same list of klassen, just a different one selected. See state/appState.ts.
 */
export function TopBar({ title }: { title: string }) {
  const { data: schooljaren } = useSchooljaren();
  const { data: klassen } = useKlassen();
  const { schooljaarId, setSchooljaarId, klasId, setKlasId } = useAppState();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!schooljaarId && schooljaren && schooljaren.length > 0) {
      setSchooljaarId(schooljaren[0].id);
    }
  }, [schooljaarId, schooljaren, setSchooljaarId]);

  useEffect(() => {
    if (!klasId && klassen && klassen.length > 0) {
      setKlasId(klassen[0].id);
    }
  }, [klasId, klassen, setKlasId]);

  const actieveKlas = klassen?.find((k) => k.id === klasId);

  return (
    <header className="sticky top-0 z-30 bg-canvas/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-tight text-ink">{title}</h1>
        <button
          onClick={() => setOpen(true)}
          className="flex h-touch items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-semibold text-ink shadow-kaart active:bg-terra-zacht"
        >
          <IconSwap className="h-4 w-4 text-terra" />
          {actieveKlas ? actieveKlas.naam : "Kies klas…"}
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Agenda wisselen">
        <p className="mb-4 text-sm text-ink-zacht">
          Kies wiens klas je bekijkt — jouw eigen klas, of die van een collega. Alles wat je hier ziet
          (doelen, thema's, kalender, dekking) is voor deze klas.
        </p>
        <Field label="Schooljaar">
          <Select value={schooljaarId ?? ""} onChange={(e) => setSchooljaarId(e.target.value)}>
            {schooljaren?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.naam}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Klas (jij of een collega)">
          <Select value={klasId ?? ""} onChange={(e) => setKlasId(e.target.value)}>
            {klassen?.map((k) => (
              <option key={k.id} value={k.id}>
                {k.naam}
              </option>
            ))}
          </Select>
        </Field>
        <Button className="mt-2 w-full" onClick={() => setOpen(false)}>
          Klaar
        </Button>
      </Sheet>
    </header>
  );
}
