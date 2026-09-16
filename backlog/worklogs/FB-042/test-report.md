# FB-042 — Test report (round 1)

**Verdict:** PASS
**Mode:** browser (headless Chrome driven by a playwright-core script in the session scratchpad; the Playwright MCP was not available) plus Vitest and lint

Setup: branch `ticket/FB-042-leeftijdkeuze-na-klik` at `eebb09e`, machine B. API from `bin-run` on port 5193, Vite on
port 5273, against the **throwaway database** `jaarplanner_fb042` (migrated, demo seed). The owner's `jaarplanner`
database was not touched. Fictional thema "Dieren (browsertest FB-042)" with subthema "Boerderij" (K2) and "Bos" (K3).
Fictional users: `themabeheer.test@jaarplanner.local` (themabeheer only), `leerkracht.test@jaarplanner.local` (no
rights, klas L3), plus the bootstrap directie. No AI key is configured. No Op.stap goals are loaded, so the server
answered the genereer request 200 with `aantalKandidaten: 0` and the screen said "Er zijn geen Op.stap-doelen geladen
voor K3, dus er is niets gevraagd." The model was never called. The request body is the evidence for the send step.

Script result: **87/87 checks passed** (themabeheer at 1440 and 390 px, directie at 1440 px, keyboard-only at
1440 and 390 px, leerkracht at 1440 and 390 px).

## Criteria checked
- "bij de themadoelen staat alleen 'Vraag suggesties', zonder 'voor' en zonder leeftijdblokjes" → PASS. On open there
  is no leeftijd group, no "Vraag suggesties voor", no Verstuur or Annuleer, and no reason text. Checked for
  themabeheer and directie at desktop and 390 px. Evidence: `themabeheer-desktop-1-dicht.png`, `themabeheer-390-1-dicht.png`.
- "de leeftijdkeuze met de leeftijden van de subthema's aangevinkt, en er is nog niets aan de AI gevraagd" → PASS.
  After the click, `aria-pressed=true` is set on exactly K2 and K3. Focus moves to the first toggle (JK). Verstuur and
  Annuleer are visible. **0** genereer requests were seen. Evidence: `themabeheer-desktop-2-open.png`, `themabeheer-390-2-open.png`.
- "K2 uitvinkt en verstuurt, dan worden alleen suggesties voor de overige gekozen leeftijden gevraagd" → PASS. There was
  exactly one POST `/api/themas/{id}/doelsuggesties/genereer` with body `{"selectie":{"jaarFasen":["K3"]}}` (response
  200, `"jaarFasen":["K3"]`). The row closed after the successful send. Evidence: `themabeheer-desktop-4-verstuurd.png`.
- "annuleert, dan verdwijnt ze en is er niets gevraagd" → PASS. The row closed, focus returned to "Vraag suggesties",
  and 0 requests were sent. Cancelling also forgets a changed choice: K2 was unticked, then Annuleer, and on reopening
  K2 and K3 were both ticked again.
- "zonder aangevinkte leeftijd, dan kan niet verstuurd worden en staat er waarom" → PASS. Verstuur is disabled, and
  "Kies minstens één leeftijd om suggesties te vragen." is visible and linked with `aria-describedby`. A forced click
  sent nothing. The text disappears once a leeftijd is ticked again. Evidence: `themabeheer-desktop-3-geen-leeftijd.png`,
  `themabeheer-390-3-geen-leeftijd.png`.
- "Wie geen doelsuggesties mag maken ... ziet geen knop" (scenario 5) → PASS. The leerkracht sees no "Vraag
  suggesties" button, no group and no Verstuur, at 1440 and 390 px. Evidence: `leerkracht-desktop.png`, `leerkracht-390.png`.
- "Nagekeken in een echte browser op desktop en op ~390px, met het toetsenbord bedienbaar" → PASS.
  - Keyboard only: Tab reaches the button, and Enter opens the row with focus on JK and no request. Tab to Annuleer,
    then Enter, closes the row and returns focus to the button. Space reopens it. Tab to K2, then Space, unticks it.
    Tab to Verstuur, then Enter, sends `["K3"]` only. The focus ring is visible (`themabeheer-toetsenbord-focus-verstuur.png`).
  - At 390 px the row wraps into three lines, and `scrollWidth` is 390 (no horizontal scroll).
  - Contrast of the "Vraag suggesties voor" label, measured in Chrome: rgb(88,94,106) on white, **6.51:1**.

## Additional observation (not a criterion)
- A simulated AI failure (500, via route interception) keeps the row open with the choice intact and shows "Suggesties
  niet gelukt". This is sensible, because the user can retry or cancel. Evidence: `themabeheer-desktop-5-ai-fout-gesimuleerd.png`.
- One console error "Failed to load resource: 404" appeared in the first session only and did not come back in a later
  run that logged every 404. It looks unrelated to this change.

## Commands run
- `dotnet ef database update` (throwaway DB) → Done; `dotnet build … -o bin-run` → 0 errors
- health checks → api 200, vite 200, proxy 401, signin 200
- `node check.mjs` (scratchpad) → 87/87 passed; `node extra.mjs` → the error path is as described above
- `pnpm vitest run src/features/themas/ThemadetailScherm.test.tsx src/i18n` → 2 files, 44 tests passed
- `pnpm lint` → exit 0

## Defects
None.
