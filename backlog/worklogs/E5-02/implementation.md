# E5-02 — Per-class dekkingsoverzicht (FR-9.1)

**Branch:** `story/E5-02-dekkingsoverzicht` off `origin/main` `1dfe9b8` · **Commits:** `6032e59` (denominator), `e7c20d3` (screen), `e9dc200` (browser-pass fix), `60fa4a3` (records), `d1eeb3e` (the inherited `herzienUitleg` fix), plus the antagonist fix round

Kept short on the owner's ruling of 2026-08-04 that documentation length is itself a risk: on E4-02 every late-round MAJOR sat in prose a previous fix round had written, not in the product.

## What this story was

E5-01 computed dekking, Postgres-tested it, shipped it behind an endpoint and said plainly that this was **not** FR-9, because no teacher could see it. This is that half. `/dekking` stops being a placeholder and becomes the second anchor screen.

## Two owner rulings, obtained before building

1. **E5-09's wireframes-first gate is postponed**, the same way E3-06's teacher review was. E5-09 stays open.
2. **A class is measured against its own jaar/fase by default**, with the whole curriculum as a switch. This is the Art. XIV question *"waartegen wordt een klas gemeten?"* answered **for the single-leerjaar case**; the graadklas half stays open because `Klas.Leerjaar` is one ordinal.

## The denominator (`6032e59`)

E5-01 had already built and Postgres-tested `HaalLeerplandoelenAsync(jaarFasen)` for exactly this, so resolving the ruling was a value at one call site. What had to be added is the honesty around it: the payload states the scope applied, the codes used, whether it had to widen, and how many loaded doelen it left out. A narrower denominator flatters coverage, which is the one direction this figure must never move by itself.

**The fallback direction is the load-bearing part.** `Jaarfasen.VoorLeerjaar` returns `null`, not an empty list, when it cannot map a leerjaar. An empty jaar/fase set means *"the whole curriculum"* one layer down and *"no goals at all"* to a reader, and the second would report a class as having nothing left to cover. So a refusal **widens** the scope and is declared in the payload.

E5-01 left a test whose comment said it should fail and be rewritten when the ruling landed. It did, and it was.

## The screen (`e7c20d3`)

**The summary slot is the design, and it is not a percentage.** It holds one of three things at the same weight: a count, *"nog geen betrouwbaar cijfer"* with what to do instead, or *"nog niets om tegen te meten"* when the scope is empty. That third state is the one a screen could most easily render as success, since 0 of 0 satisfies `gedekt === totaal` and would fill a progress bar.

**It discharges the reconciliation E5-01 assigned here, in copy rather than code.** The kalender's notice counts every stale placement including rejected ones; this figure counts only unresolved ones. Unexplained, a teacher reading two numbers for one apparent thing concludes the tool is broken.

**Covered is the loud state and the gap is quiet**, which is the opposite of the obvious choice: in September a freshly planned class is legitimately uncovered nearly everywhere, so a solid red chip per row would paint the normal state as an emergency and, covering the screen, stop signalling anything.

**Deliberately absent, and stated on screen rather than only in a comment:** no percentage or doelsoort filter (E5-03), no gap-analyse traceable to where a doel belongs (E5-05), no export (E5-06), and no **minimumdoel level** (E5-04, blocked on E1-12), which is the level the onderwijsinspectie actually tests.

## What looking found (`e9dc200`)

The summary said *"Zolang dat zo is, geeft dit overzicht geen cijfer"* and two lines below it every group printed **"2 van 14 gedekt"**. Group counts are additive, so a teacher could add them up and reconstruct exactly the total the directie ruling of 2026-07-28 forbids, in its misleading form: a stale placement's doelen count as niet gedekt there while what is unknown is which period they sit in. No test noticed. **The rule was enforced where someone looked and left standing where nobody did**, which is the class E4-06 named.

The row chips stay, and **the reason first given for that was self-contradicting** (caught by the antagonist): it called them *"a per-doel fact that is true either way"* one sentence after saying a stale placement's doelen read as niet gedekt when what is unknown is their period. The chips are just as additive as the tally, so the withheld total is still reconstructible by counting them. The honest reason is narrower: the ruling as recorded speaks of *the figure*, and removing the per-doel verdicts would leave the screen blank in the one state where a teacher most needs to see which thema's are affected. **That is a judgement call, and whether the affected rows must be marked provisional is now an owner question.**

**A correction to my own evidence, in the same commit.** A grep over Chrome's `--dump-dom` output was briefly my proof that the tally was gone. `--dump-dom` serialises only the top-level document, so a grep for iframe content **could not have failed**. Re-verified by reading the facts from inside the frame.

## Verification

Browser pass with headless Chrome from Bash against a live API (port 5499), Vite (5500) and a real PostgreSQL (`jp_e502`), the app loaded in a same-origin iframe at an exact width because a headless window clamps `--window-size` to ~504px. Four states, each read from inside the frame:

| state | figure | group tally | scope |
| --- | --- | --- | --- |
| healthy, own scope | 4 van 16 doelen gedekt | present | `L3`, 1 doel left out |
| after switching | 4 van 17 doelen gedekt | present | whole curriculum, URL + request both `bereik=HeelCurriculum` |
| stale placement | **none** | **none** | `L3` |
| leerjaar 7 (graadklas) | 0 van 17 doelen gedekt | present | fallback notice shown while "Deze klas" is pressed |

Accepting a placement through the real E4-02 endpoint took dekking **0 → 4 of 16**, with the covering thema named.

Contrast, alpha composited: lowest text pair **5,08:1** (white on `dekking-gedekt`), niet-gedekt chip boundary **6,48:1**, switch track **3,40:1** (SC 1.4.11), body prose 5,73–6,08:1, the figure 15,42:1. No horizontal overflow at 1440px or at exactly 390px.

**Gates on the merged tree after both fix rounds:** **555** unit + **185** integration (0 skipped, real PostgreSQL) + **416** frontend / **20** files; `dotnet format --verify-no-changes` clean; `pnpm lint` and `pnpm build` clean.

**Eight load-bearing claims mutation-checked**, each restored and re-verified green: defaulting the controller to `HeelCurriculum` fails 5 endpoint tests; zeroing `AantalBuitenBereik` fails 2 unit tests; printing the withheld figure fails 5; dropping `?bereik=` from the request fails 19; a space-joined group key fails 1; removing the empty-scope state fails 5; fetching without a class fails 1; restoring the tally unconditionally fails 1.

## What this story hands on

- **E5-03 / E5-05:** the denominator is no longer the whole curriculum. Read `bereik` before printing a percentage or a gap list: one class now has two legitimate denominators, and a figure that does not say which it used is not evidence.
- **E5-04 / E5-06:** the screen states its own absence of minimumdoel level and of an export. Remove those sentences when you land, or they become false.
- **Any story with a fake of `IDekkingOpslag`:** the port gained `TelAlleLeerplandoelenAsync` and `HaalLeerjaarAsync`.
- **`DemoDataSeeder` writes an em dash into `Leerplandoel.Tekst`** (`"Voorbeelddoel 1 — demodata…"`), and this screen now renders it to a user. Pre-existing and already logged under the Art. II.3 entry as demo-fixture Dutch; logged here per E1-15's rule that the right question is *"did I make one visible?"*, not *"did I add one?"*. Not fixed here: it is the seeder's string, not this story's. **Filed as E7-18** on the antagonist's instruction to file it or waive it, with the finding that being catalogued under Art. II.3 does not discharge **Art. II.5**, which is a rule about the character rather than about where copy lives.

## The gates, and what they changed

**test-runner: PASS on all nine claims, no defects, 4 MINOR.** It re-derived every gate itself and probed the one combination this story had never exercised (stale **and** a non-zero `aantalBuitenBereik`, in both scopes) looking for a third figure leak, sweeping every `title`/`aria-*`/`alt`/`value`/`content` attribute, `document.title`, the meta tags and every `progress`/`meter`/`[role=progressbar]` element. None. Its own environment findings are worth more than its verdict: `Demo__Seed=true` is **not** enough because the seeder also requires `IsDevelopment()` and `--no-launch-profile` leaves you in Production; and Playwright's *"Browser is already in use"* was a **live** Edge belonging to another session, not an orphan, so it killed nothing and drove Chrome over CDP instead.

**antagonist round 1: VIOLATIONS FOUND — 2 MAJOR, 9 MINOR, 2 open questions, no CRITICAL.** Neither MAJOR was in the screen. All addressed:

1. **MAJOR — the ruling was recorded everywhere except where rulings live.** `backlog/README.md`'s Art. XIV list still carried the question as open and still asserted that dekking measures the whole curriculum and that every caller passes `null`, both false at `d1eeb3e`. Fixed: the entry is now *partially resolved* and names both halves it does **not** settle (graadklas, and the kleutergroep the ruling's wording never contemplated), plus the Art. XI.1 amendment still owed by the owner. `Klas.cs`'s own claim that *"no planning logic keys on this value"* was falsified by this change and is corrected.
2. **MAJOR — a kleutergroep is measured against three jaar/fase codes and nothing declared it.** `Leerjaar = 0` cannot say which kleuterjaar, so `JK + K2 + K3` are measured together: up to two other years' doelen sit in a derde-kleuterklas's denominator and read as its own lacunes, while the payload says `EigenJaarFase` with no fallback flag and only the leerjaar-7 case had a notice. Since kleuter is roughly half of a 2,5–12 school this is not an edge case. Fixed **in copy, derived from `gemetenJaarFasen.length`** so it cannot drift from the codes printed beside it and so a future graadklas ruling yielding two codes lands in the same branch. Whether a three-year scope may be labelled *"Deze klas"* at all is now an owner question in the Art. XIV list.

*The nine MINOR, each fixed:* an `id` built from the JSON group key contained quotes and whitespace, so `aria-labelledby` resolved to nothing and **every group silently lost its accessible name** (axe does not flag that, and the demo seed's single-word names hid it) → a DOM-safe id, and the comment claiming "nothing renders it" corrected; the group header claimed to be **sticky** and could not be, because the list wrapper's `overflow-hidden` makes it a scroll container that never scrolls → removed, claim included; **`bezig` described behaviour this app does not have** (no `placeholderData`, so the summary unmounts) → removed rather than made real, because keeping the old figures would print a total over a *different denominator* while the pressed button named the new one; **five pre-existing tests had silently moved onto the fallback path**, including the Art. IV.1 one, which is the exact hazard this story's own docstring named and fixed only for `Maak`'s callers → a named constant and the reason stated once; the `nakijken` marker had **no reachable explanation** on this screen (the register's row is a link, this one deliberately is not) → the marker itself is now the link; the minimumdoel sentence named a *data* prerequisite as if it were the whole condition, so it would read as a promise the moment E1-12 lands rather than when E5-04 is built → reworded against the missing feature too; the worklog and story entry were stale and self-inconsistent → this section; the seeder's em dash reaching users was catalogued but owned by nobody → filed as **E7-18**, with the finding that being catalogued under Art. II.3 does not discharge **Art. II.5**.

*One finding did not survive contact, and the audit had flagged it as unverified and asked for confirmation first.* It reported that model binding accepts an out-of-range numeric enum, so `?bereik=5` would return whole-curriculum figures under a meaningless label. Reproduced with an `Enum.IsDefined` guard deliberately removed: all of `5`, `-1` and `onzin` **already** answer 400. The guard was therefore removed again rather than kept with an untrue justification, and **the test stayed**, because it pins the behaviour whoever enforces it.

*Both open questions are the owner's and are recorded rather than answered:* the kleuter scope above, and whether the per-row verdicts must be marked provisional while the plan's figure is withheld. On the second the audit was right that the reason first given was self-contradicting — the chips are just as additive as the tally I removed — so the rationale is rewritten to the narrower true one and the decision is flagged as unmade.

## Antagonist round 2, and what it cost

**VIOLATIONS FOUND: 3 MAJOR + 6 MINOR.** Six of its seven assigned checks came back clean; the four *new* findings were not in round 1, and **three of them are the same defect class round 1 existed to catch**. All addressed.

**It also found the branch was 29 commits behind and that a claim of mine about `origin/main` was false**, so `origin/main` (`ba372a4`) was merged in before fixing anything: two findings are only judgeable against the merged content, and one of them is *retired* by it. Conflicts in `nl.json`, the E7 epic and the progress table, all resolved by keeping both sides; the table re-derived on the merged files (**97 / 42 / 43%**).

1. **MAJOR — a comment described a notice the screen did not render, and that comment was the justification for a branch ordering.** `bepaalCijfer` checks the empty scope before the withheld figure and defended the order by claiming the unresolved-placement notice "is rendered **independently** of this slot". It was not: the summary had three mutually exclusive branches, so in the reachable combined state (an L3 class while only kleuterdoelen are loaded, **plus** a stale placement) the screen said *"nog niets om tegen te meten"* and **nothing at all** about the placement awaiting a decision, and withheld the link to go fix it. Fixed by moving the sentence and its link **out** of the slot, so the comment is now true, with a test for the combined state. Verified in a browser on a real L1 class: the empty scope, the open placement, the link, and no total, all at once.
2. **MAJOR — the second open question was not on the list that three artefacts said it was on.** A component comment, the commit body and this worklog all claimed the row-verdict question was "recorded in the Art. XIV list". It was not; it existed only in the component and here, so it would never have reached the owner. **This is MAJOR-1 of round 1 reproduced by the commit that fixed MAJOR-1.** Now filed in `README.md`.
3. **MAJOR — the branch shipped a figure its own Art. XIV bullet forbade**, with no waiver and no citation: *"E5-02 must not put a figure on screen before this is answered."* The premise held on this branch, because **E1-18** (`7e4bde8`) was not an ancestor of it. Merging retired it; the gate is struck with the citation. Product risk nil, record breach real, and it is exactly what MAJOR-1's remit was supposed to close.

*The six MINOR, each fixed:* the retracted row-chips rationale survived **verbatim in the story entry**, the durable record a reader opens first, while being rewritten in two other places; my numbering note asserted E7-16/17 were "not committed to `origin/main`" when they were, the true fact being that this branch was behind; **two of the four "visible" fixes had no regression guard at all** (the `kopId` fix was invisible to every existing assertion, and the `nakijken` marker was never tested), so both now have one, each mutation-checked; the new `Link` was **the only `to={` in the app dropping the klas/schooljaar selection**, which emptied the shell's pickers and, at desktop width, left no in-app route back; SC 2.5.8 applied the moment that marker became interactive and its ~20px was computed rather than measured, so it is now `min-h-6` and **measured at 24,00 × 59,38px in a browser**; and the controller's "anything else yields 400" was overbroad, because `?bereik=EigenJaarFase,HeelCurriculum` binds as a flags combination. *Also fixed, reported by the test-runner a round earlier and left standing:* with an empty scope the list wrapper collapsed to a bare 1px rule under the summary.

*One thing the round did **not** find, and it matters:* nothing in the product's behaviour. Every MAJOR was in the record around it.

## The kleuterjaar chooser (owner ruling 2026-08-04)

Round 1's second MAJOR was that a kleutergroep is measured against three jaar/fase codes with nothing declaring it. The first fix declared it in copy; the owner then ruled the real fix: **let the teacher choose.**

Backend: `?jaarFase=` narrows **within** the class's own derived set, so nobody can measure a kleutergroep against L6, and an out-of-set code is **ignored rather than refused** — a 400 would take a teacher who followed a stale link off a working screen, and the payload stays honest because `GemetenJaarFasen` reports what was *applied*. The payload gains `BeschikbareJaarFasen`, because after narrowing to `K3` the measured list is `["K3"]` and a screen with only that could no longer offer `JK` and `K2` as the alternatives it narrowed from.

The chooser renders on **"this class has more than one code"**, not on "is this kleuter". The second is a question the data model cannot answer, and the still-open graadklas ruling would answer it differently while needing exactly this shape.

*Measured in a browser on a seeded kleuterklas with JK, K2 and K3 doelen:* all three gives **4 doelen in scope, 14 outside**; pressing `K3` refetches, puts `jaarFase=K3` in the URL, and gives **2 in scope, 16 outside** with only the two K3 codes listed. The scope sentence changes to *"omdat je dat jaar gekozen hebt"*, which is what distinguishes a narrowed kleutergroep from an L3 class. Every option measures 24px (SC 2.5.8), contrast 6,08 / 8,90 / 15,42:1, no overflow at 1440px or 390px. Ten new tests (five unit, two endpoint, five component); two load-bearing claims mutation-checked: dropping the parameter from the request fails 4, and rendering the chooser unconditionally fails 2.

## Closed, and on what basis

**`[x]` on the owner's decision, 2026-08-04, with one commit unaudited.** Asked whether to run a third round on the kleuterjaar chooser or close, the owner chose to close. The story entry carries the caveat in full and the progress table moved to 43/97 = 44%, re-derived from the epic files rather than incremented.

**What that `[x]` rests on, precisely.** Everything up to and including the round-2 fixes had **two independent antagonist rounds plus a test-runner PASS**. The kleuterjaar chooser (`5998cba`) was built *in response to* round 2 and has ten tests, two mutation checks and a browser pass on a seeded kleuterklas — **all by its author**. That is the E5-01 shape, and it is recorded here for the same reason: it is the first place to look if something turns out to be wrong. The concrete residual is the `?jaarFase=` narrowing, the `BeschikbareJaarFasen` field, the ignore-an-out-of-set-code decision, and the *"omdat je dat jaar gekozen hebt"* copy.

**The counterweight, because it changes how much that residual should worry anyone:** across both audited rounds, **nothing was found in the product's behaviour**. Every MAJOR sat in the record around it — twice in prose a previous fix round had written, and once in a comment whose false claim was the *justification for a branch ordering*. This story's demonstrated failure mode is prose, not screens.

## Still open, and not this story's

- **The graadklas / menggroep half** of the Art. XIV denominator question, which has the same root as the kleuter half: `Klas` carries one `Leerjaar` ordinal. The fix is to give a class a real jaar/fase, which needs a migration and the beheerscherm E6-03/E6-04 will build, so it is a future story rather than a loose end here.
- **Neither of this story's two owner questions reached `docs/besluiten-gevraagd.md`**, the channel `README.md` says to forward to directie. One of them was answered anyway, in session. That gap is pre-existing (E5-01's question is not there either) and is worth someone owning, because a question that only lives in `README.md` reaches the owner only when they read it.
