import { Statusmerk } from "../../components/ui/Statusmerk";
import { Doelmerk } from "../../components/ui/Doelmerk";
import { Verwijderknop } from "../../components/ui/Rijknoppen";
import { Toevoegknop } from "../../components/ui/Toevoegknop";
import { t, telWoord } from "../../i18n";
import { cn } from "../../lib/cn";
import type { SubthemaWeergave } from "../../lib/types";
import { KLEURSTAAL, kleurSleutel, type Activiteitkleur } from "../activiteiten/kleuren";
import type { ActiviteitMetKleur } from "../activiteiten/Activiteitformulier";
import { Doelkoppelaar } from "../activiteiten/Doelkoppelaar";
import { Blok, Doellijst, Doelregel, Ontkoppel, Subkop } from "./Fiche";

/**
 * One age's derivation of a thema: a chapter of the fiche.
 *
 * **It was a card and it is now a chapter, and that is the whole change.** As a card it sat inside a
 * "Subthema's" section, so the level a doel hangs on was expressed by one border and twenty pixels
 * of indent, and on a wide screen the card stretched to eleven hundred pixels around a list of two
 * short lines. As a chapter it hangs off the fiche's own margin, at the same axis as the thema's
 * facts and the themadoelen above it, with its leeftijd and duration set in that margin. Same three
 * levels, carried by the page's structure instead of by a box.
 *
 * **The heading opens the subthema** (owner, 2026-08-30: "ik wil niet telkens op dat potloodje
 * klikken"), and the pencil stays gone. An overlay button behind the content, not a wrapper around
 * it: this chapter contains a delete control and two goal pickers, and a button inside a button is
 * invalid and unreachable by keyboard.
 *
 * **Activiteiten come before subdoelen**, which is the other way round from the card. The
 * activiteiten are what the teacher built; the subdoelen are the accounting on top of it.
 */
export function Subthemahoofdstuk({
  subthema,
  onBewerk,
  onVerwijder,
  onNieuweActiviteit,
  onBewerkActiviteit,
  onVerwijderActiviteit,
  onKoppelSubdoel,
  onOntkoppelSubdoel,
  onKoppelActiviteitdoel,
  koppelenBezig,
}: {
  subthema: SubthemaWeergave;
  onBewerk: () => void;
  onVerwijder: () => void;
  onNieuweActiviteit: () => void;
  onBewerkActiviteit: (activiteit: ActiviteitMetKleur) => void;
  onVerwijderActiviteit: (activiteit: ActiviteitMetKleur) => void;
  onKoppelSubdoel: (leerplandoelCode: string) => void;
  onOntkoppelSubdoel: (subdoelId: string) => void;
  onKoppelActiviteitdoel: (activiteitId: string, leerplandoelCode: string) => void;
  koppelenBezig?: boolean;
}) {
  const activiteiten = subthema.activiteiten as ActiviteitMetKleur[];

  return (
    <Blok
      // The leeftijd is the figure and it is LABELLED. The values are free text, from "K3" to "8-9",
      // and "5-6" beside "2 weken" reads as a second duration; four small letters remove the only
      // real ambiguity in the margin. A subthema is scoped by age and holds for every klas that
      // teaches it (Art. IX.2), so no class is named here.
      boven={t("subthemabeheer.leeftijd")}
      figuur={subthema.leeftijd}
      onder={telWoord(subthema.duurWeken, "thema.eenWeek", "thema.weken")}
    >
      <header className="relative flex items-start justify-between gap-x-3">
        <button
          type="button"
          onClick={onBewerk}
          aria-label={t("subthemabeheer.bewerkAria", { naam: subthema.naam })}
          className="absolute -inset-x-2 -inset-y-1.5 z-0 rounded-veld transition-colors duration-150 hover:bg-inkt/[0.035]"
        />
        <h3 className="pointer-events-none relative z-10 min-w-0 font-display text-hoofdstuk text-inkt">
          {subthema.naam}
        </h3>
        <Verwijderknop
          className="relative z-10 -mt-1"
          label={t("subthemabeheer.verwijderAria", { naam: subthema.naam })}
          onClick={onVerwijder}
        />
      </header>

      {/* The onderzoeksvraag is the most characteristic object in this domain: a kennisrijk thema is
          driven by a question (Art. IX). It was a 15 pixel line behind a hairline, indistinguishable
          from the probleemstelling under it. Set at reading size now, with the probleemstelling
          stepping back, so the chapter opens on what it is asking. */}
      {subthema.onderzoeksvragen.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2.5">
          {subthema.onderzoeksvragen.map((vraag) => (
            <li key={vraag.id} className="border-l-2 border-lijn-sterk pl-3.5">
              <p className="text-sectie text-inkt">{vraag.vraag}</p>
              {vraag.probleemstelling ? (
                <p className="mt-0.5 text-meta text-inkt-zacht">{vraag.probleemstelling}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <Subkop
        titel={t("thema.activiteitenTitel")}
        acties={<Toevoegknop label={t("activiteit.toevoegen")} onClick={onNieuweActiviteit} />}
      >
        {activiteiten.length === 0 ? (
          <p className="text-meta text-inkt-zwak">{t("activiteit.geen")}</p>
        ) : (
          <ul className="divide-y divide-lijn border-y border-lijn">
            {activiteiten.map((activiteit) => (
              <li key={activiteit.id}>
                <Activiteitregel
                  activiteit={activiteit}
                  onBewerk={() => onBewerkActiviteit(activiteit)}
                  onVerwijder={() => onVerwijderActiviteit(activiteit)}
                  onKoppelDoel={(code) => onKoppelActiviteitdoel(activiteit.id, code)}
                  koppelenBezig={koppelenBezig}
                />
              </li>
            ))}
          </ul>
        )}
      </Subkop>

      <Subkop
        titel={t("thema.subdoelenTitel")}
        acties={
          <Doelkoppelaar
            onKies={onKoppelSubdoel}
            bezig={koppelenBezig}
            alGekozen={subthema.subdoelen.map((s) => s.koppeling.leerplandoelCode)}
            toelichting={t("thema.koppelAanSubthema", { naam: subthema.naam })}
          />
        }
      >
        {subthema.subdoelen.length === 0 ? (
          <p className="text-meta text-inkt-zwak">{t("thema.geenSubdoelen")}</p>
        ) : (
          <Doellijst>
            {subthema.subdoelen.map((subdoel) => (
              <Doelregel key={subdoel.id}>
                <span className="mono min-w-0 truncate text-meta text-inkt">
                  {subdoel.koppeling.leerplandoelCode}
                </span>
                <Statusmerk status={subdoel.koppeling.status} className="ml-auto" />
                <Ontkoppel
                  label={t("activiteit.ontkoppel", { code: subdoel.koppeling.leerplandoelCode })}
                  bezig={koppelenBezig}
                  onClick={() => onOntkoppelSubdoel(subdoel.id)}
                />
              </Doelregel>
            ))}
          </Doellijst>
        )}
      </Subkop>
    </Blok>
  );
}

/**
 * One activiteit: a ruled row, not a box.
 *
 * **The teacher's colour is a bar, where it used to be the whole surface.** A washed rectangle per
 * activiteit turned a list a teacher scans into a stack of cards inside a card inside a page, and at
 * a desktop width each of them was a thousand pixels of pale fill around six words. As a three pixel
 * bar at the left edge the colour survives at full strength as a scanning aid, the rows keep one
 * geometry, and the colour's NAME still travels with it on the line below the title, so nothing
 * rests on hue alone (Art. XII).
 *
 * **The row itself opens the activiteit** (owner, 2026-08-30). An overlay button BEHIND the content
 * rather than around it, the same construction the month cell uses: this row also carries a delete
 * control and a goal picker. Everything above the overlay that is not itself pressable lets its
 * clicks fall through.
 *
 * **The doelmerk is unconditional**, filled or empty. Absence used to be encoded as absence, so "no
 * doelen" and "this row is just shorter" looked identical, and the question this list is scanned for
 * was the one it refused to answer.
 */
function Activiteitregel({
  activiteit,
  onBewerk,
  onVerwijder,
  onKoppelDoel,
  koppelenBezig,
}: {
  activiteit: ActiviteitMetKleur;
  onBewerk: () => void;
  onVerwijder: () => void;
  onKoppelDoel: (leerplandoelCode: string) => void;
  koppelenBezig?: boolean;
}) {
  const kleur = activiteit.kleur as Activiteitkleur | null;
  const codes = activiteit.doelkoppelingen.map((k) => k.leerplandoelCode);

  return (
    <div className="relative flex gap-3 py-2.5">
      {/* The hover fill is deliberately faint. This list runs to twenty rows on a real thema, and a
          row that lights up under a pointer merely passing over it keeps claiming to be the one you
          were looking for. Ink at 3.5% reads as "this responds" and no more. */}
      <button
        type="button"
        onClick={onBewerk}
        aria-label={t("activiteit.bewerkAria", { naam: activiteit.naam })}
        className="absolute -inset-x-2 inset-y-0 z-0 rounded-veld transition-colors duration-150 hover:bg-inkt/[0.035]"
      />

      {/* The bar is ALWAYS rendered and only sometimes coloured. Rendering it conditionally left the
          rows without a colour starting three pixels to the left of the rows with one, so a list of
          six activiteiten had a ragged left edge, which is the exact class of defect this redesign
          exists to remove. Reserving the space costs nothing and keeps one hard edge. */}
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 w-[3px] shrink-0 rounded-full",
          kleur ? KLEURSTAAL[kleur] : "bg-transparent",
        )}
      />

      {/* `pointer-events-none` so the name, the soort and the codes hand their clicks down to the
          overlay; every control above it turns them back on for itself. */}
      <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        {/* `basis-full` on a phone, so the name gets the whole line and the doelmerk plus the two
            controls drop underneath it. Sharing one line, a real activiteit title wrapped to three
            lines against a 130 pixel column of controls and the row grew to seventy pixels. From
            `sm` the basis goes back to zero and the two sit side by side. */}
        <div className="min-w-0 flex-1 basis-full sm:basis-0">
          <p className="text-body font-medium text-inkt">{activiteit.naam}</p>
          <p className="mt-0.5 text-meta text-inkt-zacht">
            {t(`activiteitsoort.${activiteit.activiteitType}`)}
            {activiteit.hoek ? ` · ${activiteit.hoek}` : ""}
            {kleur ? ` · ${t(kleurSleutel(kleur))}` : ""}
          </p>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-2">
          {codes.length > 0 ? (
            <span className="mono hidden min-w-0 truncate text-meta text-inkt-zacht lg:block">
              {codes.join(" · ")}
            </span>
          ) : null}
          <Doelmerk aantal={codes.length} />
          {/* `contents` so the wrapper adds no box of its own: the koppelaar's open state is a
              full-width panel that has to stay a direct child of the wrapping row to take its own
              line. */}
          <div className="pointer-events-auto contents">
            <Doelkoppelaar
              compact
              onKies={onKoppelDoel}
              bezig={koppelenBezig}
              alGekozen={codes}
              toelichting={t("activiteit.koppelAan", { naam: activiteit.naam })}
            />
          </div>
          <Verwijderknop
            className="pointer-events-auto"
            label={t("activiteit.verwijderAria", { naam: activiteit.naam })}
            onClick={onVerwijder}
          />
        </div>
      </div>
    </div>
  );
}
