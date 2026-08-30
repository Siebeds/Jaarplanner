import { useMinimumdoelen } from "../../lib/queries";
import type { MinimumdoelFilterQuery, MinimumdoelRegel } from "../../lib/types";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Leegte } from "../../components/ui/Leegte";
import { t } from "../../i18n";

/**
 * The decreed minimumdoelen, grouped by the discipline of the leerplandoelen they are concorded to.
 *
 * A minimumdoel has no discipline of its own (Art. VII.0), so the same ref can appear under more
 * than one heading. That is the concordance being honest rather than a duplicate: the backend
 * returns one row per (minimumdoel, bucket), and forcing them into a single heading would hide that
 * a government target is taught in two subjects.
 *
 * The concorded leerplandoel codes travel with each row, so a teacher can jump from an inspection
 * level target to the goals that actually cover it.
 */
export function Minimumdoelenlijst({
  filter,
  onKiesDoel,
}: {
  filter: MinimumdoelFilterQuery;
  onKiesDoel: (code: string) => void;
}) {
  const { data, isPending, isError } = useMinimumdoelen({ ...filter, aantal: 200 });

  if (isPending) return <Laadlijst rijen={6} />;
  if (isError) return <Leegte titel={t("doelen.foutTitel")} />;

  const regels = data?.regels ?? [];
  if (regels.length === 0) {
    return <Leegte titel={t("doelen.geenMinimumdoelenTitel")} actie={<p className="text-meta text-inkt-zacht">{t("doelen.geenMinimumdoelenActie")}</p>} />;
  }

  const groepen = groepeerPerDiscipline(regels);

  return (
    <ul className="flex flex-col gap-2">
      {groepen.map(([discipline, rijen]) => (
        <li key={discipline} className="overflow-hidden rounded-kaart border border-lijn bg-kaart shadow-licht">
          <h2 className="flex items-center justify-between gap-3 border-b border-lijn px-4 py-3">
            <span className="font-display text-sectie text-inkt">{discipline}</span>
            <span className="mono text-meta text-inkt-zwak">{rijen.length}</span>
          </h2>
          <ul className="divide-y divide-lijn">
            {rijen.map((regel) => (
              <li key={`${regel.ref}-${regel.domein}-${regel.subdomein}`} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="mono rounded bg-doelsoort-md px-1.5 py-0.5 text-[0.625rem] font-medium text-doelsoort-md-op">
                    {regel.ref}
                  </span>
                  <span className="truncate text-meta text-inkt-zwak">
                    {regel.domein} / {regel.subdomein}
                  </span>
                </div>
                <p className="mt-1.5 text-body text-inkt">{regel.omschrijving}</p>
                {regel.leerplandoelCodes.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1">
                    {regel.leerplandoelCodes.map((code) => (
                      <li key={code}>
                        <button
                          type="button"
                          onClick={() => onKiesDoel(code)}
                          className="mono rounded border border-lijn px-1.5 py-0.5 text-[0.625rem] text-inkt-zacht transition-colors duration-150 hover:border-lijn-sterk hover:text-inkt"
                        >
                          {code}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/** Groups in first-seen order, which is the order the backend already sorted them in. */
function groepeerPerDiscipline(regels: MinimumdoelRegel[]): [string, MinimumdoelRegel[]][] {
  const groepen = new Map<string, MinimumdoelRegel[]>();
  for (const regel of regels) {
    const sleutel = regel.disciplineNaam ?? regel.disciplineNummer;
    const bestaand = groepen.get(sleutel);
    if (bestaand) bestaand.push(regel);
    else groepen.set(sleutel, [regel]);
  }
  return [...groepen.entries()];
}
