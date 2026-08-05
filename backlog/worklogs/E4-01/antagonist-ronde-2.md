# E4-01 — antagonist, round 2 (on fix round 1)

**Verdict:** VIOLATIONS FOUND (2 MAJOR, 9 MINOR, 1 QUESTION — no CRITICAL)

*Authored by the `antagonist` agent on 2026-08-04, auditing `git diff a938b1b..HEAD` (`618f129`, `f52db80`). Pasted
verbatim by the session that owns the branch: the agent is read-only on project files and said so plainly rather than
claiming it had written this. Nothing below is edited, including the findings about my own prose.*

**How it was answered:** every finding is addressed in fix round 2, described in
[`implementation.md`](implementation.md) under *Fix round 2*. Two findings were deliberately **not** changed and the
reasoning is recorded there and on the code: `kalender.vergrendelDekking` stays under-inclusive rather than false, and
the `DemoDataSeeder` em dash was **already filed** as E7-18 in the very file this round searched, which is itself the
more interesting fact.

---

**The mechanism survives round 2 intact.** `DEKKING_KEY`, the subtree drop, the `useVerwijderThema` exemption and the
four closed test gaps are correct and I could not falsify them. **The copy does not survive.** The clause added to
`kalender.beslisUitleg` reproduces the E4-06 defect class in two board states, and two tests that already pass in this
tree render the contradiction on one screen.

## Per round-1 finding: fixed / not fixed / fixed but replaced

| R1 finding | Verdict |
| --- | --- |
| **MAJOR** — test comment asserts a disclosure no string makes | **Fixed but replaced by a new problem.** The comment correction is present and honest. The copy is present in both keys. But the board clause is false in two of three board states → Finding 1. |
| **MINOR** — "bitten six times" stale | **Half fixed.** The comment is corrected; `implementation.md:46-47` still reads *"bitten six times by a write path"* → Finding 5. |
| **MINOR** — generation branch unpinned | **Fixed.** `Jaarplankalender.test.tsx:3402-3428`. I traced the mutation by hand: deleting `useJaarplan.ts:149` makes the `waitFor` time out. Genuinely pins it. |
| **MINOR** — client half pinned at cache level only | **Fixed, with an overstated claim attached** → Finding 6. |
| **MINOR** — browser table's load-bearing column unartefacted | **Not fixed; conceded and then re-overclaimed** → Finding 8. |
| **MINOR** — stale figure on the other write routes | **Fixed for the two named families and for all thirteen `useBeheerMutatie` writes. Not fixed for the two importers** → Finding 2. |
| **MINOR** — orphaned JSDoc in `useDekking.ts` | **Fixed.** `useDekking` has its own block again and the `staleTime` reasoning is back on the query. |
| **MINOR** — Art. II.5 em dash in `DemoDataSeeder.cs:239` | **Not fixed, correctly** (round 1 asked for a filing). I found no filing in `backlog/E7-niet-functioneel.md`. |
| **QUESTION** — does the drag-raises-dekking side effect need copy | **Answered by owner ruling, and the answer was implemented badly** → Finding 1. |

## Findings

### [MAJOR] 1 — The new board clause promises a drag on the two tiers where dragging is withheld, and two existing passing tests render the contradiction

- **Article/FR:** Art. II.3/II.5, Art. X.5/X.6, the E3-06 rule, and the E4-06/E3-07 defect class the fix round's own guard docstring invokes.
- **Where:** `nl.json:342` (new third clause) against `Jaarplankalender.tsx:656-660` (the render gate) and `:808-812` / `:827-831` (`BORDUITLEG` / `PLAATSUITLEG`).
- **Problem.** `beslisUitleg` renders under one condition — `openBeslissingen > 0`, counted over the whole plan with **no tier condition**. Its own comment at `:640-642` says so and gives the reason: *"Deliberately **not** tier-dependent … It also says nothing about how a thema comes to count beyond aanvaarden, because 'of zelf verplaatsen' is only true on the tier where moving works."* The fix round put exactly that into the string.
  - **`anderNiveau` (Subthemaperiode).** The board renders `fijnUitleg`, then `plaatsAnderNiveau`, then the new clause. The card has no grip and no picker. Two sentences say moving is elsewhere; the third instructs the gesture.
  - **`niveauOnbekend`.** Worse: `roosterNiveauOnbekend` (*"… dus thema's verplaatsen kan hier niet."*) sits directly above a sentence telling the teacher to drag.
  - **`kan`.** True, but redundant: `sleepUitleg` one paragraph above already opens *"Versleep een thema naar een andere themaperiode."*
  **Live in passing tests:** `Jaarplankalender.test.tsx:1535-1567` and `:1706-1730` each render a `Voorgesteld` placement, so `beslisUitleg` is on screen, and both assert the grip is **null** in the same render. Nothing asserts the clause's absence at either tier.
  The author's defence (*"safe because it says AI-voorstel"*) answers the wrong axis: that excludes a `geweigerd` card, not a tier.
- **Required fix:** (a) append the clause to `kalender.sleepUitleg` (the `kan` entry of `BORDUITLEG`), or (b) gate it on `verplaatsstaat === "kan"`, which means splitting the key. (a) is smaller and matches precedent. Add a test that renders the fine tier **and** an outstanding proposal.

### [MAJOR] 2 — The two importers still only invalidate, so `/dekking` paints a pre-import figure

- **Article/FR:** Art. V.1/V.2, and the fix round's own rule as stated on `DEKKING_KEY`.
- **Where:** `frontend/src/features/import/useImport.ts:40-43` and `:59-62`.
- **Problem.** An import writes both the numerator (counted `DoelKoppeling`s) and the denominator (every leerplandoel). `/import` is a built primary nav destination; default `gcTime` is five minutes. Open `/dekking`, import, return through the nav → the pre-import figure, no loading line. Nothing records this as a decision, unlike `useVerwijderThema`, whose exemption **is** written down.
- **Required fix:** drop the subtree in both commit mutations, or record an argument for why an import cannot leave a stale figure. I believe none exists.

### [MINOR] 3 — The copy guard pins wording, not a property, and its named blind spot is smaller than the real one

Three of five assertions are substring matches on the string under test, and the one nominated as *"the one that pins the reasoning"* is a five-word verbatim fragment. It cannot detect Finding 1 (a catalogue test mounts nothing) and it **locks in the defect**: the honest fix moves the clause, and this guard fails that fix. The named blind spot is a decoy; the real hole — no state coverage — is unnamed.

### [MINOR] 4 — `Jaarplankalender.tsx:640-642` now contradicts the string it introduces

The comment is both false about the code and a correct statement of why the code is wrong: a warning the fix walked past. `f52db80` touched no comment in this file.

### [MINOR] 5 — Round-1 MINOR-2 is half fixed, and the corrected half inherits E7-16's superseded framing

`implementation.md:46-47` still says *"six times"*; `E7-niet-functioneel.md:174-175` says seven. And the corrected comment says *"a **write** path"*, while E7-16 records that framing as retired: the rule has to say **database path**, because a read path is exactly as unverified.

### [MINOR] 6 — The behaviour test's counterfactual claim is wrong about where it fails

Under `invalidateQueries` the `waitFor` on the cache at `:3467` times out and the test dies **there** — before `unmount()`, before `DekkingPagina` is mounted, so neither behaviour assertion runs. "Fails on its last assertion" is false, and the discriminating assertion is the same cache assertion the three earlier tests already make.

### [MINOR] 7 — The 390px measurement has no artefact for either new sentence

`copy-390.png` ends at `sleepUitleg`; **`beslisUitleg` is not in the image at all**, and neither is the panel. This is round-1 MINOR-5's pattern inside the paragraph written to answer round-1 MINOR-5.

### [MINOR] 8 — "The test-runner's six screenshots now cover both states of the load-bearing column" is not what the cited report says

No committed screenshot shows a loading line; the cited report says so itself (*"A screenshot is not proof of the loading line … the evidence is the accessibility snapshot"*), and that snapshot is not in the repo.

### [MINOR] 9 — `kalender.vergrendelDekking` demanded a re-read and did not get one

One open panel now carries *"Een eigen keuze telt mee voor de dekking"* and, below it, the imperative *"Aanvaard het thema als het moet meetellen."* Not a contradiction, but the string's own comment says: *"A future story that loosens this condition has to re-read the string, not just the guard."* This round loosened it.

### [MINOR] 10 — The story entry's headline still says both gates are owed, and omits three of five commits

### [MINOR] 11 — The docs describe a "link" rule while the hook fires on all thirteen beheer writes, and the widened cost is unrecorded

A rename, a new subthema and an edited activiteit now drop **every** class's figure. Defensible on the same reasoning as the lock, but the lock's cost was measured and recorded and this larger one is not, and the docs under-describe the code.

### [QUESTION] 12 — Two owner calls the fix round made implicitly

(a) Does a third explanatory paragraph belong above the board at all, given *"explanatory prose is the first thing to cut"*? (b) `"een andere periode"` vs `"een andere themaperiode"`: the new clause is the only kalender string that says *periode* where the gesture is tier-specific. Plus, carried forward: round 1's Art. II.5 breach at `DemoDataSeeder.cs:239`, which I could not find filed.

## Checks run (proof of thoroughness)

- **Every gate re-run on `HEAD` (`f52db80`)**: `pnpm test` → 444 passed / 20 files, 0 skipped (claim exact); `pnpm lint` → 0; `pnpm build` → 0; `dotnet test` against real PostgreSQL → 569 unit + 194 integration, 0 failed, 0 skipped (both exact); `dotnet format --verify-no-changes` → 0. `git status` clean.
- **Every card and board state enumerated against both new clauses.** The **panel** clause is correct as claimed: `verplaatsGevolg` renders only when a picker exists (`!isGeweigerd && verplaatsstaat === "kan"`), so it is tier-safe and rejected-safe, and *"a property of an eigen keuze"* holds for `Aanvaard` and `Manueel`. The one odd state is a **stale `Manueel` with a retained motivation**; the sentence stays true about after-the-move, so not raised as a finding, but it is the state to re-read if that copy is touched again.
- **The link-path fix attacked from four sides.** Whole-subtree drop is **right** for layers 1–2 (`EfDekkingOpslag` reads themadoelen and doelsuggesties school-wide, unfiltered by class), over-broad for layers 3–4 and for the non-link writes (cost only). `useVerwijderThema`'s exemption is **verified server-side**: `SchoolcontentBeheerService.VerwijderThemaAsync` refuses while `AantalThemaplaatsingenAsync > 0`. Other writers: all eleven `useBeheerMutatie` writes plus the two suggestion families drop; the **importers do not** (Finding 2). The `removeQueries`-with-mounted-observer hazard does not apply: `useDekking`'s only consumer is on another route.
- **TanStack semantics re-checked in source** (`query-core@5.101.2`): `remove` calls `destroy()` → `cancel({silent:true})` and deletes the entry, so an in-flight pre-edit fetch cannot be written back.
- **Art. IV / III / VI / VII / VIII / IX / XIV** — untouched or unaffected; new feature edges are one-way and match the existing `themas → matching` convention; no secrets; no migration; backlog arithmetic still matches the epic file.
- **Not verified, and what it would take.** I did not mutate source (read-only), so Findings 1 and 6 rest on tracing render gates and assertion order. Confirming Finding 1 empirically takes one test at `Subthemaperiode` with a `Voorgesteld` placement; Finding 6 takes swapping remove for invalidate and reading which line fails first. I did not reproduce Finding 2 in a browser.

**The change is not done.** Finding 1 is a user-facing copy defect of the class that has reopened two stories in this repo; Finding 2 is a live stale inspectie-facing figure on a built route.
