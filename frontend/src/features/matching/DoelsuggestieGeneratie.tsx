import { useState } from "react";

import { Button } from "../../components/ui/button";
import { t, tAantal } from "../../i18n";
import { ApiError } from "../../lib/api";
import { useGenereerDoelsuggesties } from "./useDoelsuggesties";
import type { Doelsuggestiegeneratie, Leerdoelselectie } from "./types";

/**
 * The trigger for FR-4.1 — "de tool **stelt** per thema **voor** met welke leerdoelen het overeenkomt".
 *
 * **This panel is the whole point of E2-08.** The matching service, its prompt builder, its validation, its
 * persistence and the review list below it were all built and tested, and none of it could be reached: the
 * service was called from nothing but its own unit test, so a deployed app showed "er zijn nog geen
 * AI-doelsuggesties" forever. This is the missing button.
 *
 * **Nothing is auto-applied.** A run only ever *adds* proposals, each landing as `Voorgesteld` with its
 * motivation for the teacher to accept, reject or replace (Art. IV.1/IV.2). Re-running is safe: a code
 * already linked to the thema is skipped server-side, so no decision the teacher made is overwritten.
 *
 * **The scope of a run is asked, not assumed.** Which disciplines the school starts with is still an open
 * decision (Art. XIV), so the two filters are offered empty with copy that says what empty means. The
 * default — search everything loaded — is stated on screen and changeable per run, rather than being a
 * hard-coded set nobody can see.
 *
 * All copy comes from `nl.json` via `t()` (Art. II.3). Backend messages are never echoed: the failure
 * branches key on the HTTP status only. Leerplandoel *codes* are rendered, because a code is data the
 * teacher needs, not prose.
 */
export interface DoelsuggestieGeneratieProps {
  themaId: string;
}

/** Splits a comma-separated field into trimmed, non-empty values; an empty field means "no filter". */
function lijst(waarde: string): string[] {
  return waarde
    .split(",")
    .map((deel) => deel.trim())
    .filter((deel) => deel.length > 0);
}

export function DoelsuggestieGeneratie({ themaId }: DoelsuggestieGeneratieProps) {
  const [disciplines, setDisciplines] = useState("");
  const [jaarFasen, setJaarFasen] = useState("");
  const generatie = useGenereerDoelsuggesties(themaId);

  function genereer() {
    const selectie: Leerdoelselectie = {
      disciplines: lijst(disciplines),
      jaarFasen: lijst(jaarFasen),
    };
    generatie.mutate(selectie);
  }

  return (
    <section
      className="rounded-md border border-input bg-muted/40 p-4"
      aria-labelledby="doelsuggestie-generatie-titel"
    >
      <h3 id="doelsuggestie-generatie-titel" className="text-base font-semibold">
        {t("matching.generatieTitel")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("matching.generatieUitleg")}
      </p>

      {/* The Art. XIV seam, made visible: both dimensions optional, and the copy says what leaving them
          empty does. A pre-filled discipline list here would be this story quietly answering "disciplines
          first" on the school's behalf. */}
      <p className="mt-3 text-xs text-muted-foreground">
        {t("matching.selectieUitleg")}
      </p>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label
            className="block text-sm font-medium"
            htmlFor="doelsuggestie-disciplines"
          >
            {t("matching.disciplinesLabel")}
          </label>
          <input
            id="doelsuggestie-disciplines"
            type="text"
            value={disciplines}
            onChange={(event) => setDisciplines(event.target.value)}
            placeholder={t("matching.disciplinesPlaceholder")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <div className="flex-1">
          <label
            className="block text-sm font-medium"
            htmlFor="doelsuggestie-jaarfasen"
          >
            {t("matching.jaarFasenLabel")}
          </label>
          <input
            id="doelsuggestie-jaarfasen"
            type="text"
            value={jaarFasen}
            onChange={(event) => setJaarFasen(event.target.value)}
            placeholder={t("matching.jaarFasenPlaceholder")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
      </div>

      {/* No aria-label: the visible text is the accessible name. An aria-label would replace it, so a
          speech-input user saying "Doelsuggesties genereren" — what is written on the button — could not
          activate it (WCAG 2.2 SC 2.5.3, Label in Name). The text is unique on the panel already. */}
      <div className="mt-3">
        <Button type="button" onClick={genereer} disabled={generatie.isPending}>
          {generatie.isPending
            ? t("matching.genereerBezig")
            : t("matching.genereer")}
        </Button>
      </div>

      {/* 422 = the model answered badly and retrying is sensible; anything else = the tool is broken or
          unconfigured (with no AzureAI:ApiKey the client throws, which surfaces as a 500). Telling a
          teacher "de AI gaf geen bruikbaar antwoord" for a missing key would blame the model for a
          configuration fault and send them into a pointless retry loop. Both messages state that nothing
          was added, which Art. IV.5 guarantees. The response body is never echoed (Art. II.3). */}
      {generatie.isError && (
        <p role="alert" className="mt-3 text-sm text-suggestie-geweigerd">
          {generatie.error instanceof ApiError && generatie.error.status === 422
            ? t("matching.genereerMislukt")
            : t("matching.genereerOnbeschikbaar")}
        </p>
      )}

      {/* The live region is mounted **empty, with the panel**, and filled when a run finishes. A
          `role="status"` element that enters the DOM already populated is frequently not announced at
          all, which would silence the entire run report — including the candidate count, the one thing
          that distinguishes "the AI found nothing" from "there was nothing to search". The box styling
          is applied only once there is something in it, so an empty region draws nothing. */}
      <div
        role="status"
        className={
          generatie.isSuccess
            ? "mt-3 rounded-md border border-input bg-background p-3"
            : undefined
        }
      >
        {generatie.isSuccess && <Runverslag resultaat={generatie.data} />}
      </div>
    </section>
  );
}

/**
 * What one run did. It states facts and passes no judgement: how many suggestions were added, what the
 * server skipped and how many leerplandoelen were searched.
 *
 * The candidate count is not decoration. "0 suggesties" and "there was nothing to search" look identical
 * on screen otherwise, and today the second is the likelier cause — no Op.stap import can be triggered yet
 * (E1-15), so a real deployment holds only demo goals. Skipped codes are named rather than swallowed
 * (Art. III.5/IV.4): the model answering with a code the tool could not resolve is information the teacher
 * is owed.
 */
function Runverslag({ resultaat }: { resultaat: Doelsuggestiegeneratie }) {
  const aantalNieuw = resultaat.bewaard.length;

  return (
    <>
      {resultaat.aantalKandidaten === 0 ? (
        <p className="text-sm font-medium">{t("matching.geenKandidaten")}</p>
      ) : (
        <>
          <p className="text-sm font-medium">
            {aantalNieuw === 0
              ? t("matching.genereerNiets")
              : tAantal(
                  aantalNieuw,
                  "matching.genereerGeluktEnkelvoud",
                  "matching.genereerGelukt",
                )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tAantal(
              resultaat.aantalKandidaten,
              "matching.kandidatenEnkelvoud",
              "matching.kandidaten",
            )}
          </p>
        </>
      )}

      {/* Two things about this line.
          (1) One skipped code must not read "deze codes komen niet …" — Dutch inflects the demonstrative
          and the verb, so the count picks the string (`tAantal`), as the two lines above already do.
          (2) The copy says the code did not match **exactly**; it deliberately does not say the code does
          not exist. The server skips an AI-supplied code on an exact (ordinal) comparison, because a model
          that re-cases a decreed identifier is altering goal identity (Art. III.5) — while the substitution
          field one row below resolves the same string case-insensitively, since a teacher typing it is
          naming a goal rather than redefining one. So `nat-k3-01` can legitimately appear here and still be
          accepted below, and "deze code staat niet in de geladen leerplandoelen" would have been a false
          claim about the curriculum. See the "Case policy" on `DoelMatchingService`. */}
      {resultaat.overgeslagenOnbekend.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {tAantal(
            resultaat.overgeslagenOnbekend.length,
            "matching.onbekendeCodesEnkelvoud",
            "matching.onbekendeCodes",
            { codes: resultaat.overgeslagenOnbekend.join(" · ") },
          )}
        </p>
      )}

      {/* `duplicaatCodes` needs no singular: "Overgeslagen — al aan dit thema gekoppeld: …" names no
          count and carries no demonstrative, so it reads correctly for one code and for ten. */}
      {resultaat.overgeslagenDuplicaat.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {t("matching.duplicaatCodes", {
            codes: resultaat.overgeslagenDuplicaat.join(" · "),
          })}
        </p>
      )}
    </>
  );
}
