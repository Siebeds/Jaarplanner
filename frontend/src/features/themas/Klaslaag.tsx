import { useState } from "react";

import { useSchooljaren } from "../../app/schooljaren";
import { t } from "../../i18n";
import { Subthemaformulier } from "./Subthemaformulier";
import { Subthemakaart } from "./Subthemakaart";
import type { Subthema, SubthemaInvoer } from "./types";
import { useMaakSubthema, useThemaVoorKlas } from "./useThemas";

/**
 * The class-scoped half of a thema: this class's subthema's, their subdoelen and their activiteiten
 * (E1-14, Art. IX.2).
 *
 * **It asks the server for one class** (`…/voor-klas/{klasId}`), so no other class's content is in the tab to
 * begin with. With no class chosen it makes no request at all and says so: a section that silently showed
 * every class's derivations would be the exact cross-class bleed Art. IX.2 forbids, and one that spun forever
 * would be worse than a sentence.
 *
 * **Landing 2 made this half writable.** In landing 1 it was read-only with a sentence pointing at Import;
 * that sentence and its catalogue key are gone, because the affordances it apologised for now exist. Each
 * subthema owns its own controls in {@link Subthemakaart}, so state cannot leak between two subthema's.
 */
export interface KlaslaagProps {
  themaId: string;
  /** The class chosen in the shell, or "" when none is. */
  klasId: string;
}

export function Klaslaag({ themaId, klasId }: KlaslaagProps) {
  const heeftKlas = klasId.length > 0;
  const thema = useThemaVoorKlas(themaId, heeftKlas ? klasId : undefined);
  const schooljaren = useSchooljaren();
  const [nieuw, setNieuw] = useState(false);
  /**
   * "Someone else already deleted it", raised by a card and said here.
   *
   * It lives at section level because the fix for antagonist round 3's MAJOR 1 refetches on that 404, so the
   * row (and any notice inside it) is gone by the time a teacher would read it. The section survives, so the
   * sentence does.
   */
  const [alWeg, setAlWeg] = useState<"subthema" | "activiteit" | null>(null);
  /**
   * "It moved, and here is where it went", raised by an activiteit row and said here (E4-08).
   *
   * Same reason as `alWeg` and a sharper case of it: a move to a subthema of **another thema** takes the
   * activiteit off this screen, because this half shows one thema. So the row that performed the move is gone
   * by the time anyone could read a confirmation inside it, and without this notice a successful move looks
   * exactly like a delete. It names the destination for that reason: "it worked" would not tell a teacher
   * where to look.
   */
  const [verplaatst, setVerplaatst] = useState<{ activiteit: string; subthema: string; thema: string } | null>(
    null,
  );

  const maakSubthema = useMaakSubthema();

  /*
    **Both notices are cleared by the *event* of a later successful write, never by reading the mutation's
    state** (E4-08's antagonist round 1, and it corrects E1-14's round-4 fix rather than adding to it).

    That round replaced a per-call-site reset with a render-phase `if (alWeg && maakSubthema.isSuccess)`, on the
    reasoning that reading it off the mutation state keeps the rule in one place. The rule is right and the
    mechanism is not: `isSuccess` is **latched**, not an event, and nothing in this feature calls `.reset()`. So
    after one successful subthema create it stays `true` for the whole mount, and the guard then fires on the
    same render that *raises* a notice and throws it away. Concretely: create a subthema, then move an
    activiteit, and the confirmation never paints, which is the one flow where it is the only feedback there is
    (a move to another thema takes the row off this screen). Every test wrote once, so the suite could not see
    it.

    The clearing therefore happens in the create path's `onSuccess`, which is the actual event, and there is
    exactly one such call site, so the "one place" argument is unaffected.
  */
  function wisMeldingen() {
    setAlWeg(null);
    setVerplaatst(null);
  }

  // The class's own name, so the heading reads "Van L3 derde leerjaar" rather than a GUID. The selector's list
  // is the only place names live; a class the URL names but the list does not contain gets a neutral fallback
  // rather than an invented name.
  const klasNaam =
    schooljaren.data
      ?.flatMap((schooljaar) => schooljaar.klassen)
      .find((klas) => klas.id === klasId)?.naam ?? t("themabeheer.klasOnbekend");

  const subthemas: Subthema[] = thema.data?.subthemas ?? [];

  function bewaarNieuw(invoer: SubthemaInvoer) {
    maakSubthema.mutate(
      { themaId, invoer },
      {
        onSuccess: () => {
          setNieuw(false);
          wisMeldingen();
        },
      },
    );
  }

  return (
    <section aria-labelledby="thema-klas" className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="thema-klas" className="text-sm font-bold uppercase tracking-wide text-petrol">
            {heeftKlas ? t("themabeheer.klasTitel", { klas: klasNaam }) : t("themabeheer.subthemasLabel")}
          </h3>
          <p className="mt-0.5 max-w-prose text-sm text-ink-zacht">
            {heeftKlas ? t("themabeheer.klasUitleg") : t("themabeheer.klasGeenKeuze")}
          </p>
        </div>

        {/* Only with a klas chosen: a subthema cannot exist without one (Art. IX.2), so offering the control
            before that would be offering a form that cannot be submitted. */}
        {heeftKlas && !nieuw ? (
          <button
            type="button"
            onClick={() => {
              wisMeldingen();
              setNieuw(true);
            }}
            className="rounded-md border border-input px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-diep"
          >
            {t("themabeheer.subthemaNieuw")}
          </button>
        ) : null}
      </div>

      {alWeg ? (
        <p role="alert" className="mt-3 text-sm text-ink-zacht">
          {alWeg === "subthema" ? t("themabeheer.subthemaAlWeg") : t("themabeheer.activiteitAlWeg")}
        </p>
      ) : null}

      {/* `role="status"` rather than `alert`: this is a confirmation of something the teacher just did, so it is
          announced politely instead of interrupting. Mutually exclusive with `alWeg` by construction, since each
          setter clears the other: two notices about the same activiteit would contradict each other. */}
      {verplaatst ? (
        <p role="status" className="mt-3 text-sm text-ink-zacht">
          {t("themabeheer.activiteitVerplaatstNaar", {
            activiteit: verplaatst.activiteit,
            subthema: verplaatst.subthema,
            thema: verplaatst.thema,
          })}
        </p>
      ) : null}

      {heeftKlas ? (
        <>
          {thema.isPending ? (
            <p className="mt-3 text-sm text-ink-zacht">{t("themabeheer.detailLaden")}</p>
          ) : thema.isError ? (
            <p role="alert" className="mt-3 text-sm font-medium text-suggestie-geweigerd">
              {t("themabeheer.detailFout")}
            </p>
          ) : (
            <>
              {subthemas.length === 0 && !nieuw ? (
                <p className="mt-3 text-sm text-ink-zacht">{t("themabeheer.subthemasGeen")}</p>
              ) : null}

              {subthemas.length > 0 ? (
                <ul className="mt-3 flex flex-col gap-3">
                  {subthemas.map((subthema) => (
                    <Subthemakaart
                      key={subthema.id}
                      subthema={subthema}
                      klasId={klasId}
                      klasNaam={klasNaam}
                      onAlWeg={(soort) => {
                        setVerplaatst(null);
                        setAlWeg(soort);
                      }}
                      onVerplaatst={(bestemming) => {
                        setAlWeg(null);
                        setVerplaatst(bestemming);
                      }}
                    />
                  ))}
                </ul>
              ) : null}
            </>
          )}

          {nieuw ? (
            <div className="mt-3">
              <Subthemaformulier
                // No `key` here. Round 3 keyed this on the notice to "clear" it, which the button handler
                // already does; the key's only reachable effect was to remount the form and wipe five typed
                // fields when a delete elsewhere on the screen 404ed (antagonist round 4).
                klasId={klasId}
                klasNaam={klasNaam}
                onBewaar={bewaarNieuw}
                onAnnuleer={() => setNieuw(false)}
                bezig={maakSubthema.isPending}
                fout={maakSubthema.error}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
