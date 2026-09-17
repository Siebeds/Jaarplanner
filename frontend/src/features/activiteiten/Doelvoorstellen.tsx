import { Doelsoortmerk } from "../../components/ui/Doelsoortmerk";
import { AiKnop } from "../../components/ui/Knop";
import { Statusmerk } from "../../components/ui/Statusmerk";
import { t, telWoord } from "../../i18n";
import { useLeerplandoel } from "../../lib/queries";
import type { ActiviteitWeergave, DoelKoppelingWeergave } from "../../lib/types";
import { useBeslisActiviteitdoelvoorstel, useStelActiviteitdoelenVoor } from "../themas/mutaties";
import { Aimerk, Beslisknoppen } from "../themas/Subdoelplaatsing";
import { aiFout, beslisFout } from "../themas/plaatsingen";

/**
 * The AI's doelen for an existing activiteit (FB-026, ADR-0054), under its linked doelen, for whoever may link them.
 *
 * **The button asks, the cards wait.** An open proposal wears the faint ring with the wand and the status mark beside it
 * (ADR-0051) and is decided with the quiet check and cross. An accepted one moves up into the linked doelen; a rejected
 * one is not drawn again, and the server does not propose it again either.
 */
export function Doelvoorstellen({
  themaId,
  activiteit,
  onToon,
}: {
  themaId: string;
  activiteit: Pick<ActiviteitWeergave, "id" | "doelkoppelingen">;
  onToon: (code: string, knop: HTMLElement) => void;
}) {
  const stelVoor = useStelActiviteitdoelenVoor(themaId);
  const beslis = useBeslisActiviteitdoelvoorstel(themaId);
  const open = activiteit.doelkoppelingen.filter((k) => k.status === "Voorgesteld");

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <AiKnop
          className="h-9 min-h-9 px-2.5 text-meta"
          bezig={stelVoor.isPending}
          disabled={stelVoor.isPending}
          onClick={() => {
            beslis.reset();
            stelVoor.mutate(activiteit.id);
          }}
        >
          {stelVoor.isPending ? t("doelvoorstel.vraagBezig") : t("doelvoorstel.vraag")}
        </AiKnop>
        <div aria-live="polite">
          {stelVoor.isError ? null : stelVoor.data ? (
            <p className="text-meta text-inkt-zacht">
              {stelVoor.data.aantalVoorgesteld === 0
                ? t("doelvoorstel.geenVoorstellen")
                : telWoord(stelVoor.data.aantalVoorgesteld, "doelvoorstel.eenVoorstel", "doelvoorstel.voorstellen")}
            </p>
          ) : null}
        </div>
      </div>

      <div aria-live="polite">
        {stelVoor.isError || beslis.isError ? (
          <p className="rounded-veld bg-attentie-zacht px-3 py-2 text-meta font-medium text-attentie-inkt">
            {stelVoor.isError ? aiFout(stelVoor.error, "doelvoorstel.aiMislukt") : beslisFout(beslis.error)}
          </p>
        ) : null}
      </div>

      {open.length > 0 ? (
        <>
          <ul className="flex flex-col gap-2" aria-label={t("doelvoorstel.lijst")}>
            {open.map((voorstel) => (
              <Doelvoorstel
                key={voorstel.id}
                voorstel={voorstel}
                bezig={beslis.isPending}
                onToon={onToon}
                onBeslis={(status) => beslis.mutate({ activiteitId: activiteit.id, koppelingId: voorstel.id, status })}
              />
            ))}
          </ul>
          <p className="text-meta text-inkt-zacht">{t("doelvoorstel.subdoelUitleg")}</p>
        </>
      ) : null}
    </div>
  );
}

function Doelvoorstel({
  voorstel,
  bezig,
  onToon,
  onBeslis,
}: {
  voorstel: DoelKoppelingWeergave;
  bezig: boolean;
  onToon: (code: string, knop: HTMLElement) => void;
  onBeslis: (status: "Aanvaard" | "Geweigerd") => void;
}) {
  const code = voorstel.leerplandoelCode;
  const { data } = useLeerplandoel(code);

  return (
    <li className="voorstel-ai rounded-veld px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Aimerk label={t("plaatsing.aiVoorstel")} />
        <Statusmerk status="Voorgesteld" className="ml-auto" />
        <Beslisknoppen
          naam={code}
          bezig={bezig}
          onAanvaard={() => onBeslis("Aanvaard")}
          onWeiger={() => onBeslis("Geweigerd")}
        />
      </div>
      <button
        type="button"
        onClick={(event) => onToon(code, event.currentTarget)}
        className="mt-1.5 block w-full min-w-0 rounded-md text-left hover:bg-inkt/[0.035]"
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {data ? <Doelsoortmerk soort={data.doelsoort} /> : null}
          <span className="mono text-micro font-medium text-inkt-zacht">{code}</span>
        </span>
        {data ? <span className="mt-1 line-clamp-2 block text-body text-inkt">{data.tekst}</span> : null}
      </button>
      {voorstel.aiMotivatie ? (
        <p className="mt-2 border-l-2 border-suggestie-voorgesteld pl-3 text-meta text-inkt-zacht">{voorstel.aiMotivatie}</p>
      ) : null}
    </li>
  );
}
