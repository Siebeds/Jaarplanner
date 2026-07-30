import { Link, useLocation } from "react-router-dom";

import { buttonVariants } from "../components/ui/button";
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
    <section className="mx-auto flex max-w-xl flex-col items-center px-6 py-14 text-center">
      <h2 className="text-xl font-bold text-ink">{t("navigatie.nietGevondenTitel")}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-zacht">
        {t("navigatie.nietGevondenUitleg")}
      </p>
      <Link
        to={{ pathname: JAARPLAN_PAD, search: location.search }}
        className={`mt-6 ${buttonVariants()}`}
      >
        {t("navigatie.naarJaarplan")}
      </Link>
    </section>
  );
}
