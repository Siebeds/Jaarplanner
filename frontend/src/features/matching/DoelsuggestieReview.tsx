import { useState } from "react";

import { t } from "../../i18n";
import { DoelsuggestieGeneratie } from "./DoelsuggestieGeneratie";
import { DoelsuggestieLijst } from "./DoelsuggestieLijst";
import { OngekoppeldeDoelenLijst } from "./OngekoppeldeDoelenLijst";

/**
 * The doelsuggestie page (E2-05 review + E2-08 trigger). Until the app has thema navigation, it takes the
 * thema-id from an input so the flow is reachable and demonstrable; once the themapagina exists it will
 * render the trigger and list for the selected thema directly (app-shell routing is E0-10).
 *
 * **E2-08 put the trigger above the list**, in that order deliberately: the review list was the whole
 * screen before, and it could only ever render "er zijn nog geen AI-doelsuggesties" because nothing in the
 * app could create one. Generating is now the first thing on the page, and the list below it is the result.
 *
 * All copy via nl.json (Art. II.3).
 */
export function DoelsuggestieReview() {
  const [themaId, setThemaId] = useState("");

  return (
    <section className="w-full max-w-2xl text-left">
      <h2 className="text-xl font-semibold">{t("matching.titel")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("matching.uitleg")}</p>

      <label className="mt-4 block text-sm font-medium" htmlFor="thema-id">
        {t("matching.themaIdLabel")}
      </label>
      <input
        id="thema-id"
        type="text"
        value={themaId}
        onChange={(event) => setThemaId(event.target.value.trim())}
        placeholder={t("matching.themaIdPlaceholder")}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      <div className="mt-4">
        {themaId.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("matching.geenThema")}</p>
        ) : (
          <div className="flex flex-col gap-4">
            <DoelsuggestieGeneratie themaId={themaId} />
            <DoelsuggestieLijst themaId={themaId} />
          </div>
        )}
      </div>

      {/* School-wide gap list (E2-06, FR-4.4): updates as links change — accepting a suggestion above
          removes its doel here via the shared TanStack Query invalidation. */}
      <section className="mt-8 border-t border-input pt-6">
        <h3 className="text-lg font-semibold">{t("ongekoppeld.titel")}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{t("ongekoppeld.uitleg")}</p>
        <div className="mt-4">
          <OngekoppeldeDoelenLijst />
        </div>
      </section>
    </section>
  );
}
