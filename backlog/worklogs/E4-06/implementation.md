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
| `frontend/src/i18n/nl.json` | **Seven** new `kalender.*` keys (*corrected in fix round 1: this line and the self-check below both said six; `nl.json:133-139` held seven*). No em dashes, no counted strings, so no plural obligation. |
| `frontend/src/features/jaarplan/Jaarplankalender.test.tsx` | Four new tests, plus the lock control added as a premise to the existing axe pass. |
| `backend/tests/.../Postgres/JaarplanPersistentieTests.cs` | The real-PostgreSQL proof, plus three private helpers and a stub AI client. |
| `backend/src/.../JaarplanGeneratieService.cs` | **Doc comment only, no behaviour change** — records why `WijzigVergrendelingAsync` guards nothing on status. |

### The central design question, answered

`IsVervangbaar` is `Status == Voorgesteld && !Vergrendeld`. **An `Aanvaard`, `Manueel` or `Geweigerd` placement
therefore already survives a regeneration with no lock at all.** Consequences, resolved:

**Decision: the lock control is offered only where it changes an outcome, i.e. on a `Voorgesteld`
placement — and additionally on any already-locked placement, so it can always be undone.**

> *Narrowed in fix round 1.* This section originally said "changes something **observable**", and repeated that
> phrase in `JaarplanGeneratieService.cs`, `api.ts` and `Themakaart.tsx`. It is false as an absolute: locking a
> decided placement **does** show the "Vast" badge and **does** change the panel's sentence. What it cannot change
> is whether a regeneration replaces the placement, or whether the thema counts as placed for the dekking. Since
> the absolute claim is the load-bearing justification for hiding the control, it is corrected in all four places
> rather than left as shorthand.

Reasoning, including the argument I rejected:

1. Offering "Vastzetten" on an `Aanvaard` placement is a switch with no effect on any outcome: regeneration already
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
| 2. Label or icon not colour alone; honest copy; all strings in `nl.json`; no em dashes | **yes** | 🔒 **plus** the word "Vast"; the truth-telling decision is documented above and pinned by test 2; seven keys added to `nl.json` (*corrected in fix round 1: said six*); the catalogue-wide em-dash guard passes |
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

---

## Fix round 1 — the copy now branches on the pair, and the delete trigger has its own weight

The antagonist returned **VIOLATIONS FOUND** (3 MAJOR, 5 MINOR) on `889471d`, plus two owner rulings of
2026-07-31. Every finding is addressed below, numbered as the orchestrator numbered them. **Nothing was
disputed** — one finding (5) turned out to be worse than described, and my own fix for (7) was wrong on the
first attempt and was caught in the browser.

### 1 (MAJOR) — `vergrendelUitlegVast` was false on every locked non-`Voorgesteld` placement

The section decided *whether* to render on `(status, vergrendeld)` but *which sentence* on `vergrendeld` alone.
So a locked `Manueel` card read *"Dit thema staat vast, dus een hergeneratie laat het staan"* — asserting the
lock as the reason it survives, which `IsVervangbaar` (`Voorgesteld && !Vergrendeld`) contradicts — and invited a
"Losmaken" that cannot make the thema replaceable.

**Fixed** by making the sentence a function of the whole state, in one place: `Themakaart.tsx`'s `slotUitleg`
branches on `(isVervallen, isVoorstel, vergrendeld)`. A new key `vergrendelUitlegBeslistVast` says both halves the
audit required: the lock is redundant, **and** unlocking will not free the thema.

**Pinned** by `it.each(["Aanvaard","Manueel","Geweigerd"])` in `Jaarplankalender.test.tsx`, which asserts the
rendered Dutch (and that each of the other three sentences is *absent*), not just the request body. The round-1
test stood in exactly this state and asserted only `verzoeken[0].body`.

### 2 (MAJOR, owner ruling) — "blijft staan" is not "telt mee voor de dekking"

New key `vergrendelDekking`, rendered under **both** `Voorgesteld` branches: *"Vastzetten gaat over de planning,
niet over de dekking: dit thema telt pas mee voor de dekking zodra het aanvaard is."*

Phrased as a **condition, not an instruction**, deliberately: this screen has no accept control, and per the
owner's ruling building one is E4-01/E4-02's obligation, not this story's. So the copy states the fact without
pointing at a button that does not exist. **No accept button was built.** Not shown on a decided card (the
question is settled there) and not on a rejected one (where it would be wrong about what the teacher decided).

### 3 (MAJOR) — the regeneration claim is now scoped to the path that exists

All four lock sentences say **"een hergeneratie van het hele jaarplan"**. E4-05 adds a second discard path and
E4-07's preserve/overwrite rule is recorded as *"confirm with directie"*, so an unqualified "een hergeneratie" was
a promise about unwritten code. A test asserts the qualifier is present in all four strings, so a later edit that
drops it fails rather than quietly re-widening the claim.

*Reported to the orchestrator for E4-05/E4-07 (not written into the backlog here): both strings must be
re-verified once the preservation rule is settled.*

### 4 (MINOR) — the comment now says what the rejection copy actually says

`kalender.weigeringUitleg` explains the reversal only; it says nothing about regeneration. The comment claimed it
explained "that the rejection stands". Rewritten to state the omission as a deliberate choice with its reason,
and to record that *whether the rejection copy should mention regeneration is an owner question*, reported rather
than decided.

### 5 (MINOR) — a stale card gets no lock nudge at all

Worse than described: a locked stale card also rendered *"Maak het los als de AI het opnieuw mag voorstellen"*,
which is false there. Now:

- stale **and unlocked** → no lock section, no `vergrendelNietNodig`. The single remedy is the period picker, and
  the panel already says so at the top (`herplaatsKies`).
- stale **and locked** → the control stays (otherwise the lock is stranded) with a new key
  `vergrendelUitlegVervallen`, which points at choosing a period and offers only to remove the lock.

Two tests, one per branch, and the state was looked at in a browser at both widths.

### 6 (MINOR) — `vergrendelMislukt` no longer guarantees anything

`MuteerPlaatsingAsync` commits before it derives the grid and projects, so a 500 from that tail leaves the lock
persisted. Dropped *"Er is niets gewijzigd aan je jaarplan"* and replaced it with a reload, as the 404 branch
does: *"Herlaad de pagina om te zien wat er nu in je jaarplan staat. Blijft dit terugkomen, meld het dan aan de
beheerder van de tool."*

### 7 (MINOR) — success is announced, and my first fix for it was wrong

A `role="status"` sr-only region reports the **persisted** state by name: *"«Water» staat nu vast."* /
*"«Water» staat niet meer vast."* (`aria-pressed` stays rejected: beside a label that flips it announces
backwards.)

**The first attempt put the region inside the lock section, and it was silent in the case that matters most.**
Unlocking a decided placement removes that whole section, so the region unmounted in the same render that should
have announced. Caught in the browser (`aankondiging: []`), not by the test I had just written. Moved to panel
level; a second test now drives exactly that transition and asserts both that the section is gone and that the
announcement is there.

### 8 (MINOR, owner ruling) — the destructive trigger has its own weight

New `destructiveOutline` Button variant: `border-attentie-ink bg-card text-attentie-ink`, used by "Uit deze
periode halen" / "Uit het jaarplan halen".

Why this resolution rather than the alternatives:

- **Not extending the confirmation** to an unlocked proposal. That one-click rule is *ratified* (E3-07, from the
  E3-01 audit) on the grounds that a run can re-propose it, and `VerwijderVervangbarePlaatsingen()` really does
  delete it before the suggestion loop, so the premise holds. Overturning a ratified rule is not a fix round's to
  do; making the control legible is.
- **No new hue** (Art. XII): it is the same `attentie-ink` the `destructive` confirm button already uses, so the
  delete family speaks one colour from trigger to confirmation. Lighter than `destructive`, because it is not yet
  the point of no return and must not be mistaken for the confirm button it leads to.
- **Not colour alone:** a solid dark border against the neutral button's pale `input` token is a *luminance*
  difference (9.24:1 vs 3.16:1 against the same well), which survives monochrome, and the labels differ.

A test asserts the two buttons no longer share a class list, so a refactor back to `outline` fails.

### 9 (MINOR) — the records that did not survive counting

Corrected in place above, marked as corrections: the key count (six → **seven**, and twelve after this round) and
the "changes nothing observable" claim, narrowed to "changes no regeneration outcome and no dekking" in all four
places (`JaarplanGeneratieService.cs`, `api.ts`, `Themakaart.tsx`, this worklog).

### The exact copy now rendered, per state

> **Corrected in fix round 2.** The row `Aanvaard / Manueel / Geweigerd | yes | no → vergrendelUitlegBeslistVast`
> tabulated the behaviour the comment eight lines above it in `Themakaart.tsx` forbids: it routed a **rejected**
> locked card to *"Je hebt dit thema zelf beslist, dus … het blijft staan"*, which describes the opposite decision
> to a weigering. The round-2 audit raised it as a MAJOR and it is fixed; the authoritative table is the one at the
> end of the **Fix round 2** section below, which lists all sixteen combinations as read out of a real browser.
> This one is left in place, marked, rather than silently corrected, because it is the record of what round 1
> actually shipped.

| `status` | `vergrendeld` | `isVervallen` | Control | Sentence(s) |
|---|---|---|---|---|
| Voorgesteld | no | no | **Vastzetten** | `vergrendelUitlegVrij` + `vergrendelDekking` |
| Voorgesteld | yes | no | **Losmaken** | `vergrendelUitlegVast` + `vergrendelDekking` |
| Aanvaard / Manueel | no | no | none | `vergrendelNietNodig` |
| Aanvaard / Manueel / ~~Geweigerd~~ | yes | no | **Losmaken** | `vergrendelUitlegBeslistVast` (**wrong for `Geweigerd`, fixed in round 2**) |
| Geweigerd | no | no | none | none (the weigering section stands alone) |
| any | no | **yes** | none | none (only `herplaatsKies`, the one remedy) |
| any | yes | **yes** | **Losmaken** | `vergrendelUitlegVervallen` |

### Files changed in this round

| File | Why |
|---|---|
| `frontend/src/i18n/nl.json` | 5 new keys (`vergrendelDekking`, `vergrendelUitlegBeslistVast`, `vergrendelUitlegVervallen`, `vergrendelVastgezet`, `vergrendelLosgemaakt`); 4 existing lock strings requalified; `vergrendelMislukt` rewritten. **12 `kalender.*` keys for this story in total.** |
| `frontend/src/features/jaarplan/Themakaart.tsx` | `slotUitleg` (the pair, in one place), the `isVervallen` suppression, the dekking sentence, the panel-level live region, `destructiveOutline` on the delete trigger, and three comments corrected. |
| `frontend/src/components/ui/button.tsx` | The `destructiveOutline` variant, with its reasoning and measured contrast beside the other variants. |
| `frontend/src/features/jaarplan/api.ts` | The "nothing observable" claim narrowed. |
| `backend/src/.../JaarplanGeneratieService.cs` | **Doc comment only, again no behaviour change** — same narrowing, plus why it is narrowed. |
| `frontend/src/features/jaarplan/Jaarplankalender.test.tsx` | 9 new tests (200 total, was 191). |

### Gates

| Gate | Result |
|---|---|
| `dotnet format --verify-no-changes` | ✓ clean |
| `dotnet test` (unit) | ✓ **496 passed, 0 failed, 0 skipped** |
| `dotnet test` (integration, real Postgres) | ✓ **153 passed, 0 failed, 0 skipped** |
| `corepack pnpm lint` | ✓ eslint `--max-warnings 0` + `tsc --noEmit` clean |
| `corepack pnpm test` | ✓ **200 passed** in 12 files (191 before this round) |
| `corepack pnpm build` | ✓ built; `.border-attentie-ink` and `hover:bg-attentie-zacht` verified present in `dist/assets/*.css`, so the new variant is not a class that generates no CSS |

**One honest note on the integration run.** The first `dotnet test` over the whole solution reported
**7 failed / 146 passed**, every failure an Npgsql connect timeout inside `PostgresTestDatabase.MaakAsync`. Not
this story's code and not flaky tests: two other agents were running an API and a Vite server out of other
worktrees at the time (`e3-08-zoom`, `agent-a8b6127bb7255ef99`), and 15 stray `jp_test_*` databases were still on
the server. Re-run on its own, the integration project is **153/153, 0 skipped**. Recorded because a reader of
the log would otherwise see a red run with no explanation.

### Browser pass — real API, real PostgreSQL, 1440px and exactly 390px

Playwright MCP is down, so headless Chrome driven over **CDP from Bash** (Node 24's global `WebSocket`, no deps),
which is what let this round *interact* rather than only screenshot. `Emulation.setDeviceMetricsOverride` gives an
exactly 390px viewport, so the `--window-size` clamp near 504px never applies. Own ports (API **5407**, Vite
**5307**) and a throwaway `jaarplanner_e406b` database, migrated from the real migrations and dropped afterwards.

**Seven placements** — including the two states round 1 never looked at:

> **Correction (fix round 2).** This paragraph originally claimed the seven covered *"every row of the table
> above"*. They did not. The seven included a `Geweigerd` **unlocked** card and no `Geweigerd` **locked** one,
> which is precisely the row the round-2 audit found broken: an unlooked-at state was reported as looked at.
> Round 2 renders and reads **all sixteen** `(status × vergrendeld × isVervallen)` combinations in one page; the
> table at the end of that section is the evidence.

- `Manueel` **+ locked** (Verkeer) and `Aanvaard` **+ locked, stale** (Op reis, stored on 2027-04-10, inside the
  Paasvakantie so no block starts there), plus a stale unlocked proposal (Feesten in december).
- Every card rendered the sentence its state maps to and no other. Verified by reading the DOM per card, not by
  eye alone; then looked at, at both widths.

**Keyboard only, no pointer:** focus the "Losmaken" on the locked `Manueel` card, `Input.dispatchKeyEvent` Enter →
the PUT fires, the badge goes, the panel flips to `vergrendelNietNodig`, the live region says *"«Verkeer» staat
niet meer vast."*, and a **full reload** shows the unlock read back from PostgreSQL. Same round trip in the other
direction on the `Voorgesteld` card (*"«Water» staat nu vast."*).

**Composited contrast, every alpha layer flattened, measured in the browser:**

| Element | Colour | Against | Ratio | Needs |
|---|---|---|---|---|
| `vergrendelDekking` (new), 12px/400 `text-ink-zacht` | `rgb(83,101,110)` | `rgb(248,247,244)` panel well | **5.66:1** | 4.5 |
| `vergrendelUitlegBeslistVast` (new), same token | `rgb(83,101,110)` | `rgb(248,247,244)` | **5.66:1** | 4.5 |
| `vergrendelUitlegVervallen` (new), same token | `rgb(83,101,110)` | `rgb(248,247,244)` | **5.66:1** | 4.5 |
| **`destructiveOutline` label**, 14px/600 | `rgb(103,54,20)` | `rgb(255,255,255)` button fill | ~~9.24:1~~ → **9.93:1** | 4.5 |
| **`destructiveOutline` border** (SC 1.4.11) | `rgb(103,54,20)` | flattened well, `rgb(247.8,246.6,244.2)` | **9.24:1** | 3.0 |
| `destructiveOutline` label on hover | `rgb(103,54,20)` | `rgb(254,248,236)` = `attentie-zacht` | **9.39:1** | 4.5 |
| neutral `outline` border beside it (unchanged) | `rgb(150,138,115)` | `rgb(248,247,244)` | **3.16:1** | 3.0 |
| focus ring token on the panel well | petrol `rgb(22,81,90)` | `rgb(248,247,244)` | **8.29:1** | 3.0 |

**390px:** viewport exactly 390. At rest `documentElement.scrollWidth === 390`, and **no element outside a
designated scroll region exceeds the viewport** in any state (checked by walking every node and its ancestors for
`overflow-x: auto|scroll`). Both buttons 220×36 with 23px between them.

*One pre-existing oddity, deliberately not "fixed" here.* Opening the edit panel of the **rejected** card in
period 3 makes `documentElement.scrollWidth` read 690 while `body.scrollWidth` stays 390 and **zero** laid-out
elements sit outside a scroll region. It is not this story's: the card it happens on has no lock section at all,
and the cards that do have one (Wonen, Herfst en oogst) keep it at 390. Reported to the orchestrator rather than
chased, because a fix would be inside E3-06/E3-07's ribbon.

### `frontend-design` skill

Re-invoked for this round. It drove three decisions: the dekking sentence is a **separate paragraph** rather than
a longer first sentence (one idea per line, and it is the same fact in two states, so duplicating the string
would have invited them to drift); the `destructiveOutline` variant reuses `attentie-ink` instead of introducing
a chrome accent; and no heading was added to the lock section, again, even though it now holds two sentences.

### Deliberately left

- **`IsVervangbaar` untouched** and **no status guard on `WijzigVergrendelingAsync`**, as instructed. The
  permissiveness is now documented as a decision with its reason.
- **No accept control** on the kalender (owner ruling: E4-01/E4-02).
- Round 1's finding 2 (the `Een_verplaatste_plaatsing_overleeft_een_hergeneratie` precedent living in the unit
  suite, not the integration one) still stands as a note for whoever edits the story text.

### Open questions for the orchestrator / owner

1. **Should `kalender.weigeringUitleg` say that a rejection survives a regeneration?** Today it explains only how
   to reverse the rejection. Adding it would be true; it would also put a third sentence on a card whose one open
   decision is the reversal. Owner question, reported not decided (finding 4).
   > **Answered (owner, 2026-07-31): yes, say it.** Built in fix round 2, and it is what closes that round's MAJOR
   > at its root: see round 2, item 1/2.
2. **`vergrendelUitlegVast` and `vergrendelNietNodig` must be re-verified when E4-07's preserve/overwrite rule is
   settled**, and again when E4-05 lands its second discard path (finding 3).
3. The 390px `documentElement.scrollWidth` observation above, for E3-06/E3-07.

## Fix round 2 — the rejected card gets the sentence that is true about a rejection

Round-2 gates on `ec65209`: **test-runner PASS** on all five criteria (it verified the whole
`(status, vergrendeld, isVervallen)` matrix in a browser and proved `vergrendelUitlegBeslistVast` with its own
scratch `[PostgresFact]` rather than by reading `IsVervangbaar`); **antagonist: 1 MAJOR + 4 MINOR**, with 8 of its
previous 9 findings verified closed. Nothing the test-runner pinned was touched.

**FR / Article:** FR-8.4 · Art. IV.2 (a human decision is the human's to change), Art. II.3 (all copy in
`nl.json`), Art. XII + WCAG 2.2 AA (contrast measured in a browser, never colour alone), Art. V.1 (dekking counts
`aanvaard`/`manueel`), the E3-06 rule (never ship a control that does nothing).

### 1 + 2 (MAJOR, plus an owner ruling) — `Geweigerd × vergrendeld` said the opposite of what the teacher decided

`slotUitleg` branched `!isVoorstel → vergrendelUitlegBeslistVast`, so a **rejected and locked** card opened with
*"Je hebt dit thema zelf beslist, dus een hergeneratie van het hele jaarplan laat het staan…"*. What the teacher
decided about that thema was **no**. The second half is factually true, which is exactly what made it a
true-looking sentence about the opposite decision, and the panel then read: *"Draai eerst de weigering terug"* →
*"je hebt dit beslist, het blijft staan"* → *"dit thema is geweigerd"*. `Themakaart.tsx`'s own comment forbade
this: `toonSlotOverbodig` excludes `isGeweigerd` precisely so a rejected card is not also told "a regeneration
leaves this standing", and the sibling branch did the excluded thing with a worse opening clause.

Fixed **at the root, per the owner's ruling**, not by patching the sentence:

1. **`kalender.weigeringUitleg` now states that a weigering survives a regeneration.** That is the fact a teacher
   cannot otherwise know, and *"ik heb dit geweigerd"* leads them to expect the opposite. It is true of the code:
   `IsVervangbaar` is `Voorgesteld && !Vergrendeld`, so a rejected placement is never discarded by a run, and
   `GenereerAsync` files a re-proposal of the same thema at the same `BlokStart` under `afgewezen` rather than
   inserting it again (`JaarplanGeneratieService.cs:217-231`). The new copy says all three parts in two sentences:
   it stays, it is not re-proposed *there*, and the card only goes when the teacher removes it.
   > *"Een weigering blijft gelden zolang jij ze niet terugdraait: een hergeneratie van het hele jaarplan laat ze
   > staan en stelt dit thema hier niet opnieuw voor, dus de kaart verdwijnt alleen als je ze zelf uit het
   > jaarplan haalt. Terugdraaien kan wel: het thema komt dan als jouw eigen keuze in deze periode."*
   >
   > "hier" is deliberate and load-bearing: the idempotence is per `(thema, niveau, blokStart)`, so the AI *may*
   > still propose the same thema in a **different** period. An unqualified "de AI stelt dit thema niet opnieuw
   > voor" would have been the same class of over-promise as the unscoped "bij hergenereren".
2. **A new sentence for the locked rejected card**, which no longer repeats the regeneration fact (it is stated
   once, in the weigering section, which always renders for a rejected card):
   > `kalender.vergrendelUitlegGeweigerdVast` — *"Bij een geweigerd thema voegt vastzetten niets toe: de weigering
   > zelf houdt dit thema al buiten bereik van de AI. Losmaken haalt alleen het label “Vast” weg, de weigering
   > blijft."*
3. **`isGeweigerd` is now tested first in `slotUitleg`, ahead of `isVervallen`.** That also takes the stale
   rejected card off `vergrendelUitlegVervallen` (see item 4).
4. **"Losmaken" stays** on both, so a lock is always undoable. Verified over the API and in a browser by keyboard.

Reachability, stated honestly: **not** reachable from today's UI (`wijzigPlaatsingStatus` is only ever called with
`"Manueel"`, `Themakaart.tsx:468`), reachable over the API now, and two clicks away the moment E4-01/E4-02 ship a
reject control. That is why it was fixed rather than deferred.

### 3 (owner ruling) — the dekking condition is now the teacher's own decision, not a status this screen cannot set

`vergrendelDekking` said a thema *"telt pas mee voor de dekking zodra het **aanvaard** is"*. E5's binding reading
counts **`Aanvaard` and `Manueel`** (`backlog/E5-dekking-export.md:15`), and "Verplaatsen" **on this very card**
turns a `Voorgesteld` placement into `Manueel` (`Themaplaatsing.VerplaatsNaar`). So the sentence named the one
status this screen cannot set while omitting the route it does offer. Per the owner's ruling it is now phrased as
the teacher's own decision, which covers both statuses, stays satisfiable today, and discloses no unbuilt work:

> *"Vastzetten gaat over de planning, niet over de dekking: dit thema telt pas mee voor de dekking zodra jij dit
> voorstel zelf overneemt."*

Still **one** sentence, because the card already carries three lines of explanation. "Overnemen" is the verb this
app already uses for both counting routes: `matching.manueelUitleg` says *"Manueel overnemen … Voor de dekking
telt dat even zwaar als Aanvaarden"*. It deliberately does **not** say "zelf beslist": a **weigering** is also the
teacher's own decision and does *not* count, so "beslist" would have been the same kind of near-truth this round
is fixing. The sentence only ever renders on a `Voorgesteld` placement anyway.

### 4 (MINOR) — the re-placement instruction is said once again, and never where there is no picker

`vergrendelUitlegVervallen` instructed *"kies eerst een periode voor dit thema"* while `kalender.herplaatsKies`
says the same thing at the top of the same panel. Worse, in the `isVervallen && vergrendeld && Geweigerd` state
the period picker is **suppressed** (`doelen = isGeweigerd ? [] : …`) and dragging is off, so the instruction
pointed at an affordance that is not there. Both halves fixed:

- The instruction is **gone** from `vergrendelUitlegVervallen`. It now reads *"Dit thema staat vast, maar het staat
  in geen enkele periode. Daar helpt vastzetten niet tegen. Wil je het slot weg, dan kan je het losmaken."* The
  remedy is stated once, above, by the key that owns it.
- The key no longer renders on a rejected stale card at all (item 1, point 3), which gets the weigering sentence.
- A **catalogue-wide guard** (`i18n/catalogus.test.ts`) now fails if any `kalender.vergrendel*` value contains the
  imperative "kies", so the instruction cannot be duplicated back in by a future string.

*Pre-existing, not mine, reported for filing against E3-07:* `kalender.herplaatsKies` has the identical defect in
that state. On a stale **rejected** card it tells the teacher to *"kies hieronder een periode … of versleep de
kaart"*, and the very next paragraph says *"Dit thema is geweigerd, dus je kan het niet verplaatsen"* — two
sentences that contradict each other, with no picker and no grip on the card. Photographed at 390px this round.

### 5 (MINOR) — the contrast figures: measured myself, and now stated identically everywhere

Three records disagreed about one pair (9.74 / 9.24 / 9.07) and a fourth, twenty-four lines up in the same file,
said 9.93. Re-measured in a real browser, compositing every alpha layer, and the disagreement has a cause worth
recording rather than just a winner:

| Element | Foreground | Measured against | Ratio | Needs |
|---|---|---|---|---|
| `destructiveOutline` **label** 14px/600 | `attentie-ink` `rgb(103,54,20)`, L = 0.055724 | its own `bg-card` fill, `rgb(255,255,255)` | **9.93:1** | 4.5 |
| `destructiveOutline` **border** (SC 1.4.11) | same | panel well: `bg-paper-diep/60` flattened over that white card | **9.24:1** | 3.0 |
| `destructiveOutline` label on **hover** | same | `attentie-zacht` `rgb(254,248,236)` | **9.39:1** | 4.5 |
| neutral `outline` border beside it (unchanged) | `input` token `rgb(150,138,115)` | same well | **3.16:1** | 3.0 |
| `vergrendelDekking` / `vergrendelUitlegGeweigerdVast` / `vergrendelUitlegVervallen` / `weigeringUitleg`, 12px/400 | `text-ink-zacht` `rgb(83,101,110)` | same well | **5.66:1** | 4.5 |
| `weigeringEerstTerugdraaien` / `herplaatsKies`, 12px/400 | `attentie-ink` `rgb(103,54,20)` | same well | **9.24:1** | 4.5 |

**Why 9.24 and not 9.27.** The well is `rgba(243,241,237,0.6)` over white = `rgb(247.8, 246.6, 244.2)`,
L = 0.927409. `getComputedStyle` and every devtools readout *display* that as `rgb(248,247,244)`, whose L is
0.930096; compositing from the rounded value gives 9.27:1, from the exact one 9.24:1. Both are arithmetically
correct on their own input, which is how three records of one pair drifted. The figures above are the measured
ones, from the exact composite, and `button.tsx` now states the same numbers **with the backdrop named** — a
figure without its backdrop is what made the earlier records uncheckable. The antagonist's 9.07 is not
reproducible: its own quoted luminances yield 9.27. Every wrong figure understated, so nothing was ever passing on
a failing number.

### 6 (MINOR) — the fifth unqualified regeneration claim, and a guard aimed at the class

`kalender.vergrendeldUitleg` — the `title` on the "Vast" badge — still read *"Blijft staan bij hergenereren"*. True
today, and the one string of the family the audit had not quoted, so round 1's four qualifications missed it. It
now reads *"Blijft staan bij een hergeneratie van het hele jaarplan"*.

The guard is no longer four literal assertions. `i18n/catalogus.test.ts` now **iterates every**
`kalender.vergrendel*` value, and any that mentions "hergener" must contain "hele jaarplan"; it also fails if the
family stops matching at all, so it cannot go quiet. That is the pattern `catalogus.test.ts` exists for, in its own
words: *each previous fix was applied to the one instance that had been noticed.* The two rendered-copy assertions
in `Jaarplankalender.test.tsx` stay (a passing guard is not worth moving) and point at the class-wide one.

### 7 — the two records that would have been cited as evidence

Both corrected in place, above, marked as corrections rather than rewritten: the round-1 state table (which
tabulated the very behaviour the code comment forbade) and the *"Seven placements, covering every row of the table
above"* claim (they covered a `Geweigerd` **unlocked** card and no locked one, i.e. exactly the defective row).

### Files changed in this round

| File | Why |
|---|---|
| `frontend/src/i18n/nl.json` | 1 new key (`vergrendelUitlegGeweigerdVast`); `weigeringUitleg`, `vergrendelDekking`, `vergrendelUitlegVervallen` and `vergrendeldUitleg` rewritten. **13 `kalender.*` keys for this story in total.** |
| `frontend/src/features/jaarplan/Themakaart.tsx` | `slotUitleg` tests `isGeweigerd` first; three comments corrected to what is now built (the class note on the dekking condition, the `toonSlotOverbodig` note, the `isVervallen` note). |
| `frontend/src/components/ui/button.tsx` | The `destructiveOutline` contrast figures, re-measured, each with its backdrop named. No style change. |
| `frontend/src/features/jaarplan/Jaarplankalender.test.tsx` | `it.each` narrowed to Aanvaard/Manueel; a new 2-case `it.each` for `Geweigerd × vergrendeld × (placed, stale)`; the four literal "hele jaarplan" assertions reduced to the two this test renders. |
| `frontend/src/i18n/catalogus.test.ts` | Two catalogue-wide guards over the whole `kalender.vergrendel*` family: the qualified-regeneration one and the no-duplicated-instruction one. |
| `backlog/worklogs/E4-06/implementation.md` | This section, plus the two corrections of item 7. |

**No backend change this round.** No behaviour changed, so `IsVervangbaar`, the status guard question and the
integration test are exactly as the test-runner verified them.

### Gates

| Gate | Result |
|---|---|
| `dotnet format --verify-no-changes` | ✓ clean (no output) |
| `dotnet test` unit, `JAARPLANNER_TEST_POSTGRES` set | ✓ **496 passed, 0 failed, 0 skipped** |
| `dotnet test` integration, real PostgreSQL 17 | ✓ **153 passed, 0 failed, 0 skipped** |
| `corepack pnpm lint` | ✓ eslint `--max-warnings 0` + `tsc --noEmit` clean |
| `corepack pnpm test` | ✓ **203 passed** in 12 files (200 before this round) |
| `corepack pnpm build` | ✓ built, 38.18 kB CSS |

### Browser pass — real API, real PostgreSQL, all sixteen states in one page

Headless Chrome over **CDP from Bash** again (Playwright MCP still down). Own ports (API **5408**, Vite **5308**),
throwaway `jaarplanner_e406c` migrated from the real migrations. **Sixteen** placements this time, seeded by SQL so
every combination exists: one thema per status (Water = Voorgesteld, Wonen = Aanvaard, Herfst en oogst = Manueel,
Verkeer = Geweigerd), each placed twice in real periods (unlocked, locked) and twice on dates inside the
Paasvakantie 2027-04-08/10, where no derived block starts, so `isVervallen` is true. Every panel opened at once and
the rendered `<p>` text read back per card, then mapped to its `nl.json` key. **All sixteen printed the key its
state maps to and no other:**

| `status` | `vergrendeld` | `isVervallen` | Picker | Buttons | Rendered sentences, in DOM order |
|---|---|---|---|---|---|
| Voorgesteld | no | no | yes | Verplaatsen + **Vastzetten** + Uit deze periode halen | `verplaatsGevolg`, `vergrendelUitlegVrij`, `vergrendelDekking` |
| Voorgesteld | **yes** | no | yes | Verplaatsen + **Losmaken** + Uit deze periode halen | `verplaatsGevolg`, `vergrendelUitlegVast`, `vergrendelDekking` |
| Voorgesteld | no | **yes** | yes | Verplaatsen + Uit het jaarplan halen | `herplaatsKies`, `verplaatsGevolg` |
| Voorgesteld | **yes** | **yes** | yes | Verplaatsen + **Losmaken** + Uit het jaarplan halen | `herplaatsKies`, `verplaatsGevolg`, `vergrendelUitlegVervallen` |
| Aanvaard | no | no | yes | Verplaatsen + Uit deze periode halen | `verplaatsGevolg`, `vergrendelNietNodig` |
| Aanvaard | **yes** | no | yes | Verplaatsen + **Losmaken** + Uit deze periode halen | `verplaatsGevolg`, `vergrendelUitlegBeslistVast` |
| Aanvaard | no | **yes** | yes | Verplaatsen + Uit het jaarplan halen | `herplaatsKies`, `verplaatsGevolg` |
| Aanvaard | **yes** | **yes** | yes | Verplaatsen + **Losmaken** + Uit het jaarplan halen | `herplaatsKies`, `verplaatsGevolg`, `vergrendelUitlegVervallen` |
| Manueel | no | no | yes | Verplaatsen + Uit deze periode halen | `vergrendelNietNodig` |
| Manueel | **yes** | no | yes | Verplaatsen + **Losmaken** + Uit deze periode halen | `vergrendelUitlegBeslistVast` |
| Manueel | no | **yes** | yes | Verplaatsen + Uit het jaarplan halen | `herplaatsKies` |
| Manueel | **yes** | **yes** | yes | Verplaatsen + **Losmaken** + Uit het jaarplan halen | `herplaatsKies`, `vergrendelUitlegVervallen` |
| Geweigerd | no | no | **no** | Weigering terugdraaien + Uit deze periode halen | `weigeringEerstTerugdraaien`, `weigeringUitleg` |
| **Geweigerd** | **yes** | no | **no** | **Losmaken** + Weigering terugdraaien + Uit deze periode halen | `weigeringEerstTerugdraaien`, **`vergrendelUitlegGeweigerdVast`**, `weigeringUitleg` |
| Geweigerd | no | **yes** | **no** | Weigering terugdraaien + Uit het jaarplan halen | `herplaatsKies`, `weigeringEerstTerugdraaien`, `weigeringUitleg` |
| **Geweigerd** | **yes** | **yes** | **no** | **Losmaken** + Weigering terugdraaien + Uit het jaarplan halen | `herplaatsKies`, `weigeringEerstTerugdraaien`, **`vergrendelUitlegGeweigerdVast`**, `weigeringUitleg` |

(`vergrendelDekking` appears on exactly the two `Voorgesteld && !isVervallen` rows, which is the rule. A card with
an `aiMotivatie` also shows `motivatieLabel`, omitted from the table as it is not lock copy. `verplaatsGevolg`
appears only where the move has something to lose, per E3-07.)

**The two rows in bold are the ones round 1 never rendered**, and they are the fix. Both were also driven, not
only read: on the locked rejected `Verkeer` card, **keyboard only** (`Input.dispatchKeyEvent` Enter on a focused
"Losmaken", no pointer) the PUT fires, the badge goes, the live region announces *"«Verkeer» staat niet meer
vast."*, the lock section disappears (correct: an unlocked rejected card is offered no lock, by design), and a
**full reload** shows the unlock read back from PostgreSQL. Re-locked over the API and re-verified.

**390px:** `Emulation.setDeviceMetricsOverride` **before** the first navigation and `mobile: false` — with
`mobile: true` Chrome reports `window.innerWidth === 1560` for a 390 layout, which would have made every
measurement here a lie. Confirmed `innerWidth === 390`, `body.scrollWidth === 390`, and **zero** elements outside a
designated scroll region (walking every node's ancestors for `overflow-x: auto|scroll`). Buttons 220–268 × 36.
`window.scrollTo(600, 0)` leaves `scrollX === 0` in every state, so there is no horizontal page scroll: the
`documentElement.scrollWidth` reading of 2006 with all sixteen panels open is the ribbon's scroll region being
counted, the same pre-existing artefact round 1 saw at 690 with one panel. Screenshots taken at 1440 and at exactly
390 of both bold rows.

### Deliberately not touched (as instructed)

`IsVervangbaar`; the status guard on `WijzigVergrendelingAsync`; the `role="status"` live region; the
`destructiveOutline` **design** (only its stated figures were wrong); the integration test; the four qualified
sentences (`vergrendelUitlegVrij`, `vergrendelUitlegVast`, `vergrendelNietNodig`, `vergrendelUitlegBeslistVast`);
and `backlog/E4-bewerking-hergeneratie.md`, which the orchestrator owns.

### Nothing disputed

All five findings are accepted and fixed. One correction to a *number* in a finding, not to the finding: the
border ratio is **9.24:1** against the exact composite (9.27:1 if you round the well first), not 9.07:1.

### Still open for the orchestrator / owner

1. **`kalender.herplaatsKies` on a stale rejected card** — pre-existing E3-07 defect, described under item 4. Not
   fixed here on instruction; file against E3-07.
2. `vergrendelUitlegVast`, `vergrendelNietNodig`, `vergrendelUitlegBeslistVast`, `vergrendeldUitleg` and the new
   `weigeringUitleg` all promise something about "een hergeneratie van het hele jaarplan". **E4-05's second discard
   path and E4-07's preserve/overwrite rule must re-verify all five**, and the catalogue guard will point at them.
3. `Geweigerd` remains unreachable from the UI (nothing here sets it). The moment E4-01/E4-02 add a reject control,
   the two bold rows above become two clicks away, and the copy is already in place for them.
