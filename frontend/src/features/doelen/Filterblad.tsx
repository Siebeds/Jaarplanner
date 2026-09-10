import { Blad } from "../../components/ui/Blad";
import { Veld, Keuze } from "../../components/ui/Veld";
import { Knop } from "../../components/ui/Knop";
import type { LeerplandoelFacetten } from "../../lib/types";
import type { Doelenfilter } from "../../state/doelenfilter";
import { t } from "../../i18n";

/**
 * The three dimensions a teacher narrows on here, each with the count the rest of the filter
 * leaves. Doelsoort is deliberately NOT among them: it lives on the Doelsoortbalk on the screen
 * itself, where the proportions are visible, and offering it twice would let the two controls
 * disagree about what is selected.
 *
 * Subdomein is disabled until a domein is chosen, because subdomein names are not globally unique
 * (Art. VII.0): the backend refuses a bare subdomein, so offering one would be offering a 400.
 */
export function Filterblad({
  open,
  onOpenChange,
  filter,
  onWijzig,
  facetten,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: Doelenfilter;
  onWijzig: (filter: Doelenfilter) => void;
  facetten?: LeerplandoelFacetten;
}) {
  const domeinen = facetten?.domeinen ?? [];
  const gekozenDomein = domeinen.find((d) => d.domein === filter.domein);
  const telling = (aantal: number) => ` (${aantal})`;

  return (
    <Blad
      open={open}
      onOpenChange={onOpenChange}
      titel={t("doelen.filtersTitel")}
      voet={
        <div className="flex gap-2">
          <Knop rang="stil" onClick={() => onWijzig({})}>
            {t("doelen.filtersWissen")}
          </Knop>
          <Knop rang="hoofd" vol onClick={() => onOpenChange(false)}>
            {t("doelen.filtersToepassen")}
          </Knop>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Veld label={t("doelen.jaarFase")}>
          {(id) => (
            <Keuze
              id={id}
              value={filter.jaarFase ?? ""}
              onChange={(e) => onWijzig({ ...filter, jaarFase: e.target.value || undefined })}
            >
              <option value="">{t("doelen.alle")}</option>
              {(facetten?.jaarFasen ?? []).map((facet) => (
                <option key={facet.jaarFase} value={facet.jaarFase}>
                  {facet.jaarFase}
                  {telling(facet.aantal)}
                </option>
              ))}
            </Keuze>
          )}
        </Veld>

        <Veld label={t("doelen.domein")}>
          {(id) => (
            <Keuze
              id={id}
              value={filter.domein ?? ""}
              // Changing the domein clears the subdomein: keeping it would send a pair the new
              // domein does not contain, and the list would come back empty for no visible reason.
              onChange={(e) => onWijzig({ ...filter, domein: e.target.value || undefined, subdomein: undefined })}
            >
              <option value="">{t("doelen.alle")}</option>
              {domeinen.map((facet) => (
                <option key={facet.domein} value={facet.domein}>
                  {facet.domein}
                  {telling(facet.aantal)}
                </option>
              ))}
            </Keuze>
          )}
        </Veld>

        <Veld label={t("doelen.subdomein")}>
          {(id) => (
            <Keuze
              id={id}
              disabled={!gekozenDomein}
              value={filter.subdomein ?? ""}
              onChange={(e) => onWijzig({ ...filter, subdomein: e.target.value || undefined })}
            >
              <option value="">{t("doelen.alle")}</option>
              {(gekozenDomein?.subdomeinen ?? []).map((facet) => (
                <option key={facet.subdomein} value={facet.subdomein}>
                  {facet.subdomein}
                  {telling(facet.aantal)}
                </option>
              ))}
            </Keuze>
          )}
        </Veld>
      </div>
    </Blad>
  );
}
