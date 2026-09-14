import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Segment } from "../../components/ui/Segment";
import { Leegte } from "../../components/ui/Leegte";
import { Laadvlak } from "../../components/ui/Laadvlak";
import { useRechten } from "../../lib/rechten";
import { t } from "../../i18n";
import { Opstapimport } from "./Opstapimport";
import { Schoolcontentimport } from "./Schoolcontentimport";
import { toegestaneSecties, type Bron } from "./secties";

/**
 * Getting data in: the school's own content (FR-1) and the official Op.stap goals (FR-2).
 *
 * **One screen, two flows, and a switch rather than two routes.** They are the same task from a
 * teacher's side, "get our data in", and they are nothing alike underneath: one is editable school
 * content the uploader wrote in a spreadsheet, the other is decreed reference data nobody may edit,
 * fetched from KOV's Op.stap API since E1-22 (ADR-0032). Putting them side by side under one heading
 * and one switch is what makes the difference visible, where two menu items would only make it findable.
 *
 * Deliberately not in the bottom bar. Loading files is something a school does at the start of a year
 * and after a curriculum update, not something anyone does daily, and a fifth item in a four-item bar
 * would spend permanent room on it. It is reached from the two screens whose data it fills.
 *
 * **Each section is shown to whoever holds its right, and the route to everyone** (E6-02; the section,
 * not the route, per the 2026-08-03 ruling). The sections and their rights are `INLAADSECTIES`: the
 * school's thema's for directie and themabeheer, Op.stap for directie. The switch appears only when two
 * sections remain, since a switch with one option is a control that does nothing. `?bron=opstap` asks for
 * the Op.stap section, which is what the Doelen register's links mean; a section the gebruiker may not use
 * is never shown, whatever the address asks.
 */
export function ImportScherm() {
  const { mag, laadt } = useRechten();
  const [zoek] = useSearchParams();
  const [gekozen, setGekozen] = useState<Bron | null>(null);

  const secties = toegestaneSecties(mag);
  const gevraagd = zoek.get("bron");
  const bron =
    secties.find((sectie) => sectie.bron === gekozen)?.bron ??
    secties.find((sectie) => sectie.bron === gevraagd)?.bron ??
    secties[0]?.bron ??
    null;

  return (
    <>
      <Schermkop
        titel={t("importeren.titel")}
        onder={
          secties.length > 1 && bron !== null ? (
            <Segment
              label={t("importeren.bron")}
              waarde={bron}
              onKies={setGekozen}
              opties={secties.map((sectie) => ({ waarde: sectie.bron, label: t(sectie.labelSleutel) }))}
            />
          ) : undefined
        }
      />
      <Schermvlak>
        {laadt ? (
          <Laadvlak className="h-32" />
        ) : bron === "school" ? (
          <Schoolcontentimport />
        ) : bron === "opstap" ? (
          <Opstapimport />
        ) : (
          // Reached only by typing the address: every link here asks `magInladen` first. Says what the gebruiker
          // cannot do, and nothing about who can.
          <Leegte titel={t("importeren.geenRecht")} />
        )}
      </Schermvlak>
    </>
  );
}
