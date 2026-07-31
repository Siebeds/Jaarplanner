# E4-06 — Vergrendelde blokken excluded from regeneration

## Build round 1 — the lock got the switch it never had

- **FR / Article:** FR-8.4; Art. IX.3 (`vergrendeld` per thema per planningsblok); Art. IV.1 (human-in-the-loop);
  Art. XII + Art. II.3 (never colour alone, all copy in `nl.json`, teacher-facing language follows the reader).
- **Branch:** `story/E4-06-vergrendeling`

### Pre-flight verified, not trusted

The orchestrator's finding holds in full. Every server part exists and I read each one:

| Claim | Verified |
|---|---|
| `Themaplaatsing.Vergrendeld` (~98), `IsVervangbaar` (~105), `StelVergrendelingIn` (~128) | yes |
| `Jaarplan.VerwijderVervangbarePlaatsingen()` (~133), `MenselijkBeslotenPlaatsingen` (~125) | yes |
| `JaarplanGeneratieService.WijzigVergrendelingAsync` (~435) | yes |
| `GenereerAsync` discards only replaceable placements (~136) | yes, via `VerwijderVervangbarePlaatsingen()` |
| `PUT api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/vergrendeling` (~160) | yes |
| `frontend/.../jaarplan/api.ts` never calls it | yes — confirmed absent |
| `Themakaart.tsx` renders a "Vast / Blijft staan bij hergenereren" badge anyway | yes, lines ~111 and ~401 |

So the badge really was unreachable state and FR-8.4 really had no invocation surface: the E2-08 / E1-15 / E0-10
pattern a fourth time, and a breach of the E3-06 rule. This was a **user-surface** story with a verification
obligation on the server half, exactly as claimed.

### Files changed

| File | Why |
|---|---|
| `frontend/src/features/jaarplan/api.ts` | `wijzigPlaatsingVergrendeling` — the missing call. Header comment now says four editing calls, not three. |
| `frontend/src/features/jaarplan/useJaarplan.ts` | `useWijzigVergrendeling` — its own mutation, so the lock's in-flight state is its own state. |
| `frontend/src/features/jaarplan/Themakaart.tsx` | The lock/unlock control in the "Aanpassen" panel, plus the honest statement where no control is offered. |
| `frontend/src/i18n/nl.json` | Six new `kalender.*` keys. No em dashes, no counted strings, so no plural obligation. |
| `frontend/src/features/jaarplan/Jaarplankalender.test.tsx` | Four new tests, plus the lock control added as a premise to the existing axe pass. |
| `backend/tests/.../Postgres/JaarplanPersistentieTests.cs` | The real-PostgreSQL proof, plus three private helpers and a stub AI client. |
| `backend/src/.../JaarplanGeneratieService.cs` | **Doc comment only, no behaviour change** — records why `WijzigVergrendelingAsync` guards nothing on status. |

### The central design question, answered

`IsVervangbaar` is `Status == Voorgesteld && !Vergrendeld`. **An `Aanvaard`, `Manueel` or `Geweigerd` placement
therefore already survives a regeneration with no lock at all.** Consequences, resolved:

**Decision: the lock control is offered only where it changes something observable, i.e. on a `Voorgesteld`
placement — and additionally on any already-locked placement, so it can always be undone.**

Reasoning, including the argument I rejected:

1. Offering "Vastzetten" on an `Aanvaard` placement is a switch with no observable effect: regeneration already
   skips it, `moetBevestigen` (`status !== "Voorgesteld" || vergrendeld`) is already true so the delete already
   confirms, and `MenselijkBeslotenPlaatsingen` already contains it. That is the E3-06
   control-that-does-nothing in a new coat.
2. **The "durable intent that outlives a status change" argument fails on this codebase's own facts.** It
   presumes a placement can return to `Voorgesteld`. Nothing can put it there: `WijzigPlaatsingStatusAsync`
   refuses that status outright (only the AI produces it), `VerplaatsNaar` only ever moves *to* `Manueel`, and a
   generation run inserts *new* rows rather than resetting existing ones. So a lock set on a decided placement
   could never become load-bearing later either. That is what settled it.
3. **The compensating obligation, because silence is the worse lie.** If the control merely disappeared, an
   accepted card with no "Vast" badge would read as disposable, which invites pointless locking. So where no
   control is offered the panel *states* the fact: *"Je hebt dit thema zelf beslist, dus een hergeneratie laat
   het staan. Vastzetten hoeft hier niet."* Not for a `Geweigerd` card, which already carries two sentences
   about the rejection; a third saying "a regeneration leaves this alone" would be true and useless.
4. **The badge copy is left alone and is not made to carry the exclusivity claim.** `kalender.vergrendeldUitleg`
   ("Blijft staan bij hergenereren") is true of the card it appears on. The inverse lie is answered in the
   panel, where the decision is taken, rather than by a new line of prose above the board: this screen already
   carries six explanatory paragraphs and CLAUDE.md says prose is the first thing to cut and never repeats per
   row. Inside a closed disclosure it costs nothing at rest.
5. I did **not** touch `IsVervangbaar`. The domain rule is right; the UI adapts to it.

### Point 3 of the brief: the confirmation is not weakened

`moetBevestigen` already treats a locked placement as needing confirmation. Verified in a real browser:

- locked + `Voorgesteld` → "Uit deze periode halen" raises *"«Herfst en oogst» uit periode 2 halen? Dat kan je
  niet ongedaan maken."* So **locking tightens** the delete guard; nothing about it loosened.
- unlock → the one-click delete returns. **This is correct, not a bypass.** The ratified E3-07 rule is that an
  untouched AI proposal goes on one click *because regeneration can simply propose it again*, and after unlocking
  that is precisely what the placement is. It also costs three deliberate teacher actions, and unlocking is
  itself reversible, so no unrecoverable state is reached silently.
- The confirmation copy (`verwijderVraag`) names the thema and the period and never mentions the lock, so it
  stays accurate in both directions.

### Point 4 of the brief: `WijzigVergrendelingAsync` guards nothing — filed, deliberately not fixed

It will lock a `Geweigerd` placement. **Left permissive, and now documented as a decision rather than an
omission.** The asymmetry with `VerplaatsPlaatsingAsync`, which *does* refuse a rejection, is justified: that
refusal exists because moving converts the status to `Manueel`, the one transition with an Art. V.1 *dekking*
consequence (a rejected placement teaches nothing, a manual one does). Setting a boolean has no such
consequence. Adding a 400 here would be inventing a new domain rule to tidy a UI, which the brief forbids and
which is not the Application layer's to add. The rule stays in one place, on `IsVervangbaar`; the *caller*
declines to make the meaningless call.

### Tests added

**Backend — `JaarplanPersistentieTests.Een_vergrendeld_voorstel_overleeft_een_volledige_hergeneratie` `[PostgresFact]`.**
The production `JaarplanGeneratieService` on the production `EfJaarplanOpslag` against **real PostgreSQL**, with
only the model stubbed (Art. IV.6). Two placements that differ in **one bit** — both `Voorgesteld`, both
`Themaperiode`, one locked — and an AI answer that places a real thema, so the run genuinely discards one of the
two. Asserts `AantalBehouden == 1`, `AantalVervangen == 1`, the locked row's id/date/flag/motivation unchanged,
and **on the rows** that the unlocked twin's `DELETE` reached the table.

*I checked whether an equivalent already existed, as instructed. It does not, and the two near-misses are
instructive:*

- `JaarplanGeneratieServiceTests.Hergeneratie_behoudt_vergrendelde_en_besliste_plaatsingen` (unit) pins the rule
  but against a fake port that holds the aggregate in a field, so "it survived" cannot fail there and no `DELETE`
  is ever verified.
- `JaarplanEndpointsTests.Beslissing_en_vergrendeling_overleven_een_herlaad` (in-memory provider) locks a
  placement it has **also accepted** and then regenerates with an **empty** AI answer. So the lock is not the
  variable in either direction: the placement would have survived on its status alone, and nothing was proposed
  that could have displaced it.
- The precedent named in the brief, `Een_verplaatste_plaatsing_overleeft_een_hergeneratie`, is in
  **`Jaarplanner.UnitTests`**, not the integration suite. Worth recording, since the brief expected it beside an
  integration test.

**Frontend — four tests in `Jaarplankalender.test.tsx`:**

1. lock → unlock round trip, asserting method, URL and both bodies, and that the board re-renders from the
   server's returned plan rather than an optimistic guess;
2. no lock control on `Aanvaard`/`Manueel`, *with* the compensating sentence present and zero requests sent;
3. a locked `Aanvaard` placement can still be unlocked (no trap);
4. the 404-vs-500 split, asserting each copy excludes the other and that no server string appears.

Plus the lock button added as an explicit premise to the existing "axe with an edit panel OPEN" pass.

### Gates

| Gate | Result |
|---|---|
| `dotnet build` | ✓ 0 errors, 0 warnings (the one `xUnit2031` I introduced was fixed) |
| `dotnet test` (unit) | ✓ **496 passed, 0 failed, 0 skipped** |
| `dotnet test` (integration, real Postgres) | ✓ **153 passed, 0 failed, 0 skipped** |
| `dotnet format --verify-no-changes` | ✓ clean |
| `corepack pnpm lint` | ✓ eslint `--max-warnings 0` + `tsc --noEmit` clean |
| `corepack pnpm test` | ✓ **191 passed** in 12 files (was 187) |
| `corepack pnpm build` | ✓ built |

**Zero skipped**, because Postgres was configured rather than left absent:
`JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=postgres;Password=postgres;SSL Mode=Disable"`
against the local Postgres 17 on 5432. `Host=127.0.0.1` and `SSL Mode=Disable` are load-bearing; `localhost`
makes Npgsql hang on this host.

### Browser pass — real API, real PostgreSQL, 1440px and exactly 390px

Playwright MCP was not used (unreliable here all week). Headless Chrome driven over CDP from Bash, own ports so
a parallel tree is undisturbed: API on **5407** (`--no-launch-profile`, because `launchSettings.json` overrides
`ASPNETCORE_URLS` and 5184 was already held by another agent), Vite on **5307**, a throwaway
`jaarplanner_e406` database migrated from the real migrations and dropped afterwards. Seeded through the API
(schooljaar, klas, four thema's) plus four placements inserted directly, since generation needs an AI key this
environment has none of: one `Voorgesteld` unlocked, one `Voorgesteld` **locked**, one `Aanvaard`, one
`Geweigerd`.

**Behaviour observed:**
- All four cards render the right affordance: lock offered on both `Voorgesteld` cards (as "Vastzetten" and
  "Losmaken" respectively), the factual sentence on `Aanvaard`, and **nothing** on `Geweigerd`.
- **Keyboard only, no pointer:** 13 Tab presses reach the card's "Aanpassen", Enter opens it, 2 more Tabs reach
  "Vastzetten", Enter fires the PUT. The badge appears, the control flips to "Losmaken", and the lock **survives
  a full page reload** read straight from PostgreSQL. That is acceptance criterion 1 end to end, non-drag
  (WCAG 2.2 SC 2.5.7).
- 390px: `document.scrollWidth === 390`, **no horizontal page overflow**, no element outside a designated scroll
  region exceeds the viewport, lock button 220×36px.

**Composited contrast, measured in the browser with every alpha layer flattened** (not jsdom, which cannot
evaluate colour):

| Element | Colour | Measured against | Ratio | Needs |
|---|---|---|---|---|
| Lock explanation, 12px/400 `text-ink-zacht` | `rgb(83,101,110)` | `rgb(248,247,244)` = `paper-diep/60` over the card | **5.66:1** | 4.5 |
| "Vastzetten" / "Losmaken" label, 14px/600 `text-ink` | `rgb(21,39,46)` | `rgb(255,255,255)` card | **15.42:1** | 4.5 |
| "🔒 Vast" badge, 12px/600 `text-ink-zacht` | `rgb(83,101,110)` | `rgb(255,255,255)` card | **6.08:1** | 4.5 |
| Lock button border (SC 1.4.11) | `rgb(150,138,115)` | `rgb(248,247,244)` panel well | **3.16:1** | 3.0 |
| Keyboard focus ring, `ring-2 ring-ring` | petrol `rgb(22,81,90)` @ .925 → `rgb(39,94,102)` | its own `rgb(250,248,245)` offset ring | **6.92:1** | 3.0 |

No new hue: the control reuses `petrol` (focus), `ink`/`ink-zacht` (text) and the existing `outline` Button
variant. Nothing collides with the six doelsoort hues, the four suggestiestatus tokens or the two dekking
tokens. Every state carries a word (`Vast`, `Vastzetten`, `Losmaken`) as well as the 🔒, so nothing is colour-
or glyph-alone (Art. XII).

### `frontend-design` skill

Invoked and applied. It is **not** in `.claude/skills/` (that holds only `jaarplan-build`); it resolves from the
installed plugin cache at
`~/.claude/plugins/cache/claude-plugins-official/frontend-design/unknown/skills/frontend-design/SKILL.md`.
Recorded because a future agent looking only in the repo will conclude it is missing.

Its restraint pass changed the design: I had drafted a **"Bij hergenereren" section heading** and cut it, on the
skill's own Chanel rule plus this panel's idiom — every sibling section is one sentence plus one button, the two
sentences are self-contained, and the heading would have been the only structural device on the card that labels
rather than acts. `kalender.vergrendelenTitel` was removed from `nl.json` with it rather than left dead.
Its copy rules also drove: active verbs that say what happens ("Vastzetten", not "Instellen"), one consistent
stem across badge and control (Vast / Vastzetten / vastgezet), and error copy that states the fault and the
remedy without apologising.

### Self-check vs acceptance criteria

| Criterion | Met? | Evidence |
|---|---|---|
| 1. Lock and unlock from the kalender, persists across reload, keyboard-operable, visible focus, not drag-dependent | **yes** | Browser: keyboard-only Tab→Enter round trip against the real API; badge survives a full reload from PostgreSQL; focus ring 6.92:1; the control is in the non-drag panel, the E3-07 precedent |
| 2. Label or icon not colour alone; honest copy; all strings in `nl.json`; no em dashes | **yes** | 🔒 **plus** the word "Vast"; the truth-telling decision is documented above and pinned by test 2; six keys added to `nl.json`; the catalogue-wide em-dash guard passes |
| 3. Proven at integration level against real PostgreSQL that a locked placement survives full regeneration while an unlocked `Voorgesteld` one is replaced | **yes** | `Een_vergrendeld_voorstel_overleeft_een_volledige_hergeneratie`, 153/153 integration tests, 0 skipped. No equivalent existed; the two near-misses are analysed above |
| 4. Frontend tests cover the lock/unlock round trip and the error path | **yes** | Four new tests, 191/191 passing |
| 5. Partial regeneration is E4-05 and is not claimed | **honoured** | Nothing was built for it; the new test's doc comment says so explicitly. `GenereerAsync` still takes no period scope |

### For the test-runner

- **Unit/integration:** `cd backend`, export
  `JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=postgres;Password=postgres;SSL Mode=Disable"`,
  then `dotnet test`. Expect 496 + 153, **0 skipped**. The story's own test is
  `Jaarplanner.IntegrationTests.Postgres.JaarplanPersistentieTests.Een_vergrendeld_voorstel_overleeft_een_volledige_hergeneratie`.
- **Frontend:** `cd frontend && corepack pnpm install && corepack pnpm lint && corepack pnpm test && corepack pnpm build`.
  Fresh worktree needs its own install; pnpm only runs via corepack, from Bash.
- **Browser (this needs looking at, not just asserting):** the API's `launchSettings.json` overrides
  `ASPNETCORE_URLS`, so start it as
  `dotnet run --project src/Jaarplanner.Api --no-build --no-launch-profile -- --urls http://localhost:<port> --ConnectionStrings:Postgres "<conn>" --environment Development`,
  and `createdb` + `dotnet ef database update` first. Vite:
  `VITE_API_PROXY_TARGET=http://localhost:<apiport> corepack pnpm dev --port <viteport> --strictPort`.
  There is no demo seeder output in this environment, so seed a schooljaar + klas + thema's over the API and
  insert placements directly (see the SQL shape in `themaplaatsingen`); generation needs an AI key that is absent.
  URL: `/jaarplan?schooljaar=<id>&klas=<id>`. **Steps:** open a `Voorgesteld` card's "Aanpassen" → "Vastzetten" →
  badge appears → reload → badge still there → "Losmaken" → badge gone. Then confirm an `Aanvaard` card offers
  no "Vastzetten" but does show *"Vastzetten hoeft hier niet"*, and a `Geweigerd` card shows neither.
  Check 1440px **and** 390px; `--window-size` clamps near 504px on this host, so use CDP
  `Emulation.setDeviceMetricsOverride` (or an iframe) for 390.

### Findings for the orchestrator

1. **Two adjacent buttons that look identical, one reversible and one unrecoverable.** In the panel, "Losmaken"
   (or "Vastzetten") and "Uit deze periode halen" are both `Button variant="outline"`, stacked and visually
   indistinguishable; at 390px they are separated only by a hairline rule. The pattern predates this story
   ("Weigering terugdraaien" already sits like that), but I added a third instance and put it on the most common
   card. **Deliberately not changed**, for two reasons: the consequence is already bounded by the ratified E3-07
   confirmation rule (a locked or decided card confirms before deleting; an unlocked proposal is exactly the case
   where deletion is cheap because regeneration can re-propose it), and inventing a fourth Button variant would
   break the panel's single idiom and belongs to whoever owns the button hierarchy, not to this story. Flagged
   because it is a real risk and because a later story may want to give the destructive control its own weight.
2. **The story's own precedent reference is slightly off**, worth correcting rather than propagating:
   `Een_verplaatste_plaatsing_overleeft_een_hergeneratie` lives in `Jaarplanner.UnitTests`, so "put the lock case
   beside it" and "at integration level against real PostgreSQL" pointed at two different suites. I did the
   integration one, which is what the acceptance criterion asks for; the unit-level lock case already existed.
3. **`WijzigVergrendelingAsync` accepts a `Geweigerd` placement.** Filed, not fixed; reasoning above. If the
   orchestrator or antagonist disagrees, the fix is one guard in the Application layer plus one UI branch — but I
   argue it would be a domain rule invented for the UI's convenience.
4. No contradiction found between the code and the backlog or the constitution beyond the reachability gap the
   story was written for. Art. IX.3's `vergrendeld` is now genuinely reachable.

### Open questions / Art. XIV touched

None. Nothing here keys on planningsblok granularity (the E3-05 seam supplies the grid), on graadklas/menggroep
handling, or on the school-wide-vs-per-class scoping question. `vergrendeld` is a property of a placement, which
is already per klas.
