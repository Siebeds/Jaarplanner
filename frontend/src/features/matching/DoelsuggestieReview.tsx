import { useState } from "react";

import { t } from "../../i18n";
import { DoelsuggestieLijst } from "./DoelsuggestieLijst";
import { OngekoppeldeDoelenLijst } from "./OngekoppeldeDoelenLijst";

/**
 * The doelsuggestie review page (E2-05).
 *
 * It still takes the thema-id from a text field. That is **not** a design choice — a real thema list is
 * **E1-14** (beheer-UI) and generating suggestions at all is **E2-08**, so until one of those lands this is
 * the only way the flow is reachable, and a reachable screen beats an unreachable one. The field now says
 * out loud that it is a stopgap, rather than sitting there looking like the intended way in.
 *
 * All copy via nl.json (Art. II.3).
 */
export function DoelsuggestieReview() {
  const [themaId, setThemaId] = useState("");

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="matching-titel" className="flex flex-col gap-5">
        <header>
          <h2 id="matching-titel" className="text-2xl font-bold text-ink sm:text-[1.75rem]">
            {t("matching.titel")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-zacht">
            {t("matching.uitleg")}
          </p>
        </header>

        <div className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
          <label className="block text-sm font-semibold text-ink" htmlFor="thema-id">
            {t("matching.themaIdLabel")}
          </label>
          <p className="mt-0.5 text-xs text-ink-zacht">{t("matching.themaIdStopgap")}</p>
          <input
            id="thema-id"
            type="text"
            value={themaId}
            onChange={(event) => setThemaId(event.target.value.trim())}
            placeholder={t("matching.themaIdPlaceholder")}
            className="mt-2.5 h-11 w-full max-w-lg rounded-md border border-input bg-card px-3.5 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-zacht"
          />
        </div>

        {themaId.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-ink-zacht">
            {t("matching.geenThema")}
          </p>
        ) : (
          <DoelsuggestieLijst themaId={themaId} />
        )}
      </section>

      {/* School-wide gap list (E2-06, FR-4.4): updates as links change — accepting a suggestion above
          removes its doel here via the shared TanStack Query invalidation. */}
      <section aria-labelledby="ongekoppeld-titel" className="border-t border-border pt-8">
        <h3 id="ongekoppeld-titel" className="text-xl font-bold text-ink">
          {t("ongekoppeld.titel")}
        </h3>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-ink-zacht">
          {t("ongekoppeld.uitleg")}
        </p>
        <div className="mt-5">
          <OngekoppeldeDoelenLijst />
        </div>
      </section>
    </div>
  );
}
