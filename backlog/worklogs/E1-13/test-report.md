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

**Repro** (`N1-finding6-stille-vernietiging.png`, `M2-finding6-optin-blijft.png`):

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
`D1-modus-flip-verouderd.png` (staleness), `E1-bedreigd-1440.png` and
`F1-bedreigd-niet-getikt-doorgevoerd.png` (**clause 5** happy path), `G1-opstap-409.png` (**the 409**),
`G3-opstap-review.png` (**clause 6**), `G5-opstap-400.png`, `H1-een-probleem.png` (singular),
`H3-400-detail.png`, `H4-opstap-reword.png` (**`vereistReview` not keyed on**), `I1-foutenvelop.png`,
`K-390-vol.png` (390px), plus the three defect reproductions `L1-finding1-schoolcontent.png`,
`M1-finding1-opstap.png` and `N1-finding6-stille-vernietiging.png`.

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
