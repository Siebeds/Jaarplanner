import { useState } from "react";
import { DoelKoppelPicker } from "./DoelKoppelPicker";
import { DoelDetailPanel } from "../doelen/DoelDetailPanel";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Sheet } from "../../components/ui/Sheet";
import { Spinner } from "../../components/ui/Spinner";
import { IconPlus, IconSparkle } from "../../components/Icons";
import { useLeerplandoelenBatch, useThemadoelSuggesties, useVerwijderThemadoel, useVoegThemadoelToe } from "../../lib/queries";
import type { ThemaWeergave } from "../../lib/types";

/**
 * The thema's 2–3 school-wide "themadoelen" (anchor goals): each shown with its code and its readable
 * leerplandoel-tekst, openable (full detail in a SidePanel) and unlinkable in place. Two small icon-buttons
 * bottom-right add more — manueel via search, or an AI-wizard (E2-07 step 2) that suggests several at once
 * and lets the teacher accept them one by one or in bulk.
 */
export function ThemadoelenPanel({ thema }: { thema: ThemaWeergave }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [geopendCode, setGeopendCode] = useState<string | null>(null);
  const voegToe = useVoegThemadoelToe(thema.id);
  const verwijder = useVerwijderThemadoel(thema.id);

  const codes = thema.themadoelen.map((t) => t.koppeling.leerplandoelCode);
  const { perCode } = useLeerplandoelenBatch(codes);
  const gekoppeldeCodes = codes;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-zwak">
          Themadoelen ({thema.themadoelen.length})
        </h2>
        {!thema.heeftVoldoendeThemadoelen && (
          <span className="rounded-full bg-suggestie-geweigerd/10 px-2 py-0.5 text-[11px] font-semibold text-suggestie-geweigerd">
            min. 2 nodig
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-ink-zwak">
        De 2–3 kernleerdoelen die dit hele thema draagt, schoolbreed voor elke klas.
      </p>

      <ul className="mb-3 flex flex-col gap-2">
        {thema.themadoelen.map((t) => {
          const doel = perCode[t.koppeling.leerplandoelCode];
          return (
            <li key={t.id} className="flex items-start gap-2 rounded-xl bg-surface-verhoogd p-2.5">
              <button
                type="button"
                onClick={() => setGeopendCode(t.koppeling.leerplandoelCode)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="font-mono text-xs font-semibold text-ink-zacht">{t.koppeling.leerplandoelCode}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink">{doel?.tekst ?? "…"}</p>
                {t.koppeling.aiMotivatie && (
                  <p className="mt-0.5 text-xs italic text-ink-zwak">"{t.koppeling.aiMotivatie}"</p>
                )}
              </button>
              <button
                onClick={() => verwijder.mutate(t.id)}
                disabled={verwijder.isPending}
                className="shrink-0 text-xs font-semibold text-suggestie-geweigerd"
              >
                Unlink
              </button>
            </li>
          );
        })}
        {thema.themadoelen.length === 0 && <p className="text-sm text-ink-zwak">Nog geen themadoelen gekozen.</p>}
      </ul>

      <div className="flex justify-end gap-2">
        <Button
          variant="secundair"
          size="icoon"
          className="rounded-full"
          title="Manueel een doel koppelen"
          onClick={() => setPickerOpen(true)}
        >
          <IconPlus className="h-4 w-4" />
        </Button>
        <Button size="icoon" className="rounded-full" title="AI stelt themadoelen voor" onClick={() => setAiOpen(true)}>
          <IconSparkle className="h-4 w-4" />
        </Button>
      </div>

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Themadoel koppelen">
        <DoelKoppelPicker
          disabledCodes={gekoppeldeCodes}
          bezig={voegToe.isPending}
          onKoppel={(code) => voegToe.mutate(code, { onSuccess: () => setPickerOpen(false) })}
        />
      </Sheet>

      <ThemadoelAiWizard
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        thema={thema}
        gekoppeldeCodes={gekoppeldeCodes}
        onKoppel={(code) => voegToe.mutateAsync(code)}
        koppelBezig={voegToe.isPending}
      />

      <DoelDetailPanel code={geopendCode} open={!!geopendCode} onClose={() => setGeopendCode(null)} />
    </Card>
  );
}

/**
 * The AI-wizard sheet: step 1 asks the AI to look at the thema and propose leerplandoelen; step 2 shows the
 * results and lets the teacher accept them one at a time or, via "Alles aanvaarden", in bulk — both actions
 * stay advisory-review (Art. IV.1): nothing is added until the teacher presses a button.
 */
function ThemadoelAiWizard({
  open,
  onClose,
  thema,
  gekoppeldeCodes,
  onKoppel,
  koppelBezig,
}: {
  open: boolean;
  onClose: () => void;
  thema: ThemaWeergave;
  gekoppeldeCodes: string[];
  onKoppel: (code: string) => Promise<unknown>;
  koppelBezig: boolean;
}) {
  const aiSuggesties = useThemadoelSuggesties();
  const [overgenomen, setOvergenomen] = useState<string[]>([]);
  const [bulkBezig, setBulkBezig] = useState(false);

  const stap: "intro" | "resultaten" = aiSuggesties.data ? "resultaten" : "intro";
  const teKiezen = aiSuggesties.data?.isGeslaagd
    ? aiSuggesties.data.suggesties.filter((s) => !gekoppeldeCodes.includes(s.code) && !overgenomen.includes(s.code))
    : [];

  function sluit() {
    aiSuggesties.reset();
    setOvergenomen([]);
    onClose();
  }

  async function neemOver(code: string) {
    await onKoppel(code);
    setOvergenomen((codes) => [...codes, code]);
  }

  async function neemAllesOver() {
    setBulkBezig(true);
    try {
      for (const s of teKiezen) {
        await neemOver(s.code);
      }
    } finally {
      setBulkBezig(false);
    }
  }

  return (
    <Sheet open={open} onClose={sluit} title="AI-suggesties voor themadoelen">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-zwak">
        Stap {stap === "intro" ? "1" : "2"} van 2 — {stap === "intro" ? "genereren" : "beoordelen"}
      </p>

      {stap === "intro" && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-ink-zacht">
            De AI kijkt naar de naam, invalshoeken en woordenschat van <b>{thema.naam}</b> en stelt passende
            leerplandoelen voor. Jij beslist welke je overneemt, één voor één of in bulk.
          </p>
          <Button
            disabled={aiSuggesties.isPending}
            onClick={() =>
              aiSuggesties.mutate({
                thema: {
                  naam: thema.naam,
                  invalshoeken: thema.invalshoeken,
                  duurWeken: thema.duurWeken,
                  kernwoordenschat: thema.kernwoordenschat,
                  rijkeWoordenschat: thema.rijkeWoordenschat,
                },
              })
            }
          >
            <IconSparkle className="h-4 w-4" /> {aiSuggesties.isPending ? "AI denkt na…" : "Genereer suggesties"}
          </Button>
          {aiSuggesties.isError && (
            <p className="rounded-xl bg-suggestie-geweigerd/10 p-3 text-sm text-suggestie-geweigerd">
              Kon geen AI-suggesties ophalen. Is de AI-integratie geconfigureerd op de backend?
            </p>
          )}
        </div>
      )}

      {aiSuggesties.isPending && stap === "resultaten" && <Spinner label="AI denkt na…" />}

      {stap === "resultaten" && aiSuggesties.data && !aiSuggesties.data.isGeslaagd && (
        <div className="text-center">
          <p className="mb-3 rounded-xl bg-suggestie-geweigerd/10 p-3 text-sm text-suggestie-geweigerd">
            De AI gaf geen bruikbaar antwoord. Probeer opnieuw.
          </p>
          <Button variant="secundair" onClick={() => aiSuggesties.reset()}>
            Opnieuw proberen
          </Button>
        </div>
      )}

      {stap === "resultaten" && aiSuggesties.data?.isGeslaagd && (
        <>
          {teKiezen.length > 0 && (
            <Button size="klein" className="mb-3 w-full" disabled={bulkBezig || koppelBezig} onClick={neemAllesOver}>
              {bulkBezig ? "Bezig…" : `Alles aanvaarden (${teKiezen.length})`}
            </Button>
          )}
          <ul className="flex flex-col gap-2">
            {aiSuggesties.data.suggesties.length === 0 && (
              <li className="text-sm text-ink-zwak">Geen suggesties deze keer.</li>
            )}
            {aiSuggesties.data.suggesties.map((s) => {
              const alGekoppeld = gekoppeldeCodes.includes(s.code) || overgenomen.includes(s.code);
              return (
                <li key={s.code} className="rounded-xl border border-rand bg-surface-verhoogd p-3">
                  <p className="font-mono text-xs font-semibold text-ink-zacht">{s.code}</p>
                  <p className="mt-0.5 text-sm italic text-ink-zacht">"{s.motivatie}"</p>
                  <Button
                    size="klein"
                    className="mt-2"
                    disabled={alGekoppeld || bulkBezig || koppelBezig}
                    onClick={() => neemOver(s.code)}
                  >
                    {alGekoppeld ? "Al gekoppeld" : "Overnemen als themadoel"}
                  </Button>
                </li>
              );
            })}
          </ul>
          <Button variant="geest" className="mt-3 w-full" onClick={() => aiSuggesties.reset()}>
            Opnieuw genereren
          </Button>
        </>
      )}
    </Sheet>
  );
}
