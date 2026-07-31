import { t } from "../../i18n";
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
 * **The audience is stated in words, not enforced.** Functional analysis §3.2 makes import directie-only and
 * `routes.ts` already records that as `magBeheerder`, but the API is unauthenticated today (E6-01/E6-02, gated
 * by E7-11), so a client-side gate here would be security theatre over an open endpoint. Saying which section
 * is beheerderswerk is honest; pretending to enforce it is not.
 */
export function ImportPagina() {
  return (
    <section className="flex flex-col gap-6">
      <header>
        <h2 className="text-xl font-bold text-ink">{t("import.titel")}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-zacht">{t("import.uitleg")}</p>
      </header>

      <Schoolcontentimport />
    </section>
  );
}
