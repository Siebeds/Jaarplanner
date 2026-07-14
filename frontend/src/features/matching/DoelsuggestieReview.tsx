import { useState } from "react";

import { t } from "../../i18n";
import { DoelsuggestieLijst } from "./DoelsuggestieLijst";

/**
 * The doelsuggestie review page (E2-05). Until the app has thema navigation, it takes the thema-id
 * from an input so the review flow is reachable and demonstrable; once the themapagina exists it will
 * render <see cref="DoelsuggestieLijst"/> for the selected thema directly. All copy via nl.json (Art. II.3).
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
          <DoelsuggestieLijst themaId={themaId} />
        )}
      </div>
    </section>
  );
}
