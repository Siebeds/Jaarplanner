import { useState } from "react";

import { t } from "../../i18n";
import { Jaarplankalender } from "./Jaarplankalender";

/**
 * The jaarplan page (E3-06). Until the app has class navigation (E6), it takes the klas-id from an
 * input so the kalender is genuinely reachable rather than only unit-testable — the same shape as
 * {@link ../matching/DoelsuggestieReview}, and for the same reason: this project has three times
 * shipped a feature nobody could reach.
 *
 * All copy via nl.json (Art. II.3).
 */
export function JaarplanPagina() {
  const [klasId, setKlasId] = useState("");

  return (
    <section className="w-full max-w-6xl text-left">
      <label className="block text-sm font-medium" htmlFor="klas-id">
        {t("kalender.klasIdLabel")}
      </label>
      <input
        id="klas-id"
        type="text"
        value={klasId}
        onChange={(event) => setKlasId(event.target.value.trim())}
        placeholder={t("kalender.klasIdPlaceholder")}
        className="mt-1 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      <div className="mt-6">
        <Jaarplankalender klasId={klasId} />
      </div>
    </section>
  );
}
