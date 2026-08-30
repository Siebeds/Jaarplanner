import { useState } from "react";
import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Segment } from "../../components/ui/Segment";
import { t } from "../../i18n";
import { Opstapimport } from "./Opstapimport";
import { Schoolcontentimport } from "./Schoolcontentimport";

type Bron = "school" | "opstap";

/**
 * Getting data in: the school's own content (FR-1) and the official Op.stap goals (FR-2).
 *
 * **One screen, two flows, and a switch rather than two routes.** They are the same task from a
 * teacher's side, "load a spreadsheet", and they are nothing alike underneath: one is editable school
 * content the uploader wrote, the other is decreed reference data nobody may edit. Putting them side
 * by side under one heading and one switch is what makes the difference visible, where two menu items
 * would only make it findable.
 *
 * Deliberately not in the bottom bar. Loading files is something a school does at the start of a year
 * and after a curriculum update, not something anyone does daily, and a fifth item in a four-item bar
 * would spend permanent room on it. It is reached from the two screens whose data it fills.
 */
export function ImportScherm() {
  const [bron, setBron] = useState<Bron>("school");

  return (
    <>
      <Schermkop
        titel={t("importeren.titel")}
        onder={
          <Segment
            label={t("importeren.bron")}
            waarde={bron}
            onKies={setBron}
            opties={[
              { waarde: "school", label: t("importeren.school.kort") },
              { waarde: "opstap", label: t("importeren.opstap.kort") },
            ]}
          />
        }
      />
      <Schermvlak>{bron === "school" ? <Schoolcontentimport /> : <Opstapimport />}</Schermvlak>
    </>
  );
}
