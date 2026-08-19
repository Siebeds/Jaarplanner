# E5 — Dekking & export

**Phase:** 5 · **Milestone:** M5 — Bewijs van dekking
**Goal:** Prove coverage — per class, down to minimumdoel level via concordance — with a gap list, doelsoort filtering, and export as proof. The dekkingsoverzicht is the second anchor screen.
**Covers FR:** FR-9 (9.1–9.3, 9.5), FR-11. **Constitution:** [Art. V](../CONSTITUTION.md#article-v--coverage-must-be-provable-dekking) (the core invariant).
**UX & a11y:** this is an anchor screen — follow [`docs/ux/ui-ux-approach.md` §5](../docs/ux/ui-ux-approach.md) and [ADR-0017](../docs/adr/0017-ui-ux-design-system.md); doelsoort/coverage use colour **+ label**; WCAG 2.2 AA.

---

- [x] **E5-01 — Coverage computation (computed, never stored)** — *done 2026-08-03 on `story/E5-01-dekkingsberekening`. One antagonist round (VIOLATIONS FOUND, 4 MAJOR + 6 MINOR + 1 QUESTION), all findings addressed; **the owner ruled that the fix round ships without a re-audit** (see below). Worklog: [`worklogs/E5-01/implementation.md`](worklogs/E5-01/implementation.md).*
  > **⚠ How this `[x]` differs from the others in this backlog, recorded because it would be dishonest to let it read the same.** Every other closed story here was gated by an audit that saw its **final** state. This one was not: the four MAJOR fixes were written after the only audit and were verified by **the tests and by me, not by an independent pass**. The owner's decision, in their words: *"de story mag op groen"*, having been told that every prior story needing a re-audit found defects **in the fixes**. That is a legitimate call and it is theirs to make; what is not legitimate is recording it as an ordinary green. **If something in E5-01 turns out to be wrong, this is the most likely reason and the first place to look.** The concrete residual risk: `AantalOnopgelosteVervallenPlaatsingen`'s rename, the reworded reliability contract, the new `jaarFasen` seam and the three new endpoint tests have no adversarial reading behind them.
  > **Delivered:** dekking derived on read for one klas (`DekkingService` + `IDekkingOpslag` + `EfDekkingOpslag` + `GET /api/klassen/{klasId}/dekking`), with no dekking table, no cache and no invalidation. Gates: build 0/0, format clean, **512 unit + 161 integration passed, 0 failed, 0 skipped** against real PostgreSQL (baseline `61457bc` was 496 + 154).
  > **The layer question was an owner ruling, not an inference (2026-08-03).** The codebase held **three** different answers about which of the four `DoelKoppeling` layers count: the E2-06 gap list reads 4, `OpstapImportService.KoppelingAantallenAsync` reads 3 (E1-17's defect), and `ThemaDoelcodes` — the kalender card — reads 2. The gap list's docstring meanwhile promises it "matches the coverage semantics of Art. V", which no 2-layer dekking could honour. Art. V.1 enumerates no layers. **Ruled: all four, with `Subdoel`/`Activiteit` filtered to the klas that owns the subthema** (Art. IX.2 scopes those per klas and leeftijd). Rejected: 2 layers, which would make a goal linked only via an activiteit vanish from *both* overviews; and 4 layers school-wide, which would let klas A claim dekking for what klas B teaches. Recorded on `IDekkingOpslag`, not only in the worklog. *Also found:* `LaadThemasAsync` eager-loads only two layers, so the other two were not merely unfiltered but **unloaded** — a missing navigation, which stays green in every test.
  > **The Postgres test caught a real defect on its first run**, which is this story's most useful outcome. `EfDekkingOpslag` was first one query — `.Concat()` over the four branches plus `Distinct()`, i.e. one SQL UNION. EF cannot translate it (*"Unable to translate set operation after client projection has been applied"*) and **four of five Postgres tests failed**. The union moved client-side, matching what `LeerplandoelenQuery.HaalKoppelingenAsync` already does for these same layers. **The in-memory provider passed the broken version**, so it would have gone through CI green and thrown the first time anyone opened a dekkingsoverzicht. This is exactly the E2-06 antagonist carry-forward this story inherited.
  > **E3-07's clause 4 is now implemented.** A stale placement covers nothing, and the summary figure is **withheld** rather than flagged: `AantalGedekt` is `int?` and null when `IsBetrouwbaar` is false, so a caller cannot render a total it does not have. E3-07's own test report recorded that clause as *not verifiable* rather than as a pass; it is no longer outstanding.
  > **One judgement call, deliberately flagged rather than buried:** a stale **geweigerd** placement does *not* poison the figure (it can never change the number, and counting it would leave the plan permanently *te herzien* over something nobody will re-place — the defect E4-06 fixed elsewhere), while a stale **voorgesteld** one does. The directie ruling of 2026-07-28 did not contemplate a rejected placement. Both sides are pinned by a named test; the stricter reading is one predicate away.
  > **Still not reached: Art. V.2's inspection level.** No minimumdoel coverage is computed — that is **E5-04**, blocked on **E1-12**. Each doel carries its `minimumdoelRef` so the roll-up needs no second pass, and a named test exists so the field's presence is not read as the roll-up's presence.
  > **Antagonist round 1: VIOLATIONS FOUND (4 MAJOR, 6 MINOR, 1 QUESTION), all addressed 2026-08-03.** The audit re-ran the gates itself before judging and confirmed the gate table was true, then falsified **four** prose claims against the code. Worth recording individually, because three of the four were comments asserting the opposite of the implementation, which is this repo's most persistent defect class:
  > 1. **MAJOR — the contract documented "stale" and implemented "unresolved".** `IsBetrouwbaar`/`AantalVervallenPlaatsingen` were described as counting stale placements; they exclude rejected ones. Worse, the **kalender genuinely disagrees**: `kalenderFormat.ts:174` counts every stale placement with no status filter, so a stale *geweigerd* card raises the non-dismissible aandacht-notice while dekking reports `isBetrouwbaar: true, 0 unresolved`. *Fixed:* field renamed to `AantalOnopgelosteVervallenPlaatsingen`, both params document the exclusion, and the divergence is stated as deliberate with **E5-02 owning the copy** that keeps it from becoming the E4-06 contradiction in a new place. The audit judged the underlying *rule* defensible on stronger grounds than the worklog gave: because dekking is recomputed on read, un-rejecting a stale placement makes the very next read withhold the figure, so the state is self-healing.
  > 2. **MAJOR — the test fake documented a filter it did not implement.** *Fixed:* claim removed and replaced with why no filter is needed (the short-circuit is pinned by `AantalKoppelingAanroepen == 0` plus `GevraagdeThemaIds`, which is a stronger assertion than a filtered answer). No test had been passing for the wrong reason.
  > 3. **MAJOR — the denominator is the whole curriculum for every class, and it was the one judgement call left undeclared** while five others were documented meticulously. `DekkingWeergave` even framed it as a virtue. *Fixed:* recorded as a **new Art. XIV open decision** in [`README.md`](README.md), and a real seam added — `HaalLeerplandoelenAsync(jaarFasen)` — implemented and Postgres-tested so it cannot turn out to be decorative later. **E5-03 and E5-05 must not inherit "the whole curriculum" as a considered answer.**
  > 4. **MAJOR — the story's central claim had no test above component level.** No test anywhere composed a real persisted `Themaplaatsing` with the real link layers: the endpoint tests only covered the empty plan and the 404, the layer tests never touched a jaarplan, the unit tests never touched a database. So *"a doel is gedekt when a thema carrying it is placed in the plan"* was verified only across two mutually-faked halves. *Fixed:* three endpoint tests over HTTP against real PostgreSQL — a placed aanvaarde thema covering its doel and **naming itself as evidence**, a stale placement withholding the figure (**E3-07 clause 4 now proven end to end**), and a voorgestelde placement covering nothing. The block start is asked of the real `IPlanningsblokIndeling` rather than hard-coded, so the healthy case cannot silently drift into asserting the stale one.
  > *MINORs, all addressed:* the "same browse order as the gap list" claim was unguaranteeable (two different collations) and `CurrentCulture` made output host-dependent → **ordinal throughout**, claim corrected; the `IsGepland` "reuse" was a re-derivation from a serialised string → stated plainly, with the trigger for fixing it properly named; an `IsGedekt` cross-reference pointed at a member that did not carry the information → the three exclusions are now spelled out where they are claimed; `IJaarplanLezer`'s isolation from the AI client is **type-level, not structural** → stated as such; the unpaged whole-curriculum payload is a deliberate divergence from the register's paging → recorded on the controller for E5-02/E5-03; and the new endpoint is unauthenticated like 12 of the other 13 controllers → noted on the controller and routed to **E7-11**.
  > *Gates after the fix round:* **513 unit + 165 integration, 0 failed, 0 skipped** (+1 unit, +4 integration), build 0/0, format clean. Merged `main` (`efecf73`) in before landing, which brought today's **jaarFase ruling** — that ruling made one of this story's fresh comments untrue (the seam justified its ordinal matching by calling the code form unresolved), so it was corrected in the same pass: the canonical form is ruled and the import normalises, which is what actually makes ordinal matching right.
  > *Scope boundaries, stated so no later story credits itself with these:* **no screen** (E5-02/E5-03/E5-05 own the dekkingsoverzicht, so no teacher can see this yet and FR-9 is **not** satisfied), **no percentage** (E5-03; the counts it needs are here), and **no unification of the three layer definitions** (E1-17). For E1-17 specifically: the duplication **cannot** be removed by extracting a shared predicate, because these filters must translate to SQL and EF cannot translate a call to a helper method. That story has to generate the queries from one place or pin the call sites against each other.
  Leerplandoel *gedekt* ⇔ linked (status `aanvaard`/`manueel`) to a thema placed in the plan. Minimumdoel *gedekt* ⇔ ≥1 concorded leerplandoel gedekt.
  *Done when:* coverage is derived on read, not persisted. **High-risk logic — unit-tested thoroughly.** Ref: Art. V.1/V.6.
  *Carry-forward (E2-06 antagonist):* the E2-06 ongekoppelde-doelen query (`OngekoppeldeDoelenQuery`) unions the four owned `DoelKoppeling` sources but is only tested on EF **in-memory** — add a **Postgres-test-container** test for that UNION-of-owned-subqueries translation when building the (similar) coverage queries here.
  *Query shape — do **not** un-own `Themaplaatsing` (recorded 2026-07-29, E3-01 audit):* E3-01's worklog warns that `Themaplaatsing` being an EF *owned* collection makes it unqueryable server-side and should therefore "stop being owned" before E5. **That diagnosis is wrong and the remedy is oversized.** EF does translate `Any()`/`Count()` over an owned *collection navigation* into a SQL subquery; what it forbids is querying an owned type independently of its owner. The real blocker is local and small: `Jaarplan.Plaatsingen` is `Ignore`d (it returns a freshly materialised ordered list), so the only navigation is a bare backing field LINQ cannot address. Minimal fix if E5 ever needs it: expose a *mapped* collection navigation alongside the ordered projection, **keeping the type owned** — un-owning would surrender the ownership cascade E3-01's delete guards depend on. And E5 may not need it at all: per-class dekking loads one jaarplan aggregate, which gives the placed `ThemaId`s for free; even the multi-class views (FR-9.4) mean one plan per class with tens of placements — not a scaling problem for a primary school. This is a query-shape question, not an Art. V.1 stored-vs-computed question.
  *Binding reading — do not guess this (recorded 2026-07-29, E3-01 antagonist):* Art. V.1 says a doel is gedekt when linked to a thema **"placed in the plan"**. Before E3-01 that phrase was unambiguous, because a placement had no status. It now has four (`Voorgesteld`/`Aanvaard`/`Geweigerd`/`Manueel`), and `JaarplanWeergave` reports the same `Doelcodes` for all of them. **Only `Aanvaard` and `Manueel` placements count as placed** — by direct analogy with Art. V.1's own treatment of *link* status, and because counting a `Voorgesteld` placement would let the **AI** grant dekking, which Art. IV.1 forbids. A `Geweigerd` placement plainly must not count. E3-01 computes no dekking, so nothing is wrong today; this exists so E5 does not have to infer it. **Also honour the stale-placement rule:** while any placement `IsVervangen`/`IsVervallen` is unresolved, report the figure as *onbetrouwbaar / te herzien* rather than a number (directie ruling 2026-07-28, see E3-07).
  > **E3-07 closed its two halves of that ruling on 2026-07-30 and this one is now the only part outstanding.** A stale placement is detected and persisted (`IsVervallen` on `ThemaplaatsingWeergave`), rendered in a non-dismissible notice, and re-placeable inline. **Clause 4 — "coverage must not claim what it cannot prove" — is unimplementable until this story exists**, and E3-07's test report records it as *not verifiable* rather than as a pass, precisely so it does not read as done. Concretely: `HaalJaarplanAsync` already gives you the flag per placement, so the check is `plan.Plaatsingen.Any(p => p.IsVervallen)` → emit *onbetrouwbaar / te herzien* instead of a figure, in the view **and** in every export (FR-11).

- [x] **E5-02 — Per-class coverage view (gedekt / niet gedekt)** — *done 2026-08-04 on `story/E5-02-dekkingsoverzicht`, pushed at `5998cba` (9 commits, with `origin/main` `ba372a4` merged in first so the gates saw the tree that lands). **test-runner PASS on all nine claims, no defects**; **antagonist two rounds, both VIOLATIONS FOUND, all 20 findings addressed**. Gates: **562 unit + 187 integration (0 skipped, real PostgreSQL) + 421 frontend / 20 files**, `dotnet format` / lint / build clean, twelve mutation checks. Narrative: [`worklogs/E5-02/implementation.md`](worklogs/E5-02/implementation.md).*
  > **One defect left behind, found by E5-03's antagonist on 2026-08-06 and recorded here because it is E5-02's code.** `Dekkingsamenvatting`'s *"Naar Inladen"* link renders `<Link to="/import">` with **no `search`**, so following it drops the klas/schooljaar selection — the one cross-screen link in this feature that does not carry it (ADR-0021). **Worth more than its impact, which is low** (import is school-wide, so the teacher lands somewhere useful anyway): E5-02's own round-2 audit enumerated every `to={` in the feature and concluded the vervallen marker *"was the only one missing it"*, and that conclusion was one short. **An enumeration is a checkable claim, and this one was checked and still wrong** — the same lesson the 2026-08-04 note on E4-03 records about "this is recorded elsewhere". Not reopening E5-02: its acceptance criteria are met and one missing `search` is not a regressed story. Whoever picks up **E5-05** or **E5-06** is in this file already and should take it.
  > **⚠ One commit in this `[x]` was never audited, and it would be dishonest to let this read like the others.** The **kleuterjaar chooser** (`5998cba`, the last commit) was built *in response to* antagonist round 2 and then shipped **without a third round**, on the owner's decision when asked. Everything before it had two independent audit rounds plus a test-runner pass; that commit has its own ten tests, two mutation checks and a browser pass, all **by its author**. Same shape as **E5-01**'s `[x]`, and recorded for the same reason: if something in E5-02 turns out to be wrong, this is the most likely place to look. **The concrete residual:** the `?jaarFase=` narrowing, the new `BeschikbareJaarFasen` payload field, the ignore-an-out-of-set-code decision and the *"omdat je dat jaar gekozen hebt"* copy have no adversarial reading behind them. What is *not* residual risk: the two audited rounds found **nothing in the product's behaviour** at all, so the pattern this story exhibited is prose defects rather than broken screens.
  Show, per class, which leerplandoelen are covered and which are not.
  *Done when:* the view matches the plan state live. Ref: FR-9.1.
  > **What this story turned out to be.** `/dekking` was a `BinnenkortPagina`; it is now the second anchor screen. Every in-scope leerplandoel as gedekt / niet gedekt, the covering thema's named beside each covered one (the evidence half of Art. V), grouped per `(domein, subdomein)` with a per-group tally, and a scope switch. **The design decision that carries it is the summary slot, and it is not a percentage:** it holds a count, or *"nog geen betrouwbaar cijfer"* with what to do instead, or *"nog niets om tegen te meten"*. E5-01 made `aantalGedekt` null precisely so a caller **cannot** print a total it has no right to, and this is the screen that honours that (directie 2026-07-28, clause 4, which E5-01 recorded as unimplementable until a screen existed).
  > **TWO OWNER RULINGS, 2026-08-04, obtained before building.** (1) **E5-09's wireframes-first gate is postponed**, the same way E3-06's teacher review was; E5-09 stays open and this story did not wait for it. (2) **A class is measured against its own jaar/fase by default**, derived from `Klas.Leerjaar`, with `Dekkingsbereik.HeelCurriculum` as an explicit switch. That is the Art. XIV question *"waartegen wordt een klas gemeten?"* answered **for the single-leerjaar case only** — a graadklas has one ordinal and cannot state its set, so that half stays open and the computation widens honestly rather than guessing (`isTerugvalNaarHeelCurriculum`).
  > **What E5-03 and E5-05 now inherit, and it is a correction to what E5-01 told you.** The denominator is **no longer the whole curriculum**. `GET …/dekking` takes `?bereik=` and defaults to the class's own jaar/fase, and the response states which scope it applied, which codes it used, whether it had to widen, and how many loaded doelen it left out (`aantalBuitenBereik`, because a narrower denominator flatters the figure). **Read `bereik` before putting a percentage or a gap list on screen:** one class now has two legitimate denominators, and a figure that does not say which one it used is not evidence. `AantalLeerplandoelen` can also legitimately be **0** while the school has a full curriculum loaded (an L3 class, only kleuterdoelen imported); 0 of 0 must never render as success.
  > **The defect that only looking found, and it is the E4-06 class again.** With a stale placement the summary said *"Zolang dat zo is, geeft dit overzicht geen cijfer"* and two lines below it every group printed *"2 van 14 gedekt"*. Group counts are **additive**, so a teacher could add them up and reconstruct exactly the total the ruling forbids, in its misleading form: a stale placement's doelen count as niet gedekt there, while what is unknown is which period they sit in. No test noticed. The rule was enforced where someone looked and left standing where nobody did. Fixed by deriving the tally from the same function the summary uses; the row chips stay, and **the reason first given for that was self-contradicting** (round-2 audit): it called them a per-doel fact *"true either way"* one clause after conceding that a stale placement's doelen read as niet gedekt when what is unknown is their period. The chips are **just as additive** as the tally, so the withheld total stays reconstructible by counting them. The honest reason is narrower: the ruling speaks of *the figure*, and removing the verdicts would leave the screen unable to show which thema's are affected at all. **That is a judgement call, and it is now an owner question in the Art. XIV list** ([`README.md`](README.md)).
  > *A correction to this story's own evidence, recorded because the mechanism is transferable.* A grep over Chrome's `--dump-dom` output was briefly the proof that the tally was gone. `--dump-dom` serialises only the top-level document, so a grep for the content of a same-origin **iframe** could not have failed. All four states were re-verified by reading the facts from inside the frame.
  > *Logged per E1-15's rule that the question is "did I make one visible?" rather than "did I add one?":* `DemoDataSeeder` writes an **em dash** into `Leerplandoel.Tekst` (*"Voorbeelddoel 1 — demodata…"*) and this screen now renders it to a user. Pre-existing, already catalogued under the Art. II.3 entry as demo-fixture Dutch, and deliberately **not** fixed here: it is the seeder's string, not this story's.
  > *Scope boundaries, stated so no later story credits itself with them, and stated **on screen** rather than only here:* **no percentage and no doelsoort filter** (E5-03), **no gap-analyse traceable to where a doel should be planned** (E5-05), **no export** (E5-06), and **no minimumdoel level** (E5-04, blocked on E1-12) which is the level the onderwijsinspectie actually tests. That last absence is visible copy, because a directie must not read this screen as the inspectie-proof it is not yet.
  > **Gate results (2026-08-04).** **test-runner PASS on all nine claims**, no defects, 4 MINOR; it re-derived every gate itself and found **no third figure leak**, having swept every `title`/`aria-*`/`alt`/`value`/`content` attribute, `document.title`, the meta tags and every `progress`/`meter`/`[role=progressbar]` element in the withheld state. **Antagonist round 1: VIOLATIONS FOUND** (2 MAJOR, 9 MINOR, no CRITICAL), **all addressed**, and neither MAJOR was in the screen: the ruling had been recorded everywhere except the Art. XIV list in [`README.md`](README.md), which still asserted the opposite; and a **kleutergroep** is measured against three jaar/fase codes with nothing declaring the widening, which is the ruling's wording not covering the kleuter case. Details in the worklog. **One finding did not reproduce** and had been flagged as unverified by the auditor itself: model binding already rejects an out-of-range numeric `?bereik=`, so the guard added for it was removed again and only the test kept. **Antagonist round 2 (on the fix round): VIOLATIONS FOUND, 3 MAJOR + 6 MINOR, all addressed.** It vindicated the reason for running it: **the new findings were mostly round 1's own fixes**, and three were the very class round 1 existed to catch. The sharpest is that **MAJOR-1 of round 1 was reproduced by the commit that fixed MAJOR-1** — the row-verdict question was cited by three artefacts as being on the Art. XIV list and was on none of them. Round 2 also found this branch **29 commits behind** and a claim of mine about `origin/main` simply false, so `origin/main` was merged in before anything was fixed; that merge *retired* the Art. XIV gate *“E5-02 must not put a figure on screen”* via **E1-18** (`7e4bde8`), which the audit had correctly flagged as live and unacknowledged here. **Nothing it found was in the product's behaviour**; every MAJOR was in the record around it. Details in the worklog. **Still `[~]`: no third audit has run**, and the shape of round 2 is the argument for wanting one.
  > **A THIRD OWNER RULING, 2026-08-04, and it closes half of an Art. XIV question rather than only reporting it.** The antagonist found that a **kleutergroep** was measured against `JK` + `K2` + `K3` together, because `Klas.Leerjaar` is `0` and cannot say which kleuterjaar: a derde kleuterklas carried roughly three times the doelen it teaches, so its figure read about a third of what it is and its gap list named doelen for two-and-a-half-year-olds. **Ruled: the teacher chooses the kleuterjaar on the screen.** Implemented as `?jaarFase=` narrowing **within** the class's own set (nobody can measure a kleutergroep against L6), with `beschikbareJaarFasen` beside `gemetenJaarFasen` in the payload so a narrowed screen still knows what it narrowed from, and a chooser that renders on *"more than one code available"* rather than on *"is this kleuter"* — so the day a graadklas gets two codes it needs no new control. Measured in a browser on a seeded kleuterklas: all three gives 4 doelen in scope, K3 gives 2, the URL carries the choice, every target is 24px and the copy says the single code is the teacher's **choice** rather than the class's one leerjaar. The graadklas half stays open and is the same root.
  > **The kalender/dekking divergence E5-01 filed against you got worse on 2026-08-03, and it is a *ruling* rather than a copy task (written here by E4-02, at its round-3 audit's insistence).** E5-01 recorded that `kalenderFormat.ts` counts **every** stale placement with no status filter, while `DekkingService` excludes rejected ones (`IsVervallen && !IsGeweigerd`). E4-02 then put "Weigeren" on a stale proposal's card face with copy recommending it, so **rejecting a stale proposal is now the advertised way to resolve a te-herzien plan**, measured in a browser as `isBetrouwbaar` false→true and `onopgeloste` 1→0. Consequence you inherit: `kalender.herzienUitleg` ends *"Zolang dit openstaat is de dekking van dit jaarplan onbetrouwbaar"*, and the rejected card **stays in that notice** (`vervallenPlaatsingen` filters on staleness alone) while the API reports the figure as trustworthy. No teacher can see the contradiction today because no dekkingsoverzicht exists; the moment this story ships a number, they can.
  > **RESOLVED (owner, 2026-08-03): a rejected stale placement leaves the figure trustworthy. `DekkingService`'s narrowing stands, and the copy is what changes.** E4-02 had filed this the other way round, arguing that `herzienUitleg` was faithful to the directie ruling of 2026-07-28 (*"onbetrouwbaar while any placement is unresolved"*) and that `DekkingService` — whose own comment calls the narrowing *"a judgement call, not an owner ruling"* — was the divergence. The owner ruled the narrowing correct, on the grounds E5-01's audit had already given: dekking is recomputed on every read, so un-rejecting a placement makes the very next read withhold the figure again, and the state is self-healing. **So E5-01's original assignment was right and E4-02's counter-instruction was wrong: `kalender.herzienUitleg` is the thing to fix, and it is yours.** Concretely, it ends *"Zolang dit openstaat is de dekking van dit jaarplan onbetrouwbaar"* while a **rejected** stale placement no longer makes it so, and `vervallenPlaatsingen` (`kalenderFormat.ts`) keeps that card in the notice with no status filter. Decide whether the notice should distinguish the two, or only the sentence should.
  > *Not urgent, and worth saying so:* no teacher can read the contradiction until this story puts a number on a screen. That is exactly why it is cheap to fix now.
  > *Also inherited, smaller:* `DekkingService`'s comment justifies poisoning the figure on a stale `voorgesteld` placement with *"the teacher may still accept it"*. After E4-02 they cannot (accepting is withheld on a stale card, rejecting is not). The conclusion survives, because re-placement still raises the figure; the stated reason is half stale, so do not quote it.

- [x] **E5-03 — Coverage % + missing-goals list + doelsoort filter** — *done 2026-08-06*
  Show dekkingspercentage, list ontbrekende doelen, filter by doelsoort (e.g. only minimumdoelen).
  *Done when:* filtering by MD shows minimumdoel-only coverage. Ref: FR-9.2.
  **Measured in a browser: 43% unfiltered (6 of 14) becomes 63% narrowed to MD (5 of 8)**, against a real API and real
  PostgreSQL. Client-side over the one payload E5-02 already fetches, which is what `DekkingWeergave.Doelen` was
  designed for and says so. **No backend behaviour changed**; the single backend commit is a test.
  *Gates:* 567 frontend / 23 files + 15 Postgres integration tests, 0 failed, 0 skipped; lint, build and
  `dotnet format` clean; **23 mutations, 22 bite** (the 23rd provably cannot — see the worklog).
  **Eight antagonist rounds, every one of which found something.** Full record in
  [`backlog/worklogs/E5-03/worklog.md`](worklogs/E5-03/worklog.md).
  > **The design question this story turned out to be about was not the percentage.** It was *which* narrowing may
  > touch the figure. **Doelsoort** changes what is measured, so the figure follows it; **"alleen ontbrekende"** changes
  > only what is shown, and a figure that followed *that* would report 0% every time a teacher asked to see their gaps.
  > Two client-side filters over one payload, one a change of subject and one a change of view. It also falsified a
  > documented distinction on `Bereikschakelaar` (*"a filter hides rows and leaves the figure alone"*), now rewritten.
  > **The trap, for whoever adds the next figure here:** the server nulls `aantalGedekt` while a placement is stale,
  > but every row still carries its own `isGedekt`, so a client-side count over a filtered subset reconstructs exactly
  > the total the directie ruling of 2026-07-28 withholds. That route was open to any caller and is now closed in
  > `bepaalCijfer` alone. **Route any third figure through it.**
  > **`bepaalPercentage` clamps to 1..99.** Plain rounding turns 1 of 500 into "0%" and 499 of 500 into "100%", and the
  > second is the worst thing an inspectie-facing screen can say. The fraction is always printed beside it.
  > **What this story did NOT do, so no later story credits itself with it:** the gap-analyse grouped by discipline and
  > actionable from the kalender is **E5-05**; the minimumdoel level is **E5-04** and stays blocked on E1-12. An
  > MD-doelsoort filter is *not* minimumdoelniveau — Art. V.1 makes a minimumdoel covered when **one** concorded
  > leerplandoel is, aggregated over distinct refs — and the screen now says so in its own copy rather than leaving a
  > directie to read "63%" as coverage of the minimumdoelen.
  > **Six of the eight rounds' defects were user-facing copy and not one was an arithmetic error.** From round 2 onward
  > **every round's findings sat in the fix round that answered the previous one**; no round after the first found a
  > defect from the original build. One empty-state sentence took three attempts, false in one direction and then the
  > other. That produced the standing rule now in `CLAUDE.md`: *a conditional sentence may assert only what its own
  > render condition guarantees*, with the corollary that when the honest explanation is forbidden you say **less**,
  > never something else.
  > **Owed, and it is not this story's defect:** `Dekkingsamenvatting`'s *"Naar Inladen"* link has no `search`, so it
  > drops the klas/schooljaar selection. On `main`, predates E5-03; E5-02's round-2 audit enumerated every `to={` and
  > concluded the vervallen marker was the only one missing it, so that conclusion was one short.

- [ ] **E5-04 — Minimumdoel-level coverage (inspection level)**
  Surface coverage at minimumdoel level via concordance — the level the onderwijsinspectie tests.
  *Done when:* a minimumdoel shows covered iff ≥1 concorded leerplandoel is covered. Ref: FR-9.3, Art. V.2.

- [~] **E5-05 — Gap-analyse presentation** — *built 2026-08-07 on `story/E5-05-gap-analyse`, off `origin/main`
  `96a9060`. Commits `ff911e6` (server), `3b11cb2` (screen), `5ca1ac8` (a test the mutation check exposed as
  vacuous), `e7a29de` (the record), and after twelve idle days `6b4111c` + `9c15019` (**fix round 1** and its record,
  on antagonist ronde 1) and `a154604` onwards (**fix round 2**, on ronde 2).
  **Two antagonist rondes, both VIOLATIONS FOUND — 3 MAJOR + 5 MINOR + 2 QUESTION, then 1 MAJOR + 7 MINOR + 2
  QUESTION. Every MAJOR is fixed and mutation-checked; two MINOR are routed to E7 and two QUESTION are the owner's.**
  **`[~]` and not `[x]`: ronde 3 is owed**, and this backlog's own status legend reserves `[x]` for "implemented,
  tested, Antagonist-clean". Ronde 2 found its MAJOR inside fix round 1, exactly as three consecutive rounds of E4-08
  did, so fix round 2 having no independent pass is a named risk rather than a formality.*
  Clear missing-goals overview, grouped by discipline/domein, actionable from the calendar.
  *Done when:* a gap can be traced to where it should be planned. Ref: FR-9, Art. XII (gap-analyse).
  > ### **OWNER RULING, 2026-08-07: the grouping stays `(domein, subdomein)` and gets no discipline level.**
  > The line above asks for the list *"grouped by discipline/domein"*, so this narrows the story's own text and is
  > recorded here rather than quietly not done. The taxonomy really does have three levels (Art. VII.0), the
  > disciplinenaam is seeded and already user-facing in the Doelen-register, and `Leerplandoel.DisciplineNummer`
  > exists — so the option was live and was put to the owner with its cost: a third grouping level also touches the
  > list E5-02 and E5-03 built and the export layout E5-06 had ruled on. **Rejected in favour of leaving those alone.**
  > The day it is wanted it is a payload field and a group key, not a rework. *Recorded on the screen as well, in
  > `DekkingPagina`'s list of deliberate absences, so a reader of the code does not have to find this file.*
  >
  > **What was built instead is the other half of the same sentence, and it is the half the acceptance criterion
  > actually names.** `/dekking` has listed *which* doelen are missing since E5-03; this story says **why** each one is
  > missing and **where** that is closed. Four causes, ordered cheapest-route-first, first match wins:
  > `WachtOpBeslissing` (a thema carrying it stands in the plan as an unanswered proposal), `NietIngepland` (a thema
  > carries it and sits in no period: never placed, rejected, or stale), `KoppelingNietBeslist` (only an undecided
  > doelsuggestie links it, so the decision is a link decision and planning would not help), and `GeenThema`.
  > **E3-03 wrote the hand-off itself**: `Dekkingsvooruitzicht` counts what accepting the plan would cover and says in
  > its own type that *which* doelen those are is E5-05's to list. `WachtOpBeslissing` is exactly that set, and a unit
  > test pins the two against each other rather than leaving the equality to hold by inspection.
  > **Where each half lives, because the split is the design.** The **row** states the cause, in the same slot and the
  > same type as the evidence line a covered row has carried since E5-02: one column of reasons either way. The
  > **routes are aggregated** into one block above the list, at most four lines with a count and one link each. No
  > control per row, and that is deliberate: in September a class is legitimately uncovered almost everywhere, so a
  > hundred near-identical buttons is the mistake `Doeldekkingregel`'s own comment already rejects for a solid red
  > chip. And a teacher does not close gaps one doel at a time. Placing one thema closes fourteen.
  > **`GeenThema` gets no link** (the E3-06 rule): planning cannot close it, so a link to either screen would be a
  > control that does not do what it says. The line still renders, because "these cannot be closed by planning" is the
  > most useful thing this block can tell a directie about Art. V.2.
  > ### **The one rule that cost thought, and it is a leak this repo has already shipped once.**
  > The four counts partition the gaps in view, so they add up to `totaal - gedekt` — precisely the figure the directie
  > ruling of 2026-07-28 withholds while a placement is unresolved. **E5-02 shipped that leak through its group
  > tallies**: the summary said it would give no figure while every group printed one, and the counts were additive.
  > So the block **does not render at all** in the withheld state, gated on the same `cijfer.soort` the group tallies
  > use. Two alternatives were rejected and both are recorded on `Lacuneroutes`: rendering the lines without counts
  > needs a second copy family saying the same things less precisely (E5-03's rule is to say less, not to say
  > something else), and rendering with counts plus a caveat is the E4-06 contradiction — a warning that the figure
  > cannot be trusted, beside figures. The rows keep explaining themselves, because a per-doel cause is not a figure;
  > that scope was settled by **E5-06's** audit.
  > **A constraint the storage read imposes on the copy, guarded rather than trusted.** The candidate read excludes
  > `geweigerd` links entirely, so a goal whose only link the teacher already rejected classifies as `GeenThema`.
  > That cause may therefore say no thema **covers** the goal and may never say none is **linked** to it. It is the
  > more natural sentence to write, which is why `catalogus.test.ts` reads the value rather than the key: a `t(key)`
  > assertion moves with the catalogue and cannot catch a lying sentence (E5-03's lesson).
  > **What the export does NOT carry, with a test on the absence.** A cause is a *remedy* and the document is
  > *evidence* (Art. V.4); and Art. XIV reserves export layout for directie, which E5-06 obtained a ruling on
  > precisely so it would not be settled by implication. Adding two columns on this story's judgement would undo that.
  > **The duplication this story adds, named rather than hidden.** The four-layer, four-status predicate is now written
  > out **eight** times across two storage methods, because EF cannot translate a call to a shared one — the
  > constraint **E1-17** owns. `De_besliste_kandidaten_zeggen_hetzelfde_als_de_dekkende_lezing` pins the two against
  > each other on real PostgreSQL, because `WachtOpBeslissing` is only sound while they agree: a layer present in one
  > query and missing from the other becomes a doel reported as one click from covered while the click does nothing.
  > Merging the two reads is the better fix and is deliberately left to E1-17, whose scope it would otherwise absorb.
  > **Gates.** 646 unit + 230 integration on real PostgreSQL (0 skipped), `dotnet format` exit 0; 628 frontend / 24
  > files, eslint + `tsc` + `pnpm build` clean. **Thirteen mutation checks**, and the thirteenth is the one worth
  > carrying: removing `!doel.isGedekt` from the row's render condition left the whole suite **green**, because the
  > test used the ordinary covered fixture whose `oorzaak` the fixture nulls exactly as the server does. The assertion
  > held through the fixture's invariant and never reached the component's own guard. E4-08 recorded this class in its
  > own words — *a mutation check can pass because the test's own setup already did the thing under test* — and this
  > is the next instance. Found by running the mutation, not by re-reading the test.
  > **Browser pass** at 1440px and 390px against a live API and real PostgreSQL, on a fixture holding one instance of
  > every state (2 gedekt, 6 `WachtOpBeslissing`, 2 `NietIngepland`, 2 `KoppelingNietBeslist`, 2 `GeenThema`).
  > **axe 0 violations at both widths.** Composited contrast: route sentences **15,42:1**, links **8,90:1** at 24px
  > tall (SC 2.5.8), cause lines **6,08:1** at 12px — the same token and the same measurement as the evidence line
  > they mirror. Nothing of this story overflows at 390px; the elements that do are the scrolling nav, pre-existing.
  > The withheld state was reached by making a placement stale and **the block disappeared while the rows kept their
  > cause lines**, with no total anywhere on the page including `title`/`aria-*`/`value`/`content` attributes and no
  > `progress`/`meter`/`[role=progressbar]` element. That same stale placement moved its two doelen from
  > `WachtOpBeslissing` to `NietIngepland` in front of the browser, which is the classification's sharpest case
  > driven live rather than only in a `[Theory]`.
  > **One thing the browser could NOT check, stated rather than implied:** the demo seeder writes a single doelsoort,
  > so the interaction between the doelsoort filter and the route counts was exercised only by a component test. Same
  > residual E5-03 carried, same cause.
  > ### **ANTAGONIST RONDE 1, 2026-08-19: VIOLATIONS FOUND (3 MAJOR + 5 MINOR + 2 QUESTION), and it ran twelve days
  > after the code was written because the session that wrote it never came back.**
  > *Two of the three MAJOR were found by RUNNING MUTATIONS that the whole 876-test backend suite survived. That is
  > the headline of this round: the story shipped thirteen mutation checks and none of them touched the storage layer's
  > status or scope surface, which is exactly where both defects were.*
  > **MAJOR-1 — the copy contradicted the kalender, and this is the one that reached a teacher.** `NietIngepland`
  > folded three states together (never placed, placed and **rejected**, placed against a period that no longer
  > exists) on the stated ground that the remedy was identical. **Both halves of that ground were false.** A rejected
  > placement is not stale, and `plaatsingenIn` filters `!isVervallen` and nothing about rejection, so the card **is**
  > drawn in its period column: `/dekking` told a teacher a thema *"staat in geen enkele periode van dit jaarplan"*
  > while a card for it stood visible in one with a "Geweigerd" chip. And the remedy differs: this one is closed with
  > *Weigering terugdraaien* on the card, while `Themakiezer` deliberately **disables** that thema in exactly the
  > period the teacher is looking at, so the folded route sent them to a control that refuses them (the E3-06 rule).
  > `Themakiezer`'s own comment describes the scenario, one file away from the copy that contradicted it.
  > *Fixed by splitting `PlaatsingGeweigerd` out as its own cause*, ordered second (one click on a card already on
  > screen ranks above placing a thema and below answering a proposal nobody has looked at yet). **A rejected AND
  > stale placement stays `NietIngepland`**, because a stale card is drawn in no period, so there the folded sentence
  > is true: the boundary is the render rule rather than a preference, and `DekkingServiceTests` drives both sides of
  > it. Three value-reading guards added, because a `t(key)` assertion could not have seen this — the key was right and
  > the sentence was false.
  > **MAJOR-2 — a test that named a filter it never exercised.** `Een_subthema_van_een_andere_klas_is_ook_geen_kandidaat`
  > said it scoped layers **3 and 4** per class and only ever filled layer 3 for the foreign class. Mutating layer 4's
  > `st.KlasId == klasId` to `st.KlasId == st.KlasId` left the whole suite green. The covering read's sibling test had
  > the activiteit from the start, so the new read got the **weaker copy** of a fixture whose own comment says a
  > missing filter is what it exists to catch. *Fixed, and the mutation now fails it.*
  > **MAJOR-3 — the pin held four of sixteen pairs.** Eight predicate copies each able to differ on either of two
  > decided statuses is **sixteen** (layer, status) pairs, and the fixture filled exactly four: layer 1 `Aanvaard`,
  > layer 2 `Aanvaard`, layer 3 `Manueel`, layer 4 `Manueel`. Deleting `|| Status == Manueel` from layer 1 of the
  > candidate read left the whole suite green. **This matters more than a coverage gap** because the pin is the entire
  > stated reason the eightfold duplication was accepted instead of routed to E1-17: in the product that mutation reads
  > as *"De koppeling is nog niet beslist"* plus a link to `/themas`, for a link the school already decided by hand.
  > *Every layer now carries both decided statuses.* The eight copies were also re-read character by character in the
  > audit and **the code as written was correct** — the finding was about the net, not the code.
  > **MINOR-4** the controller claimed FR-9 was unsatisfied *"for one reason only"* while FR-9.4's directie overviews
  > (E6-06) are unbuilt too, written in the very commit that swept six other comments for describing E5-05 as unbuilt:
  > *if you correct one absence, that is when you are least likely to check the next.* **MINOR-5** `Lacuneroutes` and
  > `telLacuneoorzaken` asserted opposite things about the same four counts; now said once, on the component that owns
  > the withholding gate, with the other pointing at it. **MINOR-7** `KAND-GEWEIGERD` in the pin fixture was
  > `Voorgesteld`, so its assertion read as a claim about rejected links that would be a bug if true.
  > **MINOR-8 is routed, not fixed:** the unauthenticated dekking read now also returns the names of thema's in no
  > plan. A widening of debt `DekkingController` already records, no pupil data, and it belongs to whichever story adds
  > the role checks (**E7-11**, blocked on E6-01/E6-02) rather than to this one.
  > ### **Two things left open for the owner, both stated rather than decided here.**
  > 1. **`GeenThema`'s line distinguishes nothing** (ronde 1 MINOR-6, sharpened by ronde 2): *"Geen enkel thema dekt
  >    dit doel."* is **true** in every state that renders it, so nothing is being deferred that is false. It is simply
  >    uninformative: it is true of every row in the list. **Ronde 2 corrected this entry's own framing**, which said
  >    the useful sentence was *forbidden*. What is forbidden is the **short** version: the candidate read excludes
  >    rejected links, so a doel whose only link the teacher already threw away lands in this cause, and *"geen thema is
  >    hieraan gekoppeld"* would be false for it. A longer truthful sentence does exist, e.g. *"Geen enkel thema is aan
  >    dit doel gekoppeld, of je hebt de koppeling geweigerd."* So **the choice is brevity against informativeness, not
  >    brevity against impossibility**, and it is stated that way because "forbidden" invited an accept without the
  >    trade being weighed. **Accept the short line, or rule on the longer one.**
  > 2. **Three route lines now read "Naar de kalender" and go to the same place** (ronde 1 QUESTION-2, which fix round 1
  >    made worse: it was two). SC 2.4.4 is met, because each link's purpose is clear from the sentence in its own
  >    `<li>`, and identical label plus identical destination is the benign duplicate rather than the harmful one. But a
  >    screen-reader link list shows three identical entries for three genuinely different tasks. **The precedent ronde
  >    2 put on the table, which this entry owed you:** E4-08 already ruled and *tested* the opposite convention for its
  >    own case, *"geeft elke verplaatsknop een eigen naam, zodat drie activiteiten niet drie keer hetzelfde heten"*
  >    (`frontend/src/features/themas/Klaslaag.test.tsx`). It is not the same case, because E4-08's three controls had
  >    three different destinations and these have one, but it is the nearest ruling and you should decide against it
  >    rather than around it. **Not redesigned on this story's own judgement**, because it is a UX call and because
  >    every fix round in this repo that reached past its finding introduced a new defect.
  > ### **Gates on `6b4111c`, all re-run rather than carried forward.**
  > **648 unit + 230 integration** (0 skipped, real PostgreSQL), `dotnet format --verify-no-changes` exit 0;
  > **629 frontend / 24 files**, `eslint` + `tsc --noEmit` + `vite build` clean.
  > **Four mutation checks, and all four bite** — each one run, not reasoned about: (1) layer 4's klas filter
  > neutralised → `Een_subthema_van_een_andere_klas_is_ook_geen_kandidaat` **FAILS**; (2) `Manueel` dropped from layer
  > 1 of the candidate read → `De_besliste_kandidaten_zeggen_hetzelfde_als_de_dekkende_lezing` **FAILS**; (3) the whole
  > `PlaatsingGeweigerd` branch deleted → `Een_geweigerde_plaatsing_is_haar_eigen_oorzaak` **FAILS**; (4) the new cause
  > line rewritten to the exact false claim MAJOR-1 was about → the new catalogue guard **FAILS**.
  > *Two things went wrong while running these and both are worth carrying:* a `sed` line number was off by one and
  > **silently mutated nothing** while the tests went green, which would have read as "the mutation does not bite" —
  > the fix is an assertion on the line's content before touching it, which caught the next off-by-one immediately. And
  > a failed build followed by `dotnet test --no-build` **served the previous mutation's binary**, so a "1 failed"
  > appeared that proved nothing about the mutation under test. Check the build's error count in the same breath.
  > **Browser pass, 2026-08-19, real API and real PostgreSQL on a throw-away database**, driving the actual user path
  > rather than a fixture: rejected the AI's proposal for *Herfst en oogst* on the kalender, confirmed against the API
  > that the placement was `Geweigerd` **and** `isVervallen: false` **and** still drawn in its period column, then read
  > `/dekking`. The row says *"Geweigerd op de kalender, dus telt niet mee voor de dekking: Herfst en oogst."*, the
  > route block carries its own line and link, and the false sentence appears **nowhere on the page**. **axe 0
  > violations at 1528px and at exactly 390px** (`innerWidth === 390`). Composited contrast, measured not argued:
  > cause line **6,08:1** at 12px, route sentence **15,42:1**, link **8,90:1** at 24px tall (SC 2.5.8) — the same three
  > figures the first browser pass recorded, because the new copy reuses those tokens rather than introducing any. The
  > links carry `klas` and `schooljaar` (ADR-0021). Nothing of this story overflows at 390px; the five elements that do
  > are the scrolling nav, pre-existing and already recorded above.
  > **What the browser did NOT re-check, said rather than implied:** the **withheld** state was not re-driven for the
  > new cause. It renders inside the same `<ul>` behind the same `cijfer.soort` gate as the other four, a component
  > test asserts the block's absence, and the gate itself was mutation-checked by the first pass — but the sentence
  > "every state was seen in a browser" is not one this fix round has earned, and the fifth state is the one it added.
  > *Also observed while cleaning up, and it is not mine:* **26 leaked `jp_test_*` databases** on the local instance,
  > which is exactly what **E7-14** describes. *(Ronde 2 reproduced the count and confirmed it stayed 26 across six
  > full suite runs of its own, so "not mine" is measured rather than asserted.)*
  > ### **ANTAGONIST RONDE 2, 2026-08-19: VIOLATIONS FOUND (1 MAJOR + 7 MINOR + 2 QUESTION), and the MAJOR was in fix
  > round 1.**
  > *That is why the round was run rather than the story closed on a ruling: rounds 2, 3 and 4 of E4-08 each found their
  > MAJOR in the previous round's fix. This one did too.* Ronde 2 also **re-ran all four of fix round 1's mutations
  > itself** and confirmed each bites, added two of its own that bite (swapping the branch order fails
  > `Een_open_voorstel_gaat_voor_op_een_weigering_elders`; deleting `!p.IsVervallen` from the shared helper fails three
  > theory rows including the rejected-and-stale one), and re-derived every gate figure.
  > **The MAJOR — I closed one axis of my own grid and called it the whole grid.** MAJOR-3's fix filled the sixteen
  > *decided* cells and the comment claimed that was "SIXTEEN (layer, status) pairs", six lines below the same comment
  > calling it a "four-layer, **four-status** predicate". Both cannot be true: the grid is 4 layers × 4 statuses × 2
  > reads = **thirty-two** cells, and the **non-counting** axis was at three of eight. Proven by mutation, not by
  > reading: widening the *covering* read's layer 1 to `!= Geweigerd || == Manueel` — which lets a `voorgesteld`
  > themadoel grant dekking and is Art. IV.1's headline — left the whole suite green, and so did deleting the
  > rejection exclusion from the *candidate* read's layers 1, 3 **and** 4 while `IDekkingOpslag` promises it holds in
  > every layer. *Fixed:* both status tests now carry both non-counting statuses at every layer, and both mutations now
  > fail. **A domain invariant made ronde 2's own suggested fix impossible as written:** Art. IX.2 caps a thema at
  > **three** themadoelen, so layer 1's four statuses do not fit on one thema and the fourth cell had to move to a
  > second thema. Recorded in the fixture, because the next person to extend that grid will hit the same wall.
  > *The arithmetic in the comment is corrected too, and that is the part worth carrying:* **a number that flatters
  > your own fix is the one to recount.**
  > **The seven MINOR, and three of them are fix round 1 repeating a defect it was fixing.** (a) `NietIngepland`'s
  > rewritten doc says two states where the code allows three: an **unparseable placement status** falls through to it
  > and would carry MAJOR-1's false sentence again, unreachable today and now written down at the enum rather than
  > fixed speculatively. (b) **MINOR-5's fix repeated MINOR-5**: it claimed `Lacuneroutes` "owns the gate" and is "the
  > one place that rule is stated" when the gate is on `DekkingPagina`, which stated the rule a third time and more
  > strongly; the rule now lives once, next to the gate, and it dropped the "never more than a rounding error away"
  > bound, which was unbounded rather than negligible. (c) **`types.ts` kept a false half-sentence** while the fix
  > corrected the count beside it: nothing compares `LACUNEOORZAKEN` to the C# enum, so a server-added cause renders
  > **nothing** rather than erroring, and the array is hand-kept in step. (d) The **catalogue guard was narrower than
  > its own comment**: ronde 2 rewrote the string to *"Geweigerd, dus dit thema staat nergens in je jaarplan"* — the
  > same lie, reworded — and all 28 catalogue tests passed; the pattern is broadened and the mirror loop's rationale
  > corrected to what it actually checks. (e) The cause count went **stale in nine places**, one written by fix round 1,
  > including `it("accepts the four causes the server can send")` — the named guard for `leesOorzaak`, the single
  > function deciding whether a cause renders at all, **with no assertion for the new cause**; it now iterates
  > `LACUNEOORZAKEN` so it cannot go stale again. (f) **`backlog/README.md` was not updated at all**, and `CLAUDE.md`
  > designates it the source of truth for live progress, so it stated three false things at `9c15019`: four causes, the
  > pre-fix gate figures, and *"no antagonist round has run"* at a commit where one had. (g) **MINOR-8's routing to
  > E7-11 was asserted and never written** — the exact defect E7-03's own note and the E4-08 precedent both record.
  > Now written on E7-11, together with a **second, unrecorded widening** ronde 2 found: E5-05 widened every row of the
  > payload E7-03's first performance item is about, so that item's 226 ms is a floor rather than a reading. Both are
  > on E7's entries, which outlive this story.
  > **Gates on fix round 2, all re-run:** **648 unit + 230 integration** (0 skipped, real PostgreSQL),
  > `dotnet format --verify-no-changes` exit 0 (it took an explicit `dotnet format` first: writing files from a script
  > mixed LF into CRLF files, which the build does not notice and the formatter does), **629 frontend / 24 files**,
  > eslint + `tsc` clean. **No `nl.json` value changed in this round**, verified with a diff, so the browser evidence
  > above still describes the shipped copy. **Fix round 2 changed no executable product code at all** — the diff is
  > comments, tests and records, which is checkable and was checked (`git diff 9c15019..a154604` filtered to
  > `backend/src` and `frontend/src` minus comment lines comes back empty).
  > *One slip of my own, found by checking rather than by an audit, and fixed in the commit carrying this
  > paragraph:* writing files from a
  > python script with `encoding='utf-8-sig'` **added a BOM to six files that had none**. The build does not notice,
  > `dotnet format` does not notice, and the repo's convention is clearly no BOM (246 of 280 `.cs` files). Stripped.
  > The general lesson is the one this round keeps producing: a tool that round-trips a file changes more than the
  > characters you were aiming at, so diff the bytes and not only the lines you meant to edit.

- [x] **E5-06 — Export coverage overview (proof of coverage)** — *built 2026-08-06 on `story/E5-06-dekking-export`
  (off `story/E5-03-percentage-filter`, since E5-03 was pushed but unmerged when this started; `origin/main` `fc11503`
  merged in after PR #35 landed). **Three antagonist rounds, all three VIOLATIONS FOUND, every finding
  fixed, ruled on or routed.*** Commits `64ee3ce` (server), `8cbda59` (tests + six mutations), `b97e762` (screen),
  `dbaff92` (merge of `origin/main`), `47600f1` (`nl.json`), `b8bb91a` (fix round 1), `7893c87` (the repo record and a
  stale `CLAUDE.md` clause), `0a1fa9b` (fix round 2), plus fix round 3.
  > **The audit history, because the shape of it is the story's most transferable result.**
  > - **Round 1: 3 MAJOR, 5 MINOR, 2 QUESTION.** Two of the three MAJOR were things this repository had *already written
  >   down* and this story walked past: the per-doel-verdict question whose own entry named E5-06 as its deadline, and
  >   the unrecorded Art. XIV ruling. The third was the `Minimumdoel` column.
  > - **Round 2: 1 MAJOR, 5 MINOR, 2 QUESTION.** It confirmed all eight round-1 findings genuinely fixed in the tree,
  >   and **five of its six new findings were in the fix round's own prose**. The MAJOR was a comment guaranteeing that
  >   the document's stamp and its filename could not name different days, while `Genereer` read the clock twice.
  > - **Round 3: 0 MAJOR, 8 MINOR, 3 QUESTION**, and **not one finding in the product's behaviour**. It could not break
  >   the round-2 fix. All eight were documentation, and **four were figures it re-derived and found short** — a
  >   register count, a byte-identity claim, a mutation-list entry naming a test that cannot fail, and an absence count
  >   left over from an earlier version of the same list. The fourth consecutive round in this family whose findings
  >   live in prose rather than in code. *If anything in E5-06 is wrong, the prose is where to look, not the export.*
  Export the dekkingsoverzicht as evidence.
  *Done when:* an export reproduces the on-screen coverage faithfully. Ref: FR-9.5, FR-11.2.
  > ### **Two owner rulings, taken 2026-08-06 *before any code was written*, because Art. XIV reserves this and E5-07 is `[!]` on it.**
  > The Art. XIV bullet reads *"Export formats: PDF, Excel, or both; which layout (inspectie / klassenmap)"*. Asking
  > first was therefore not caution but the rule, and the alternative would have ratified a page layout by implication.
  > 1. **The format is Excel (`.xlsx`) via ClosedXML.** Already in the stack for both import paths (MIT, Art. VIII), so
  >    no dependency is added; and a spreadsheet has **no page layout**, which is the half of the Art. XIV bullet this
  >    story must not answer. A PDF rides on E5-07's ruling and slots in behind `IDekkingExport` unchanged.
  > 2. **The export is always the full set in scope.** `bereik` and `jaarFase` travel, because they decide what the
  >    figures *mean*; the screen's doelsoort filter and its gaps-only toggle do **not**, and the endpoint has no
  >    parameter for either, so narrowing the document is not a thing a caller can ask for.
  >
  > **⚠️ Still owed by the owner, per [Art. XI.1](../CONSTITUTION.md#article-xi--amending-this-constitution):** a
  > dedicated amendment commit narrowing the Art. XIV *"Export formats"* bullet to the layout question, since the
  > format half is now decided. The precedent is `efecf73`, which recorded the jaarFase ruling in the backlog and named
  > the amendment as outstanding rather than making it. Until that lands, **E5-07's `[!]` cites the same bullet** and
  > this story's code rests on a ruling the constitution still calls open. *Raised by the antagonist as MAJOR-3, and it
  > was right: a ruling that exists only in a session and a commit message is not a ruling the next story can find.*
  >
  > ### **RESOLVED (owner, 2026-08-06): the directie ruling of 2026-07-28 speaks only of *the figure*.**
  > This closes the question [`README.md`](README.md) had been carrying since E5-02 and widening ever since, and E5-06
  > is the story that entry named as the deadline: *"Cheap to settle now, because no export reads these verdicts yet
  > (E5-06)."* The export crossed that line three ways at once, which is what the antagonist's MAJOR-1 established:
  > the per-doel verdicts now leave the app **as a file with no screen beside it**; the file is the artefact the
  > ruling's own words are about (*"mislead an inspectie"*); and the AutoFilter over `Gedekt` takes the exposure from
  > *"one manual count away"* to **zero**, before anyone types `=COUNTIF`.
  > **Ruled: rows and the `Gedekt` column stay exactly as they are, in every state.** Consistent with what E5-02 chose
  > for the row chips and E5-03 for the gaps-only toggle, so three artefacts now agree on one reading instead of
  > inheriting it by default. **Why it is the right answer and not merely the convenient one:** without those columns
  > the document cannot say *which* placement is the problem, in precisely the state where a teacher has one to fix,
  > and Art. V's evidence half is the whole reason the file exists. The rejected alternatives are kept because they are
  > what makes the choice legible: withholding the AutoFilter (half a measure, since one formula defeats it), and
  > blanking the verdicts (closes the gap, and makes the export useless in the one state that needs it while the screen
  > keeps showing them, so screen and file would contradict each other).
  > **What the document does withhold is the figure itself**, and that is measured rather than asserted: with one
  > accepted placement made stale, a real browser download said *"Nog geen betrouwbaar cijfer. 1 plaatsing in dit
  > jaarplan wacht nog op een beslissing …"* and printed no total anywhere, while 2 `Ja` / 12 `Nee` rows sat in the
  > same file.
  > ### **The `Minimumdoel` column was built and then deleted, and the deletion is the more useful record.**
  > The payload carries a `minimumdoelRef` per doel, so the first version rendered it, headed *"Minimumdoel"*, directly
  > beside `Gedekt` and inside the AutoFilter. The antagonist killed it (MAJOR-2) and was right twice over. **It
  > rendered the level the kopblok declares absent two rows above** (Art. V.2, E5-04, blocked on E1-12), which is the
  > E4-06 and E3-07 contradiction shape in a new artefact. And the inference it invited is **wrong in both
  > directions**, not merely unsupported: Art. V.1 makes a minimumdoel gedekt when **at least one** concorded
  > leerplandoel is, so a `Nee` beside a ref does not mean that minimumdoel is uncovered (another row with the same ref
  > may say `Ja`, and the document aggregates nothing); and a minimumdoel whose concorded doelen all fall outside the
  > scope appears in **no row at all**, so filtering that column yields a silently incomplete set. `Doeldekkingregel`
  > renders no such column either, and this story's criterion is faithful reproduction of the screen. **E5-04 owns it**,
  > where it can be rolled up correctly instead of insinuated. Pinned by a test, because an absence needs one.
  > ### What it deliberately does not do, so no later story credits itself with it
  > - **No percentage.** The rounding rule is documented and non-obvious (`dekkingFormat.ts` `bepaalPercentage`: 0% and
  >   100% are reserved for a genuinely empty and a genuinely complete numerator, everything between clamped into
  >   1..99, so a figure can never contradict the fraction beside it). A second implementation server-side would be a
  >   second authority for one number, which is the defect class E5-01 found when three places disagreed about which
  >   `DoelKoppeling` layers count. *"4 van 14 doelen gedekt"* cannot disagree with anything. If directie wants a
  >   percentage in the document, the fix is one shared implementation, never a second.
  > - **No provenance.** A document titled *Dekkingsoverzicht* does not distinguish an accepted AI suggestion from a
  >   manual link. The note under E5-07 fires when an export *"claims to explain a coupling's origin"*, and
  >   `Gedekt door` names the thema rather than the origin, so the condition is not met. It needs a nullable
  >   `VervangenLeerplandoelCode` and a migration, so it belongs with E5-07's ruling. **Ask directie rather than infer:
  >   it is plausibly what an audit of decreed-goal coverage asks about first.**
  > - **No PDF, no page layout.** See ruling 1.
  > ### Gates
  > **615 unit + 218 integration on real PostgreSQL, 0 skipped; 586 frontend / 24 files; `dotnet format`, `pnpm lint`
  > and `pnpm build` clean** (the last of those matters here: E7-17 means `lint` alone type-checks nothing, and a
  > missing catalogue key is a **compile** error because `t` is typed against `nl.json`, which is how the two new keys
  > could not have been forgotten). **Thirteen mutation checks, each failing the
  > intended test and no other, listed because a bare count is not checkable by a later reader** (round-2 audit:
  > mutations leave no artefact behind, so the claim has to name its evidence).
  > 1. withheld slot derives the number from the rows → `Een_ingehouden_cijfer_wordt_nooit_als_getal_afgedrukt`
  > 2. the full-set note deleted → `Het_bestand_zegt_dat_schermfilters_er_niets_aan_veranderen`. **This one passed on
  >    the first attempt, and the mutation was the weak thing rather than the test:** it replaced *"Dit bestand"* while
  >    the assertion reads *"alle doelen die in dit overzicht meetellen"*.
  > 3. an em dash in a document sentence → `Nergens_in_het_bestand_staat_een_kastlijntje`
  > 4. the singular plaatsing sentence deleted → `Een_enkele_openstaande_plaatsing_krijgt_enkelvoud`
  > 5. `bereik` ignored by the endpoint → `Het_bereik_reist_mee_naar_de_export`
  > 6. a doelsoort filter applied to the document → `De_schermfilters_veranderen_de_export_niet` **and** the anti-drift
  >    test `Het_document_stemt_rij_voor_rij_overeen_met_het_JSON_antwoord`
  > 7. the link carries `doelsoort` and `ontbrekend` → *"laat de doelsoortfilter en de alleen-ontbrekende-schakelaar er
  >    BUITEN"*
  > 8. `dekking.exportUitleg` rewritten to *"Je krijgt precies wat je nu ziet."* → both `catalogus.test.ts` export guards
  > 9. `dekking.alleenLeerplandoelen` rewritten into a claim → both new `catalogus.test.ts` minimumdoel guards
  > 10. the `Minimumdoel` column added back → `Er_staat_geen_minimumdoelkolom_in_het_document`
  > 11. column 1's width back to 14 → `Elk_kopbloklabel_past_in_de_breedte_van_de_eerste_kolom`
  > 12. the clock read a second time for the filename → `De_klok_wordt_een_keer_per_document_gelezen`
  > 13. the **`dekking.data` half only** of the link's `klasId && dekking.data` guard removed, so the link renders while
  >     the read is still pending → *"staat er ook niet als de dekking niet berekend kon worden"*, and **only** that one.
  >     *It read "the two absence tests" until round 3 checked it:* `useSelectie` returns `""` rather than `null` for
  >     no-klas, so the no-klas test's absence is produced entirely by the `klasId` half and it passes unchanged
  >     under this mutation. Naming two tests where one bites is exactly the failure a list was written to prevent.
  >
  > **Four of these assert an ABSENCE**, which no deletion can mutation-check, so each was checked by **adding** the
  > thing back: the filter parameter on the server (6) and in the link (7), the `Minimumdoel` column (10), and the
  > link itself (13). *The sentence said "two" and was a leftover from the six-mutation era; it survived the list
  > growing to eleven and then to thirteen, which is what a count nobody re-derives does.*
  > A **real browser pass** over CDP against a live API and real PostgreSQL, on a throwaway database: two placements
  > accepted through E4-02's own button took dekking **0 → 4 of 14**; the screen was then narrowed to
  > `?doelsoort=Minimumdoel&ontbrekend=1` (showing **80%** and one row) and the downloaded workbook still held **all 14
  > rows, 4 `Ja` / 10 `Nee`**. Contrast composited in the browser: link **8,4:1**, explanation **5,73:1**; axe **0
  > violations** at 1440px; no horizontal overflow at a true 390px viewport (`Emulation.setDeviceMetricsOverride`, not
  > a clamped `--window-size`).
  > **⚠️ The browser pass predates fix round 1; the Gates figures above do not.** Said plainly rather than presented as
  > one measurement, because they are not one. **Neither fix round touched frontend source**: round 1 touched only `catalogus.test.ts`
  > and round 2 touched no frontend file at all (round-3 audit verified both), so every *screen* figure above still describes the shipped screen, and every *document* claim survives the fixes and
  > is now additionally covered by the HTTP tests on real PostgreSQL. **The one property a browser was the sole witness
  > to, and which the fix changed, is the rendered column width** — and that is honestly unverified in a renderer.
  > `Elk_kopbloklabel_past_in_de_breedte_van_de_eerste_kolom` asserts `Length > Breedte`, which is a **proxy**: Excel's
  > width unit is the default font's digit width and these labels are bold, so the assertion holds today with room to
  > spare and is not the same thing as having looked. **Nobody has opened this workbook in Excel or LibreOffice.**
  > *An alternative worth naming because it needs no width at all:* a single-cell `"Klas: K3 derde kleuterklas"` layout
  > has no populated neighbour, so there is nothing for Excel to clip against.
  > *Playwright MCP was unavailable all story (its profile was in use by another session), so this ran over CDP.*
  > ### Three results worth carrying to other stories
  > 1. **A negative behaviour is only observable in the state it forbids.** Ruling 2 is enforced by an *absence* (no
  >    query parameter), and in the screen's default state a link that honours the filters and one that ignores them
  >    produce **byte-identical** URLs. Both the browser pass and the HTTP test therefore measure it with the screen
  >    genuinely narrowed. A default-state check would have proven nothing while looking like proof.
  > 2. **A mutation that does not bite is a fact about the mutation until you check *which* assertion should have caught
  >    it.** My first attempt at breaking the full-set note passed, because it replaced *"Dit bestand"* while the
  >    assertion reads *"alle doelen die in dit overzicht meetellen"*. Same family as E4-08's finding 1.
  > 3. **`git checkout` to revert a mutation ate two uncommitted fixes**, which is E3-07's round-2 defect exactly, and
  >    this story had *written a warning about it into its own earlier commit message four hours earlier*. The lesson is
  >    not "be careful": **commit first, then mutate.** Every later mutation was reverted by a reverse string replace.
  > ### Two things it measured that are not its own, and neither is filed by it
  > - **Art. II.5 names *exported documents* explicitly, and imported curriculum text flows into this one unchanged.**
  >   `DemoDataSeeder` writes an em dash into `Leerplandoel.Tekst`, and it was watched landing in a downloaded `.xlsx`.
  >   **E7-18** is filed for demo-fixture Dutch, and its blast radius is bigger than the screen it was filed about: it
  >   reaches a document meant for an onderwijsinspectie. **The general case is not E7-18's and needs an amendment**
  >   (see the antagonist's QUESTION-1): real Op.stap text will contain em dashes, so the export must either alter
  >   decreed text (Art. III.1 forbids it) or breach Art. II.5. Art. II.5 needs a clause exempting verbatim decreed
  >   curriculum text, with the boundary stated.
  > - **Should `CONSTITUTION.md` carry the directie ruling of 2026-07-28 at all?** *(round-2 audit.)* That ruling now
  >   governs what an **exported** artefact may contain (Art. V.4), and it appears **nowhere in the constitution**: it
  >   lives in `DekkingWeergave`'s doc-comment and in this backlog. The format ruling above is flagged as owing an
  >   amendment while this one is not, which is inconsistent treatment of two rulings taken on the same day. Art. V, or
  >   the `Dekking` clause of Art. IX.3, is where it would go. Owner/directie call. *Also noted, and pre-existing rather
  >   than this story's:* the Art. XI ratification log has no row for `e420648`, the 2026-07-30 language amendment that
  >   this story's server-composed Dutch rests on. The amendment text is in Art. II.3, so the authority is sound and it
  >   is only the log that is short.
  > - **The export route is unauthenticated, and it is accepted E7-11 debt rather than a new breach.** Recorded here
  >   because round 2 raised it and round 3 found the substance recorded only on `DekkingController` (E5-01's entry
  >   carries the analogous note for the JSON read). It exposes not one field more than the JSON endpoint beside it and
  >   FA §3.2 lets all three roles view dekking, so the role matrix demands no gate — but **the blast radius genuinely
  >   changes**: one guessable URL now yields a portable document of a whole class's planning and coverage, where before
  >   it yielded a JSON body. **E7-11** owns the app-wide gap and is blocked on E6-01/E6-02.
  > - **axe reports 0 violations and one `incomplete`**: `aria-prohibited-attr` on 14 nodes, all of them the
  >   pre-existing doelsoort badge, a roleless `<span aria-label="Minimumdoel">`. ARIA prohibits that, so a screen
  >   reader may announce *"MD"* and never the expansion. E5-02/E1-16 own the component; **E7-20** is the family.

- [!] **E5-07 — Export jaarplan (PDF/Excel, layout)** — *blocked: Art. XIV export formats & layout*
  Export a class year plan for print / klassenmap / inspectie.
  *Done when:* format(s) and layout chosen with directie; export matches the plan. Ref: FR-11.1.
  *An export cannot show how a coupling arose (recorded here by E2-08, 2026-07-29).* When a teacher
  substitutes a different leerplandoel on an AI suggestion, `DoelKoppeling.VervangLeerplandoel` overwrites
  `LeerplandoelCode` and clears `AiMotivatie`, so afterwards nothing distinguishes an overridden AI
  suggestion from a purely manual link. If directie wants that provenance in an export, it needs a nullable
  `VervangenLeerplandoelCode` column + a migration — decide **before** an export claims to explain a
  coupling's origin. Applies to **E5-06** too, for the same reason.

- [ ] **E5-08 — Coverage depth note (binary for MVP)**
  Keep binary gedekt/niet-gedekt for MVP as a deliberate simplification; leave a seam for later herhaling/opbouw (verticale samenhang).
  *Done when:* the simplification is documented in code/UX; no false "fully built up" claims. Ref: Art. IX.3, Gap GAP 11.

- [ ] **E5-09 — Dekkingsoverzicht wireframe + teacher feedback (wireframes-first)**
  Low-fidelity wireframe of the dekkingsoverzicht (leerplandoel + minimumdoel levels, gap list, doelsoort filter) reviewed with directie/teachers **before** building E5-02/03.
  *Done when:* a wireframe is approved and informs the build. Ref: ADR-0017, `docs/ux/ui-ux-approach.md` §5; NFR-2.
