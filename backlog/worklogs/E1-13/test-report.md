# E1-13 — Test report (round 1)

**Verdict:** FAIL
**Mode:** both — unit/integration gates **plus** a real browser pass (headless Chrome over CDP)
**Tree tested:** worktree `.claude/worktrees/agent-a8b6127bb7255ef99`, branch `story/E1-13`.
Verified at `c236a68`; re-checked at `31b2264`, which adds only `backlog/worklogs/E1-13/antagonist.md`.
**No source file differs between the two**, so the browser evidence below is current.

> **The gates are green and the story still fails.** 502 + 153 backend, 243 frontend, lint, build and
> `dotnet format` all clean, twice. Five of the six clauses are met and several are met unusually well.
> The story fails on **two demonstrated defects reachable from the screen**, one of which silently
> destroys teacher-set `DoelKoppeling` statuses — the exact loss Art. IV.2 and clause 5 exist to prevent.

---

## Verdict per *Done when* clause

| # | Clause | Verdict | How I know |
| --- | --- | --- | --- |
| 1 | download the sjabloon (FR-1.5) and upload a filled `.xlsx` (FR-1.1) | **PASS** | Clicked the on-screen link in Chrome: `Browser.downloadWillBegin` gave `jaarplanner-schoolcontent-sjabloon.xlsx`, **7033 bytes written to disk** with the server's own filename. Every fixture in this report was built with `openpyxl` **from that downloaded file**, and `a-schoon.xlsx` then previewed and committed through the screen. The FR-1.5 to FR-1.1 round trip is exercised, not assumed. |
| 2 | read the per-row problems (row number + offending column) and the opmerkingen for dropped content (FR-1.2) | **PASS** | On screen: `rij 3 · kolom Klas` / "Verplicht veld 'Klas' ontbreekt.", `rij 4 · kolom Thema duur (weken)`, `rij 4 · kolom Type`. Two separate blocks with separate registers: "3 problemen in het bestand" (fault) versus "1 stuk inhoud gaat niet mee" (loss). See `C1-rijproblemen.png`, `B1-stille-drop.png`. |
| 3 | `isBestandGeldig` and `isVolledigVerwerkt` as two distinct statements, never one "OK" | **PASS** | The case the criterion is written for, driven for real: a file that parses cleanly and drops a typo'd goal code renders **"OK Bestand gelezen: Alle rijen zijn zonder problemen gelezen."** *and* **"WAARSCHUWING Inhoud volledig: 1 stuk inhoud kan niet overgenomen worden."** Two list items, two glyphs, two registers, warning not success. See `B1-stille-drop.png`. |
| 4 | review the preview *before* committing (FR-1.3) | **FAIL** | The forward path is right: no commit control exists until a preview returns, and it vanishes after the commit. But **defect 1** below: after a commit, pressing *Bestand nakijken* again fires a real preview request whose answer is thrown away, and the screen keeps asserting the previous commit. A reader who re-checks is shown a stale past-tense panel and cannot commit the fresh check at all. |
| 5 | choose add versus update/overwrite (FR-1.4), warned before an overwrite discards teacher-set `DoelKoppeling` statuses (Art. IV.2), never a silent default | **FAIL** | The happy path is excellent and I verified it both ways against real PostgreSQL. But **defect 2** below: I destroyed two `Aanvaard` themadoel links through the UI on a screen that showed no opt-in, no warning, no count, and "1 ongewijzigd" at every level. That is a silent destructive default. |
| 6 | read the Op.stap re-import review notice (FR-2.5) from `OpstapHerimportDiff` | **FAIL** | The notice itself is the strongest part of the story and every trap in the brief is handled (see below). It fails only through **defect 1**, which on this half discards the FR-2.5 review report specifically: after an import, re-checking shows the previous run's report while the fresh one is dropped. |

---

## Defects (these go back to the implementer)

### [MAJOR] 1. After a commit, *nakijken* fires a request whose answer can never be shown

Independently found by the antagonist (its finding 1) from a code reading. **I reproduced it in a
browser on both halves**, which is what turns it from a concern into a defect.

`uitkomst = commit.data ?? voorbeeld.data` (`Schoolcontentimport.tsx:105`, `Opstapimport.tsx:86`) and
`kijkNa()` never calls `commit.reset()`, so once `commit.data` exists it wins permanently while the form
stays enabled.

**Repro, school content** (`L1-finding1-schoolcontent.png`):
1. pick `a-schoon.xlsx`, press *Bestand nakijken*. Preview appears, heading "Wat dit bestand toevoegt".
2. press *Import doorvoeren*. Heading becomes "Wat er toegevoegd is", plus "De import is doorgevoerd."
3. **without changing the file or the modus**, press *Bestand nakijken* again. The button is not
   disabled (I read `disabled === false`), it flips to "Bezig met nakijken...", and
   `POST /api/schoolcontent-import/voorbeeld` really goes out. I captured all three POSTs in order.
4. The screen afterwards is identical to step 2: "Wat er toegevoegd is" / "Alles uit dit bestand **is**
   overgenomen." / "De import is doorgevoerd." No commit control.

The discarded answer is materially different. I issued the same preview from the page's own `fetch` with
the same `File` object: the server answers `toegepast: false`, `themas: ["TR Schoon:Ongewijzigd"]`, i.e.
"nothing would change", because the thema is already imported. The screen instead keeps a past-tense
success from an earlier write.

**Repro, Op.stap** (`M1-finding1-opstap.png`) — the FR-2.5 variant, and the reason clause 6 fails:
discipline `7`, `m-opstap-d7a.xlsx`, *nakijken*, then *Doelen inlezen*, giving "Wat er veranderd is aan de
doelen van discipline 7" / "De doelen zijn ingelezen." Press *Op.stap-bestand nakijken* again:
`POST /api/opstap-import/voorbeeld` goes out and the screen still shows the committed panel. **The review
report of the run just requested is discarded**, which is precisely what clause 6 asks to be shown.

**Expected:** the outcome on screen belongs to the most recent run.
**Actual:** it belongs to the last commit, forever, while later checks silently do nothing visible.

### [MAJOR] 2. A ticked Art. IV.2 opt-in survives a re-preview, and then discards teacher decisions with no control on screen

The antagonist raised the mechanism (its finding 6) and judged the dangerous branch reachable but did not
exercise it. **I ran it end to end against real PostgreSQL and the links were destroyed.**

`vergeetUitkomst()` resets `beslissingenVerwijderen`, but `kijkNa()` does not, and `voerDoor()` sends
`beslissingenVerwijderen` ungated by the current diff (`Schoolcontentimport.tsx:99`).

**Repro** (`P3-finding6-gewapend-zonder-controle.png` is step 4, the state that matters; also
`M2-finding6-optin-blijft.png`):

```
0. thema "TR Bedreigd" has themadoelen DEMO-L3-05=Aanvaard, DEMO-L3-06=Aanvaard
1. modus Bijwerken + d2-bedreigd-herimport.xlsx, press Bestand nakijken
   -> warning panel present, checkbox present, checked = false        [correct]
2. reader ticks the opt-in                                 checked = true
3. a concurrent session removes those two links (a second tab, another teacher: FR-10)
4. reader presses Bestand nakijken again (same file, same modus)
   -> warning panel GONE, opt-in controls on screen = 0
   -> React state still holds beslissingenVerwijderen = true
   -> screen reads: "OK Alles uit dit bestand kan overgenomen worden",
      "Dit bestand verandert niets aan de thema's ... die er al staan", "1 ongewijzigd" x3
5. the links exist again (a concurrent re-import restores them)
6. reader presses Import doorvoeren. No opt-in, no warning, no count anywhere on screen.
   -> themadoelen for that thema: (none). Two "Aanvaard" decisions destroyed.
   -> screen reads: "De import is doorgevoerd."
```

Even without step 3, pressing *Bestand nakijken* again with the box ticked leaves it ticked
(`checked = [true]`): a destructive flag pre-set for a run the reader never ticked it for, which is a
silent default in the plain single-user case too.

**Required:** reset the flag in `kijkNa`, and gate the wire value on the diff actually on screen:
`beslissingenVerwijderen && uitkomst.diff.bedreigdeBeslissingen.length > 0`.

### [MINOR] 3. `import.onbeschikbaar` asserts "Er is niets gewijzigd" on the commit path

Confirms the antagonist's finding 5, and defect 2 makes it worse rather than theoretical: the same string
serves preview and commit, so a commit that failed *after* the write reports "niets gewijzigd", and with a
hidden ticked opt-in that sentence would be false about deleted teacher decisions.

### [MINOR] 4. Observation, not a criterion breach: a commit control is offered for a file that imports nothing

With a file whose only row is rejected, the screen states "Uit dit bestand wordt niets ingelezen" and
"niets in dit bestand" at all three levels, and still offers *Import doorvoeren* (`H1-een-probleem.png`).
Harmless and honestly labelled, but it is a control that does nothing (the E3-06 rule).

---

## What the brief told me to attack, and what I found

**Staleness on file change and modus flip — holds.** Changing the file drops the whole result block rather
than merely disabling it: no result block at all, buttons back to just *Bestand nakijken*. Flipping the
modus after a preview does the same, including while a threatened-decisions panel is open
(`D1-modus-flip-verouderd.png`). A ticked opt-in resets with it. Changing the Op.stap discipline or file
drops the outcome and the 409 panel too. **A stale preview cannot be committed.** The staleness hole that
does exist is the commit-precedence one (defect 1), which the brief did not name.

**The 409 while E1-12 is open — holds, and it is the best thing on the screen.** A real MD-concorded file
gets its own amber panel headed "De doelen zijn niet ingelezen", framed by "Dit gaat niet over de rijen in
het bestand. De toepassing kan dit bestand nog niet inlezen, en hieronder staat waarom en wat er eerst
moet gebeuren.", then the server's Dutch next step: "Deze leerplandoelen verwijzen naar minimumdoelen die
nog niet ingeladen zijn: K-99. Laad eerst de decretale minimumdoelen in." Structurally separate from the
row-problem block. No directie member would re-download their file. See `G1-opstap-409.png`. A 400
correctly takes the ordinary alert instead (`G5-opstap-400.png`).
*One caveat, matching the antagonist's finding 2 and the implementer's own open question 5:* the **other**
409 ("Deze codes staan al bij een andere discipline... Controleer of dit bestand bij discipline 1 hoort")
gets the same system-state frame, so the framing sentence and the detail disagree about whose fault it is.
I hit this for real. Copy defect, not a criterion breach.

**`vereistReview` must not become a permanent banner — holds, verified three ways.** (a) grep: it is never
read in any component; the notice derives from `verdwenen` plus `verdwenenMaarGekoppeld`. (b) The notice
disappears the moment another file is picked. (c) The decisive case: I built a file that only **rewords**
one goal, so the server returns `vereistReview: true` with `verdwenen: []`, and **no notice appears**
(`H4-opstap-reword.png`; my probe for the word "Nazicht" returned false). The copy is run-scoped:
"Nazicht bij deze inlezing: 50 doelen staan niet meer in dit bestand". Nothing undismissable, nothing
persisted.

**`problemen[].reden` stays English, placed honestly — holds.** Rendered verbatim
(`Unknown or missing doelsoort code 'X'.`) with `lang="en"`, in mono, in a *separate* recessed block below
the review report, under "Technische details: 1 rij kon niet gelezen worden" and "Deze rijen uit het
officiële Op.stap-bestand kon de tool niet omzetten. **Dit is geen fout van jou**: het bestand komt van
Op.stap. De uitleg hieronder staat in het Engels en is bedoeld voor wie de tool onderhoudt." Never the
primary sentence, never blame. See `G3-opstap-review.png`.

**Plurals — holds.** Rendered singulars checked on screen, not only in the catalogue: "1 probleem
gevonden", "1 probleem in het bestand", "1 stuk inhoud kan niet overgenomen worden", "1 stuk inhoud gaat
niet mee", "1 verwijzing uit de schoolinhoud", "1 koppeling die jij zelf beslist hebt", "En nog 16
andere." Plurals correct alongside ("3 problemen", "50 doelen", "3 verwijzingen"). The one
`catalogus.test.ts` exemption (`import.telling`, which is `{aantal} {soort}`) is legitimate: `soort` is
always an uninflected participle, so "1 toegevoegd" and "1 ongewijzigd" read correctly, which I confirmed
on screen.

**The two error envelopes, plus a non-JSON or empty body — holds, all five shapes driven through request
interception.** Real traffic confirms both envelopes occur in this one feature: the integrity 409 and the
discipline 400 carry `type` and `traceId` (via `IProblemDetailsService`), while the non-`.xlsx` 400 answers
a bare `{title, status, detail}`. Both render their Dutch `detail`. Injected via `Fetch.fulfillRequest`:
an **empty 500 body** falls back to "Het inlezen is nu niet beschikbaar..."; an **HTML body**, a **bare
JSON string** (`"Discipline is required."`) and a **blank `detail`** all fall back to Dutch and leak no
English; a **`problem+json` with `type`/`traceId`** parses. **Zero uncaught page exceptions across all
five**, with the form still interactive each time. See `I1-foutenvelop.png`.

---

## Commands run — my own numbers

| Command | Result |
| --- | --- |
| `corepack pnpm test` (frontend/) | **243 passed / 15 files**, 0 failed |
| `corepack pnpm lint` | clean, exit 0 |
| `corepack pnpm build` | clean, built in 3.73s |
| `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (backend/) | **502 unit passed** / 0 failed / 0 skipped; **153 integration passed** / 0 failed / 0 skipped |
| `dotnet test tests/Jaarplanner.IntegrationTests` (second run, per the implementer's flake note) | **153 passed** / 0 failed / 0 skipped again. **I did not reproduce the 6-failure flake** the worklog recorded. |
| `dotnet format --verify-no-changes` | clean, exit 0 |

The worklog's "241 / 15 files" and "152 integration" are pre-merge snapshots; the merged tree is 243 / 153.

## Browser pass — yes, I got one up

The Playwright MCP server is gone this session, so I drove **headless Chrome 151 over the DevTools Protocol
from Node 24** (raw global `WebSocket`; there is no puppeteer in this repo). API on `127.0.0.1:5411`
(`Demo__Seed=true`, real PostgreSQL 17, seeder skipped because the schooljaar existed), Vite on
`localhost:5412` proxying to it. Real uploads via `DOM.setFileInputFiles`; the React-controlled discipline
field via `Input.insertText`, since a plain `.value =` does not update it; error shapes via
`Fetch.fulfillRequest`; and the narrow check via `Emulation.setDeviceMetricsOverride` rather than
`--window-size`, which clamps to about 504px on this machine.

**Nothing stayed unverified for lack of a browser.** Every clause was driven on screen.

Measured rather than assumed, at 390px on the fullest state of both flows:

- **Text contrast**, alpha-composited up the full ancestor chain: **140 text nodes, 0 below AA.** Lowest
  **4.88:1** (the cross glyph and "Bestand gelezen:" in `suggestie-geweigerd` at 10% over `paper-diep`),
  then 5.08 (an `Aanvaard` badge), 5.39 (`ink-zacht` on `paper-diep`). These match the implementer's
  numbers exactly, and match the antagonist's *computed* values, which it said plainly it could not measure.
- **Non-text contrast (SC 1.4.11)** of all four form-control borders: **3.40:1** each. The
  `bg-card`-instead-of-`paper-diep` decision holds; on `paper-diep` these would be about 3.01:1.
- **390px:** `scrollWidth === clientWidth === 390`, and **no element in `main` extends past the viewport**
  with the threatened-decisions panel and the 50-item review notice both open. See `K-390-vol.png`.
- The header repeating mid-page in tall screenshots is a `captureBeyondViewport` artifact of the app
  shell's `position: sticky` header (verified: the only sticky or fixed element in the document). Not a
  layout defect, and not this story's.

## Evidence

Screenshots in `backlog/worklogs/E1-13/`: `A1-schoon-voorbeeld.png` and `A2-schoon-doorgevoerd.png` (the
tense flip), `B1-stille-drop.png` (**clause 3**), `C1-rijproblemen.png` (**clause 2**),
`D1-modus-flip-verouderd.png` (staleness), `E1-bedreigd-1440.png`,
`P1-optin-getikt-voor-doorvoeren.png` and `P2-optin-niet-getikt-voor-doorvoeren.png` (**clause 5** happy
path, both directions), `G1-opstap-409.png` (**the 409**),
`G3-opstap-review.png` (**clause 6**), `G5-opstap-400.png`, `H1-een-probleem.png` (singular),
`H3-400-detail.png`, `H4-opstap-reword.png` (**`vereistReview` not keyed on**), `I1-foutenvelop.png`,
`K-390-vol.png` (390px), plus the defect reproductions `L1-finding1-schoolcontent.png`,
`M1-finding1-opstap.png`, `M2-finding6-optin-blijft.png` and
`P3-finding6-gewapend-zonder-controle.png`.

Database evidence for clause 5, both directions, on real PostgreSQL:

- commit with the opt-in **unticked**: `DEMO-L3-05=Aanvaard, DEMO-L3-06=Manueel` **survive**
- commit with the opt-in **ticked**: `(none left)`, and the label had said exactly that would happen
- commit with the opt-in **hidden but still ticked** (defect 2): `(none)`, and the screen had said nothing

## Notes for the record

- **The antagonist's findings 3, 4, 7 and 8 I did not independently re-derive.** They are copy,
  role-matrix and comment-accuracy findings outside the acceptance criteria, and I have no reason to doubt
  them. Its findings 1, 5 and 6 I confirmed, and 1 and 6 by reproduction. Its finding 2 I hit for real
  while driving the wrong-discipline 409. Its contrast figures agree with my measurements.
- **E1-17's known upstream defect is faithfully rendered here.** `KoppelingAantallenAsync` omits
  `Thema.Doelsuggesties`, so a still-referenced goal can land in `verdwenen` rather than
  `verdwenenMaarGekoppeld`. This screen shows what it is given; the fix belongs to E1-17.
- **Tooling defect I hit, worth recording.** My three port claims were written free-form instead of with
  the protocol's `owner:` field. `mine()` greps `^owner:` so it never listed them, and `release()` read the
  owner as an empty string and refused them as belonging to someone else: a lock that still works as a
  mutex but that no helper can lift. Same class as today's `file-CLAUDE.md.md` release that logged success
  for a release that never happened. The helpers verify the happy path and stay silent on a malformed file.
  Reported to the groepschat by the coordinator; I rewrote all three in the correct shape and released them
  with the helper.

## What must happen next

Defects 1 and 2 are both reachable from the screen and defect 2 destroys teacher work, so this is a fix
round, not a waiver. Both fixes are small: `commit.reset()` in `kijkNa` on both halves, and resetting plus
diff-gating `beslissingenVerwijderen`. Each needs a test that pins the *behaviour* rather than the code
path: preview, commit, preview again shows the **fresh** preview; and a commit sends `false` whenever no
threatened-decisions control is on screen.

---

## Correction (round 1, appended after the coordinator caught it) — a flaw in my own evidence

**What was wrong.** Three of my screenshots were byte-identical (md5 `7ab239bd…`):
`E3-bedreigd-doorgevoerd.png`, `F1-bedreigd-niet-getikt-doorgevoerd.png` and
`N1-finding6-stille-vernietiging.png`. They were named as three different states, including the state
illustrating my headline MAJOR. Caught by the coordinator, not by me, and committed openly as `1c0196b`.

**Why they collided, which is the part worth keeping.** They were not mislabelled captures or a harness
fault: all three were honest images of the same moment, and that moment cannot distinguish the three
states. All three shots were taken **after** the commit, on the same file in the same modus. After a
commit, `Bedreigdebeslissingen` is not rendered at all — it lives only in the `!toegepast` branch
(`Schoolcontentimport.tsx:238-247`) — so the discard control is absent from *every* post-commit screen,
whether it was ticked, unticked, or armed-but-invisible. The diff panel is identical too ("1 ongewijzigd"
×3). **I photographed the wrong moment three times.** The discriminating state is always *pre*-commit.
Proof that this is the real cause and not a guess: the retaken post-commit image
`P4-na-doorvoeren-gemeenschappelijk.png` is **byte-identical to the old collided image** (same md5), on a
fresh browser session, a fresh database seed and a different opt-in setting.

**Retaken on unfixed `HEAD` `1c0196b`** (I confirmed `git diff c236a68..HEAD -- frontend/src backend/src`
is empty, so this is still the behaviour I tested), because once the fix lands the pre-fix behaviour cannot
be photographed. Each image is now bound to a verified database outcome rather than to a filename:

| Image | State it shows | Verified outcome |
| --- | --- | --- |
| `P1-optin-getikt-voor-doorvoeren.png` | opt-in **visible and ticked**, before *doorvoeren*: panel present, 1 control, `checked = [true]` | committing then gave `(none)` — the two links destroyed, exactly as the label promised |
| `P2-optin-niet-getikt-voor-doorvoeren.png` | opt-in **visible and unticked**, before *doorvoeren*: panel present, 1 control, `checked = [false]` | committing then left `DEMO-L3-05=Aanvaard, DEMO-L3-06=Manueel` **intact** |
| `P3-finding6-gewapend-zonder-controle.png` | **defect 2, step 4**: panel **gone**, **0** opt-in controls on screen, both verdicts green, "1 ongewijzigd" ×3, *Import doorvoeren* offered — while the flag is still armed | committing then gave `(none)`: two `Aanvaard` decisions destroyed with nothing on screen about them |
| `P4-na-doorvoeren-gemeenschappelijk.png` | the post-commit panel, which is **the same in all three flows** by design | this is the single image the old three were all showing |

The three misleading filenames are deleted rather than kept as identical copies under wrong names, and
every screenshot in this directory is now unique (checked by md5).

**What this does and does not change.** No verdict, no clause and no defect changes: the FAIL, both MAJORs
and every PASS stand. `P3` is a genuine improvement on what I had, because the state defect 2 actually
turns on — a destructive flag armed with no control representing it — was the one state I had never
photographed at all. The standing evidence for defect 2 was, and remains, the database transition
`DEMO-L3-05=Aanvaard, DEMO-L3-06=Aanvaard` → `(none)`, which is stronger than any screenshot, plus the
antagonist reaching the same defect independently by reading the code.

**The lesson, in the terms this repo already uses.** This is the E3-04 audit's finding 6 in a new place:
"I looked at it" is only evidence if the artefact shows what the sentence claims. My failure mode was
specific and repeatable — I captured the *end* of each flow because that is where a run naturally stops,
when the state under test lived one step earlier. **Screenshot the state that carries the claim, not the
state the script ends in**, and md5 a set of screenshots before citing them as distinct.

---

# E1-13 — Test report (round 2)

**Verdict:** FAIL
**Mode:** both — unit/integration/lint/build gates **plus** a real browser pass (headless Chrome over CDP) against a real API and PostgreSQL 17
**Tree tested:** worktree `.claude/worktrees/agent-a8b6127bb7255ef99`, branch `story/E1-13`, head **`672bdab`**.
`origin/main` is contained in the branch and has not moved.

> **All six *Done when* clauses are met, and the two defects from round 1 are genuinely fixed** — each
> re-driven with my own repro, and with a positive control, so a fix that merely disabled the feature would
> have been caught. I also independently reproduced all three of the fix round's own claims the brief asked
> me to distrust, including the guard calibration, which lands on exactly the numbers I derived from scratch.
>
> **The FAIL is a different, and worse, defect that I found while driving the screen.** Against real
> PostgreSQL, **any import commit that adds a new subthema or a new activiteit to a thema that already exists
> answers 500.** Only a wholly-new thema, created in the same run, commits. That is the ordinary FR-1 path
> from the second import onward, it is reachable from this screen in three clicks, and no test sees it
> because the import unit tests run on the EF **InMemory** provider. It is **not this story's regression**:
> E1-13's entire footprint on `SchoolcontentImportService` versus `origin/main` is product copy, so the
> defect is pre-existing on `main`. I am still calling FAIL rather than PASS-with-a-note, because clause 4's
> "review the preview before committing" and clause 5's add-versus-update choice both terminate in a commit a
> teacher cannot complete, and the screen's own honest report of it ("Het doorvoeren is misgelopen") is what
> a reviewer would meet on their second ever import. See defect 1 for the minimal repro.

## Verdict per *Done when* clause

| # | Clause | Verdict | How I know (round 2, my own evidence) |
| --- | --- | --- | --- |
| 1 | download the sjabloon (FR-1.5) and upload a filled `.xlsx` (FR-1.1) | **PASS** | Clicked the on-screen link in Chrome: `Browser.downloadWillBegin` fired with the server's own filename `jaarplanner-schoolcontent-sjabloon.xlsx` for `/api/schoolcontent-import/sjabloon`. This headless profile then cancels the write (`downloadProgress: inProgress x4 -> canceled`), so I have no bytes on disk this round; the same URL fetched directly answers **200, 7033 bytes**, `content-disposition: attachment; filename=jaarplanner-schoolcontent-sjabloon.xlsx`. Round 1 got the bytes on disk, and the fix round changed `Bestandkiezer.tsx` and the sjabloon link **by docstring only**, which I verified in the diff. **Every fixture in this round was built with `openpyxl` from that served file** and uploaded through the screen with `DOM.setFileInputFiles`, so the FR-1.5 to FR-1.1 round trip is exercised, not assumed. `S1-aankomst.png` |
| 2 | read the per-row problems (row number + offending column) and the opmerkingen for dropped content (FR-1.2) | **PASS** | Heading **"3 problemen in het bestand"**, and on screen `rij 3 . kolom Klas`, `rij 4 . kolom Thema duur (weken)`, `rij 4 . kolom Type`, all four substrings probed in the live DOM. Kept in a block separate from the loss block. `T4-rijproblemen.png` |
| 3 | `isBestandGeldig` and `isVolledigVerwerkt` as two distinct statements, never one "OK" | **PASS** | The case the criterion exists for: a file that parses cleanly and drops a typo'd goal code renders **"Bestand gelezen: Alle rijen zijn zonder problemen gelezen."** *and* the separate warning **"1 stuk inhoud gaat niet mee"** / "kan niet overgenomen worden". Two verdicts, two registers, warning not success. `T5-stille-drop.png` |
| 4 | review the preview *before* committing (FR-1.3) | **PASS** on the criterion; see defect 1 for the 500 that ends the flow | Round 1's defect 1 is closed on **both** halves, re-driven by me. School content: the preview gives "Wat dit bestand toevoegt" plus a commit control; the commit gives "Wat er toegevoegd is" / "De import is doorgevoerd" and **no** commit control; pressing *Bestand nakijken* again on the same file and modus drops the past-tense panel entirely and shows the **fresh** answer ("Dit bestand verandert niets...", "1 ongewijzigd" three times), committable again. `T1`, `T2`, `T3`. |
| 5 | choose add versus update/overwrite (FR-1.4), warned before an overwrite discards teacher-set `DoelKoppeling` statuses (Art. IV.2), never a silent default | **PASS** | Round 1's defect 2 is closed, verified three ways including a positive control, with the wire read by a route the fix round could not use. Detail below. |
| 6 | read the Op.stap re-import review notice (FR-2.5) from `OpstapHerimportDiff` | **PASS** | The FR-2.5 report renders and survives a re-check. After *Doelen inlezen* ("Wat er veranderd is aan de doelen van discipline 7" / "De doelen zijn ingelezen"), pressing *Op.stap-bestand nakijken* again shows the **fresh** report and offers the import control again: the discarded-report defect is gone (`V2` to `V3`). The notice itself, driven with a file that drops a loaded goal: **"Nazicht bij deze inlezing: 1 doel staat niet meer in dit bestand"**, "Deze doelen zijn niet verwijderd: ze blijven bewaard en gemarkeerd, zodat de jaarplannen intact blijven", `TR7-4`, "geen verwijzingen uit de schoolinhoud". Singular correct throughout. `W1-fr25-review.png` |

## Clause 5 in full — the round-1 repro, plus the control that makes it mean something

Run against real PostgreSQL on a thema created **through this screen**, because on a pre-existing thema the
commit cannot complete at all (defect 1). The statuses are `Manueel`, which `IsMenselijkeBeslissing` treats
identically to `Aanvaard`; they were set through `POST /api/themas/{id}/themadoelen`, which the beheer service
records as `Manueel` by design.

**A — the round-1 repro verbatim, including the concurrent removal at step 3.**

```
STEP 0  TR Bedreigd: DEMO-L3-05=Manueel, DEMO-L3-06=Manueel
STEP 1  Bijwerken + g-bedreigd-herimport.xlsx, Bestand nakijken
        -> "2 koppelingen die jij zelf beslist hebt, staan niet meer in dit bestand"
        -> 1 checkbox, checked = false                                   U1
STEP 2  the reader ticks it                       checked = true         U2
STEP 3  a concurrent session removes both links (DELETE .../themadoelen/{id} -> 204, 204)
        -> themadoelen: (none)
STEP 4  Bestand nakijken again (same file, same modus)
        -> panel GONE, opt-in controls on screen: 0, flag: []            U3
STEP 5  the links exist again (POST .../themadoelen -> 200, 200)
STEP 6  Import doorvoeren -> "De import is doorgevoerd", no alert        U4
OUTCOME DEMO-L3-01=Voorgesteld, DEMO-L3-05=Manueel, DEMO-L3-06=Manueel
        i.e. BOTH teacher decisions SURVIVED. The unfixed build produced (none).
WIRE    voorbeeld  menselijkeBeslissingenVerwijderen=false
        voorbeeld  menselijkeBeslissingenVerwijderen=false
        commit     menselijkeBeslissingenVerwijderen=false
```

**How I read the wire, since the brief asked.** Not in-page. I intercepted with **`Fetch.enable` at the
request stage** and read `Fetch.requestPaused`'s `request.postData`, then parsed the multipart part named
`menselijkeBeslissingenVerwijderen` out of the raw body. That is the byte stream the browser was about to
send, independent of any page state, and it is a different route from the one the fix round used. The fix
round is right that `Network.requestWillBeSent` does not inline a multipart body; `Fetch.requestPaused` does.

**B — the single-user case, no concurrent change.** Tick the box, then press *Bestand nakijken* again with the
panel still on screen: the checkbox comes back **unchecked** (`U5` is byte-identical to `U1`, which is exactly
the claim), the commit sends `false`, and both links survive. Round 1's "even without step 3" complaint is
answered.

**C — the positive control, which is the reason A and B mean anything.** Tick the box and commit straight
away: the wire carries **`menselijkeBeslissingenVerwijderen=true`** and the outcome is `DEMO-L3-01=Voorgesteld`
only, both `Manueel` decisions discarded, exactly as the label ("Verwijder deze 2 koppelingen bij het
doorvoeren. Dat kan je niet ongedaan maken.") promises. **A fix that had simply stopped sending the flag would
have passed A and B and failed C.** `U6`.

## The three claims the brief told me not to take on trust

**1. The 409 discriminator: confirmed, and the third frame is reachable and honest.**
Both real refusals driven through the screen, and both `type` URIs also read straight off the wire with
`curl`: same `title`, different `type`.

| Refusal | `type` | Frame on screen | Server `detail` under it |
| --- | --- | --- | --- |
| MD row, minimumdoel not loaded | `urn:jaarplanner:opstap-import:ontbrekende-minimumdoelen` | "...**De toepassing kan dit bestand nog niet inlezen**, en hieronder staat waarom en wat er eerst moet gebeuren." | "...verwijzen naar minimumdoelen die nog niet ingeladen zijn: 4-99. **Laad eerst de decretale minimumdoelen in.**" |
| same file, wrong discipline | `urn:jaarplanner:opstap-import:code-in-andere-discipline` | "...maar over het bestand als geheel: **het hoort mogelijk bij een ander disciplinenummer dan je opgaf**." | "Deze codes staan al bij een andere discipline: TR7-4 (discipline 7). **Controleer of dit bestand bij discipline 3 hoort.**" |
| unclassifiable (injected) | absent, or the framework's `rfc9110#section-15.5.10` | "...het bestand is als geheel geweigerd en **er is niets gewijzigd**." | whatever `detail` there is, else "De reden is niet doorgegeven." |

Each frame now names the owner of the fix, and round 1's contradiction is gone: `V4`, `V5`, `V6`, `W3`.
A 400 still takes the **ordinary** alert rather than a refusal frame (`V7`): "'999' is geen Op.stap-discipline...".
The neutral frame **is reachable and says nothing false**. I drove it twice, once with the framework's own
status-derived `type` and once with **no `type` at all**, which is the likelier real case: this API's
controller-built 400s carry no `type` (`{title, status, detail}` only). The fix round's stated premise also
holds where the framework writes the body: a real 500 from this API answers
`"type": "https://tools.ietf.org/html/rfc9110#section-15.6.1"`. Two honest limits. On today's server **no real
409 lands on the neutral frame**, because all three `OpstapImportFoutSoort` members are mapped and the new
exhaustiveness test keeps that true, so the branch is defensive and only a replaced body reaches it. And the
duplicated "Er is niets gewijzigd" the fix round says it removed is indeed gone: only the generic frame states
it, and each specific frame leaves it to the server's `detail`.

**2. The copy guard: the calibration claim holds, and I re-derived its numbers independently.**
I wrote my own sweep from scratch, a C# literal tokenizer that skips `//`, `///`, `/* */` and char literals,
handles verbatim/interpolated/raw strings and filters to prose, over the same eleven files on the two import
render paths, plus every `nl.json` leaf, against no em dash / no `Art.` / no `(s)`.

| Tree | backend prose literals | `nl.json` leaves | findings |
| --- | --- | --- | --- |
| `672bdab` (fixed) | **73** across 11 files | **431** | **0** |
| `bc4c880` (unfixed) | 69 across 11 files | 425 | **1**, and only 1: `SchoolcontentImportService.cs:502`, "...themadoelen geankerd (Art. IX.2)." |

**73 and 431 are exactly the fix round's figures, arrived at independently.** I then took the *fixed* xUnit
guard and ran it against the **unfixed** source in a detached worktree at `bc4c880`
(`.claude/worktrees/e113-calib`, since removed): **3 failed / 4 passed**, all three failures being
`Assert.DoesNotContain("Art.")` inside `AssertLeesbaarVoorEenLeerkracht`, on the exact string
"...geankerd (Art. IX.2). 1 genegee...", and one of the three coming from
`Elke_opmerking_van_een_run_is_leesbaar_voor_een_leerkracht`, the "grows by itself" test. At `672bdab` the
whole suite is green. **The guard bites, for the stated reason, and it is the sweep-over-every-opmerking shape
that bites rather than a per-notice assertion.** I did not leave a working tree dirty to prove it (the E4-06
lesson).

**3. The removed commit control: both directions checked, and the distinction is the right one.**

| File | On screen | Commit control |
| --- | --- | --- |
| `e-alles-fout.xlsx`, whose only row is rejected, so `diff.overgeslagen` | "7 problemen in het bestand", "Uit dit bestand wordt niets ingelezen", **"Er is niets om door te voeren. Hierboven staat waarom..."** | **none** (`T6`) |
| `a-schoon.xlsx` re-checked after it was already imported: parses fine, changes nothing | "Bestand gelezen", "Inhoud volledig", "Dit bestand verandert niets aan de thema's... die er al staan", "1 ongewijzigd" three times | **offered** (`T7`) |

So the gate really is `overgeslagen` and not `isLeeg`: a legitimate idempotent re-import keeps its button, and
a file that would write nothing loses it. That is the E3-06 rule applied in the right place.

## Defects

### [MAJOR] 1. Against real PostgreSQL, an import commit that adds a subthema or an activiteit to an existing thema returns 500

**Not introduced by this story.** `git diff --stat origin/main..672bdab -- backend/src` is six files: the new
`Probleemsoorten.cs` plus `Type =` on the Op.stap 409 handler, and product copy in `OpstapImportService`,
`SchoolcontentImportService`, `SchoolcontentRijProbleem` and the template generator. Nothing touches EF or the
Thema/Subthema/Activiteit graph. The defect is pre-existing on `main` and belongs to the import service
(E1-07/E1-08), not to this screen. It is filed here because this screen is the first thing that can reach it,
and because it terminates clauses 4 and 5.

**Minimal repro, on a freshly created and migrated database (`e113iso`) with the demo seed and nothing else:**

```
1. POST /api/themas  {"naam":"TR Beheer","duurWeken":4}                      -> 201
2. POST /api/schoolcontent-import  (modus=Toevoegen, i.e. the commit endpoint)
   one row: Thema "TR Beheer", Subthema "Beheer sub", Klas "L3 derde leerjaar (demo)",
            Activiteit "Beheer act", Type uitstap
   -> 500  {"type":"...rfc9110#section-15.6.1","title":"An error occurred while processing your request."}
```

Server log: `Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException: The database operation was expected to
affect 1 row(s), but actually affected 0 row(s)` at `SchoolcontentImportService.ImporteerAsync` line 119
(`SaveChangesAsync`). The batch it fails on contains `UPDATE activiteiten ... WHERE "Id" = @p5;` and
`UPDATE subthemas ... WHERE "Id" = @p13;`, i.e. **an UPDATE for rows the run is creating**, which is why 0 rows
are affected.

What I established about its shape, by probing rather than guessing:

| Case | Result |
| --- | --- |
| new thema + new subthema + new activiteit, all in one run | **200** |
| existing thema (demo-seeded), add a subthema + activiteit, `Toevoegen` | **500** |
| existing thema (demo-seeded), add a subthema + activiteit, `Bijwerken` | **500** |
| existing thema created via `POST /api/themas`, add a subthema + activiteit | **500** |
| existing thema created by an earlier import, add a *new* subthema | **500** |
| existing thema created by an earlier import, add only a *new* activiteit | **500** |
| existing thema, file changes nothing (`isLeeg`) | **200** |
| **every** preview (`/voorbeeld`) in all of the above | **200**, and the diff is correct |

So it is not demo data and not the `Bijwerken` path: **the importer can create content and can no-op, but it
cannot grow existing content.** From the second import of a school year onward that is the normal case.

**Why no test catches it.** The 13 `toepassen: true` import unit tests run on `UseInMemoryDatabase(...)`
(`SchoolcontentImportOpmerkingenTests.cs:224`), and the EF InMemory provider does not do the relational
rows-affected check Npgsql raises here. The integration suite never posts a second import that adds a child to
an existing thema. 505 + 155 green is therefore fully consistent with this being broken.

**Expected:** the commit succeeds and the added subthema/activiteit are persisted.
**Actual:** 500, nothing written, and the screen says "Het doorvoeren is misgelopen. We kunnen niet zien of er
al iets gewijzigd is...". The copy is right, incidentally: that string is `import.onbeschikbaarNaDoorvoeren`,
the fix round's MINOR 6, and this is the first time it has been seen on screen against a real failure rather
than in a test (`T11`, `T12`).

### [MINOR] 2. Not a defect, recorded so it is not rediscovered: two screenshot pairs are byte-identical, deliberately

`md5sum *.png | sort | uniq -w32 -D` reports two collisions, and in both cases **the identity is the evidence**
rather than a mislabelling. Round 1's mistake was the opposite: three names, one state.

- `T3-hercheck-na-doorvoeren.png` equals `T7-ongewijzigd-toch-doorvoerbaar.png`. The re-check after a commit
  renders exactly the screen a fresh preview of that same unchanged file renders. That is the strongest
  available statement that no trace of the commit panel survives.
- `U1-bedreigd-niet-getikt.png` equals `U5-tweede-check-ontikt.png`. After ticking and re-checking, the screen
  returns exactly to the unticked state. That is the claim.

Both files are kept, under both names, with this note.

## Commands run — my own numbers

| Command | Result | Fix round claimed |
| --- | --- | --- |
| `dotnet test` (unit) with `JAARPLANNER_TEST_POSTGRES` | **505 passed / 0 failed / 0 skipped** | 505, agrees |
| `dotnet test` (integration), same env | **155 passed / 0 failed / 0 skipped** | 155, agrees |
| `corepack pnpm test` | **256 passed / 15 files**, 0 failed | 256, agrees |
| `corepack pnpm lint` | clean, exit 0 | clean, agrees |
| `corepack pnpm build` | clean, built in 5.36s | clean, agrees |
| `dotnet format --verify-no-changes` | clean, exit 0 | clean, agrees |
| the fixed copy guard against `bc4c880` | **3 failed / 4 passed**, all on `Art.` | "exactly the one finding", agrees |
| my own copy sweep, `672bdab` / `bc4c880` | 73 + 431 -> **0** / 69 + 425 -> **1** | 73 + 431, one finding, agrees |

**No disagreement with any figure the fix round reported.** I also did not see the 6-failure integration flake
in this round's run; combined with round 1 and the fix round that is seven runs and one occurrence, so the
worklog's "unreproduced observation" framing is the right one.

## Browser pass

Headless Chrome 151 over the DevTools Protocol from Node 24 (raw global `WebSocket`; no Playwright MCP this
session and no puppeteer in the repo). API on `127.0.0.1:5421`, Vite on `localhost:5422` proxying to it, CDP on
`9441`, all three claimed in `.claude/coordination/claims/` in the `owner:/taken:/why:` shape and released
afterwards. **Dedicated databases** `e113ver` and `e113iso`, each created and migrated from scratch and both
dropped at the end, so no parallel session's data was read or written. Real uploads via
`DOM.setFileInputFiles`; the React-controlled discipline field via `Input.insertText`; error shapes via
`Fetch.fulfillRequest`; request bodies via `Fetch.requestPaused`; the narrow check via
`Emulation.setDeviceMetricsOverride` rather than `--window-size`, which clamps at about 504px here. Waits are
polls on page state, never fixed sleeps.

Measured, on the fullest state of the page (the Art. IV.2 panel open **and** the FR-2.5 review notice open):

- **Text contrast**, alpha-composited up the full ancestor chain, `aria-hidden` and `sr-only` excluded:
  **63 text nodes, 0 below AA at 1440px and 0 below AA at 390px.** Lowest **5.39:1** (`text-ink-zacht` on
  `paper-diep`), the same figure round 1 and the fix round each measured independently. Next: 5.73, 5.75.
  The fix round's new copy is comfortably clear.
- **390px:** `scrollWidth === clientWidth === 390` and **0 elements in `main`** extending past the viewport, on
  both halves and on the combined fullest state. `W2`, `W4`, `X-390-volle-staat`.
- **Zero console errors** across every run in this round.

32 screenshots in `backlog/worklogs/E1-13/round-2/`, md5-checked (two intended identities, see defect 2).

## What must happen next

1. **Defect 1 goes to the import service, not to this screen.** It is `main`'s, it is reachable in three
   clicks, and it needs both the fix in `SchoolcontentImportService`'s handling of children added to an
   already-tracked thema, and an **integration** test on real PostgreSQL that imports twice and adds a subthema
   the second time. A unit test on the InMemory provider cannot fail here, so it must not be the test that
   closes it.
2. **Nothing else is outstanding on E1-13's own six clauses.** If the owner prefers, the story can be closed on
   its criteria with defect 1 filed as its own story against E1-07/E1-08, and E1-13 re-verified after that
   lands. I am not making that call: my verdict is on the flow as a teacher meets it, and today the flow ends
   in a 500.
3. **One thing stayed unverified for want of the environment:** I could not produce a gateway failure *after* a
   successful save, so `import.onbeschikbaarNaDoorvoeren` was only seen on a failure *before* the write
   (defect 1's 500 exercised it, which is closer than a test but still not the post-write case).

---

# E1-13 — Test report (round 3)

**Verdict:** **PASS**
**Mode:** both — unit/integration (xUnit on real PostgreSQL) + browser pass (headless Chrome over CDP)
**Tree verified:** `story/E1-13` at **`bdd5911`**, i.e. *after* `00dc903` merged `origin/main` (E4-06) in. This is
what will actually land.
**Fix round under test:** `4c1fcc3` (code + tests), `46496f5` (worklog + evidence).

Round 1 failed on clauses 4, 5 and 6. Round 2 passed all six on their own terms and failed on one blocking defect
older than the story: a school-content import commit that grows an **existing** thema answered 500 against real
PostgreSQL. That defect is now fixed, the four MINOR findings are met, and **the one thing the fix round could not
get on screen, I did get on screen.** Verdict: PASS.

## The blocking defect — my own round-2 repro, re-run end to end through the screen

Driven in headless Chrome against the real API and a dedicated PostgreSQL database (`jaarplanner_e113gate3`,
created, migrated, used, **dropped**), on ports **5471** (api) / **5472** (vite) / **9471** (CDP), all claimed in
`.claude/coordination/claims/` and released. Fixtures built with `openpyxl` through the single-source column
mapping. Never a dev server in the foreground; every process killed **by PID**.

One distinct thema per modus, so each modus's first file genuinely *creates* and its second file genuinely
*grows*. File 2 adds an activiteit to the **existing** subthema **and** a wholly new subthema to the **existing**
thema: both halves of the round-2 repro in one file.

| Modus | file 1 (creates) | file 2 (grows the existing thema) | console errors |
| --- | --- | --- | --- |
| `Toevoegen` | "Bestand gelezen: Alle rijen zijn zonder problemen gelezen." + "Inhoud volledig: Alles uit dit bestand is overgenomen." | **same two green verdicts, committed**; the diff reads `+ Noten toegevoegd in Gate3-Herfst-T` and `+ Bladeren persen toegevoegd in Gate3-Herfst-T · Bladeren` | **0** |
| `Bijwerken` | idem | **same two green verdicts, committed** | **0** |

**Read back from the database, not off the screen**, because the defect was in the write:

```
thema          | subthema | activiteit
Gate3-Herfst-B | Bladeren | Bladeren persen     <- added by file 2
Gate3-Herfst-B | Bladeren | Bladeren rapen      <- kept from file 1
Gate3-Herfst-B | Noten    | Noten kraken        <- new subthema of an existing thema
Gate3-Herfst-T | Bladeren | Bladeren persen
Gate3-Herfst-T | Bladeren | Bladeren rapen
Gate3-Herfst-T | Noten    | Noten kraken
(6 rows)
```

Both modes: no 500, and the content is actually there. Round 2's defect 1 is closed.
Evidence: `round-3/r3-t-file2-doorgevoerd.png`, `r3-b-file2-doorgevoerd.png`, plus the four preview shots.

## The four claims about the fix — all four verified, the metadata one hardest

### Claim 1: five broken child collections, not the two I hit — **CONFIRMED, measured**

I did not take the table on trust. I **neutralised the fix** in `AppDbContext` (replaced
`property.ValueGenerated = ValueGenerated.Never;` with a no-op carrying a temporary marker), rebuilt, and ran the
sweep. Exactly **5 failed, 4 passed**, and the five are exactly the five named:

| Test | Collection | Neutralised | Fix restored |
| --- | --- | --- | --- |
| `Bestaand_thema_krijgt_een_themadoel` | `Thema.Themadoelen` | **FAIL** `DbUpdateConcurrencyException: expected to affect 1 row(s), but actually affected 0 row(s)` | pass |
| `Bestaand_thema_krijgt_een_subthema` | `Thema.Subthemas` | **FAIL** (same) | pass |
| `Bestaand_subthema_krijgt_een_subdoel` | `Subthema.Subdoelen` | **FAIL** (same) | pass |
| `Bestaand_subthema_krijgt_een_activiteit` | `Subthema.Activiteiten` | **FAIL** (same) | pass |
| `Bestaand_schooljaar_krijgt_een_klas` | `Schooljaar._klassen` | **FAIL** (same) | pass |
| `Bestaand_thema_krijgt_een_doelsuggestie` | `Thema.Doelsuggesties` (owned, composite) | pass | pass |
| `Bestaande_activiteit_krijgt_een_doelkoppeling` | `Activiteit.Doelkoppelingen` (owned, composite) | pass | pass |
| `Bestaand_schooljaar_krijgt_een_sluiting` | `Schooljaar._sluitingen` | pass | pass |
| `Bestaand_jaarplan_krijgt_een_plaatsing` | `Jaarplan._plaatsingen` (E3-04) | pass | pass |

`AggregaatGroeiTests`: **5 failed / 4 passed** neutralised, then **9 passed / 0 failed** restored.
The HTTP theory `Tweede_import_laat_een_bestaand_thema_groeien` also reproduces neutralised: **2 failed**
(`Toevoegen` *and* `Bijwerken`), then **2 passed** restored. So the sweep claim, and the claim that composite owned
keys were never affected, are both measured rather than reasoned.

The tests are honest guards, not green decoration: each loads the parent, adds the child through the domain
method, saves, then **re-reads in a fresh `DbContext`** and asserts the count and contents. The HTTP theory reads
the result back through `GET /api/themas`, not off the diff the same request computed.

### Claim 2: three of the five were invisible because of an explicit `.Add(child)` — **CONFIRMED, with one precision**

Present, and each covers one of the three collections that never surfaced in production:

- `KlasBeheerService.cs:89` — `_context.Klassen.Add(klas)`, for `Schooljaar._klassen`
- `SchoolcontentBeheerService.cs:232` — `_context.Themadoelen.Add(...)`; `:321` — `_context.Subdoelen.Add(...)`
- `SchoolcontentImportService.cs:468` — `_context.Themadoelen.Add(...)`; `:605` — `_context.Subdoelen.Add(...)`

And **absent** where the 500 came from: `SchoolcontentImportService` has **no** `_context.Subthemas.Add` and **no**
`_context.Activiteiten.Add` (grep returns nothing), while it does grow those collections via
`thema.VoegSubthemaToe` (`:718`) and `doelSubthema.VoegActiviteitToe` (`:369`).

**The precision:** `SchoolcontentBeheerService` *does* carry `Subthemas.Add` (`:268`) and `Activiteiten.Add`
(`:353`), so the manual beheer path was never broken either. The claim is exactly true of the **import** path,
which is the path a teacher met as a 500. Nothing in the fix depends on the looser reading.

### Claim 3: fixed model-wide in `OnModelCreating` — **CONFIRMED**

`AppDbContext.OnModelCreating` iterates `modelBuilder.Model.GetEntityTypes()`, then `GetKeys()`, then
`Where(p => p.ClrType == typeof(Guid))`, and sets `ValueGenerated.Never`. It is one rule over the whole model
rather than nine lines, so a **new** child collection cannot reintroduce the defect. No per-configuration
duplicate exists, and no configuration anywhere asks for a store-generated Guid: `ValueGeneratedOnAdd`,
`HasDefaultValueSql`, `gen_random_uuid` and `uuid_generate` all return zero source hits outside `bin/`.

### Claim 4: metadata only, no migration — **CONFIRMED FOUR WAYS.** This is the claim I pushed hardest.

1. **No migration file was touched.** `git diff 4c1fcc3^ 4c1fcc3 -- '*Migrations*'` is empty, so the applied DDL
   is byte-identical to before the fix. Nothing can drift in a file that did not change.
2. **`dotnet ef migrations has-pending-model-changes`** answers *"No changes have been made to the model since the
   last migration."* (exit 0).
3. **I scaffolded a throw-away migration and read it.** `dotnet ef migrations add __E113DriftCheck` produced
   `Up()` and `Down()` that are **completely empty**: zero schema operations, no column, no default, no
   constraint, no index. The only snapshot change was the removal of **11 `.ValueGeneratedOnAdd()` lines** and
   nothing else (`1 file changed, 11 deletions(-)`). I then ran `dotnet ef migrations remove` and restored the
   snapshot with `git checkout`; the tree is clean and `AppDbContextModelSnapshot.cs` is untouched.
4. **A database migrated from scratch.** Fresh `jaarplanner_e113gate3`, all 11 migrations applied, then
   `information_schema.columns`: **all 33 `uuid` columns are `uuid NOT NULL` with an empty `column_default`.**
   The single exception is `klassen.SchooljaarId`, whose zero-guid default comes from migration
   `20260728150734_JaarplanEnSchooljaarKlassen.cs:47`: pre-existing, an FK rather than a key, and untouched.

So: no schema diff, no migration, no data-model change. **A safe change, not silent drift** — including under
E4-06's freshly merged work, which the 167-test integration run exercises on this same tree.

**One observation, not a defect.** The committed snapshot still declares `.ValueGeneratedOnAdd()` on those 11 Guid
keys, so it is now stale in *metadata* relative to the model. The consequence for the database is nil, proven by
the empty `Up()`/`Down()` above; the only effect is that whoever scaffolds the next migration will see those 11
removals ride along in the snapshot rewrite. Normal EF behaviour, worth knowing, nothing to fix. The two
`ValueGeneratedOnAdd` entries that remain are the `bool` defaults (`NietMeerInOpstap`, `Vergrendeld`), correctly
left alone because the loop filters on `Guid`.

## Spot-checks on the six clauses — fix round 2 broke none of them

Not re-derived, since round 2 established all six including the clause-5 positive control. Spot-checked because
the fix touched both importers, `routes.ts`, `AppDbContext` and four services.

### MINOR 4 — the one fix that changed **server** behaviour. Checked in **both** directions.

The guard widened to `inkomend.Count == 0`, dropping `&& bestaand.Count > 0`, so it changes when the Op.stap
commit control is withheld. Both cases driven on discipline **7**, which held **0** doelen, so each really is a
*first* import.

**(a) A first *empty* import now reads as a skip.** A header-only workbook gives the warning verdict
*"Inhoud volledig: 1 opmerking bij dit bestand. Hieronder staat welke."*, and the notice in the **zero form**,
verbatim on screen:

> Er zijn geen geldige leerplandoelen ingelezen voor discipline 7, dus is er niets toegepast. **Er staan nog geen
> doelen voor deze discipline, dus er verandert ook niets.** Mogelijk is het bestand leeg, onvolledig of hoort het
> bij een andere discipline.

plus *"Uit dit bestand wordt niets ingelezen."* and *"Er is niets om in te lezen. Hierboven staat waarom."*, and
the button list is exactly `["Bestand nakijken","Op.stap-bestand nakijken"]`: **no "Doelen inlezen"**. Zero
console errors. `round-3/r3-op-minor4-leeg-full.png`

**(b) A normal first import of a file *with* rows is unaffected.** Same empty discipline 7, a two-row file:
**two green** verdicts (*"Bestand gelezen"* plus *"Inhoud volledig: Dit bestand kan volledig ingelezen worden."*),
*"2 toegevoegd"* listing `G3-A1` and `G3-A2`, and the live **"Doelen inlezen"** control. The widened condition did
**not** swallow the normal path. `round-3/r3-op-minor4-vol-g-full.png`
*(A G-only file, deliberately: an MD-concorded row trips the E1-12 minimumdoelen precondition, which is MINOR 5's
territory and left to E1-12 by the brief.)*

xUnit backs both forms: `OpstapImportOpmerkingenTests` carries `[InlineData(0, "Er staan nog geen doelen voor deze
discipline")]`, `[InlineData(1, "Het bestaande doel blijft ongewijzigd.")]` and
`[InlineData(3, "De 3 bestaande doelen blijven ongewijzigd.")]`.

### MINOR 1 — the clause is gone from the neutral 409 frame

`import.opstap.geweigerdAlgemeenUitleg` now reads *"Dit gaat niet over de rijen in het bestand: het bestand is als
geheel geweigerd."*, and the diff confirms `en er is niets gewijzigd` was deleted. The test asserts the **rendered
panel**, not the key, so restoring the clause fails even after a rename.

I did drive a real 409 on screen, and it rendered the **system** variant (`geweigerdSysteemUitleg`), not the
neutral one: *"De doelen zijn niet ingelezen"* / *"Dit gaat niet over de rijen in het bestand. De toepassing kan
dit bestand nog niet inlezen..."* plus the server detail about the missing minimumdoelen. Its "Er is niets
gewijzigd aan de doelen die al in de toepassing staan" is that case's own true statement, since a real refusal
rolls back, and it is not the unconditional claim MINOR 1 removed. `round-3/r3-op-minor1-409-full.png`

### MINOR 2 — **I got it on screen.** This is the item the fix round could not.

The fix round verified this sentence over real HTTP but not in a browser, because Chrome wedged twice. It renders.
Demo thema `Water` (2 `Manueel` themadoelen) plus a file bringing 3 new codes, modus `Bijwerken`, warning panel:

> Thema 'Water' houdt 2 themadoelen die er al staan, en dit bestand brengt 3 nieuwe codes aan. Samen is dat meer
> dan de 3 themadoelen die een thema kan hebben. 2 themadoelen zijn daarom overgeslagen: DEMO-L3-02, DEMO-L3-03.
> De bezette plaatsen kan dit bestand niet vrijmaken: haal eerst een themadoel weg bij het thema zelf, of duid bij
> het doorvoeren aan dat koppelingen die niet meer in het bestand staan mogen verdwijnen.

Verbatim, in the warning register, with the triangle icon beside the colour (Art. XII: never colour alone).
`round-3/r3-sc-minor2.png`

**And I checked the advice is actionable, which was MINOR 2's entire point.** The sentence tells the reader to tick
something at commit time; in that exact state the control is present and labelled *"Verwijder deze 2 koppelingen
bij het doorvoeren. Dat kan je niet ongedaan maken."*, beside a live *"Import doorvoeren"*. The advice points at a
real, visible control, not at a described one.

### MINOR 3 — the guard and its blind spot

`OpstapImportOpmerkingenTests` exists (4 `Fact`/`Theory` attributes) and its doc comment names the exact sentence
that escaped the three predicates. Covered by the 513.

### 390px

On the fullest state (the MINOR 2 warning plus the full diff): `scrollWidth === clientWidth === 375` at
`innerWidth 390` (a 15px scrollbar), and **0 elements in `main`** extending past the viewport, measured via
`Emulation.setDeviceMetricsOverride` because `--window-size` clamps at about 504px here.
`round-3/r3-390px-minor2.png`

## Commands run — my own numbers, on `bdd5911`

| Command | My result | Orchestrator's figure | Verdict |
| --- | --- | --- | --- |
| `dotnet format --verify-no-changes` | clean, exit 0 | clean | **confirmed** |
| `dotnet test` UnitTests | **513 passed / 0 failed / 0 skipped** (24s) | 513 | **confirmed** |
| `dotnet test` IntegrationTests (`JAARPLANNER_TEST_POSTGRES` set) | **167 passed / 0 failed / 0 skipped** (3m 1s) | 167 | **confirmed** |
| `corepack pnpm test` | **272 passed / 15 files** (34.25s) | 272 / 15 | **confirmed** |
| `corepack pnpm lint` | clean, exit 0 | clean | **confirmed** |
| `corepack pnpm build` | clean, built in 14.22s | clean | **confirmed** |
| `dotnet ef migrations has-pending-model-changes` | no changes since the last migration | no changes | **confirmed** |
| `dotnet ef migrations add __E113DriftCheck` then `remove` | empty `Up()`/`Down()`; snapshot delta = 11 metadata lines | n/a (my addition) | metadata only |
| `dotnet ef database update` on a fresh DB plus `information_schema` | 33 uuid columns, all `NOT NULL`, all default-free | n/a (my addition) | no schema diff |
| `AggregaatGroeiTests` **neutralised** | **5 failed / 4 passed** | n/a (my addition) | sweep claim measured |
| `Tweede_import_laat_een_bestaand_thema_groeien` **neutralised** | **2 failed** (both modi) | n/a (my addition) | the repro is a real guard |

**Every number the orchestrator gave is confirmed. I contradict none of them.**
Zero skipped tests in both backend assemblies, so nothing hid behind an absent database.

## Evidence

**13 screenshots in `backlog/worklogs/E1-13/round-3/`, md5-checked, all 13 distinct.** I captured 15 and kept 13. Dropped: a second
capture of the MINOR 4 empty state that was byte-identical to `r3-op-minor4-leeg-full.png` (the same state reached
twice by two independent scripts, so citing it would have dressed one observation up as two), and one shot of a
mid-request "Bezig met nakijken..." state from an aborted probe, which evidences no claim I make here.

Key shots: `r3-t-file2-doorgevoerd.png` and `r3-b-file2-doorgevoerd.png` (the round-2 defect, now committing in
both modi), `r3-sc-minor2.png` (MINOR 2 on screen at last), `r3-op-minor4-leeg-full.png` and
`r3-op-minor4-vol-g-full.png` (MINOR 4 in both directions), `r3-op-minor1-409-full.png`, `r3-390px-minor2.png`.

**Zero console errors** in every browser run this round.

## Housekeeping

- **Tree is clean** at `bdd5911`, apart from the two things I am supposed to add: this report and the 13
  screenshots in `round-3/`. The orchestrator holds `branch-story-E1-13` and does the committing.
- The neutralise experiment was restored with `git checkout`; a grep for the temporary marker returns **0** and
  `ValueGenerated.Never` is back at `AppDbContext.cs:115`. The scaffolded migration was removed and the snapshot
  restored. `git status --short` is empty and `git ls-files --others --exclude-standard` is empty.
- Scratch database `jaarplanner_e113gate3` **dropped**; no `e113` or `groei` database remains.
- Ports 5471/5472/9471 released, verified with `netstat`; every process killed **by PID**, never by image name.
  Claims `suite-agent-a8b6127bb7255ef99`, `db-e113gate3` and `ports-5471-5472-9471` released.
- One environment hiccup, retried once as policy says: a `dotnet test` build failed with `MSB3027` because a
  `testhost` from my previous run still held `Jaarplanner.Infrastructure.dll`. The PID was already gone by the time
  I looked, so it was a transient file lock rather than a live process, and not a product defect; the re-run passed.

## What stayed unverified

**One sentence, plainly:** the *neutral* 409 frame (`geweigerdAlgemeenUitleg`) was never rendered in my browser,
because every real 409 I could trigger on this data renders the system or discipline variant instead, so that one
string rests on the Vitest assertion over the rendered panel rather than on a screenshot.
