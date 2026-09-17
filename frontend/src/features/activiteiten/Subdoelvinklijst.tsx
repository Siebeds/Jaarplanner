import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { IcoonInfo } from "../../components/Iconen";
import { t } from "../../i18n";
import { useLeerplandoel } from "../../lib/queries";

/**
 * The subdoelen of the subthema a new activiteit goes under, each with a tick (FB-051).
 *
 * **One line per subdoel.** The owner asked for no big blocks: a subthema carries four to eight subdoelen, and the
 * row the thema page uses (`Gekoppelddoel`, two lines of text) would make this list the tallest thing on the form.
 * So the text is cut to one line here, and the whole sentence is one press away on the info button beside it.
 *
 * **The tick is the whole label.** Pressing the code or the text ticks the row too, which is the large target a
 * checkbox list needs on a phone; the info button sits outside the label so opening the detail never ticks it.
 */
export function Subdoelvinklijst({
  codes,
  gekozen,
  bezig,
  onWissel,
  onToon,
}: {
  /** The leerplandoel codes of the subthema's decided subdoelen, in the subthema's order. */
  codes: string[];
  gekozen: string[];
  bezig?: boolean;
  onWissel: (code: string, aan: boolean) => void;
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  return (
    <fieldset>
      <legend className="text-meta font-medium text-inkt">{t("activiteit.subdoelenVanSubthema")}</legend>
      {codes.length === 0 ? (
        <p className="mt-1.5 text-meta text-inkt-zacht">{t("activiteit.geenSubdoelen")}</p>
      ) : (
        <ul className="mt-1.5 divide-y divide-lijn overflow-hidden rounded-veld border border-lijn">
          {codes.map((code) => (
            <Subdoelregel
              key={code}
              code={code}
              aan={gekozen.includes(code)}
              bezig={bezig}
              onWissel={(aan) => onWissel(code, aan)}
              onToon={onToon}
            />
          ))}
        </ul>
      )}
    </fieldset>
  );
}

function Subdoelregel({
  code,
  aan,
  bezig,
  onWissel,
  onToon,
}: {
  code: string;
  aan: boolean;
  bezig?: boolean;
  onWissel: (aan: boolean) => void;
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  const { data, isPending } = useLeerplandoel(code);

  return (
    <li className="flex items-center gap-1 pr-1 transition-colors duration-150 hover:bg-inkt/[0.035]">
      <label className="flex min-h-raak min-w-0 flex-1 cursor-pointer items-center gap-2.5 py-1.5 pl-3">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-inkt"
          checked={aan}
          disabled={bezig}
          onChange={(e) => onWissel(e.target.checked)}
        />
        {data ? <Doelsoortmerk soort={data.doelsoort} /> : null}
        <span className="mono shrink-0 text-micro font-medium text-inkt-zacht">{code}</span>
        {/* If the doel cannot be loaded the row keeps its code; the detail shows the load error. */}
        {data ? (
          <span className="min-w-0 flex-1 truncate text-body text-inkt">{data.tekst}</span>
        ) : isPending ? (
          <span aria-hidden="true" className="h-4 min-w-0 flex-1 animate-pulse rounded-veld bg-vlak-diep" />
        ) : null}
      </label>
      <button
        type="button"
        aria-label={t("activiteit.subdoelBekijk", { code })}
        title={t("activiteit.subdoelBekijk", { code })}
        onClick={(event) => onToon(code, event.currentTarget)}
        className="flex h-raak w-raak shrink-0 items-center justify-center rounded-veld text-inkt-zwak transition-colors duration-150 hover:text-inkt"
      >
        <IcoonInfo aria-hidden="true" className="h-4 w-4" />
      </button>
    </li>
  );
}
