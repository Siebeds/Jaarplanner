import type { ReactNode } from "react";
import { t } from "../i18n";

/**
 * What stands on screen while the app cannot show itself yet (TB-026): the wordmark, enlarged, the year
 * bar under it, and whatever the caller puts below.
 *
 * **Drawn twice, here and in `index.html`**, which puts the same markup in `#root` so a browser still
 * loading the script shows this and nothing else. Both use the `tussenpagina` classes in `index.css`, so
 * React replacing the static copy changes nothing on screen for as long as the two stay one drawing.
 * Change one, change the other.
 *
 * `bezig` sets the year bar moving: the accent passes from period to period, the one shape this app is
 * about doing the waiting (the fill of the year strip, one of the accent's five uses).
 */
export function Tussenpagina({ bezig = false, children }: { bezig?: boolean; children?: ReactNode }) {
  return (
    <main className="tussenpagina">
      <h1 className="tussenpagina-naam">{t("app.naam")}</h1>
      <span aria-hidden="true" className="tussenpagina-balk" data-bezig={bezig || undefined}>
        <span />
        <span />
        <span />
      </span>
      {children}
    </main>
  );
}
