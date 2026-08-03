# E3-08 — Test report, round 1

> **Persisted by the orchestrator, not by the verifier.** The `test-runner`'s `Write` tool was disabled in
> that context and it declined to route around the restriction with a shell write, so it returned the report
> and asked for it to be put on disk. The text below is its report; the framing sentences are the
> orchestrator's.

**Verdict: PASS.** Mode: both — Vitest plus a Playwright MCP browser pass, plus a headless-Chrome/CDP pass
for composited contrast, an exact 390px viewport and real-browser axe.

Worktree `.claude/worktrees/e3-08-zoom`, branch `story/E3-08-zoomniveaus`, commit `a1a75d9` on `main`
(`0de4851`). Verifier's own ports: API `5291`, Vite `5292` (proxying `/api` to 5291), CDP 9333. Real
PostgreSQL 17 on 5432, `Demo__Seed=true`, klas `L3 derde leerjaar (demo)`, schooljaar 2026-2027.

## Criteria

| Criterion | Result | Evidence |
|---|---|---|
| Switch between a year overview and a finer period/block view | PASS | `role="group"` labelled `Weergave`, two `<button aria-pressed>` above the spine. Coarse = 7 period columns + 4 vakantiegaten; fine = 19 + 4. Spine 7 → 19 segments. Board `aria-label` follows the tier. Every fine column shows `Hoort bij themaperiode N` from `ouderOrdinaal`. One `/rooster` fetch drives spine and board; the tier is sent explicitly on the first request. |
| No unit hard-named, no month presupposed | PASS | New copy names only tiers. No month, week-number or term anywhere; `Planningsblokniveau` has two members and no `Maand`. Week counts deliberately absent from the labels. |
| **Level switching works without losing state** | PASS, verified on the wire | See below. |
| E3-04 obligation 1 | PASS | See below. |
| E3-04 obligation 2 | PASS | Rendered copy names `Weergave` and the exact option label `Themaperiodes`; the test asserts the agreement rather than the sentence. |
| No "Te herzien" for a healthy plan at the fine tier | PASS | No `role="region"` notice at either tier, at 1440 or 390. |
| No move affordance at the fine tier, reason in visible text | PASS | 0/6 grips, 0 selects in the open panel; the reason is a visible paragraph, not a `title`. |
| Nothing server-authored rendered | PASS | `blokindeling` absent from `innerText` at both tiers and widths; source-wide it occurs only in `types.ts` and fixtures. |
| No new `{aantal}` string without a singular sibling | PASS | The `nl.json` diff adds no `{aantal}` string; new placeholders are `{ordinaal}`. `catalogus.test.ts` green. |
| No em dash in new Dutch copy | PASS | 0 in the added `nl.json` lines, 0 in rendered `innerText`. The em dashes in the diff are English code comments and `describe` names. |

## State across a switch, checked on the wire

1. At `Themaperiodes`, set **Periode 3 (9 nov – 20 dec) = "Licht en donker"** and did **not** generate.
2. Switched to `Subthemaperiodes`: the disclosure stayed `aria-expanded="true"` (nothing remounted), the
   summary still read `(1 startthema)`, and no `Jaarplan laden…` line appeared.
3. Switched back: `Periode 3` still `Licht en donker`, every other row `Geen voorkeur`.
4. Generated. `GET /jaarplan/parameters` then reported
   `{"gewensteStartthemas":[{"blokStart":"2026-11-09","themaNaam":"Licht en donker"}],"vasteMomenten":[]}` —
   the **themaperiode** start, so the run keyed on the generation tier after a round trip through the fine tier.

Also survived: the open card panel, the klas/schooljaar URL state, the toggle's pressed state. Keyboard: both
options are natural tab stops; Tab moves 1 → 2 and Enter switches the tier.

## Obligation 1, checked in the hardest state

With a **stored** setting present (`2026-11-09` / `Licht en donker`) and the fine tier showing: the
`Startthema's` fieldset holds exactly one paragraph and **zero** comboboxes, there is no `zonder
periode`/vervallen region, the summary still counts the setting, and `Vaste momenten` stays usable (a date is
not a block). Generating **from the fine tier** left the stored parameters byte-identical and the placements
untouched.

> The antagonist's MAJOR-1 concerns this same area from the other side: with a **stranded** kept preference
> the summary's count is what goes wrong, and this pass exercised a *valid* stored preference. Both readings
> are compatible; the gap is that neither the tests nor this pass drove the stranded case at the fine tier.

## Why no false staleness, verified rather than assumed

`GeconfigureerdePlanningsblokIndeling` subdivides **each** themaperiode, so every coarse start is also a fine
start. Against the live API: coarse starts
`['2026-09-01','2026-10-02','2026-11-09','2027-01-04','2027-02-22','2027-04-19','2027-05-26']`, and the set of
coarse starts not among the 19 fine starts is **empty**. Probes: `teHerzienPresent: false`,
`regionHeadings: []` at coarse-1440, fine-1440, fine-390 and coarse-390.

## Move affordances, both sides of the comparison

Coarse: 6/6 cards carry `⠿`; the open panel offers `Verplaats naar` with 6 options. Fine: **0/6** grips; the
open panel contains **zero** `<select>` (only `Aanpassen sluiten`, `Uit deze periode halen`). The reason is
visible text above the board at 5.73:1. The only `title` attributes on the page are the pre-existing
AI-motivation truncations. **Regression check:** moving still works at the coarse tier — via the picker,
`Zomer en vakantie` moved Periode 6 → 7, the server persisted `2027-05-26` / `Manueel`, and it was moved back.

## Gates

- `corepack pnpm test` → **196 passed / 12 files, 0 failed, 0 skipped**; a grep of the full run for
  `not wrapped in act|Warning:|skipped|todo` → **0**. The implementer's numbers reproduce exactly.
- `corepack pnpm lint` → exit 0. `corepack pnpm build` → exit 0.
- **Backend claim confirmed:** `git diff --stat 0de4851..HEAD -- backend/` is empty, so skipping the `dotnet`
  gates is justified.
- `dotnet ef migrations list` → 11 migrations, none pending, so E3-04's
  `20260730191341_GeneratieparametersPerKlasEnSchooljaar` is applied.
- **Real-browser axe** (axe-core 4.10.2, wcag2a/2aa/21a/21aa/22aa): **0 violations** at coarse-1440,
  fine-1440 and fine-390, 27 passes each. This is the check jsdom cannot perform.
- **Composited contrast:** selected option **8.90:1**, unselected **15.42:1**, group label **14.55:1**, track
  border **3.21:1** at 1px. Three carriers of state, never colour alone.
- **390px** via `Emulation.setDeviceMetricsOverride` (`innerWidth === 390`, `matchMedia('(max-width: 400px)')`
  true): no page-level horizontal overflow at either tier. The fine spine drops date labels below `sm` as
  documented, keeping the sr-only ordinals.
- The new tests drive the real control, assert the `?niveau=` request, assert the coarse grid is present
  **with no await** after switching back (the cache-separation property), count `getAllByText("Water")` as 1
  and `legeperiode` as 6, and assert the grip's presence at coarse before asserting its absence at fine.

## Observations that did not fail a criterion

- **One implementer claim does not reproduce as stated.** *"`scrollWidth === clientWidth` at both 1440 and
  390"* is false for the **board**: the `<ol>` measures `scrollWidth 5800` against `clientWidth` 1384 (1440)
  and 358 (390), because it is an `overflow-x-auto` ribbon meant to scroll sideways. What holds, and what
  matters, is that the **document** does not overflow. Product fine; the sentence measured the wrong element.
- **The track border is 3.21:1 where the control actually sits** (on paper), not 3.40:1. The component's own
  comment documents both; the worklog quoted the card value. Above the 3:1 floor either way.
- **`kalender.herplaatsAnderNiveau` is untested.** The one new branch left unpinned. It could not be
  exercised in a browser: making a placement stale needs a direct DB write (schooljaarbeheer is create/read
  only until E6-03) and the sandbox blocked the `UPDATE`. Code reading is consistent and `TeHerzien` still
  renders no close control, so non-dismissibility is intact.
- **Bookkeeping.** The commit flips the checkbox to `[~]` but leaves `backlog/README.md` untouched. It also
  carries the owner's "te vol" ruling under E3-09 and an edit to E3-10's question C: documentation, no code,
  outside this story's scope. (Orchestrator-authored; see `antagonist.md`.)

## Environment notes

- `POST /jaarplan/generatie` returns **500** locally because no `AzureAI:ApiKey` is set — the filed E2-09 gap,
  not a regression, and the reason the run left the plan untouched. It does not affect the criteria:
  parameters are persisted before the AI call, which is what made the wire readable.
- Contention: a parallel agent was active with its own app on 5373/5183. This pass ran on 5291/5292. Late in
  the run something navigated the CDP tab to `localhost:5183`, **after** all measurements; every figure above
  came from `localhost:5292` with this run's schooljaar id. The verifier closed its own Chrome rather than
  keep driving a possibly-shared browser.
- Demo data deliberately mutated, mostly restored: `Zomer en vakantie` moved and moved back (its status is now
  `Manueel`, which the UI states is irreversible), and the class now holds one stored startthema preference
  (`2026-11-09` / `Licht en donker`) that did not exist before.

---

# E3-08 — Test report, round 2 (`364c3b5`)

> Persisted by the orchestrator; the verifier's `Write` was disabled again and it correctly refused to route
> around the restriction with a shell write.

**Verdict: FAIL** — one **new MAJOR**, introduced by the round-1 fix. Both round-1 MAJORs are genuinely fixed
and items 2–9 all pass. Mode: Vitest **plus mutation testing** plus a real browser against the real API and
PostgreSQL **with fault injection**.

Setup: API `127.0.0.1:5421` (`ASPNETCORE_ENVIRONMENT=Development`, `Demo__Seed=true`, real Postgres) → fault
proxy `5423` → Vite `5422` → headless Chrome CDP `9421`. All four ports claimed in the groepschat and released;
no other session's ports touched.

## 1. Stranded startthema — PASS at both tiers, FAIL on its new failure mode

Reproduced with a stranded stored preference at `blokStart 2026-10-18` — **the sharpest available case**, since
that date starts *Subthemaperiode 4* and **no** themaperiode, so round-1's code would have found it in the fine
grid and promoted it.

| | coarse | fine |
|---|---|---|
| summary | `(1 zonder themaperiode)` | `(1 zonder themaperiode)` |
| loud `role=region` notice | present | withheld |
| period rows | offered | 0, `parameters.anderNiveau` instead |
| POST body | `{"gewensteStartthemas":[{"blokStart":"2026-10-18","themaNaam":"Water"}],…}` | byte-identical |

**Cost of the second fetch: PASS**, counted at the proxy. First load = **1** `/rooster` (both hooks share the
key at the coarse tier), zoom to fine = 1 more, zoom back = 1 ordinary staleness refetch.

**New MAJOR:** with the generation-tier query errored and the fine one succeeding, the summary reads
`(1 startthema)` for the same stranded setting, there is **no error notice anywhere**
(`foutZichtbaar:false`, `instellingenFout:false`), generation is enabled, and the POST still sends the stranded
entry. Round-1 finding 1's exact symptom by a new route, and the route is the one this fix's own copy
recommends. Evidence: `shot-newmode-fine.png`.

## 2. A failed `/rooster` no longer destroys the screen — PASS

Fault: 500 only `?niveau=Subthemaperiode`. Fallback keeps the zoom control (both options), 6 cards, the spine
and the generate button; body text went 2442 → **2610** chars (round 1: 2359 → **525**). `role="alert"` on the
sentence with the retry as a **sibling** (`retryInAlert:false`, `retryIsSibling:true`); no "herlaad"
(`zegtHerlaad:false`); the pressed option stays the tier the teacher chose; one retry click recovers the
19-column board. First-load failure of **both** tiers still keeps the control and the retry, and recovers to 7
columns. axe: 0 violations in both failure states.

## 3. Copy fixes — PASS with a residue

`conceptUitleg`, `anderNiveau`, `verwijderVraag`/`uitPeriodeHalen` and `parameters.periodeLabel` are all
correct, and the `teVol`/`teVolUitleg`/`wordtTeVol` narrowing is **stated** rather than silent. Residue: three
*undeclared* strings still say bare "periode" (`leegRooster`, `indelingUitleg`, `genereerUitleg`) and the new
`roosterFout` adds a fourth name, "periode-indeling".

## 4. Sub-column empty state — PASS

On the real 19-column grid: **8** × "Deel van een ingeplande themaperiode", **6** × "Nog niets gepland", **5**
columns holding cards (6 cards; themaperiode 3 holds two) = 19. Every fine column also names its parent.

## 5. The new tests bite — PASS (4 mutations, each restored, tree verified clean)

| mutation | result |
|---|---|
| form gets `grid.blokken`/`grid.niveau` again (round-1 code) | stranded test fails: `expected '1 startthema' to be '1 zonder themaperiode'` |
| reinstate the `rooster.isError` early return | "keeps the plan and a way forward" fails |
| `ouderIsIngepland` ignored | fine-tier test fails |
| stale panel points at `herplaatsKies` again | `herplaatsAnderNiveau` test fails |

## 6. ADR amendment — PASS

Dated amendment on ADR-0014 naming E3-07 explicitly (*"no audit noticed — including the audit of E3-07
itself"*) and the accepted reload/shareability loss; ADR-0021's bullet struck through rather than deleted, with
the `?niveau=` follow-up recorded.

## 7. Regression against the round-1 PASS — PASS

7 × `Themaperiode 1…7` ↔ 19 × `Subthemaperiode 1…19`; board `aria-label` follows the tier; at the fine tier no
picker and no `Verplaatsen` (only `Aanpassen sluiten` + `Uit de themaperiode halen`), `sleepUitleg` replaced by
`fijnUitleg`; no "Te herzien" for a healthy plan at either tier; no server-authored or English text, 0 console
errors. **Moving still works at the coarse tier:** a real move of `Zomer en vakantie` to themaperiode 7 and
back through the picker, with the database verified restored (`2027-04-19`, ordinaal 6, `Manueel`).

## 8. Gates — PASS, all reproduced

`lint` exit 0 · `vitest run` **200 passed / 12 files, 0 failed, 0 skipped**, no `act(`/`console.error`/stderr
lines · `build` 0 in 2.88s · backend diff **empty** (measured from the merge-base, since a raw `main..364c3b5`
diff only shows main's newer commits) · real-browser axe **0 violations** across six states (coarse/fine at
1440 and 390, the fallback error state, and the first-load failure state), 42 passes each · 390px measured with
a true 390 viewport, `scrollWidth == clientWidth == 390`.

## 9. Contrast, alpha composited — PASS, values reproduce

alert text 5.18:1 · retry border 6.48:1 against its own fill and 5.18:1 against the wash · retry label 12.34:1
· `subperiodeIngepland` 5.56:1 (its own `bg-paper-diep/50` included).

## Defects returned

- **[MAJOR]** the failed generation-tier grid, above. Expected behaviour: refuse honestly
  (`parameters.samenvattingOnbekend` already exists) and gate generation the way `instellingenOnbekend` does.
- **[MINOR]** "one word per tier" incomplete, three undeclared strings plus a fourth name.
- **[MINOR]** **the story's own obligation 1 now contradicts the shipped behaviour** — the backlog still said
  the fine tier renders "no stranded claim", which is the very thing the fix had to stop doing. *Corrected by
  the orchestrator in `backlog/E3-jaarplan-kalender.md` the same day, with the reasoning kept.*
- **[Observation, not this story's]** the empty well's dashed border measures 1.25:1 against its own fill, and
  at the coarse tier that well is a drop target. Pre-existing token → E7-10. Also: the first-load failure state
  drops the page `<h1>` with the klas/schooljaar header, which costs orientation.

---

# E3-08 — Test report, round 3 (`4e8f6eb`)

> Persisted late by the orchestrator, together with the round-3 antagonist verdict. The round-4 audit filed the
> omission as MINOR-3: fix round 3 was written against a relayed summary of the findings rather than against the
> reports, which is the asymmetry the independent pass exists to prevent.

**Verdict: PASS**, on every criterion of the story. Mode: Vitest plus mutation testing plus a real
headless-Chrome pass against the API and PostgreSQL. Ports 5451/5452/5453/9451, claimed and released, `mine`
empty afterwards.

**The new MAJOR of round 2 is fixed, verified with the verifier's own fixture rather than the implementer's.**
Stored startthema `2026-09-14` (inside themaperiode 1 but not its start), then faulted **only**
`?niveau=Themaperiode`. The route is the one the copy recommends: the coarse first load fails, the full-page
notice keeps the zoom control, pressing *Subthemaperiodes* brings the plan back at the fine tier with the
generation grid still gone. The summary then reads exactly `(themaperiodes onbekend)` — not `(1 startthema)`,
not `(1 zonder themaperiode)`; generate is `disabled`; exactly **one** `role="alert"` naming the cause; both
fieldsets disabled; one retry beside the button it disabled; clicking generate posts nothing. After the retry:
`(1 zonder themaperiode)` and generate re-enabled.

**The third state nobody had named composes correctly.** `bekend` + `instellingenOnbekend`: generate disabled,
summary `(instellingen niet geladen)`, one alert, board intact — the wider unknown correctly takes precedence.
Both faults together: **two** alerts, one per cause, two retries, neither cause swallowed. A mid-flight snapshot
caught the honest intermediate (`(instellingen laden…)` with the button already disabled), because the gate uses
`isPending || isError` and so closes during the retry window too.

**The false alert on an errored background refetch is fixed, and the 3-second trap is real.** A probe at ~3s
showed a healthy screen with 0 alerts — it would have "proved" the bug absent. The proxy log shows why: four
attempts at +0, +1, +3 and +7 seconds before `status` flips. After 10s: the quiet sentence is present, the
element has `role: null` with no ancestor role and no `aria-live`, the retry is a sibling, and the board's
`aria-label` and the notice agree about the tier. Generation stays enabled, which is right: this failure cost
nothing.

**MINOR-C proved by a decisive count rather than by reading code:** with themaperiode 6's sole placement set to
`Geweigerd` in the database, the counts moved **8 → 6** membership sentences and **6 → 8** *"Nog niets gepland"* —
exactly the two sub-columns of that parent flipping back to the truthful claim.

**MINOR-F:** reached by rewriting `"niveau"` to `"Kwartaal"` in the response. `roosterNiveauOnbekend` renders,
`fijnUitleg` and `sleepUitleg` are both absent so nothing instructs the teacher to switch to the view they are
on, 0 drag grips, generate disabled, and **no retry is offered** — correct, since the request succeeded.

**MINOR 5, the sweep:** walked every string *value* in `nl.json` in Node (not a grep over keys, which would have
false-positived on `legeperiode`), stripping `themaperiode`/`subthemaperiode` first. Exactly three survivors, all
declared: `teVolUitleg`, `wordtTeVol`, and `periodeKeuze`'s date-range placeholder. The claimed fifth instance is
real: `spine.titel` is now tier-specific, and the sr-only figcaption reads *"Het schooljaar in themaperiodes"* /
*"… in subthemaperiodes"* — the first thing a screen-reader user hears about the strip, no longer contradicting
the ordinals under it.

**Gates, all reproduced:** `vitest` 203/203 in 12 files with no `act(`/`warn`/`skip`/`stderr` lines, `lint` 0,
`tsc --noEmit` 0, `build` 0 in 6.95s, backend diff empty. Real-browser axe **0 violations on five states**
including both failure states, `color-contrast` `incomplete` in all of them, which is why it was measured by
hand. Three mutations, each applied and reverted **inside the same Bash invocation** so a mid-run death could not
leave the tree dirty (the E4-06 lesson); all three bite, two reproducing round 1's `'1 startthema'` verbatim.

**Contrast, composited:** `generatieRoosterFout` text **5.48:1**, quiet retry border **3.21:1** against its
backdrop (3.40:1 against its own fill), loud retry border 6.48:1, `roosterVerversenMislukt` 14.55:1,
`roosterNiveauOnbekend` 5.73:1, the parameter notices 6.08:1, `subperiodeIngepland` 5.56:1.

**The cross-story determination that changed the landing plan:** E3-08 makes E3-07's stale-rejected-card defect
**worse at the fine tier**. State created by direct DB write (`BlokStart 2027-04-20` off a boundary + `Status
Geweigerd`). Coarse: the two contradicting sentences, no picker, no grip — **but the corrective control is on the
same screen**, so a teacher resolves it in place. Fine: `herplaatsAnderNiveau`, *a string this story added*,
converts that local contradiction into a **cross-view instruction that will not be kept**, because it is the
rejection and not the tier that withholds the picker; it also drops the mention of dragging, leaving one
instruction that is false. Control case verified: fine + stale + `Manueel` → the sentence is correct and helpful.
So the fault is specifically the `Geweigerd × stale × fine` intersection. *→ The owner ruled it be fixed in
E3-08, which became fix round 3.*

**Observations, not defects:** a failed *background* refetch of the generation-tier grid is silent (no false claim
is made, which is the point, but the stale-grid risk that earned the board tier its `verversen` sentence has no
equivalent); at the unrecognised tier the board's `aria-label` still names a tier the app admits it cannot read;
`roosterNiveauOnbekend` carries no `role="alert"`, defensibly; and pre-existing from E3-04, the panel renders 7
disabled startthema rows reading *"Geen voorkeur"* while the stored settings are unknown.

**Demo data** mutated, declared in two `TOUCH` posts, restored and verified by `GET` **and** `psql`: the
generatieparameters row and all six `themaplaatsingen`. No AI run happened at any point — `user-secrets` holds
only the connection string, so every generation POST 500'd *after* persisting parameters and *before* touching the
plan.

---

# E3-08 — Test report, round 4 (the merged tree, `56f647e`) — final verification

> **Persisted by the fix-round-4 implementer, not by the verifier, and that is why this section is shorter than its
> three predecessors.** The round-4 test-runner left its verdict as a `GATE` post in the groepschat (2026-08-03 14:39)
> plus a `TOUCH` and an `INFO`, and its session ended before the prose report reached this file. What follows is that
> post, condensed, with nothing added to its findings. The full original wording is in
> `.claude/coordination/groepschat.md` at that timestamp — which is gitignored live state, so this is the durable copy.

**Verdict: PASS on all 9 assignment items**, measured independently on the merged tree in a real browser against the
real API and PostgreSQL rather than inherited from the implementer. Ports 5491/5492/5493/9491, claimed and released.

What it measured, in its own summary:

- **All three `Verplaatsstaat` states**, the last (`niveauOnbekend`) through a proxy that rewrites `/rooster`'s `niveau`
  to `Kwartaal`, because the controller 400s on an unknown `?niveau=`.
- `Geweigerd` x stale gets **no** re-placement sentence at the coarse, fine **or** unrecognised tier, and keeps
  `weigeringEerstTerugdraaien` plus its *Weigering terugdraaien* button.
- The `Manueel` x stale **control** keeps `herplaatsKies` and a 7-themaperiode picker at the coarse tier and the honest
  cross-view sentence at the fine one, **and the named view really does hold the picker**.
- `niveauOnbekend` names **no** view.
- **MINOR-1 confirmed in-browser:** the generate button disabled **and** `generatieRoosterNiveauOnbekend` rendered
  **and** zero *Opnieuw proberen* buttons anywhere on the page.
- `indelingUitleg` gone, zero call sites, not resurrected by the merge. `nl.json`: 0 keys lost from either parent, 0
  invented; `weigeringUitleg` = main's sentence + *themaperiode*; `vergrendelUitlegVervallen` carries the Art. II.4 fix;
  `teVolUitleg` / `wordtTeVol` untouched.
- **Merge fidelity:** `Bewerkpaneel`'s comments-stripped diff against main is **only** the `verplaatsstaat` prop, the
  doelen guard and the one `herplaats` paragraph's condition/content. E4-06's `role="status"` region, `slotUitleg` and
  the lock/weigering/delete sections are byte-identical, and E4-06's lock was re-verified end to end (badge matched on
  the exact `🔒 Vast` sequence rather than a substring that also matches *Vastzetten*).
- **axe** 0 violations at 3 states; contrast measured with alpha compositing at 9.24:1 and 5.66:1. **390px** via CDP
  device metrics: `documentElement.scrollWidth` 390, no document overflow. No server-authored string in the DOM
  (`blokindeling` absent). Console clean, all API calls 200.
- **Demo data restored and verified** by DB query **and** `GET`, byte-identical to the recorded baseline — which was
  itself byte-identical to round 3's and the merge round's records, so both earlier restores were honest.

**Its two flagged non-defects:** the two uncommitted worklog files in this worktree were not its own (they were the
orchestrator's round-3 records; committed with fix round 4), and it agreed the merge need not chase `origin/main`'s
`efecf73`, whose three commits touch only `CLAUDE.md`, `assets/` and `backlog/README.md`.

> **One correction to the verifier's own closing caveat, recorded here rather than by editing its words.** It closed by
> saying an independent antagonist pass over `ae14b0b` / `0363ccf` / `56f647e` *"has still not run"*. It **had** run, in
> parallel with it: that is the round-4 verdict in `antagonist.md` (0 CRITICAL / 0 MAJOR, 7 MINOR, 2 QUESTION). Neither
> agent could see the other. Worth keeping as the general lesson about gating in parallel: **each may reason about the
> other's absence and be wrong**, so a claim that a sibling gate did not run needs the board checked, not inferred.
