import { Merk } from "../../app/Merk";
import { Knoplink } from "../../components/ui/Knop";
import { t } from "../../i18n";
import { aanmeldAdres } from "../../lib/aanmelding";
import { useSchermtitel } from "../../lib/useSchermtitel";

/**
 * Where a sign-out lands (TB-032): `/afgemeld`, the `post_logout_redirect_uri` of the Microsoft sign-out and the
 * direct destination in development.
 *
 * **Outside the shell, and it asks the API nothing when it opens**, like `GeenToegangScherm`. Landing on the root
 * instead would read the signed-in person, get a 401, and send the browser straight back to Microsoft, which signs a
 * known account in again without a password: the sign-out would seem to do nothing. `aanmeldOmleiding` leaves this
 * address alone for the same reason.
 *
 * The reminder about a shared computer is Microsoft's own advice: the app cannot end what the browser or Windows
 * keeps of the Microsoft account, so closing every window is what makes the sign-out complete there.
 *
 * Signing in again is the one action, and the primary one (one of the accent's five uses).
 */
export function AfgemeldScherm() {
  useSchermtitel(t("aanmelding.afgemeld.titel"));
  return (
    <main className="min-h-dvh px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-[34rem]">
        <Merk groot />

        <h1 className="mt-12 font-display text-scherm text-inkt">{t("aanmelding.afgemeld.titel")}</h1>
        <p className="mt-4 text-body text-inkt-zacht">{t("aanmelding.afgemeld.gedeeldeComputer")}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Knoplink rang="hoofd" href={aanmeldAdres("/")}>
            {t("aanmelding.afgemeld.opnieuw")}
          </Knoplink>
        </div>
      </div>
    </main>
  );
}
