import { useState } from "react";

import { DoelsoortBadge } from "../../components/DoelsoortBadge";
import { doelsoortBadgeSoort } from "../../components/doelsoort";
import { Badge, type BadgeProps } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { t, type TranslationKey } from "../../i18n";
import { Uitleg } from "../../app/uitleg";
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
    return (
      <p role="status" className="text-sm text-ink-zacht">
        {t("matching.laden")}
      </p>
    );
  }

  if (isError) {
    return (
      <p
        role="alert"
        className="rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
      >
        {t("matching.fout")}
      </p>
    );
  }

  const suggesties = data ?? [];

  if (suggesties.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card/60 px-4 py-8 text-center text-sm text-ink-zacht">
        {t("matching.leeg")}
      </p>
    );
  }

  const bezig = wijzig.isPending || vervang.isPending;

  return (
    <div>
      {wijzig.isError && (
        <p
          role="alert"
          className="mb-3 rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
        >
          {t("matching.wijzigenMislukt")}
        </p>
      )}
      {/* A refused substitution is the teacher's to fix (an unknown, already-linked, unchanged or
          ambiguously-cased code → 400), so it gets actionable copy; any other status means the tool is
          unavailable. The server's own message is not shown — the branch is on the status alone (Art. II.3),
          which means this one string has to name every check the teacher can make, casing included: a check the
          copy omits is a way out the teacher never gets told about. */}
      {vervang.isError && (
        <p
          role="alert"
          className="mb-2 rounded-md bg-suggestie-geweigerd/10 px-3.5 py-2.5 text-sm font-medium text-suggestie-geweigerd"
        >
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
      {/*
        **Reduced to the invitation and put behind the Uitleg switch** (E9-08 + E9-01, CR1).

        The consequence half moved into the row the teacher is acting on, where it appears the moment they have typed a
        code. What is left tells them the field below exists and what to put in it, which is help.

        **Not moved per row, which was the tempting reading of E9-08 and is wrong here.** The replacement field is
        rendered for EVERY suggestion, so a 256-character warning beside each one would repeat itself down the whole
        list -- the exact thing CR1 complained about, and the rule in `CLAUDE.md` that explanatory prose never gets
        repeated per row when once above the list will do. Gating it on a typed code is what makes "at the action"
        possible without "on every row".
      */}
      <Uitleg>
        <p className="mb-2 text-xs text-muted-foreground">{t("matching.vervangenUitleg")}</p>
      </Uitleg>
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
    <li className="rounded-lg border border-border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md bg-paper px-2 py-1 font-mono text-sm font-semibold text-ink">
          {code}
        </span>
        <div className="flex items-center gap-2">
          {doelsoort && <DoelsoortBadge doelsoort={doelsoortBadgeSoort[doelsoort]} />}
          <Badge variant={statusVariant[status]}>{t(statusLabelKey[status])}</Badge>
        </div>
      </div>

      {/* The goal itself, so the teacher judges the doel and not a code (FR-4.2). An unresolvable code says
          so rather than rendering an empty row. */}
      <p className="mt-2 text-sm">{tekst ?? t("matching.doelTekstOnbekend")}</p>

      {aiMotivatie && (
        <div className="mt-3 rounded-md bg-paper px-3 py-2.5">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-zacht">
            {t("matching.motivatieLabel")}
          </p>
          <p className="mt-0.5 text-sm leading-snug text-ink">{aiMotivatie}</p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
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
      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-border pt-3">
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
            className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3.5 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-zacht focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

      {/*
        WHAT REPLACING DESTROYS, said in the row it will happen to and only once the teacher has typed something
        (E9-08). It is irreversible and it discards the AI motivation, which is the kind of sentence that may never be
        hidden -- so it is not behind the Uitleg switch and never will be.

        **Gated on a typed code rather than always rendered**, because this field exists on every suggestion in the list:
        unconditional, this paragraph would appear as many times as there are rows. Typing is the first act that makes
        the button live, so it is the earliest honest moment, and it is still strictly before the commit.

        `role="alert"` so it is announced when it appears rather than only being present for a reader who happens to
        travel past it.
      */}
      {nieuweCode.trim().length > 0 && (
        <p role="alert" className="mt-2 max-w-prose text-xs leading-snug text-ink">
          {t("matching.vervangenGevolg")}
        </p>
      )}
    </li>
  );
}
