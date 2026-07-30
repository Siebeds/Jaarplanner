import { DoelsoortBadge } from "../../components/DoelsoortBadge";
import { doelsoortBadgeSoort } from "../../components/doelsoort";
import { t } from "../../i18n";
import { useOngekoppeldeDoelen } from "./useDoelsuggesties";
import type { OngekoppeldDoel } from "./types";

/**
 * The "ongekoppelde doelen" view (E2-06, FR-4.4): the Op.stap leerplandoelen that are (nog) niet aan
 * een thema gekoppeld. It renders the code, the doelsoort badge (colour from the design tokens, never
 * the sole signal — the badge also carries the abbreviation + label) and the browse context
 * (jaar/fase, domein · subdomein, goal text), all copy via nl.json (Art. II.3).
 * <para>
 * The list is driven entirely by the server query ({@link useOngekoppeldeDoelen}); it is never derived
 * from local state. Because {@link useWijzigSuggestieStatus} invalidates the gap-list query on every
 * accept/reject/adjust, the list updates as links change (the "updates as links change" of FR-4.4) —
 * "gekoppeld" = a link with status aanvaard/manueel (Art. V).
 * </para>
 */

export function OngekoppeldeDoelenLijst() {
  const { data, isLoading, isError } = useOngekoppeldeDoelen();

  if (isLoading) {
    return (
      <p role="status" className="text-sm text-ink-zacht">
        {t("ongekoppeld.laden")}
      </p>
    );
  }

  if (isError) {
    return (
      <p
        role="alert"
        className="rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
      >
        {t("ongekoppeld.fout")}
      </p>
    );
  }

  const doelen = data ?? [];

  if (doelen.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-ink-zacht">
        {t("ongekoppeld.leeg")}
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-ink-zacht" data-cijfers>
        {t("ongekoppeld.aantal", { aantal: doelen.length })}
      </p>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {doelen.map((doel) => (
          <DoelRij key={doel.code} doel={doel} />
        ))}
      </ul>
    </div>
  );
}

function DoelRij({ doel }: { doel: OngekoppeldDoel }) {
  const { code, doelsoort, jaarFase, domein, subdomein, tekst } = doel;

  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-paper px-2 py-1 font-mono text-sm font-semibold text-ink">
          {code}
        </span>
        <DoelsoortBadge doelsoort={doelsoortBadgeSoort[doelsoort]} />
      </div>

      <p className="mt-2 text-xs text-ink-zacht">
        {t("ongekoppeld.domeinKop", { domein, subdomein })}
        {" · "}
        {t("ongekoppeld.jaarFaseLabel")}: {jaarFase}
      </p>

      <p className="mt-2 text-sm leading-snug text-ink">{tekst}</p>
    </li>
  );
}
