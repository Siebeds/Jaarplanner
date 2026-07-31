# E3-08 — Antagonist verdict, round 1

> **Persisted by the orchestrator, not by the auditor.** The `antagonist` role is read-only on project
> files and its harness forbids writing report `.md` files, so it returned the verdict and asked the
> orchestrator to put it on disk. The text below is its verdict; the framing sentences are the
> orchestrator's. Recorded because a verdict that lives only in a chat transcript is a verdict the next
> reader cannot check.

**Audited:** `git diff 0de4851..a1a75d9` in the worktree `.claude/worktrees/e3-08-zoom`, 15 files, frontend
only (`git diff --stat -- backend/` empty, verified). Read as context: `CONSTITUTION.md`,
`backlog/E3-jaarplan-kalender.md`, `docs/ux/wireframes/e3-10-kalender.{md,html}`, ADR-0013/0014/0020/0021,
`Generatieparametersformulier.tsx`, `kalenderFormat.ts`, `GeconfigureerdePlanningsblokIndeling.cs`,
`JaarplanGeneratieService.VerplaatsPlaatsingAsync`, `Spreidingsrapport.cs`, `PlanningsblokIndelingTests.cs`,
`catalogus.test.ts`.

**Verdict: VIOLATIONS FOUND** — 3 MAJOR, 6 MINOR, 2 QUESTION.

## Rulings on the three things the implementer raised itself

**1. `useState` instead of Zustand: a deviation needing an ADR amendment, not an article breach — and the
E3-07 precedent it leans on was never ratified.** Art. VIII fixes Zustand as the local-UI-state library but
does not forbid React's own `useState`, and no unauthorised dependency appears. However ADR-0014 §15 names
"view zoom" and ADR-0021 §59 names *E3-08's zoom level* as Zustand's, and CLAUDE.md requires a new
significant decision to be recorded as an ADR. A code comment plus a worklog paragraph is not that artefact.
On the precedent: `git log` puts ADR-0021 at 2026-07-29 and E3-07's build at 2026-07-30, and a grep for
`zustand|ADR-0014|ADR-0021` across `backlog/worklogs/E3-07/` and the E3 epic file returns nothing. **E3-07
contradicted a one-day-old ADR silently, and neither its worklog nor its own antagonist pass examined it.**
The precedent was never ratified; it was never noticed. It is also weaker on the merits than claimed:
`sleepKaart` lives and dies inside one gesture, whereas the zoom is a persistent view mode that ADR-0014
lists beside "selected period".

*Owner ruling, 2026-07-31: accept component state and amend both ADRs, covering E3-07's drag state in the
same note.* Tracked as fix-round item 7.

**2. The implementer's correction of the brief is factually right, and hiding the affordance still stands —
but for its second reason, not its first.** `GeconfigureerdePlanningsblokIndeling.Blokken` derives the fine
tier by `VerdeelGelijkmatig(themaperiode.Start, …)`, so each parent's first sub-block starts on the parent's
own start date, and `VerplaatsPlaatsingAsync` (`JaarplanGeneratieService.cs:497-505`) requires only
`b.Start == doelBlokStart && b.Niveau == plaatsing.BlokNiveau`. So **7 of the 19 fine columns are accepted
targets, not zero.** Removing grip and picker therefore hides a working action. Sustained on the semantic
argument instead: a drop on sub-block 1 moves the thema into the whole themaperiode while the teacher aimed
at a fortnight, so the affordance would be honest about the request and dishonest about the effect. That
reasoning lived only in a doc comment giving the weaker argument.

**3. The fine tier does not misrepresent the data, but it makes a false statement per column.** See
QUESTION-9.

## Findings

### [MAJOR-1] The zoom hides a stranded kept startthema and relabels it as a valid one, while the run still sends it
Art. IV.1/IV.2; the directie ruling of 2026-07-28 as recorded under E3-09 and in `types.ts:232-236`; FR-5.4;
E3-08's own obligation 1. In `Generatieparametersformulier.tsx:253-259, :273-275, :285-286, :312-317`,
reached because `Jaarplankalender.tsx` hands the form `niveau={grid.niveau}`.

At the fine tier `isGeneratieNiveau` is false, so `vervallen = []`. Two consequences follow and the second is
the serious one: (a) the non-dismissible stranded region unmounts, which obligation 1 blessed; (b)
`vervallenStarts` is empty, so `aantalStartthemas` stops excluding the stranded entry and **counts it as a
valid startthema**. The summary reads `(1 zonder periode)` at the coarse tier and `(1 startthema)` at the
fine tier for byte-identical state and a byte-identical POST body, with generation still enabled. A teacher
whose kept startthema was orphaned by a vakantie edit zooms in, is told one startthema is set, generates, and
learns only from the post-run `vervallenStartthemas` report that nothing was placed. **The obligation blessed
the absence of rows; it did not bless a positive false claim.** No test covers it: test 7's
`queryByRole("region", …)` assertion is vacuous, because that fixture has no stranded setting.

### [MAJOR-2] The "te vol" ruling names five places the retired definition lives; there are at least nine, and it did not name the tier problem this story creates
FR-6.4; Art. XI.1; the ruling's own item 5. The five named places all check out and the ruling is faithful to
the constitution: arithmetic on school data, no threshold and no calendar unit compiled in, rule kept
server-side, and `Thema.DuurWeken` is indeed `RequirePositive`. But *"each one is a place the old definition
is written down"* is a completeness claim and it was wrong by four: `types.ts` (the `Spreidingsrapport`
interface doc), `Spreidingsoverzicht.tsx:11`, `Periodekolom.tsx:62-64`, and
`docs/ux/wireframes/e3-10-kalender.html` — the last being **the approved artifact reviewers actually open**,
which still asked question C while its `.md` companion declared C answered, an inconsistency this commit
introduced by updating only the `.md`. E3-06's record also still lists *"no zoom toggle (E3-08)"* under
"deliberately absent, so the review is not misled".

Worse, the ruling omitted the consequence E3-08 makes unavoidable: at the fine tier `beschikbareWeken ≈ 2`
while `benodigdeWeken` is a 4–6 week thema's own duration, so the new definition would flag **every filled
sub-column**. E3-09 would have implemented the five listed items and produced a board that screams.

*Resolved by the orchestrator and the owner on 2026-07-31:* the list is now nine with the miss left visible,
the wireframe question is synced (the mock deliberately left as the approved drawing), and two further owner
rulings were added — te vol exists at the themaperiode tier only with a single summary line at the fine tier,
and the comparison is made in whole weeks with the available side rounded up.

### [MAJOR-3] A failed fine-tier `/rooster` fetch destroys the whole screen with no way back
No named article; the basis is this repo's own ratified precedent in `Generatieparametersformulier.tsx:359-372`
from E3-04 fix round 4, plus CLAUDE.md's "never leave a dead end". `Jaarplankalender.tsx:150-152` returns a
single `Melding` on `rooster.isError`, while `Weergaveschakelaar` renders only inside the success branch.
`placeholderData` in TanStack Query v5 is gated on `status === 'pending'`, so when the newly-keyed fine-tier
query errors the placeholder is dropped and the early return replaces spine, board, plan, generation card and
the zoom control itself with one sentence. The teacher pressed a button and their year plan vanished, with no
control of any kind and no retry; only a reload recovers. Before this story a rooster error was reachable only
on first load, where nothing was lost.

*Verification level, stated honestly by the auditor:* derived from the library's placeholder gate and the
code's own ordering, **not observed in a browser** — the worklog's browser pass never exercised a failing
`/rooster`.

### [MINOR-4] `kalender.conceptUitleg` promises moving on a tier that offers no move
CLAUDE.md's E3-06 rule, inverted; Art. X.5. The banner enumerates *"thema's naar een andere periode
verplaatsen"* at both tiers, while `fijnUitleg` a few centimetres lower says moving happens in the other view.

### [MINOR-5] `parameters.anderNiveau`'s second sentence is false in exactly the case the story's own test exercises
Art. II.3; FR-5.4. *"Wat je eerder bewaarde, blijft ongewijzigd en gaat gewoon mee."* True when nothing was
touched; false after an unsent edit at the coarse tier, which is the flow test 7 drives — what travels is the
edit, and a run replaces the stored set wholesale (Art. IX.3). The control-naming half of obligation 2 is
correct; this clause is not.

### [MINOR-6] Two ordinal spaces survive on one screen, on the unrecoverable action
The E3-01/E3-07 unrecoverable-delete clause; the implementer's own "one grid, one truth". `Themakaart.tsx:343-351`
interpolates `plaatsing.blokOrdinaal`, computed against the coarse grid, so at the fine tier a card in
`Subthemaperiode 9` asks *"'Water' uit periode 3 halen? Dat kan je niet ongedaan maken."* Two numbers for one
object, in the confirmation guarding a delete with no soft-delete and no audit trail. `uitPeriodeHalen` has
the same ambiguity. Mitigated by the column's `Hoort bij themaperiode 3` line, hence MINOR.

### [MINOR-7] Three names for one object
Art. II.4; Art. X.5. `kalender.periode` ("Periode {ordinaal}") vs `weergaveGrof` ("Themaperiodes") vs
`binnenThemaperiode` ("Hoort bij themaperiode {ordinaal}") vs `parameters.periodeLabel` ("Periode
{ordinaal}"). A teacher presses **Themaperiodes** and gets columns headed *Periode 1*; `anderNiveau` sends
them to "Themaperiodes" to find rows labelled "Periode 1".

### [MINOR-8] The ADR deviation is recorded everywhere except in an ADR
See ruling 1. Fix is an amendment on ADR-0014 §15 and ADR-0021 §59 covering E3-07's drag state too.

### [MINOR-9] `backlog/README.md` was not updated
CLAUDE.md requires the checkbox **and** the progress table. The E3 row omits E3-08 entirely and still ends
"next is **E4**". (Orchestrator's to fix at landing.)

### [QUESTION-9] "Nog niets gepland" is false in a sibling sub-column, and E3-10's question B is now load-bearing
Art. XIV / E3-10 question B; ADR-0020 §3. The fine tier does not misrepresent the data — intra-period extent
is genuinely unmodelled, so drawing a span would invent it and rendering once at `blokStart` is right — but a
5-week themaperiode holding one thema shows *"Nog niets gepland"* in two of three sub-columns while the class
is teaching that thema then. Acceptable to ship for review, not acceptable to leave once question B is
answered, and the fine view is the right place to put the question to a teacher.

### [QUESTION-10] Seven working move destinations are hidden, and only a code comment says why
Sustained (ruling 2), but the teacher-facing sentence asserts that moving happens in the other view, which is
true of the shipped app and false of the API. If the fine tier ever grows a picker it must offer only the
parents' first sub-blocks *labelled as themaperiodes*, or it repeats the "moved into a fortnight" lie.

## Checks the auditor ran, and passed

- **Art. II.3** — no Dutch literal in any `.tsx` in the diff; `Weergaveschakelaar` routes all 3 strings
  through `t()`. `Planningsrooster.blokindeling` — the E3-06 revert trap — is **not rendered anywhere**
  (`grep -rn blokindeling frontend/src` hits only `types.ts` and three fixtures). `grid.niveau` is compared,
  never printed.
- **Art. II.5** — every leaf of `nl.json` parsed for U+2014: **zero**. The pre-existing em dash in the
  archived wireframe is noted, not introduced.
- **Art. XII / WCAG 2.2 AA** — method sound: composited alpha, both states, both widths, and the right thing
  measured (`border-input`, because the track's own fill is 1.06:1). Three carriers: `aria-pressed`,
  `font-medium`→`font-semibold`, and fill-vs-transparent with inverted text; the fill/shape difference
  survives greyscale. No new hue; every token exists in `tailwind.config.js`, so no silently-empty utility.
- **Art. IX.3 / ADR-0013 / Art. XIV** — no calendar unit anywhere; `Planningsblokniveau` has no `Maand`; the
  ratified 4–6 wk / ~2 wk lengths are absent from the labels. Art. XIV not pre-empted.
- **Art. IV / ADR-0020 §3** — no mutation on zoom; placement rendered exactly once. No false staleness, and
  **not** by the coincidence the implementer called it: every themaperiode start being a subthemaperiode start
  is a pinned server invariant (`PlanningsblokIndelingTests.Elke_subthemaperiode_ligt_in_precies_een_themaperiode`
  asserts `themaperiode.Start == kinderen[0].Start`). `isVervallen` comes from the jaarplan GET at the
  generation tier, so it cannot flip with the view. `TeHerzien` gains no dismiss control at either tier.
- **The move rule** — read from `JaarplanGeneratieService.cs:482-538` rather than from the worklog;
  `kanVerplaatsen` derives from the server's answer, so an unrecognised tier disables moving. Correct.
- **Gates re-run rather than trusted** — `corepack pnpm test` 196 passed / 12 files, 0 failed, 0 skipped;
  `corepack pnpm lint` exit 0. Backend untouched, so the `dotnet` gates are correctly skipped.
- **Art. III / V / VI / VII / VIII** — no curriculum mutation, no Excel-mapping change, dekking still never
  computed client-side, no pupil data, no secret, no AI key path, no new dependency, layering untouched.

---

# E3-08 — Antagonist verdict, round 2 (`a1a75d9..364c3b5`)

> Persisted by the orchestrator for the same reason as round 1: the auditor's `Write` is disabled.

**Verdict: VIOLATIONS FOUND** — 2 MAJOR, 4 MINOR, 1 QUESTION. **Both MAJORs are new, introduced by the fix
round itself.** Nine of the eleven round-1 items are genuinely fixed, several better than the audit asked.

Scope: `git diff a1a75d9..364c3b5`, widened to `0de4851..364c3b5` where a finding needed the whole story.
Backend diff empty, verified. Gates re-run by the auditor: `vitest run` 12 files / **200 tests** / 0 failed,
`lint` exit 0 — both matching the implementer's claims exactly.

## [MAJOR-A] A failed generation-tier grid re-creates MAJOR-1: a stranded startthema is promoted to a valid one, silently, with generation enabled

Art. IV.1 + Art. IX.3, FR-5.4, and the E3-04 precedent *"a run whose parameters the screen cannot state is a
run nobody can consent to"*. At `Jaarplankalender.tsx:445-446` the form is handed
`generatieRooster.data?.blokken ?? []` and `…?.niveau ?? ""`, and **no reader of `generatieRooster.isError`
exists in the file**. When the generation-tier query has failed and the displayed one has not,
`isGeneratieNiveau` goes false → `vervallen = []` → `aantalStartthemas` counts the stranded entry, so the
collapsed trigger reads `(1 startthema)` for a preference the server will report as `vervallenStartthemas`.
`instellingenOnbekend` watches only the settings query and `roosterOnbekend` only the display query, so
generation stays enabled and **nothing on screen says a grid is missing**.

**The trigger is the path the new copy recommends.** `kalender.roosterFout` ends *"Probeer het opnieuw, of kies
hierboven de andere weergave."* First load of `?niveau=Themaperiode` fails → full-page error → the teacher
follows that instruction → the fine fetch succeeds → confident summary, enabled button, coarse grid still
errored (TanStack does not retry a settled error query while it stays mounted). Then `parameters.anderNiveau`
sends them back to *Themaperiodes* to inspect the settings, where the full-page error returns: a loop between
a view that lies and a view that refuses.

Also false as documentation: the comment at `Generatieparametersformulier.tsx:162-163` asserts the mismatch is
"now false only when the *server* answered another tier", which does not hold in this state. Not covered by
tests: the new tests fail either only `Subthemaperiode` or *all* rooster requests; the asymmetric case this fix
created is a one-line variant of the new `faalRooster` predicate and is unwritten.

## [MAJOR-B] An errored background refetch shows the fallback notice while the chosen tier is on screen, so the alert states the wrong tier

Art. II.3, and the fix round's own rule of one statement per state. `roosterOnbekend` fires on
`rooster.isError` without checking whether data survived, and `terugval` is passed as a hard-coded `true`.
Verified in the installed `@tanstack/query-core@5.101.2` (`build/modern/query.js:375-389`): the error action
sets `status: "error"` while **leaving `data` in place** — its own comment reads *"flag existing data as
invalidated if we get a background error"*. The app uses `new QueryClient()` with no overrides, so
`staleTime: 0` and `refetchOnWindowFocus: true`. Teacher at the fine tier alt-tabs away and back, the refetch
500s once: the board keeps drawing subthemaperiodes while a red `role="alert"` announces *"De weergave die je
koos, kon niet geladen worden. Je ziet nog de themaperiodes…"*. Both clauses are false. It is a **regression in
honesty** relative to `a1a75d9`, which merely blanked the screen. Fix: derive `terugval` from
`rooster.data === undefined`, and give a failed refresh that changed nothing its own quieter, true sentence.

## [MINOR-C] "Deel van een ingeplande themaperiode" calls an unreviewed AI suggestion *ingepland*

Art. IV.1/IV.2. `geplandeIn` excludes only `Geweigerd`, so a themaperiode whose single thema is a
`Voorgesteld` proposal marks its sibling sub-columns as part of an *ingeplande* themaperiode — and those
columns hold no card, so no status chip qualifies it. Consistent with `isTeVol`/`gevuldeOrdinalen`, but those
are marks; this is the first **sentence** in the product asserting a settled plan where Art. IV says nothing is
final. Copy fix, not a data fix.
*Checked and clean:* the `Geweigerd`-only parent correctly keeps "Nog niets gepland", and a null
`ouderOrdinaal` degrades to the old sentence.

## [MINOR-D] The rounding ruling left one thing to guess

Whether `BeschikbareWeken` itself rounds or only the comparison; and the ruling did not say out loud that it
changes the **existing** generation-side `IsOverbelast` verdicts a teacher already reads.
*Answered by the orchestrator on the story, 2026-07-31:* the field itself becomes `ceil(TelOpenDagen / 7)`, and
the consequence for `Spreidingsoverzicht` is now stated.

## [MINOR-E] E3-08 ships a per-column te-vol mark at the fine tier, against the ruling committed in the same change

The ruling says te vol exists at the themaperiode tier only, expressed at the fine tier as one line above the
board rather than "a mark inherited by up to nineteen columns". But at the fine tier every placement lands in
its parent's first sub-block, so that column renders `▲ Te vol: 3 thema's` with the attentie border while its
siblings say they are part of an ingeplande themaperiode — the exact misreading the ruling forbids. No code is
required if the deferral is deliberate, but E3-08's open list must name it so E3-09 inherits an obligation
rather than a surprise.

## [MINOR-F] In the unrecognised-tier degrade, two strings tell the teacher to switch to the view they are on

`bordNiveau` maps any unrecognised `grid.niveau` to `"Themaperiode"` while `kanVerplaatsen` requires strict
equality, so `fijnUitleg` and the parameter panel both instruct *"…de weergave Themaperiodes"* while that is
the current view. The guess is gone; the instruction is impossible to follow. Needs its own sentence.

## [QUESTION-G] The zoom costs a second `/rooster` request on every window focus, and the comment says otherwise

`Jaarplankalender.tsx:99-101` claims "not a second network round trip in the normal case" — true at mount
(shared key at the coarse tier), false thereafter at the fine tier, where `staleTime: 0` +
`refetchOnWindowFocus` refetches both keys and each `/rooster` re-derives the grid server-side. Small at one
school; a decision rather than a reassuring comment.

## What round 2 confirmed as genuinely fixed

MAJOR-1's original half (the tier separation is real: `isGeneratieNiveau` governs claims, `toontGeneratieNiveau`
governs presentation; the new stranded fixture would fail on reversion); MAJOR-3's tested case (fallback grid,
surviving control, working retry, `alert` with the button as a **sibling**, no *"herlaad de pagina"*, and the
one-tier-shown-while-another-claimed case stated in visible text); MINOR-4 through MINOR-8, with the ADR
amendment judged **compliant** (appended section on ADR-0014, struck-through bullet on ADR-0021, E3-07's
unratified drag state named explicitly, the reload/shareability loss recorded, `?niveau=` named as follow-up);
QUESTION-9's Geweigerd case; QUESTION-10's four comments now leading with the semantic argument. The
`teVol`/`teVolUitleg`/`wordtTeVol` narrowing is a **recorded** carve-out, not a silent one. `Themakaart`'s
`Bewerkpaneel` DOM shape is unchanged, so E4-06's lock control still has room. `backlog/README.md` is confirmed
still stale and still blocks landing.
