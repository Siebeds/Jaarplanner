import { useState } from "react";

import { DoelsoortBadge } from "../../components/DoelsoortBadge";
import { doelsoortBadgeSoort } from "../../components/doelsoort";
import { Badge, type BadgeProps } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { t, type TranslationKey } from "../../i18n";
import { ApiError } from "../../lib/api";
import {
  useDoelsuggesties,
  useVervangSuggestieDoel,
  useWijzigSuggestieStatus,
} from "./useDoelsuggesties";
import type { Doelsuggestie, SuggestieStatus } from "./types";

/**
 * The AI doelsuggestie review list (E2-05/E2-08, FR-4.2/4.3, Art. IV.1/IV.3). For a thema it shows every AI
 * suggestion with its leerplandoel code, **the goal's own official text and doelsoort**, the AI's motivation
 * ("waarom past dit doel hier?") and the current status, and lets the teacher — the only actor — accept,
 * reject, take over manually, or replace the doel with a different one. Each action calls the API and the
 * list refetches via TanStack Query so the persisted result is shown; nothing is auto-applied.
 *
 * **Why the goal text is here (E2-08).** FR-4.2's purpose clause is *"zodat de leerkracht ze kan
 * beoordelen"*, and this row used to show a bare code plus one AI sentence — not something a non-technical
 * teacher can judge, while the sibling "ongekoppelde doelen" list already showed the text. That asymmetry
 * was an oversight, not a contract.
 *
 * All copy comes from nl.json via t() (Art. II.3); backend errors are mapped to our own Dutch message on
 * HTTP status, never echoed raw. Codes and goal text are *data* and are rendered as such. Colour is never
 * the sole signal — every status and doelsoort also carries its label (Art. XII, WCAG 2.2 AA).
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
  const vervang = useVervangSuggestieDoel(themaId);

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

  const bezig = wijzig.isPending || vervang.isPending;

  return (
    <div>
      {wijzig.isError && (
        <p role="alert" className="mb-2 text-suggestie-geweigerd">
          {t("matching.wijzigenMislukt")}
        </p>
      )}
      {/* A refused substitution is the teacher's to fix (an unknown, already-linked, unchanged or
          ambiguously-cased code → 400), so it gets actionable copy; any other status means the tool is
          unavailable. The server's own message is not shown — the branch is on the status alone (Art. II.3),
          which means this one string has to name every check the teacher can make, casing included: a check the
          copy omits is a way out the teacher never gets told about. */}
      {vervang.isError && (
        <p role="alert" className="mb-2 text-suggestie-geweigerd">
          {vervang.error instanceof ApiError && vervang.error.status === 400
            ? t("matching.vervangenMislukt")
            : t("matching.vervangenOnbeschikbaar")}
        </p>
      )}
      {/* Four buttons, two of which land the row on the same visible `Manueel` badge — and for dekking
          `Aanvaard` and `Manueel` count identically. So both need copy saying what they do, not just the
          one that happens to be new. Which of the two FR-4.3 actually means is still directie's to rule. */}
      <p className="mb-2 text-xs text-muted-foreground">
        {t("matching.manueelUitleg")}
      </p>
      <p className="mb-2 text-xs text-muted-foreground">
        {t("matching.vervangenUitleg")}
      </p>
      <ul aria-busy={bezig} className="flex flex-col gap-3">
        {suggesties.map((suggestie) => (
          <SuggestieRij
            key={suggestie.id}
            suggestie={suggestie}
            bezig={bezig}
            onBeslis={(status) =>
              wijzig.mutate({ suggestieId: suggestie.id, status })
            }
            onVervang={(leerplandoelCode) =>
              vervang.mutate({ suggestieId: suggestie.id, leerplandoelCode })
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
  onVervang: (leerplandoelCode: string) => void;
}

function SuggestieRij({ suggestie, bezig, onBeslis, onVervang }: SuggestieRijProps) {
  const { leerplandoelCode: code, status, aiMotivatie, tekst, doelsoort } = suggestie;
  const [nieuweCode, setNieuweCode] = useState("");

  function vervang() {
    const gekozen = nieuweCode.trim();
    if (gekozen.length === 0) {
      return;
    }

    onVervang(gekozen);
    setNieuweCode("");
  }

  return (
    <li className="rounded-md border border-input p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold">{code}</span>
        <div className="flex items-center gap-2">
          {doelsoort && (
            <DoelsoortBadge doelsoort={doelsoortBadgeSoort[doelsoort]} />
          )}
          <Badge variant={statusVariant[status]}>{t(statusLabelKey[status])}</Badge>
        </div>
      </div>

      {/* The goal itself, so the teacher judges the doel and not a code (FR-4.2). An unresolvable code says
          so rather than rendering an empty row. */}
      <p className="mt-2 text-sm">{tekst ?? t("matching.doelTekstOnbekend")}</p>

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
        {/* Kept alongside the substitution below, deliberately. Whether FR-4.3's "aanpassen" means replacing
            the doel or merely overriding the AI's verdict is a reading directie has not ruled on, so both
            actions are offered and the ruling costs no rework. */}
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

      {/* FR-4.3 "aanpassen" proper: couple a different leerplandoel. The teacher types the code because
          there is no doelenkiezer yet — browsing/searching the curriculum is E1-14's screen, not this
          story's. Deliberately a plain field over a fake picker: the server refuses a code Op.stap does not
          carry, and the refusal is shown above. */}
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-input pt-3">
        <div className="flex-1">
          {/* The visible label carries the code, so it is unique per row and no aria-label is needed —
              an aria-label would override the visible text and break WCAG 2.5.3 (Label in Name). */}
          <label
            className="block text-xs font-medium"
            htmlFor={`vervang-${suggestie.id}`}
          >
            {t("matching.vervangenLabel", { code })}
          </label>
          <input
            id={`vervang-${suggestie.id}`}
            type="text"
            value={nieuweCode}
            onChange={(event) => setNieuweCode(event.target.value)}
            placeholder={t("matching.vervangenPlaceholder")}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={bezig || nieuweCode.trim().length === 0}
          aria-label={t("matching.vervangenAria", { code })}
          onClick={vervang}
        >
          {t("matching.vervangenActie")}
        </Button>
      </div>
    </li>
  );
}
