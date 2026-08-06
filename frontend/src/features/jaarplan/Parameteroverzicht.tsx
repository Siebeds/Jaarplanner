import { t, tAantal } from "../../i18n";
import { formatteerDatum } from "./kalenderFormat";
import type { Parameterrapport } from "./types";

/**
 * What became of the teacher's pre-generation parameters (E3-04, FR-5.4).
 *
 * **Every sentence is composed here, from `nl.json`, and every date is formatted here.** The server deliberately
 * returns records rather than prose for exactly this reason: an earlier backend draft returned strings like
 * `"Herfst @ 2026-09-01 (Schoolfeest)"`, which is server-authored Dutch carrying an ISO date no Dutch teacher
 * reads. E3-06 was reverted once for putting a server-generated string in front of a user while the Art. II.3
 * ruling is open, and this is the same trap one story later.
 *
 * **Four outcomes stay apart, because a teacher acts differently on each:**
 * - the model *declined* a request → re-run, or place it by hand;
 * - the teacher's own two instructions *conflicted* → change one of them;
 * - the tool *refused* a placement → the thema is now planned nowhere and needs a period;
 * - an instruction *could not be applied* → the date was in no period at all.
 *
 * Collapsing them into "parameters honoured: yes/no" would hide which happened. Nothing here is a verdict: like
 * the spreading report it states facts and the teacher decides (Art. IV.1).
 */
export interface ParameteroverzichtProps {
  rapport: Parameterrapport;
}

export function Parameteroverzicht({ rapport }: ParameteroverzichtProps) {
  const {
    gehonoreerdeStartthemas,
    nietGehonoreerdeStartthemas,
    tegenstrijdigeStartthemas,
    onbekendeStartthemas,
    vervallenStartthemas,
    geweigerdDoorVastMoment,
    toegepasteVasteMomenten,
    onplaatsbareVasteMomenten,
  } = rapport;

  // Every list, including the refusals. An earlier revision omitted `geweigerdDoorVastMoment` here, so a run
  // whose only outcome was a refused placement rendered *nothing at all* — hiding the single most actionable
  // message on the screen, since that thema ends up planned nowhere. In practice a refusal implies an applied
  // moment, so the case looked unreachable; a test asserted it directly and it was not.
  const nietsGevraagd =
    gehonoreerdeStartthemas.length === 0 &&
    nietGehonoreerdeStartthemas.length === 0 &&
    tegenstrijdigeStartthemas.length === 0 &&
    onbekendeStartthemas.length === 0 &&
    vervallenStartthemas.length === 0 &&
    geweigerdDoorVastMoment.length === 0 &&
    toegepasteVasteMomenten.length === 0 &&
    onplaatsbareVasteMomenten.length === 0;

  if (nietsGevraagd) {
    return null;
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
        {t("parameters.rapportTitel")}
      </h3>

      <ul className="mt-1.5 flex flex-col gap-1.5 text-xs text-ink">
        {gehonoreerdeStartthemas.length > 0 && (
          <li>
            {tAantal(
              gehonoreerdeStartthemas.length,
              "parameters.rapportGehonoreerdEnkelvoud",
              "parameters.rapportGehonoreerd",
              { themas: gehonoreerdeStartthemas.join(", ") },
            )}
          </li>
        )}

        {/* The model declined. Attention, not error: the plan stands and nothing is broken. Icon AND word,
            never colour alone (Art. XII, WCAG 2.2 AA). */}
        {nietGehonoreerdeStartthemas.length > 0 && (
          <li className="font-medium text-attentie-ink">
            <span aria-hidden="true">▲</span>{" "}
            {tAantal(
              nietGehonoreerdeStartthemas.length,
              "parameters.rapportNietGehonoreerdEnkelvoud",
              "parameters.rapportNietGehonoreerd",
              { themas: nietGehonoreerdeStartthemas.join(", ") },
            )}
          </li>
        )}

        {/* The teacher's own two instructions could not both hold. Kept separate from the line above on
            purpose: telling them the AI ignored their request would be false, and they would re-run instead of
            changing the instruction that actually blocked it. */}
        {tegenstrijdigeStartthemas.length > 0 && (
          <li className="font-medium text-attentie-ink">
            <span aria-hidden="true">▲</span>{" "}
            {tAantal(
              tegenstrijdigeStartthemas.length,
              "parameters.rapportTegenstrijdigEnkelvoud",
              "parameters.rapportTegenstrijdig",
              { themas: tegenstrijdigeStartthemas.join(", ") },
            )}
          </li>
        )}

        {/* A name the school does not own. Only reachable if the thema list changed under the form, since the
            picker offers nothing else — but reported rather than assumed unreachable. */}
        {onbekendeStartthemas.length > 0 && (
          <li className="font-medium text-attentie-ink">
            <span aria-hidden="true">▲</span>{" "}
            {tAantal(
              onbekendeStartthemas.length,
              "parameters.rapportOnbekendEnkelvoud",
              "parameters.rapportOnbekend",
              { themas: onbekendeStartthemas.join(", ") },
            )}
          </li>
        )}

        {/* A kept preference whose period no longer exists: the vakantiedata changed after it was saved. Reported
            here as well as in the form, because the two answer different questions — the form says "this setting is
            stranded", this says "that is why nothing was asked of the AI for it". Never dropped and never moved to a
            neighbouring period (directie 2026-07-28). */}
        {vervallenStartthemas.length > 0 && (
          <li className="font-medium text-attentie-ink">
            <span aria-hidden="true">▲</span>{" "}
            {tAantal(
              vervallenStartthemas.length,
              "parameters.rapportVervallenEnkelvoud",
              "parameters.rapportVervallen",
              {
                themas: vervallenStartthemas
                  .map((keuze) =>
                    t("parameters.rapportVervallenItem", {
                      thema: keuze.themaNaam,
                      datum: formatteerDatum(keuze.blokStart),
                    }),
                  )
                  .join(" · "),
              },
            )}
          </li>
        )}

        {toegepasteVasteMomenten.length > 0 && (
          <li>
            {tAantal(
              toegepasteVasteMomenten.length,
              "parameters.rapportMomentenEnkelvoud",
              "parameters.rapportMomenten",
              {
                momenten: toegepasteVasteMomenten
                  .map((moment) =>
                    t("parameters.rapportMoment", {
                      naam: moment.naam,
                      datum: formatteerDatum(moment.datum),
                    }),
                  )
                  .join(" · "),
              },
            )}
          </li>
        )}

        {/* Its date fell in no period — outside the school year, or inside a vakantie, which belongs to no
            period. Said out loud because a teacher who blocked a period and saw nothing refused would
            otherwise conclude it had worked. */}
        {onplaatsbareVasteMomenten.length > 0 && (
          <li className="font-medium text-attentie-ink">
            <span aria-hidden="true">▲</span>{" "}
            {tAantal(
              onplaatsbareVasteMomenten.length,
              "parameters.rapportOnplaatsbaarEnkelvoud",
              "parameters.rapportOnplaatsbaar",
              {
                momenten: onplaatsbareVasteMomenten
                  .map((moment) =>
                    t("parameters.rapportMoment", {
                      naam: moment.naam,
                      datum: formatteerDatum(moment.datum),
                    }),
                  )
                  .join(" · "),
              },
            )}
          </li>
        )}
      </ul>

      {/* Refusals get their own block rather than a list line, because each one carries the model's motivation
          and is the only place a teacher can still read what was proposed. The run left that thema planned nowhere,
          so this is the most actionable thing on the screen after a parameterised run.

          **Worded as a run fact, and that is a fix rather than a style choice** (antagonist round 3). The heading
          said "Thema's die *nu* in geen enkele themaperiode staan" and the closing line said "Deze thema's zijn niet
          ingepland. Geef ze zelf een themaperiode" — both present-tense claims about the current plan, in a panel
          that is NOT withheld when the plan changes under it. A teacher who followed that instruction then read it
          again, unchanged, directly below "je hebt het jaarplan aangepast". The remedy survives as a conditional
          ("staan ze er nog altijd niet"), because this component cannot see the live plan and a remedy that asserts
          the state it is remedying is the defect. */}
      {geweigerdDoorVastMoment.length > 0 && (
        <div className="mt-3 rounded-md border border-attentie bg-attentie/10 p-3">
          <p className="text-xs font-semibold text-attentie-ink">
            <span aria-hidden="true">▲</span>{" "}
            {tAantal(
              geweigerdDoorVastMoment.length,
              "parameters.rapportGeweigerdEnkelvoud",
              "parameters.rapportGeweigerd",
            )}
          </p>

          <ul className="mt-2 flex flex-col gap-2">
            {geweigerdDoorVastMoment.map((geweigerd) => (
              <li
                key={`${geweigerd.themaNaam}-${geweigerd.blokStart}`}
                className="text-xs text-ink"
              >
                <span className="font-medium">
                  {t("parameters.rapportGeweigerdRegel", {
                    thema: geweigerd.themaNaam,
                    datum: formatteerDatum(geweigerd.blokStart),
                    moment: geweigerd.momentNaam,
                  })}
                </span>
                {geweigerd.aiMotivatie && (
                  <span className="text-ink-zacht">
                    {" "}
                    {t("parameters.rapportGeweigerdMotivatie", {
                      motivatie: geweigerd.aiMotivatie,
                    })}
                  </span>
                )}
              </li>
            ))}
          </ul>

          {/* Pluralised too. The heading already said "Thema dat..." in the singular while this line said
              "Deze thema's zijn...", which is the same defect one sentence apart, and one refusal is the common
              case. Found by reading the rendered screen, not by a test. */}
          <p className="mt-2 text-xs text-ink-zacht">
            {tAantal(
              geweigerdDoorVastMoment.length,
              "parameters.rapportGeweigerdWatNuEnkelvoud",
              "parameters.rapportGeweigerdWatNu",
            )}
          </p>
        </div>
      )}
    </div>
  );
}
