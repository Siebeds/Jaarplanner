import { Link, useLocation } from "react-router-dom";

import { t } from "../i18n";
import { JAARPLAN_PAD } from "./routes";

/**
 * Catch-all for a URL that matches no route (E0-10). Real URLs mean real broken bookmarks: once links are
 * shareable, a teacher will eventually open a stale one, and a blank screen would look like the tool is
 * down. The way back keeps the query string, so a class chosen earlier survives.
 */
export function NietGevondenPagina() {
  const location = useLocation();

  return (
    <section className="max-w-2xl">
      <h2 className="text-xl font-semibold text-foreground">{t("navigatie.nietGevondenTitel")}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("navigatie.nietGevondenUitleg")}</p>
      <Link
        to={{ pathname: JAARPLAN_PAD, search: location.search }}
        className="mt-4 inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {t("navigatie.naarJaarplan")}
      </Link>
    </section>
  );
}
