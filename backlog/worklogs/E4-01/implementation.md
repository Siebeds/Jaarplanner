# E4-01 — Immediate persistence + live coverage reflection

**Story:** E4-01 (FR-6.5, FR-7, Art. V.1) · **Branch:** `story/E4-01-live-dekking` off `origin/main` `7f6d8d9`
(i.e. with **E5-02** and **E4-03** already in).

## What this story turned out to be

Its own entry predicted most of it: the server half was already satisfied, because dekking is **computed on
every read and never stored** (Art. V.1), so "reflected without a manual save" needs no wiring and no
invalidation step behind the API. What the entry left open was the two things that were genuinely missing:

1. **Nobody had ever proven the sequence.** Every dekking test seeded placements straight through the
   `DbContext` and read the figure. That proves the read path; it cannot prove a criterion about an *edit*
   followed by a *read*, which is what FR-6.5/FR-7 actually promise a teacher.
2. **The client is allowed to remember, and it did.** The dekkingsoverzicht (E5-02, merged the same day) is a
   different route, so while a teacher edits the kalender its query has **no observer**. The five placement
   mutations wrote the jaarplan into the cache and left the dekking answer sitting there. Navigation between
   the two screens is client-side, so that answer is what `/dekking` paints on arrival: a coverage figure
   computed *before* the edit, with no loading state to say so, and — if the refetch then fails — a stale
   number left on screen beside the error.

So the work is one test file, one four-line client change, and the sentence that says why the client change is
a removal rather than an invalidation.

## The two commits

### `c8aacff` — prove an edit reaches the figure, end to end on real PostgreSQL

`backend/tests/Jaarplanner.IntegrationTests/Postgres/DekkingNaBewerkingTests.cs`: five sequences, each **one
HTTP write through the endpoint the kalender drives, then one `GET …/dekking`, with nothing in between**. The
absence of an intermediate call is the assertion, expressed by construction.

| Sequence | Figure |
| --- | --- |
| hand-place a thema (`POST …/plaatsingen`, E4-03) | 0 → 1, and the covered goal names *Herfstthema* as its evidence |
| accept a proposal (`PUT …/status`) | 0 → 1 |
| move a proposal (`PUT …/blok`) | 0 → 1, because the move sets the placement to `manueel` and `manueel` counts |
| remove a placement (`DELETE`) | 1 → 0 |
| re-place a **stale** placement (`PUT …/blok`) | no figure at all → 1, and `isBetrouwbaar` false → true |

Two of those were worth more than the criterion asked for. The **move** case pins the interaction the story
entry only described in prose: dragging a standing proposal raises the coverage figure as a side effect,
without any decision being recorded. The **stale** case pins the half E5-01 explicitly left unverified: it
proved the figure is *withheld* while a placement is stale, never that resolving one releases it again.

Against real PostgreSQL deliberately: dekking is a query over four `DoelKoppeling` layers, and a **database path**
verified only on the in-memory provider is not verified. That class is **E7-16**, cited without repeating its count,
because a figure copied into a story goes stale silently and this one already had (round-1 audit found "six" where the
epic said seven). E7-16 also records that *"write path"* was too narrow: a read path is exactly as unverified.

**Mutation-checked rather than trusted for passing first time:**

- dropping `Status = KoppelingStatus.Manueel` from `Themaplaatsing.VerplaatsNaar` → **exactly** the move test
  fails (1 failed, 4 passed);
- letting `Voorgesteld` count in `DekkingService.TeltVoorDekking` → **exactly** the two tests whose premise is
  a figure of 0 before the edit fail (2 failed, 3 passed).

### `7074328` — a plan edit drops this class's cached dekking figure

`vergeetDekking(queryClient, klasId)` in `useJaarplan.ts`, called from the shared `usePlanMutatie` hook (all
five placement edits) and from the generation mutation. It calls `removeQueries`, not `invalidateQueries`, and
the difference is the whole point:

- **invalidate** marks the inactive query stale and leaves the answer in the cache. TanStack paints it on the
  next mount and refetches behind it, so the pre-edit figure is on screen for the length of one request.
- **remove** leaves the page nothing to paint, so it shows its own "laden" line and then the fresh figure.

It is also the trade-off `DekkingPagina` already made for itself: it renders `isPending` on a scope switch
rather than keeping figures computed over another denominator. A total computed over another *plan* is the
same mistake with the same cost, and this screen is the one a directie may put in front of an inspectie
(Art. V.2).

The key is exported from the feature that owns it (`dekkingKlasKey` in `features/dekking/useDekking.ts`) and
imported by the feature that drops it, following the precedent of `themas/useThemas.ts` reaching for
`matching`'s key, so the string `"dekking"` still exists in exactly one place.

Three frontend tests, also mutation-checked: disabling the call fails **exactly** the two that assert the drop
(2 failed of 439), while the third — a **refused** move, where the server persisted nothing and the figure must
therefore survive — passes either way. That third test is the one that pins the rule as *the cache follows the
plan, not the gesture*.

## Browser pass (real API, real PostgreSQL, own throwaway database)

API on 5511, Vite on 5512, database `jp_e401` (migrated, demo seed, dropped afterwards). The demo class is
L3 with 14 L3 leerplandoelen in scope and seven `Voorgesteld` placements, each thema carrying two themadoelen.

Navigation between the two screens was done **client-side through the nav**, never by reloading, because a
reload resets the query cache and would have made the whole check vacuous.

| Action | Figure before | Figure after | Pre-edit figure shown? |
| --- | --- | --- | --- |
| accept *Ik en mijn klas* | 0 van 14 | **2 van 14** | no, the loading line |
| move *Herfst en oogst* to Themaperiode 4 | 2 van 14 | **4 van 14** | no, the loading line |
| remove *Herfst en oogst* from its period | 4 van 14 | **2 van 14** | no, the loading line |

To make the first moment after arrival observable at all, `window.fetch` was patched in the page to delay the
`/dekking` request by three seconds. Without that the read completes faster than a screen can be inspected,
which is exactly why this defect would never have been noticed by looking. The covered rows name their
evidence (*Gedekt door Ik en mijn klas* / *Herfst en oogst*), so the figure is not a count that moved for some
other reason.

Screenshot: [`dekking-na-aanvaarden.png`](dekking-na-aanvaarden.png) (2 of 14, straight after the acceptance).

**Stated honestly:** the *counterfactual* — that a stale figure would appear without this change — is evidenced
at unit level by the mutation check, not in the browser. Reproducing it in the running app would have meant
editing the hook while the page was live, and an HMR reload resets the cache the defect lives in.

> **Superseded by the test-runner, and left standing as the record of a wrong call.** It reproduced the
> counterfactual in the browser by disabling the hook and **restarting the dev server** before running the flow,
> which is the step I had not thought of: no HMR, so no cache reset. Its screenshots are in this folder. So this
> paragraph was not a limit of the method, only of mine, and the correct reading is the one it measured: the stale
> figure is a **one-request window** that self-corrects, *except* when the read fails, where the error alert ends
> up directly above a figure that is wrong. Also worth recording: the three rows of the table above were observed
> and not captured, which the antagonist flagged as a table presenting unartefacted measurements. The
> test-runner's six screenshots cover the **counterfactual pair** — a stale figure with the fix disabled, and an error
> alert with no stale figure beside it once it is on. They do **not** show the loading line, and neither does mine: the
> evidence for that is the accessibility snapshot in its report (`status: "De dekking wordt berekend."` with no figure
> element), which was not committed as a file. Said plainly because the first version of this sentence claimed the
> screenshots covered "both states of the load-bearing column", and the column is the loading line.

## What this story does **not** claim

- **No minimumdoel level** (E5-04, blocked on E1-12): every figure above is leerplandoel-level.
- **No change to the dekkingsoverzicht itself.** E5-02 owns that screen, and it is still `[~]` pending an
  audit of its kleuterjaar chooser. ~~This story changed behaviour, not layout, so no contrast or 390px
  measurement was taken or is claimed.~~ **False after fix round 1**, which added copy on the kalender: both new
  sentences were measured at 1440px and 390px (see *Copy, looked at rather than asserted*). No change to
  `/dekking`'s own layout either way.
- **No new control anywhere.** "Reflected in the dekkingsoverzicht" is satisfied by the nav item E0-10
  shipped; inventing a second route to the same screen would be scope this story does not own.
- ~~**Not the link path.**~~ It was going to be listed here as out of scope, on the reading that E4-01's criterion
  names plan edits. **The owner ruled otherwise on 2026-08-04: fix it in this story**, so it is in the fix round
  below rather than in this list. What stays out is a *screen* for it: nothing was added to `/themas`, only the
  cache rule its own comment had already promised.

## Fix round 1 (`618f129`, plus the copy commit) — what the two gates changed

Both gates ran on `a938b1b`. **antagonist: VIOLATIONS FOUND** (1 MAJOR, 6 MINOR, 1 QUESTION —
[`antagonist.md`](antagonist.md)); **test-runner: PASS** on every criterion, with findings
([`test-report.md`](test-report.md)). They converged on the same MAJOR from opposite directions, which is the
strongest signal either produced: one read the copy, the other drove the screen.

**The MAJOR was a comment of mine, and it is the sharpest kind.** `DekkingNaBewerkingTests` said the drag
consequence is disclosed *"before the drag"*. It is not: `kalender.verplaatsGevolg` names the status change and
the lost AI motivation, says nothing about dekking, and renders only inside the opened *Aanpassen* panel, so a
teacher who drags never reads it. So a **standing obligation recorded in this story's own entry** was described
by my comment as discharged. **Owner ruling (2026-08-04): write the copy, in this story.** Two existing keys, no
new key, no component change:

- `kalender.beslisUitleg` gains the drag route, once above the board, where the dekking rule already lives;
- `kalender.verplaatsGevolg` gains it at the point of action, beside the irreversibility it already disclosed.

Two wordings are deliberate and a guard in `catalogus.test.ts` pins both. The board sentence says **AI-voorstel**
rather than *thema*, because a `geweigerd` placement cannot be dragged at all, so a general promise would be
false in exactly that state. The panel says *"Een eigen keuze telt mee voor de dekking"* rather than *"het telt
daardoor mee"*, because an **already accepted** placement counted before the move: naming the move as the cause
would be the same false attribution E4-06 needed three audit rounds to get out of the lock copy.

**The link path, fixed here on the owner's ruling rather than filed.** A themadoel and an accepted or adjusted
doelsuggestie are counted `DoelKoppeling`s, so `/themas` moves the same figure the kalender does and nothing
there touched the dekking cache. The test-runner reproduced it in a browser (link `DEMO-L3-02`, walk back through
the nav, the overview paints the pre-link figure with that doel still *Niet gedekt*) and corrected the fix I
would otherwise have written: a link hangs on a **school-wide** thema, so `dekkingKlasKey(klasId)` is too narrow
and the honest drop is the whole `["dekking"]` subtree. `useVerwijderThema` deliberately does **not** drop, and
that is a claim about the server: the delete is refused while the thema sits in any jaarplan, and a thema in no
jaarplan covers nothing.

`useThemas.ts` had predicted this and named its own successor: *"no dekking query exists in the frontend yet …
whoever adds it should add its key here"*. E5-02 shipped the query and this story exported the key **on the same
day**, so the sentence became false while the obligation stayed unmet. The note now records that, because a note
that names its successor only works if the successor reads it.

**Two of my own claims were weaker than stated, and both are now stronger:**

- the mutation check for the client half covered **one of two call sites**. Deleting the call in
  `useGenereerJaarplan` left all 439 tests green. Pinned by a fourth test.
- the three original tests asserted `getQueryData(...) === undefined`, which is a mechanism rather than the
  promise. A new test edits on the kalender, unmounts it, mounts `DekkingPagina` on the **same** client and
  asserts the overview shows its own loading line and never the pre-edit total. **It fails under
  `invalidateQueries`**, so the docstring's central argument is now a test.

Smaller ones: a *"bitten six times"* count in a comment was stale (E7-16 says seven) and is now a citation
without a figure; the JSDoc block my export displaced is back on the symbol it describes.

### What the test-runner added rather than accepted

- **It reproduced the counterfactual in the browser**, which this worklog had said was not done, and characterised
  it better than I had: with the hook disabled the overview paints the pre-edit figure and self-corrects one
  request later, so the defect is a **one-request window**. Except when the read fails: then the error alert sits
  directly above a stale figure. Screenshots of both are in this folder.
- **A real cost of `removeQueries`, measured:** a lock toggle cannot change coverage and still forces a loading
  line for an unchanged figure (`8 van 14` → loading → `8 van 14`). Kept anyway, and the reason is stated in the
  hook: the alternative is a per-edit rule nobody can state, and the lock shares the one hook the other four
  edits share. A rejection is **not** in this category, whatever it looks like: rejecting a stale placement
  resolves it and releases a withheld figure.
- **The "a refused edit keeps the figure" rule holds for refusals only.** A 404 from a concurrent delete, or a
  write that commits but loses its response, keeps a figure that really is stale. Pre-existing multi-user gap: the
  jaarplan cache is equally stale in that case, so it is not this story's to close.

### Copy, looked at rather than asserted

Both sentences read in a real browser against a real API and PostgreSQL, at 1440px and at exactly 390px
([`copy-1440.png`](copy-1440.png), [`copy-390.png`](copy-390.png)). At 390px the board paragraph is **4 lines**
and the panel paragraph **5**, both inside the viewport, both `text-ink-zacht` at 12px, i.e. the token and size
their siblings already use. Measured rather than waved through, because *"explanatory prose is the first thing to
cut"* and this ruling adds a sentence: the board explanation is now three sentences on a phone. The overflow probe
compares each element's right edge with the viewport rather than reading `documentElement.scrollWidth`; the
elements it reports past 390px are the nav and the period ribbon, which are horizontal scrollers by design and
which text inside a `<p>` cannot widen.

## Fix round 2 — the copy was in the wrong string, and the importers were never in the rule

**antagonist ronde 2: VIOLATIONS FOUND (2 MAJOR, 9 MINOR, 1 QUESTION)**, full report in
[`antagonist-ronde-2.md`](antagonist-ronde-2.md). It confirmed the mechanism a second time (it read TanStack's own
`queryCache`/`query` source to check that a removal cancels an in-flight fetch rather than letting it write back) and
then took the copy apart.

**MAJOR 1 — the clause was in the tier-independent sentence.** `kalender.beslisUitleg` renders on **every** tier,
because deciding works on every tier. Moving does not: at `Subthemaperiode` the card has no grip and the panel no
picker, and at an unrecognised tier nothing can be moved at all. So fix round 1's sentence instructed a gesture that
the same screen was simultaneously reporting as unavailable, in one state one paragraph apart. **The comment three
lines above the render site had said exactly that** — *"'of zelf verplaatsen' is only true on the tier where moving
works"* — and the fix walked past it. The clause now lives in `kalender.sleepUitleg`, i.e. the `kan` entry of
`BORDUITLEG`, the mechanism this file already had for the hazard. *The lesson is now in the file:* a sentence about an
affordance belongs in the record keyed on that affordance's state, not beside the topic it shares.

Two of ronde 2's open questions dissolved with the move rather than being answered: there is no third paragraph above
the board any more (the clause joined a sentence that was already there), and the wording is *themaperiode*, like every
sibling, instead of the ambiguous *periode*.

**MAJOR 2 — the importers.** `useImporteerSchoolcontent` and `useImporteerOpstap` called `invalidateQueries()`
unfiltered, which is precisely the thing this story argues is not enough. An import is the write that can move the
figure furthest in one action, because it writes **both sides** of it: counted `DoelKoppeling`s and, on the curriculum
side, the denominator. `/import` is a primary nav destination reached client-side like any other. Both now drop the
subtree, with a test.

**Three claims of mine were weaker than written:**

- the behaviour test *did* fail under `invalidateQueries`, but at its **cache** assertion, before `DekkingPagina` was
  ever mounted — so it discriminated nothing the three earlier tests did not, while its docstring said it did. It now
  waits for the persisted status **on the card** and fails on the loading-line assertion instead. Verified by mutation:
  under `invalidateQueries` it reports *"Unable to find an accessible element with the role status"*, i.e. the overview
  painted the cached figure instead of its loading line.
- the copy guard was three verbatim fragments of the string it checked, which is the tautology E4-02 recorded. It now
  keys on the **keys**, asserts the one property a catalogue test can see (the clause is in the tier-paired sentence and
  **not** in the tier-independent one), and states plainly that truth-in-state is pinned elsewhere.
- *"the test-runner's six screenshots cover both states of the load-bearing column"* was false: they cover the
  counterfactual pair, and the loading line's evidence is an accessibility snapshot that was never committed. Corrected
  in place.

**MINOR 7 is fixed with artefacts rather than prose.** Three new screenshots at exactly 390px:
[`r2-bordzin-390.png`](r2-bordzin-390.png) shows the board paragraph carrying the clause **and** the decision paragraph
without it; [`r2-fijn-geen-sleepbelofte-390.png`](r2-fijn-geen-sleepbelofte-390.png) is the finer tier, where the whole
sentence is gone; [`r2-paneelzin-390.png`](r2-paneelzin-390.png) is the opened panel. Measured in the same pass: board
paragraph 5 lines at 335px, panel paragraph 5 lines at 221px, both inside the viewport.

**Two things ronde 2 asked for that were deliberately *not* changed:**

- **`kalender.vergrendelDekking` stays as it is.** Its own comment demanded a re-read by any story that loosened its
  condition, and this story did. Naming the second counting route there was tried and reverted: that paragraph carries
  **no tier condition**, so at the finer tier it would name an action its own panel cannot perform, and pointing at
  another view from inside a card is the two-step inference ronde 2 rejected one screen up. It stays **under-inclusive
  rather than false**, and the reasoning is recorded on the string.
- **No new E7 story for the `DemoDataSeeder` em dash.** Both rounds reported it as unfiled; it has been filed since
  2026-08-04 as **E7-18**, in the file ronde 2 searched. What that says is worth more than the correction: *a filing two
  independent audits cannot find is not discoverable*, because the entry is titled "Demo-fixture Dutch reaches
  teachers" and an auditor greps for the character. E7-18 now names `DemoDataSeeder.cs:239`, the em dash and Art. II.5
  in its own text, plus the fact that this story's screenshots render it on **every row** of the dekkingsoverzicht.

**Mutation-checked, all four:** putting the clause back into `beslisUitleg` fails the catalogue guard **and** the
render test that drives both tiers; disabling the import drop fails exactly the new import test; disabling the two
link-path drops fails exactly the two link tests; swapping remove for invalidate fails the four kalender cases,
including the behaviour one on its own assertion now.

## Gates

- **Backend:** the five new tests pass against real PostgreSQL (`JAARPLANNER_TEST_POSTGRES`, 0 skipped);
  full suite re-run before the story closed.
- **Frontend:** 439 tests / 20 files, 0 skipped. `pnpm lint` clean, and `pnpm build` (`tsc -b`, the type check
  that actually runs — see E7-17) clean.
- **Both independent gates ran once the owner approved them**, on `a938b1b`: **test-runner PASS**
  ([`test-report.md`](test-report.md)), **antagonist VIOLATIONS FOUND** ([`antagonist.md`](antagonist.md)), and
  the fix round above answers all of it. A **second antagonist round is owed** on the fix round, because it
  touches user-facing copy and this repo's record is that copy is where its defects are: three of E4-02's four
  rounds found nothing in the screen and everything in prose.
- **After fix round 2:** 569 unit + 194 integration on real PostgreSQL (0 skipped), **446** frontend / 20 files,
  `dotnet format`, `pnpm lint` and `pnpm build` clean. Every mutation reverted; the copy guard was
  mutation-checked by removing each new clause in turn.
