import { Schermkop, Schermvlak } from "../../app/Schermkop";
import { Laadlijst } from "../../components/ui/Laadvlak";
import { Segment } from "../../components/ui/Segment";
import { t } from "../../i18n";
import { useKatinstelling, useZetKatinstelling } from "../kat/gegevens";
import { Onderdeelwissel } from "./Instellingenindeling";

/**
 * Instellingen, Chuck: whether the school shows the cat (FB-071, ADR-0064). Admin only: the part is hidden from
 * everyone else (`onderdelen.ts`) and the server refuses anyone else's change.
 *
 * Off until admin turns him on, which the school does once the onderwijsadviseur has approved him (owner ruling
 * 2026-09-22). It is one switch for the whole school: a gebruiker cannot hide him for herself.
 */
export function ChuckScherm() {
  const { data, isPending, isError } = useKatinstelling();
  const zet = useZetKatinstelling();

  return (
    <>
      <Schermkop titel={t("instellingen.chuck")} smal onder={<Onderdeelwissel />} />
      <Schermvlak smal>
        <div className="flex flex-col gap-4">
          <p className="max-w-[62ch] text-body text-inkt-zacht">{t("kat.instelling.uitleg")}</p>
          {isPending ? (
            <Laadlijst rijen={1} />
          ) : isError ? (
            <p role="alert" className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
              {t("kat.venster.fout")}
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              <Segment
                label={t("kat.instelling.label")}
                waarde={(zet.isPending ? zet.variables.isZichtbaar : data.isZichtbaar) ? "aan" : "uit"}
                opties={[
                  { waarde: "uit", label: t("kat.instelling.uit") },
                  { waarde: "aan", label: t("kat.instelling.aan") },
                ]}
                onKies={(waarde) => zet.mutate({ isZichtbaar: waarde === "aan" })}
                className="self-start"
              />
              {zet.isError ? (
                <p role="alert" className="text-meta text-attentie-inkt">
                  {t("kat.instelling.mislukt")}
                </p>
              ) : null}
            </div>
          )}
        </div>
      </Schermvlak>
    </>
  );
}
