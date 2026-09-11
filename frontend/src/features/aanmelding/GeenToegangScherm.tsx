import { Merk } from "../../app/Merk";
import { Knop, Knoplink } from "../../components/ui/Knop";
import { t } from "../../i18n";
import { aanmeldAdres, useAfmelden } from "../../lib/aanmelding";

/**
 * Where a person lands when Microsoft knows them and Jaarplanner does not let them in (E6-01,
 * ADR-0031 decision 3).
 *
 * **Outside the shell, and it asks the API nothing when it opens.** The shell's navigation reads the
 * signed-in person, and every read here would answer 401, send the browser to the sign-in, have
 * Microsoft sign the same account in again without a click, get refused, and land here again. The
 * page therefore renders from the catalogue alone, and `aanmeldOmleiding` leaves this address alone.
 *
 * **Its sentences hold for every reason a login is refused**: another tenant's account, a guest in
 * the school's tenant, an app registration that does not say "member", or simply nobody having
 * invited this person. So it does not say that directie forgot anyone, because in three of those four
 * cases directie did nothing wrong. It says what is true in all four, and what the person can do.
 *
 * Two ways on, ranked: trying again is the primary action (one of the accent's five uses), because
 * it is the right one once directie has added them; choosing another account steps back to `stil`,
 * because it is the right one only for someone who used the wrong account.
 */
export function GeenToegangScherm() {
  const afmelden = useAfmelden();

  return (
    <main className="min-h-dvh px-4 py-16 sm:py-24">
      <div className="mx-auto max-w-[34rem]">
        <Merk />

        <h1 className="mt-12 font-display text-scherm text-inkt">{t("aanmelding.geenToegang.titel")}</h1>
        <p className="mt-4 text-body text-inkt-zacht">{t("aanmelding.geenToegang.uitleg")}</p>
        <p className="mt-3 text-body text-inkt-zacht">{t("aanmelding.geenToegang.watNu")}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Knoplink rang="hoofd" href={aanmeldAdres("/")}>
            {t("aanmelding.geenToegang.opnieuw")}
          </Knoplink>
          <Knop rang="stil" onClick={() => afmelden.mutate()} disabled={afmelden.isPending}>
            {t("aanmelding.geenToegang.anderAccount")}
          </Knop>
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
