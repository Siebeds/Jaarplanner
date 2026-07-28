import { Badge, type BadgeProps } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { t, type TranslationKey } from "../../i18n";
import { useDoelsuggesties, useWijzigSuggestieStatus } from "./useDoelsuggesties";
import type { Doelsuggestie, SuggestieStatus } from "./types";

/**
 * The AI doelsuggestie review list (E2-05, FR-4.3, Art. IV.1/IV.3). For a thema it shows every AI
 * suggestion with its leerplandoel code, the AI's motivation ("waarom past dit doel hier?") and the
 * current status, and lets the teacher — the only actor — accept / reject / adjust it. Each action
 * calls the API and the list refetches via TanStack Query so the persisted status is shown; nothing is
 * auto-applied. All copy comes from nl.json via t() (Art. II.3); backend errors are mapped to our own
 * Dutch message, never echoed raw. Colour is never the sole signal — every status also shows its label.
 */

/** Map the (PascalCase) API status to the semantic Badge variant + its nl.json label key. */
const statusVariant: Record<SuggestieStatus, NonNullable<BadgeProps["variant"]>> = {
  Voorgesteld: "voorgesteld",
  Aanvaard: "aanvaard",
  Geweigerd: "geweigerd",
  Manueel: "manueel",
};

const statusLabelKey: Record<SuggestieStatus, TranslationKey> = {
  Voorgesteld: "suggestieStatus.voorgesteld",
  Aanvaard: "suggestieStatus.aanvaard",
  Geweigerd: "suggestieStatus.geweigerd",
  Manueel: "suggestieStatus.manueel",
};

export interface DoelsuggestieLijstProps {
  themaId: string;
}

export function DoelsuggestieLijst({ themaId }: DoelsuggestieLijstProps) {
  const { data, isLoading, isError } = useDoelsuggesties(themaId);
  const wijzig = useWijzigSuggestieStatus(themaId);

  if (isLoading) {
    return <p role="status">{t("matching.laden")}</p>;
  }

  if (isError) {
    return (
      <p role="alert" className="text-suggestie-geweigerd">
        {t("matching.fout")}
      </p>
    );
  }

  const suggesties = data ?? [];

  if (suggesties.length === 0) {
    return <p>{t("matching.leeg")}</p>;
  }

  return (
    <div>
      {wijzig.isError && (
        <p role="alert" className="mb-2 text-suggestie-geweigerd">
          {t("matching.wijzigenMislukt")}
        </p>
      )}
      <ul aria-busy={wijzig.isPending} className="flex flex-col gap-3">
        {suggesties.map((suggestie) => (
          <SuggestieRij
            key={suggestie.id}
            suggestie={suggestie}
            bezig={wijzig.isPending}
            onBeslis={(status) =>
              wijzig.mutate({ suggestieId: suggestie.id, status })
            }
          />
        ))}
      </ul>
    </div>
  );
}

interface SuggestieRijProps {
  suggestie: Doelsuggestie;
  bezig: boolean;
  onBeslis: (status: "Aanvaard" | "Geweigerd" | "Manueel") => void;
}

function SuggestieRij({ suggestie, bezig, onBeslis }: SuggestieRijProps) {
  const { leerplandoelCode: code, status, aiMotivatie } = suggestie;

  return (
    <li className="rounded-md border border-input p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{code}</span>
        <Badge variant={statusVariant[status]}>{t(statusLabelKey[status])}</Badge>
      </div>

      {aiMotivatie && (
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium">{t("matching.motivatieLabel")}</span>{" "}
          {aiMotivatie}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={bezig}
          aria-label={t("matching.aanvaardenAria", { code })}
          onClick={() => onBeslis("Aanvaard")}
        >
          {t("matching.aanvaarden")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={bezig}
          aria-label={t("matching.weigerenAria", { code })}
          onClick={() => onBeslis("Geweigerd")}
        >
          {t("matching.weigeren")}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={bezig}
          aria-label={t("matching.manueelAria", { code })}
          onClick={() => onBeslis("Manueel")}
        >
          {t("matching.manueel")}
        </Button>
      </div>
    </li>
  );
}
