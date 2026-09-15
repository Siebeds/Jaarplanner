import { cn } from "../../lib/cn";
import { t } from "../../i18n";

/**
 * Which leeftijden a doelsuggestie run searches (TB-007), set right after "Vraag suggesties" so the button and its
 * scope read as one phrase: "Vraag suggesties voor K3 L1".
 *
 * **Toggle buttons, any number pressed.** `Segment` is the one-of-many switch of this app; this is its many-of-many
 * sibling, so it borrows the track and the pressed look (an `inkt-zwak` outline on paper, which `Segment` measured at
 * 4.2:1 against the track) and swaps the radio role for `aria-pressed`. Nothing here is coloured, so nothing collides
 * with the doelsoort hues or the AI ring beside it.
 *
 * **Two tracks, kleuter and lager**, because that is how a school thinks of the nine ages and it keeps each track
 * short enough to sit beside the button at 390px. The codes and their order come from `/api/jaarfasen`; the split is
 * on the lager prefix only.
 */
export function Leeftijdkeuze({
  jaarfasen,
  gekozen,
  onWijzig,
}: {
  jaarfasen: string[];
  gekozen: string[];
  onWijzig: (gekozen: string[]) => void;
}) {
  const sporen = [jaarfasen.filter((fase) => !fase.startsWith("L")), jaarfasen.filter((fase) => fase.startsWith("L"))]
    .filter((spoor) => spoor.length > 0);

  // Kept in the server's order, whatever order the buttons were pressed in, so the request and the result line list
  // the ages the way the rest of the screen does.
  const wissel = (fase: string) =>
    onWijzig(jaarfasen.filter((f) => (f === fase ? !gekozen.includes(f) : gekozen.includes(f))));

  return (
    <div role="group" aria-label={t("thema.leeftijdenLabel")} className="flex flex-wrap items-center gap-1.5">
      {sporen.map((spoor) => (
        <div key={spoor[0]} className="inline-flex rounded-veld border border-lijn bg-vlak-diep p-1">
          {spoor.map((fase) => {
            const aan = gekozen.includes(fase);
            return (
              <button
                key={fase}
                type="button"
                aria-pressed={aan}
                onClick={() => wissel(fase)}
                className={cn(
                  "min-h-7 min-w-9 rounded-[0.5rem] px-2 text-meta font-medium transition-colors duration-150",
                  aan
                    ? "border border-inkt-zwak bg-kaart text-inkt shadow-licht"
                    : "border border-transparent text-inkt-zacht hover:text-inkt",
                )}
              >
                {fase}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
