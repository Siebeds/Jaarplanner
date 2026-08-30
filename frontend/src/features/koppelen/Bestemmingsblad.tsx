import { useMemo, useState } from "react";
import { Blad } from "../../components/ui/Blad";
import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { DOELSOORTRAND } from "../../components/ui/doelsoortkleuren";
import { Invoer } from "../../components/ui/Veld";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { Leegte } from "../../components/ui/Leegte";
import { IcoonKruis, IcoonZoek } from "../../components/Iconen";
import { useLeerplandoel, useThemabibliotheek, useThemasVoorKlas } from "../../lib/queries";
import { useActieveSelectie } from "../../lib/selectie";
import { cn } from "../../lib/cn";
import { t, telWoord } from "../../i18n";
import { filterBestemmingen, telBestemmingen } from "./bestemmingen";
import { Themarij } from "./Themarij";

/**
 * "Waar gebruik je dit doel?": the register's answer to a teacher who is holding a leerplandoel and
 * wants it to become work.
 *
 * The rest of the app links goals the other way round: open a thema, find a doel, attach it. That
 * direction assumes the teacher starts from their own planning. This one starts from the curriculum,
 * which is how the school actually reads Op.stap. You page through the doelen for a jaar/fase, you
 * recognise one you have not covered, and only then do you decide where it belongs. Both directions
 * write the same `Manueel` links to the same rows; only the way in is different.
 *
 * **The doel stays on screen the whole time.** It is pinned above the tree rather than named once in
 * the title, because everything below it is a decision made *about* that doel and a teacher who has
 * scrolled past three thema's should not have to remember which one they were placing.
 *
 * **The whole tree is loaded at once, not per expanded thema.** A school has a dozen thema's, and
 * both things this sheet must do need all of them: search has to reach an activiteit's name three
 * levels down, and every row has to say whether the doel is already on it. Lazily loading per thema
 * would make a search box that quietly only searches what you already opened. The trees come from
 * the same `thema-voor-klas` key the agenda uses, so they are usually already cached.
 */
export function Bestemmingsblad({
  code,
  open,
  onOpenChange,
}: {
  code: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { klasId, klas } = useActieveSelectie();
  const { data: doel } = useLeerplandoel(open ? code : null);
  const { data: bibliotheek, isPending: bibliotheekLaadt } = useThemabibliotheek();

  const themaIds = useMemo(() => (bibliotheek ?? []).map((item) => item.id), [bibliotheek]);
  const { themas, laadt: themasLaden } = useThemasVoorKlas(open ? themaIds : [], klasId);

  const [zoek, setZoek] = useState("");

  /**
   * A fresh search box every time the sheet opens.
   *
   * Set during render rather than from an effect, which is the pattern `DoelenScherm` already uses
   * for its class preset: an effect would render the previous term once before clearing it. Cleared
   * on open rather than on close, because a close runs while the sheet is still animating out and
   * the tree visibly springs back to its unfiltered self on the way.
   */
  const [vorigOpen, setVorigOpen] = useState(open);
  if (open !== vorigOpen) {
    setVorigOpen(open);
    if (open) setZoek("");
  }

  const takken = useMemo(
    () => (code ? filterBestemmingen(themas, code, zoek) : []),
    [themas, code, zoek],
  );

  /**
   * A disabled query is `isPending`, so without this the sheet spins forever when there is no class.
   *
   * `useThemasVoorKlas` passes `enabled: Boolean(klasId)`, and in TanStack Query a query that never
   * runs still reports `pending` (its `fetchStatus` is `idle`, which `laadt` does not look at). No
   * class means no subthema's and no activiteiten to link to either, so the honest answer is to say
   * so rather than to imply something is on its way.
   */
  const geenKlas = klasId === null;
  const laadt = !geenKlas && (bibliotheekLaadt || themasLaden);
  const gezocht = zoek.trim().length > 0;
  const aantal = telBestemmingen(takken);

  return (
    <Blad open={open} onOpenChange={onOpenChange} titel={t("koppelen.titel")} maat="breed">
      <div className="flex flex-col gap-4">
        {/* The doel. The doelsoort hue is the one colour this sheet adds, and it is the hue Art. XII
            already assigns to that doelsoort, carried as a left edge so it never has to be read as a
            fill behind text.

            PINNED ONLY FROM `sm`, and deliberately not on a phone. Up to `sm` the Blad is a bottom
            sheet of at most 86dvh, where this card is about a fifth of everything the teacher can
            see; spending that permanently on a sentence they have just read is the wrong trade, and
            the sheet's own title still says what the screen is for. From `sm` the Blad is a
            full-height side panel with room to spare, and there the card earns its place: the tree
            below it is long, and every row is a decision made about this doel.

            `sm:` rather than a container query even though the Blad is an `@container`: this has to
            switch at exactly the breakpoint where the Blad changes from a bottom sheet to a side
            panel, and that one is on the viewport.

            `-top-4` because the scroll container is `py-4`. `top-0` sticks to the top of the CONTENT
            box, which leaves a 16px strip of padding above it that rows scroll through in plain
            sight. Measured, not guessed. The matching `sm:pt-4` puts the card back where it was. */}
        {doel ? (
          <div className="-mx-1 px-1 pb-3 sm:sticky sm:-top-4 sm:z-10 sm:bg-kaart sm:pt-4">
            <div className={cn("rounded-kaart border border-l-[3px] border-lijn bg-vlak/70 p-3", DOELSOORTRAND[doel.doelsoort])}>
              <div className="flex flex-wrap items-center gap-2">
                <Doelsoortmerk soort={doel.doelsoort} />
                <span className="mono text-meta font-medium text-inkt">{doel.code}</span>
                <span className="mono rounded border border-lijn px-1.5 py-0.5 text-[0.625rem] text-inkt-zwak">
                  {doel.jaarFase}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-3 text-body text-inkt">{doel.tekst}</p>
            </div>
          </div>
        ) : (
          <Laadvlak className="h-20" />
        )}

        {klas ? (
          <p className="text-meta text-inkt-zacht">{t("koppelen.klastoelichting", { klas: klas.naam })}</p>
        ) : null}

        <div className="relative">
          <IcoonZoek
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-inkt-zwak"
          />
          <Invoer
            type="search"
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder={t("koppelen.zoek")}
            aria-label={t("koppelen.zoek")}
            className="pl-10 pr-10"
          />
          {zoek.length > 0 ? (
            <button
              type="button"
              onClick={() => setZoek("")}
              aria-label={t("koppelen.zoekWissen")}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-inkt-zwak transition-colors hover:bg-vlak-diep hover:text-inkt"
            >
              <IcoonKruis className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Announced rather than merely rendered: the search filters a tree that is mostly collapsed,
            so on a narrow screen the only visible effect of typing can be a count changing. */}
        {gezocht && !laadt ? (
          <p aria-live="polite" className="mono text-meta text-inkt-zwak">
            {telWoord(aantal, "koppelen.eenBestemming", "koppelen.aantalBestemmingen")}
          </p>
        ) : null}

        {geenKlas ? (
          <Leegte titel={t("koppelen.geenKlasTitel")} actie={<p className="text-meta text-inkt-zacht">{t("koppelen.geenKlas")}</p>} />
        ) : laadt ? (
          <div className="flex flex-col gap-2">
            <Laadvlak className="h-14" />
            <Laadvlak className="h-14" />
            <Laadvlak className="h-14" />
          </div>
        ) : takken.length === 0 ? (
          gezocht ? (
            <Leegte titel={t("koppelen.geenTreffers")} />
          ) : (
            <Leegte titel={t("koppelen.geenThemas")} actie={<p className="text-meta text-inkt-zacht">{t("koppelen.geenThemasActie")}</p>} />
          )
        ) : code === null ? null : (
          <ul className="flex flex-col gap-2">
            {takken.map((tak) => (
              <li key={tak.thema.id}>
                <Themarij
                  tak={tak}
                  code={code}
                  klasId={klasId}
                  // Searching opens what it found: a hit three levels down inside a collapsed thema
                  // is a hit the teacher cannot see.
                  standaardOpen={gezocht}
                  // Keyed on WHETHER there is a search, not on the term. Keying on the term remounts
                  // every row on every keystroke, which throws away a half-typed "nieuwe activiteit"
                  // form under one of them. Between two searches the rows stay open, which is what
                  // the teacher wants anyway; clearing the box closes them again.
                  key={`${tak.thema.id}-${gezocht}`}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Blad>
  );
}
