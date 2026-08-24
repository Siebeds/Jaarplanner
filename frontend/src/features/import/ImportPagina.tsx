import { Uitleg } from "../../app/uitleg";
import { t } from "../../i18n";
import { Opstapimport } from "./Opstapimport";
import { Schoolcontentimport } from "./Schoolcontentimport";

/**
 * The Import screen (E1-13), at `/import` — the destination `docs/ux/ui-ux-approach.md` §3 describes as
 * *"Op.stap goals (beheerder) and thema/activiteit Excel"*.
 *
 * **One page, two sections stacked, school content first and dominant.** Deliberately not tabs. The two flows
 * differ in audience (leerkracht vs directie), in input (a mode vs a discipline number) and in meaning (the
 * school's own content vs decreed reference data), so they need a visible boundary; but FR-2.5's review notice
 * must not be hidden behind a tab nobody opened, and at ~390px a stack is the honest layout anyway.
 *
 * **The audience differs per section, and §3.2 says so.** *Thema's/activiteiten invoeren* is for Beheerder
 * **and** Leerkracht (FR-1.1); *Leerdoelen inladen/vernieuwen* is Beheerder only. So the route is not
 * directie-only (`routes.ts` → `magBeheerder: false`) and the beheerder marking lives on the Op.stap section
 * (`OPSTAP_SECTIE_ALLEEN_BEHEERDER`). Nothing is enforced anywhere yet: the API is unauthenticated today
 * (E6-01/E6-02, gated by E7-11), so a client-side gate here would be security theatre over an open endpoint.
 * Saying which section is beheerderswerk is honest; pretending to enforce it is not.
 */
export function ImportPagina() {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-bold text-ink">{t("import.titel")}</h2>
        <Uitleg><p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-zacht">{t("import.uitleg")}</p></Uitleg>
      </header>

      <Schoolcontentimport />
      <Opstapimport />
    </section>
  );
}
