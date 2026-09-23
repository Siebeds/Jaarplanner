import { useEffect } from "react";
import { t } from "../i18n";

/**
 * Names the browser tab after the screen: "<scherm> · <app>" (WCAG 2.4.2).
 *
 * Without it every tab and every step in the history carried the same name, and a screen reader heard no new title
 * when the screen changed. `Schermkop` calls this with its own title, so every screen that has a header is named by
 * the same words it shows; a screen outside the shell calls it itself.
 */
export function useSchermtitel(scherm: string) {
  useEffect(() => {
    document.title = t("app.schermtitel", { scherm, app: t("app.naam") });
  }, [scherm]);
}
