import { Merk } from "../../app/Merk";
import { Knop, Knoplink } from "../../components/ui/Knop";
import { t } from "../../i18n";
import { aanmeldAdres, useAfmelden } from "../../lib/aanmelding";

/** Why the sign-in did not end in a session. */
export type Aanmeldfout = "geweigerd" | "mislukt";

/**
 * Where a sign-in ends when it does not end in a session (E6-01, ADR-0031). Two cases, one page:
 *
 * - **`geweigerd`** (`/geen-toegang`): Microsoft knows the person and Jaarplanner does not let them in.
 * - **`mislukt`** (`/aanmelden-mislukt`): the sign-in itself did not complete. Among the causes: consent was
 *   cancelled, Entra returned an error, the round trip took too long, or the app's own check failed while handling
 *   the answer (a database outage during the invitation gate lands here too). Nobody refused anything, so the
 *   refusal's sentences would be false here, and because the cause may be on either side, this case's own sentence
 *   says only that signing in did not work.
 *
 * **Outside the shell, and it asks the API nothing when it opens.** The shell's navigation reads the
 * signed-in person, and every read here would answer 401, send the browser to the sign-in, have
 * Microsoft sign the same account in again without a click, and land here again. The page therefore
 * renders from the catalogue alone, and `aanmeldOmleiding` leaves both addresses alone.
 *
 * **The refusal's sentences hold for every reason a login is refused**: a token without the account's
 * identifiers, another tenant's account, a guest in the school's tenant, an app registration that does
 * not say "member", or simply nobody having invited this person. So it does not say that directie
 * forgot anyone, because in four of those five cases directie did nothing wrong.
 *
 * Trying again is the primary action (one of the accent's five uses). Choosing another account steps
 * back to `stil`, and is only offered on a refusal, where the wrong account is a likely cause.
 */
export function GeenToegangScherm({ soort = "geweigerd" }: { soort?: Aanmeldfout }) {
  const afmelden = useAfmelden();
  const mislukt = soort === "mislukt";

  return (
    <main className="min-h-dvh px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-[34rem]">
        <Merk />

        <h1 className="mt-12 font-display text-scherm text-inkt">
          {mislukt ? t("aanmelding.mislukt.titel") : t("aanmelding.geenToegang.titel")}
        </h1>
        {mislukt ? (
          <p className="mt-4 text-body text-inkt-zacht">{t("aanmelding.mislukt.uitleg")}</p>
        ) : (
          <>
            <p className="mt-4 text-body text-inkt-zacht">{t("aanmelding.geenToegang.uitleg")}</p>
            <p className="mt-3 text-body text-inkt-zacht">{t("aanmelding.geenToegang.watNu")}</p>
          </>
        )}

        <div className="mt-8 flex flex-wrap gap-3">
          <Knoplink rang="hoofd" href={aanmeldAdres("/")}>
            {t("aanmelding.geenToegang.opnieuw")}
          </Knoplink>
          {mislukt ? null : (
            <Knop rang="stil" onClick={() => afmelden.mutate()} disabled={afmelden.isPending}>
              {t("aanmelding.geenToegang.anderAccount")}
            </Knop>
          )}
        </div>

        {afmelden.isError ? (
          <p role="alert" className="mt-4 text-meta text-gevaar">
            {t("aanmelding.afmeldenMislukt")}
          </p>
        ) : null}
      </div>
    </main>
  );
}
