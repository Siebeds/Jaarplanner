# E1-13 — Import-UI: upload, preview & per-row foutmeldingen op het scherm

## Build round 1 — the two import screens FR-1 and FR-2.5 never had

- **FR / Article:** FR-1.1, FR-1.2, FR-1.3, FR-1.4, FR-1.5 (the display halves deferred from E1-07/E1-08/E1-09),
  FR-2.5's review notice (deferred from E1-05, made reachable by E1-15). Art. II.3 (as amended 2026-07-30),
  Art. II.5, Art. III.1/III.3/III.4, Art. IV.2, Art. VII.0/VII.1, Art. IX.2, Art. X.3, Art. XII. ADR-0017,
  ADR-0021, `ui-ux-approach.md` §3.
- **Branch:** `story/E1-13`, off `main` at `0de4851`. Four commits, one per boundary.

### Files changed

Frontend, new (`frontend/src/features/import/`):

| Path | Why |
| --- | --- |
| `ImportPagina.tsx` | The `/import` screen: two stacked sections, school content first and dominant. |
| `Schoolcontentimport.tsx` | Clauses 1-5: upload, sjabloon, modus, the two verdicts, the preview, the commit, and the Art. IV.2 opt-in. |
| `Schoolcontentdiff.tsx` | What an import does per level; `Ongewijzigd` collapsed to a count. |
| `Opstapimport.tsx` | Clause 6: the curriculum (re-)import, its refusals, and the English row diagnostics as secondary detail. |
| `Opstapdiff.tsx` | The FR-2.5 review report and the run-scoped disappearance notice. |
| `Verdicten.tsx` | The signature element: two verdicts that cannot be collapsed, enforced by the prop type. |
| `Bestandkiezer.tsx` | The file control, shared. A native `<input type="file">`, not a dropzone. |
| `Serverberichten.tsx` | The single place server-generated Dutch is rendered (per-row problems, opmerkingen). |
| `types.ts` | Both wire contracts, with the traps documented on the fields that carry them. |
| `api.ts` | Five calls plus the sjabloon URL. |
| `useImport.ts` | Four mutations; a commit invalidates every query. |
| `testdata.ts` | Fixtures and a fetch fake that records the parsed multipart body of every upload. |
| `Schoolcontentimport.test.tsx` | 28 tests. |
| `Opstapimport.test.tsx` | 13 tests. |

Frontend, changed:

| Path | Why |
| --- | --- |
| `frontend/src/lib/api.ts` | The transport blockers: no `Content-Type` on a `FormData` body; `ApiError` carries `detail`/`title`; a new `apiUrl` for the binary download; and the doc comment's false claim about backend messages replaced. |
| `frontend/src/lib/api.test.ts` | New: 10 tests over the header branch and all three error envelopes. |
| `frontend/src/App.tsx` | `/import` renders `ImportPagina` instead of `BinnenkortPagina`. |
| `frontend/src/app/routes.ts` | `/import` flips to `isGebouwd`, with a note on what is and is not built behind it. |
| `frontend/src/App.test.tsx` | Its unbuilt-screen assertion derives the route from `NAVIGATIE` instead of hard-coding `/import`. |
| `frontend/src/i18n/nl.json` | ~110 new keys under `import.*` plus `koppelingNiveau.*`; `binnenkort.import` deleted rather than left dead. |
| `frontend/src/i18n/catalogus.test.ts` | One exemption for `import.telling`, with a checkable reason. |

Backend, changed (all of it in service of the screen):

| Path | Why |
| --- | --- |
| `Infrastructure/SchoolcontentImport/SchoolcontentRijProbleem.cs` | Derived `KolomLabel` from the single-source column mapping, so the offending column can be named on screen without a second copy of the layout in the frontend (Art. III.3). Its doc comment's Art. II.3 claim corrected. |
| `Infrastructure/SchoolcontentImport/SchoolcontentImportService.cs` | Three `opmerkingen` rewritten: em dashes removed (Art. II.5), a `(s)` plural dodge replaced by two real Dutch sentences, and "Art. IX.2" moved out of a teacher's sentence into a comment (Art. II.3). ⚠️ **Three of four.** There are **four** reachable notices in this class and `PasThemadoelCapToe`'s still carried "(Art. IX.2)" after this round: antagonist MAJOR 4, fixed in fix round 1 below. |
| `Infrastructure/SchoolcontentImport/ClosedXmlSchoolcontentTemplateGenerator.cs` | The `Klas` example value lost its em dash: it is copied into a cell that must match a stored `Klas.Naam`, so it is product data (Art. II.5). |
| `UnitTests/Schoolcontent/ClosedXmlSchoolcontentParserTests.cs` | +2 tests: the column label, and its absence plus `rijNummer == 0` on a file-level problem. |
| `UnitTests/Schoolcontent/SchoolcontentImportOpmerkingenTests.cs` | New: 4 tests pinning the three notices as readable Dutch, including both grammatical forms of the skipped-code count. ⚠️ **"the three notices" is wrong: there are four.** Corrected in fix round 1, where the guard stopped being applied notice by notice. |

Docs: seven browser-check screenshots in `docs/ux/wireframes/e1-13-*.png`.

### Key decisions

1. **The two verdicts are structural, not conventional.** `Verdicten` takes `readonly [Verdict, Verdict]`, a
   tuple of exactly two. A `Verdict[]` prop would let the next author pass one element and lose clause 3 without
   touching that file. Both verdicts are always stated, each from its own response field, each with its own icon,
   word and count. `isVolledigVerwerkt` is deliberately **not** recomputed from `isBestandGeldig` even though the
   server's definition makes the second imply the first: recomputing is how a UI starts disagreeing with a payload.
2. **A third branch on the second verdict, which the brief did not name.** `isVolledigVerwerkt` is false whenever
   the file did not parse cleanly, even with zero `opmerkingen`: the rejected rows *are* the content that did not
   land. Rendered from the opmerkingen count alone that reads "0 stukken inhoud", which is false and
   ungrammatical. It has its own sentence.
3. **Tense follows `toegepast`.** A preview says content *can* be taken over; a commit says it *is*. The diff
   heading switches likewise ("Wat dit bestand toevoegt" → "Wat er toegevoegd is"). Only the verdict *labels* are
   tenseless, because they are topics rather than assertions: a label reading "Niets viel weg" could not head the
   verdict that something did.
4. **The destructive choice lives in the result** (Art. IV.2). Rendered only when `bedreigdeBeslissingen` is
   non-empty, unchecked, with the count and the consequence in its own label, directly above the commit button.
   Two consequences that took working out:
   - **the preview always sends `menselijkeBeslissingenVerwijderen: false`.** With the flag on the server
     *discards* the threatened links instead of reporting them, so `bedreigdeBeslissingen` comes back empty and
     the preview could no longer state what is at stake;
   - **ticking the box therefore does not re-run the preview.** A re-run would return an empty list and unmount
     the very block the checkbox refers to: a control that erases its own justification. Pinned by a test that
     asserts no request is made on tick.
5. **Staleness.** Changing the file or the modus **drops** the outcome rather than disabling the commit button,
   and both inputs freeze while a request is in flight so an answer can never arrive for inputs that have moved
   on. A ticked opt-in resets with the preview it belonged to, because it counted a list that no longer exists.
   Verified in a real browser (`e1-13-verouderd-voorbeeld-weg-1440.png` shows the result block empty after a
   modus change).
6. **No dropzone.** Dragging already means one thing in this app: moving a thema to a period (E3-07). One
   gesture, one meaning. The control is the **native** `<input type="file">` restyled through the `file:`
   variants, not a button clicking a hidden input, because the native control is already a labelled,
   keyboard-reachable form control and hiding it means re-implementing all of that.
7. **`Modus` is pre-selected as `Toevoegen`**, a deliberate departure from E3-04's "no pre-selected answer" rule
   and recorded as one in the code. There, the default was the outcome with no signal at all; here it is the
   non-destructive option *and* the server's own default, and on a first-ever import the two modes do the same
   thing. Each option states what it does to existing content in its own label rather than in prose above.
8. **The 409 gets its own frame, and the Dutch `detail` is rendered.** The endpoint answers 409 for both "the
   application is not ready for this file yet" (the E1-12 gap) and "this file belongs to another discipline", and
   the two are **not distinguishable structurally**: same status, same `Title`. Rather than string-matching Dutch
   prose, the refusal gets one panel headed as a system state, framed by an `nl.json` sentence saying it is not
   about the rows, with the server's `detail` below it because that is where the named next step and the specific
   missing refs live. A 400 keeps the ordinary alert: a wrong discipline number really is the uploader's to fix.
   Verified against a real 409 from a real MD-concorded file (`e1-13-opstap-409-1440.png`).
9. **`diff.vereistReview` is not rendered at all**, and this is the one place I overrode a hand-off. E1-15
   offered it as "the flag to key the notice on"; the story's own second trap forbids exactly that, and there is a
   second reason the trap does not mention: `vereistReview` is *also* true for a mere reword, so a notice about
   disappearances keyed on it fires when nothing disappeared. The notice is derived from
   `verdwenen`/`verdwenenMaarGekoppeld`, scoped to the run in front of the reader, and worded "bij deze
   inlezing". Nothing is persisted and no acknowledgement was invented (see the open question below).
10. **`problemen[].reden` stays English**, under a Dutch heading that says these are technical details for
    whoever maintains the tool and explicitly not the reader's fault, with `lang="en"` so a screen reader switches
    voice. It is in a **separate component** from the school-content problems on purpose: one component serving
    both would have to lie about one of the two audiences.
11. **`KolomLabel` was added to the backend rather than a label table to the frontend.** FR-1.2 wants the
    offending column named, and the wire only carried the enum member name. A frontend enum-name→label map would
    have been a second copy of the Excel layout outside `SchoolcontentKolommen`, i.e. Art. III.3 broken from the
    outside. It is a derived property, so no construction site changed.
12. **Colour.** Petrol for a good verdict, the existing `suggestie-geweigerd` for a file fault (the hue every
    failure alert in this app already uses), `attentie` for a warning, and **no hue at all** for
    `Toegevoegd`/`Bijgewerkt`/`Ongewijzigd` — a fourth categorical set would compete with what Art. XII already
    spends colour on. Those three carry a sign, a weight and the word instead. Mono for row numbers and
    leerplandoel codes.
13. **The audience is stated, not enforced.** `routes.ts` already records Import as directie-only
    (`magBeheerder`) and nothing filters on it, because the API is unauthenticated (E6-01/E6-02, gated by E7-11).
    The Op.stap section says in visible text that it is beheerderswerk. A client-side gate over an open endpoint
    would be theatre.
14. **The Op.stap form sits in a `bg-card` block inside the recessed section, for a measured reason.**
    `index.css` documents `--input` as 3.40:1 on card and 3.21:1 on paper *and* instructs the next author to
    measure both surfaces. On `paper-diep` it measures **3.01:1** in a real browser: it clears SC 1.4.11's 3:1
    floor by one hundredth, which is the "too thin to cite as evidence later" case E7-10 recorded. The controls
    went back on card; all three now measure 3.40:1.

### Tests added

Backend (6 new): `Names_the_offending_column_in_Dutch_from_the_single_source`,
`Leaves_the_column_label_null_for_a_file_level_problem` (also pins `rijNummer == 0`), and
`SchoolcontentImportOpmerkingenTests` — `Leeg_bestand_meldt_in_leesbaar_Nederlands_dat_er_niets_gebeurde`,
`Onbekende_codes_worden_grammaticaal_gemeld_bij_een_en_bij_meer` (a theory over 1 and 2),
`Onbekende_klas_meldt_wat_er_misging_en_wat_de_leerkracht_kan_doen`. Each notice is asserted to contain no em
dash, no `Art.` reference and no `(s)`.

Frontend (51 new across three files), pinning by clause:

- **Transport** (10): no `Content-Type` for `FormData`, still set for JSON and for a GET; `detail`/`title` off
  both ProblemDetails envelopes; a bare English string body yields **no** `detail`; empty/HTML/quoted-string
  bodies do not throw; a blank `detail` is dropped; the status-only message is unchanged.
- **Clause 1** (4): the sjabloon is a real `<a download>` with the right href; the upload is multipart with no
  `Content-Type`; nothing can be checked without a file; the chosen filename is named back.
- **Clause 3** (4): both verdicts present with **exactly two** list items even when all is well; the
  parsed-clean-but-dropped-content case reads as a warning; the no-opmerkingen branch has its own sentence; the
  past tense appears only after a commit.
- **Clause 2** (2): row number + column label rendered, and **row 0 never printed**; opmerkingen rendered
  separately from problemen.
- **Clause 4** (4): no commit control before a preview; the commit hits the committing endpoint and then offers
  no second commit; 40 unchanged thema's collapse to a count; a changed subthema names its klas and leeftijd.
- **Clause 5** (7): `Toevoegen` pre-selected; the chosen mode travels; no checkbox when nothing is threatened;
  every threatened decision named with its status and the opt-in unchecked; `false` travels on the wire unless
  ticked; ticking makes no request and sends `true`; the preview always sends `false`.
- **Staleness** (4): the preview is dropped on a file change and on a modus change; a ticked opt-in resets with
  it; the inputs freeze while a request is in flight (against a fake that never settles, since otherwise the
  state is unobservable).
- **Failures** (3): the Dutch `detail` of a 400 is shown; a 400 with no usable body falls back to `nl.json` and
  shows nothing of the body; a 500 says the tool is unavailable and does not blame the file.
- **Clause 6** (13): the two sections are separate and the audience is named; both a discipline number and a file
  are required; the multipart body carries both; the outcome drops on a discipline change; commit only after a
  check; added and changed goals with old→new values while 120 unchanged ones are only counted; the disappearance
  notice is scoped to the run and clears on a new file; **no** notice for a run that only added goals even with
  `vereistReview` true; the English `reden` untranslated with `lang="en"` under its Dutch framing; the 409 as a
  system state apart from the row problems; a 409 with no reason; a 400 in the ordinary alert; a 500 blaming
  nobody.
- **Accessibility** (3): axe on the fullest state of each flow, and a check that the live region wraps the
  verdicts and holds no controls.

### Gates

**Backend** (from `backend/`):
- `dotnet build` — succeeded, 0 warnings, 0 errors.
- `dotnet format --verify-no-changes` — clean.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` against local PostgreSQL 17
  (`Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable`,
  the value `docs/dev-setup-secrets.md` documents): **502 unit passed / 0 failed / 0 skipped** and
  **152 integration passed / 0 failed / 0 skipped**.
  > ⚠️ **These two numbers are pre-merge snapshots and they are not the tree anyone will review.** They were
  > taken before `7193a45` merged `origin/main` in; the merged tree at `c236a68` is **502 + 153**, reproduced
  > independently by both gate agents. Fix round 1 then took it to **505 + 155**. Left in place rather than
  > overwritten, because the story's own record of what it measured when is part of the audit trail; corrected
  > here so the repo does not hold two figures that disagree with no note saying which is current.
  > **Recorded because it matters for how much the gate proves:** the *first* run of the integration suite
  > reported **6 failed** (among them `Doel_met_concordantie_naar_een_onbekend_minimumdoel_geeft_409_en_wijzigt_niets`,
  > expecting `Conflict` and getting `InternalServerError`). The identical command re-run immediately afterwards
  > came back 152/0/0, twice. The likeliest cause is contention on the one local PostgreSQL instance: a parallel
  > session is active in this repo and the two assemblies also run concurrently. It is **not** a diagnosis, and
  > the failure was in Op.stap import code this story did not touch. Flagged rather than explained away.
  > ⚠️ **Unreproduced.** The test-runner ran the integration suite twice and did not see it; fix round 1 ran the
  > full suite three more times (once mid-round, twice at the end) and did not see it either. Six runs, one
  > occurrence, on the run that followed a parallel session's activity. Restated as **an unreproduced
  > observation**, not a known flake: nobody has since produced the failure, and nobody has shown it cannot
  > happen. If it recurs, the thing to capture is which other process held the database at that moment.

**Frontend** (from `frontend/`, via `corepack pnpm`):
- `pnpm test` — **241 passed / 15 files** (was 197 / 13 before this story; 174 / 12 at E1-16's close).
  > ⚠️ **Also a pre-merge snapshot.** The merged tree is **243 / 15**, and fix round 1 takes it to **256 / 15**.
- `pnpm lint` — clean, no output.
- `pnpm build` — clean.
  > **Worth knowing for every future story:** `pnpm lint` is `eslint . --max-warnings 0 && tsc --noEmit`, and
  > the root `tsconfig.json` has `"files": []` with only project references, so **the `tsc --noEmit` half checks
  > nothing at all**. Type errors surface only from `pnpm build` (`tsc -b`). This story hit it: lint passed green
  > on a file with three type errors that the build then rejected. Not fixed here (changing the lint script is
  > not this story's business) but it means "lint clean" is a weaker claim in this repo than it reads.

### Browser check — done, against the real API and PostgreSQL

No Playwright in this repo, so headless Chrome was driven over the DevTools Protocol from Node. API on
`127.0.0.1:5284` (`Demo__Seed=true`, real PostgreSQL 17, the schooljaar already existed so the seeder skipped),
Vite on `localhost:5183` proxying to it. Fixtures were built with `openpyxl` from the **downloaded sjabloon**, so
the round trip FR-1.5 → FR-1.1 is what was actually exercised.

What was driven and seen:

1. **A clean file, previewed and committed** (`e1-13-doorgevoerd-1440.png`). Both verdicts good; the tense
   flips from "kan overgenomen worden" to "is overgenomen"; the diff heading from "Wat dit bestand toevoegt" to
   "Wat er toegevoegd is"; no commit control after the commit.
2. **A file with three row problems** (`e1-13-rijproblemen-1440.png`): "rij 3 · kolom Klas", "rij 4 · kolom
   Thema duur (weken)", "rij 4 · kolom Type", each with the server's Dutch sentence. A file-level problem
   (`rijNummer` 0) renders as "hele bestand" — checked separately via the header-less workbook.
3. **Staleness** (`e1-13-verouderd-voorbeeld-weg-1440.png`): after switching to `Bijwerken` the entire result
   block is gone, not merely disabled.
4. **The Art. IV.2 case** (`e1-13-schoolcontent-bedreigd-1440.png`, and at 390px). Set up for real: import a
   thema with two themadoel codes, then `update themadoelen set status='Aanvaard'/'Manueel'` on those two rows
   (the CRUD surface for a themadoel status does not exist yet), then re-import the same thema without the codes
   in `Bijwerken`. Both decisions are named with their code, content, level and status badge; the checkbox is
   unchecked; the label carries the count and "Dat kan je niet ongedaan maken."
5. **The Op.stap 409** (`e1-13-opstap-409-1440.png`) from a real MD-concorded file: "De doelen zijn niet
   ingelezen" / "Dit gaat niet over de rijen in het bestand…" / the server's "Laad eerst de decretale
   minimumdoelen in."
6. **A real Op.stap re-import review** (`e1-13-opstap-review-1440.png`): 1 added, 50 disappeared of which 14
   still linked (from the development database's own DEMO-L3-* and NED-CHK-* rows), and the two English row
   diagnostics under their Dutch framing.

Measured, not assumed:

- **Contrast**, alpha-composited up the ancestor chain: **159 text nodes across the two fullest states, 0 below
  the AA threshold.** Lowest values: **4.88:1** (the ✕ glyph and "Bestand gelezen:" in `suggestie-geweigerd` on
  its own 10% tint over `paper-diep`, 14px/400 and 14px/600), 5.08:1 (an `Aanvaard` badge), 5.39:1 (`ink-zacht`
  on `paper-diep`). The good verdict measures 7.96:1, the `attentie` warning panel 9.39:1, mono codes 14.58:1.
- **Non-text contrast** (SC 1.4.11) of the three form-control borders: **3.40:1** each, after the fix described
  in decision 14. Before it, the two Op.stap controls measured 3.01:1.
- **390px**: `scrollWidth === clientWidth === 390`, and **no element** extends past the viewport, checked both
  in a 390px iframe and in a full-page render at that width.
- **Keyboard focus**: Tab was driven with real `Input.dispatchKeyEvent` (a programmatic `.focus()` does not match
  `:focus-visible`, which made the first attempt read as "no ring anywhere" — inconclusive, not a failure). Every
  focusable control reports `:focus-visible` true with the app's own 2px petrol ring and a paper offset.

### Self-check vs acceptance criteria

| Clause | Met? | Evidence |
| --- | --- | --- |
| 1. Download the sjabloon (FR-1.5) and upload a filled `.xlsx` (FR-1.1) | Yes | `<a href download>` to `…/sjabloon`, asserted by test; the browser check downloaded it, filled it and uploaded it back. |
| 2. Read the per-row problems (row + offending column) and the opmerkingen (FR-1.2) | Yes | Two separate blocks with separate registers; `kolomLabel` added server-side so the column is named from the single source; "rij 0" never printed. Seen on screen. |
| 3. `isBestandGeldig` and `isVolledigVerwerkt` never collapsed | Yes | A tuple of exactly two verdicts by type; four tests including the parsed-clean-but-lost-content case. |
| 4. Review the preview before committing (FR-1.3) | Yes | No commit control exists before a preview; the preview is dropped when its inputs change. |
| 5. Choose add vs update/overwrite (FR-1.4), warned before an overwrite discards teacher decisions (Art. IV.2), never a silent default | Yes | Radios with per-option consequences, `Toevoegen` pre-selected; the opt-in appears only when something is threatened, unchecked, with the count and consequence in its label; `false` travels on the wire unless ticked. |
| 6. Read the Op.stap re-import review notice (FR-2.5) | Yes | The whole second section, verified against a real re-import with 50 disappearances and against a real 409. |

**What this does *not* close.** FR-2.1 still fails: a real per-discipline Op.stap file mixes MD and G rows and is
refused with a 409 until **E1-12** loads the decreed minimumdoelen. This story makes that refusal legible instead
of mysterious; it does not remove it. E1-03/E1-04 stay `[~]` and M1 stays unreached.

### For the test-runner

Unit: `cd frontend && corepack pnpm test` (from Bash, not PowerShell) and `cd backend && dotnet test` with
`JAARPLANNER_TEST_POSTGRES` set. Please re-run the integration suite at least twice given the flake noted above.

Browser (there is no Playwright; headless Chrome over CDP works, see the note in the memory about
`--window-size` clamping):

1. `cd backend && ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS=http://127.0.0.1:<port> Demo__Seed=true dotnet run --project src/Jaarplanner.Api --no-launch-profile`
2. `cd frontend && VITE_API_PROXY_TARGET=http://127.0.0.1:<port> corepack pnpm vite --port <port2>` — note Vite
   binds to `localhost`, not `127.0.0.1`.
3. Go to `/import`.
4. **School content.** Click *Sjabloon downloaden*; open the file; set the `Klas` cell to a klas that exists
   (`select "Naam" from klassen;` — the demo data has `K3 groen (demo)` and `L3 derde leerjaar (demo)`) and clear
   the `Themadoelen`/`Subdoelen` cells. Upload it, press *Bestand nakijken*, then *Import doorvoeren*. Watch the
   tense change. Then break a row (blank the `Klas` cell on a second row, put `vijf` in a duration, put
   `zwemmen` in `Type`) and check again: three problems with row and column. Switch the modus and confirm the
   whole result disappears.
5. **The Art. IV.2 case** needs one SQL step, because no UI can set a themadoel status yet: import a thema with
   two themadoel codes that exist (`select "Code" from leerplandoelen limit 5;`), then
   `update themadoelen set status='Aanvaard' where leerplandoel_code='<code>';` for both, then re-import the same
   thema **without** those codes in `Bijwerken` and preview. Confirm the checkbox is unchecked, that the network
   request for the preview carries `menselijkeBeslissingenVerwijderen=false`, and that ticking it makes **no**
   request while the commit then carries `true`.
6. **Op.stap.** Build a 13-column A-M workbook (`Doelsoort, LfMD, nrMD, MD, Code, Jaar/fase, Domein, Subdomein,
   Cluster, Leerplandoel, Voorbeelden, Toelichting, Woordenschat`). One `MD` row with `LfMD=K-`, `nrMD=12`
   reproduces the 409; `G`-only rows import; an `X` in column A produces the English row diagnostic. Enter
   discipline `1`.
   > If you script the discipline field, note that a plain `input.value = '1'` does **not** update a
   > React-controlled input: use the native value setter. The first browser run silently did nothing because of it.
7. Measure contrast with alpha compositing and check 390px in an iframe or with
   `Emulation.setDeviceMetricsOverride` — a headless window clamps at ~504 device px, which is why every "1440"
   screenshot in this repo needs its width verified before it is believed.

### Open questions / Art. XIV touched

1. **Acknowledging a disappeared leerplandoel needs a decision, and I did not take one.** `vereistReview` never
   clears once a discipline has lost a goal, so the only two options are a run-scoped notice (built) or a
   persisted "reviewed" state per code (not built: it needs storage, and therefore directie). Raising it as the
   story instructs. A third option exists and is arguably better than both: let the *Doelen* screen own the
   standing list, since it already renders `nietMeerInOpstap` per doel (E1-16), and leave the import screen
   reporting only its own run. That is a scope decision, not a code one.
2. **The `<input type="file">` button label is browser chrome.** At an `en-US` browser locale it reads "Choose
   File" on a Dutch screen. I verified this is the browser's own string rather than ours by rendering the same
   page under `--lang=en-US` and `--lang=nl-BE` and diffing the images: the label region differs, so Chrome
   localises it. It is the same category as the `<input type="date">` E3-04 already ships, and Art. II.3 binds
   copy the frontend authors. Recorded because an audit will notice the English word on a screenshot; the
   alternative (hide the input behind a custom button) trades a UA-localised label for a re-implementation of
   labelling, keyboard behaviour and the file dialog.
3. **`GET /api/themas` returns 500 against the development database**, and it is not this story's doing. The
   `activiteiten` table holds a row with `activiteit_type = 'experiment'` (lowercase), which
   `ActiviteitConfiguration`'s reader (`Enum.Parse<ActiviteitType>`, case-**sensitive**) cannot map, so the whole
   list query throws. This story's own import wrote `Uitstap` correctly, and the offending row
   ("Schaduwspel met een zaklamp") exists nowhere in this worktree, so it arrived from outside. Two separable
   facts: the row is dirty local data, and the *reader* being case-sensitive means any row not written by this
   exact converter takes an endpoint down with a 500. Filed, not fixed: the second half is a real latent
   fragility in E1-10's persistence and belongs to whoever owns it.
4. **One Op.stap row diagnostic is a raw .NET message**: `'code' is required. (Parameter 'code')` reaches the
   screen for a row with no code. It is correctly classified (English, operator-facing, under the "technical
   details" heading) and it is E1-03's `ArgumentException` surfacing verbatim. Not translated, per the ruling and
   the story's instruction; noted because it looks like a leak and, read strictly, is one.
5. **The 409 cannot be told apart structurally.** "Minimumdoelen not loaded" and "code belongs to another
   discipline" share a status and a `Title`. This screen frames both as a system state, which is right for the
   first and slightly generous to the second (that one really is about the file, though not about its rows). A
   discriminator on the ProblemDetails would let the copy split; I did not add one, because the server's `detail`
   already names the next step for both and inventing a wire field to serve a copy nuance is the wrong order.
   Filed in case a reviewer prefers the split.

---

## Fix round 1 — the outcome on screen belongs to the run the reader asked for

- **Findings answered:** antagonist MAJOR 1-4 and MINOR 5-8, test-runner defects 1-4, plus the orchestrator's
  consolidated MAJOR 5 (the role flag) and QUESTION 10 (the duplicated filename).
- **Branch:** `story/E1-13`, three commits off `bc4c880`: `a806c32` (backend), `5824429` (frontend),
  `2247522` (browser evidence, and the one redundancy looking at it found).
- **FR / Article:** FR-1.1…1.5, FR-2.1/2.5, FR-10 (the concurrent case); Art. II.3, Art. II.5, Art. III.4,
  Art. IV.2, Art. VI.1 + FA §3.2, Art. X.5, Art. XII. The E3-06 rule.

### Finding by finding

**MAJOR 1 — a stale commit panel answers a fresh check.** `kijkNa()` now calls `vergeetUitkomst()` on **both**
importers, so a new run starts from nothing on screen. Chosen over "derive from whichever run is more recent":
the invariant becomes *at most one run's outcome is ever on screen, and it is the one the reader last asked
for*, held in one function, instead of a precedence rule every future reader has to re-derive correctly.
Verified in a browser on both halves and pinned by two tests that assert the **behaviour** (preview, commit,
preview again shows the fresh answer) rather than the call.

**MAJOR 2 — the discard flag stays armed with no control on screen.** Both halves, because either alone leaves
the hole. `vergeetUitkomst()` resets the flag when a check starts, and one derived `bedreigdeBeslissingen` value
now feeds **both** the panel and the wire, so `menselijkeBeslissingenVerwijderen` is gated on the diff actually
rendered. The reachable path is closed by the reset; the gate makes the invariant hold by construction, so a
future edit that re-introduces a path cannot re-open it. Driven end to end against real PostgreSQL: the exact
repro from `test-report.md` now ends with `DEMO-L3-05=Aanvaard, DEMO-L3-06=Aanvaard` **intact** where it
produced `(none)` before, and all three requests carried `menselijkeBeslissingenVerwijderen=false`. The
concurrent-change case is now a test of its own; the existing staleness test only covered the file-change path.

**MAJOR 3 — the 409 frame contradicts one of the two 409 cases.** *I chose the discriminator, not the narrowed
copy.* `Probleemsoorten` gives each `OpstapImportFoutSoort` an RFC 7807 `type` URI, `ApiError` carries `type`,
and the screen keys its framing sentence on it. Why the discriminator: the two refusals have **opposite owners
of the fix** (one waits on E1-12, the other is corrected by the uploader in ten seconds), so a frame that is
merely *not false* for both would be generic exactly where the screen can be specific, and Art. II.3 asks a
message to tell its reader what *they* can do. Why `type` rather than an extension member or a second title:
`type` is RFC 7807's own discriminator, so no wire field is invented for a copy nuance, and a `Title` is
user-facing Dutch (Art. II.3) that a screen must never branch on. There is a **third, neutral** frame for a 409
the screen cannot classify, because `IProblemDetailsService` fills `type` in from the status code whenever the
server set nothing, so "unrecognised" is a real state and must not fall into either specific claim.

**MAJOR 4 — a fourth reachable notice still says "(Art. IX.2)".** The cap notice is rewritten for a teacher: the
article reference into the comment, and the actionable step into the sentence (the cap keeps the *first* codes
in the cell, so it says to put the anchoring ones first). The guard **stopped being applied notice by notice**:
one import now trips three of the four sources at once and asserts the predicates over *every* opmerking the
diff carries, so a fifth source on that path fails without anyone remembering. Count and the word "three"
corrected above and in `backlog/README.md`.

*How I established coverage rather than asserting it.* A sweep over 73 backend product-copy literals across the
eleven files on the two import render paths (`SchoolcontentImportService`, the parser, the column labels, the
row-problem record, the template generator, `OpstapImportService`, `OpstapImportFout`, both controllers,
`Probleemtitels`, the exception handler) plus all 431 `nl.json` leaves, against no em dash / no `Art.` / no
`(s)`. It is **calibrated, not merely green**: run against the unfixed `bc4c880` the same sweep reports exactly
one violation, this finding, and nothing else. Comments and XML docs are excluded deliberately, since English
typography and article references are correct there, and that exclusion is the whole reason the fourth notice
survived round 1.

The sweep also has a known blind spot, and reading found what it cannot: `OpstapImportService` composed
`"De 1 bestaande doelen blijven ongewijzigd"` on a notice this story renders. That is the plural bug this repo
has shipped five times, and it is a **fourth predicate class** the three named ones do not cover. Fixed here.

**MAJOR 5 — `/import` flagged directie-only.** `magBeheerder: false` on the route;
`OPSTAP_SECTIE_ALLEEN_BEHEERDER` on the section, beside the visible sentence that already says it; comments in
`routes.ts`, `ImportPagina` and `Opstapimport` recording that **E6-02 gates the section, not the route**. Not
redesigned, per the ruling. The two §3.2 rows are now expressible: the route is visible to both roles (FR-1.1)
and the restricted part carries its own marking. A test asserts the pair together, so route and section cannot
drift apart in silence.

**MINOR 6 — "Er is niets gewijzigd" asserted where the client cannot know it.** New
`import.onbeschikbaarNaDoorvoeren` for the commit path on both importers; a 400 keeps the shared string, because
request validation runs before any write. Pinned on both. **Not reproduced in a browser**: forcing a gateway
failure *after* a successful save needs a proxy this setup does not have, so this one is test-only and I am
saying so rather than letting the browser section imply otherwise.

**MINOR 7 — three places assert a defect a merge had already fixed.** `api.ts`'s envelope (3) is restated around
shapes that are still real (proxy HTML, an empty body, valid JSON that is not an object); the test is renamed
and re-pointed; the comment in `Schoolcontentimport.test.tsx` is corrected. Each of the three now also records
**the shape of the mistake**: the claim went stale through a *merge*, not an edit, which is the case nobody
re-reads.

**MINOR 8 — the E1-12 blocker disclosed only after the reader has failed.** `import.opstap.voorwaarde`, rendered
above the form, with a comment naming who removes it (whoever lands E1-12). `routes.ts`'s false claim is
corrected to describe what is now actually there. Seen on screen before any upload. The 409 panel stays as the
reactive half, because only it knows which refs are missing.

**MINOR 9 — a commit button for a file that imports nothing.** It is a control that does nothing (the E3-06
rule), so it is gone on **both** importers when `diff.overgeslagen`, replaced by a line saying there is nothing
to commit and that the reason is above. Gated on `overgeslagen` (no usable rows, or a discipline outside the
import selection) and **not** on `isLeeg`: re-importing an unchanged file is a legitimate idempotent act the
diff already describes in words, and hiding that button would be the opposite mistake.

**QUESTION 10 — the filename on screen twice.** Deliberate, and it now says so at the place it would be tidied
away. `Bestandkiezer`'s docstring names both reasons: everything inside the native control is the browser's own
rendering in the browser's locale (verified in round 1 by diffing `--lang=en-US` against `--lang=nl-BE`) and it
truncates without a `title`; and our line is the only statement a test or a screen reader can read. No behaviour
change. The alternative, hiding the input behind a custom button, trades a UA-localised label for a
re-implementation of labelling, keyboard reach and the file dialog.

### Deliberately not changed, with the reason

- **The `Toevoegen` pre-selection.** Engaged with and accepted by the antagonist on its own terms; nothing here
  touches it.
- **`vereistReview` stays unrendered.** Three tests pin it and the test-runner verified the decisive case.
- **The E1-17 upstream defect** (`KoppelingAantallenAsync` omits `Thema.Doelsuggesties`, so a still-referenced
  goal can land in `verdwenen` rather than `verdwenenMaarGekoppeld`). This screen renders what it is given;
  compensating here would put a second copy of that rule in the UI.
- **The `aria-hidden` `/` separator at 1.25:1** in `KlasKiezer` (E0-10 chrome), which my contrast harness flags
  because it does not skip `aria-hidden` nodes. Pre-existing, decorative, correctly hidden from the
  accessibility tree. Recorded so the next measurement does not rediscover it as new.
- **A durable acknowledgement for a disappeared leerplandoel** (round 1's open question 1). Still needs storage
  and therefore directie.

### Gates — measured, on `2247522`

| Command | Result |
| --- | --- |
| `dotnet build` | 0 warnings, 0 errors |
| `dotnet format --verify-no-changes` | clean, exit 0 |
| `dotnet test` (unit) with `JAARPLANNER_TEST_POSTGRES` | **505 passed / 0 failed / 0 skipped** (was 502) |
| `dotnet test` (integration), same env | **155 passed / 0 failed / 0 skipped** (was 153) |
| `corepack pnpm test` | **256 passed / 15 files** (was 243) |
| `corepack pnpm lint` | clean |
| `corepack pnpm build` | clean |

Tests added: **+3 backend** (`Themadoelcap_wordt_leesbaar_gemeld_met_de_codes_die_wegvallen`, a theory over both
grammatical forms that also pins *which* codes the cap drops; and
`Elke_opmerking_van_een_run_is_leesbaar_voor_een_leerkracht`, the guard that grows by itself); **+2 integration**
(`De_twee_409_weigeringen_zijn_van_elkaar_te_onderscheiden` over HTTP, which is where it matters because
`IProblemDetailsService` is what could silently overwrite the discriminator; and an exhaustiveness check that
every `OpstapImportFoutSoort` maps to its own URI); **+13 frontend** across the two screens and the transport.

Four pre-existing `SchoolcontentImportRobustheidTests` assertions were re-keyed from the word "genegeerd" to the
dropped code. Worth naming: two of them **filtered on that word and then compared the results**, so the moment
the copy changed they compared two empty sequences and started passing vacuously. Keying a test on product copy
is how a guarantee gets lost in silence.

### Browser check — headless Chrome over CDP, real API, real PostgreSQL 17

API on `127.0.0.1:5431`, Vite on `localhost:5533`, CDP on `9431`, all claimed in `.claude/coordination/claims/`
in the `owner:/taken:/why:` shape and released afterwards. A **dedicated `e113fix` database**, migrated from
scratch, so no parallel session's data was read or written. Fixtures were built with `openpyxl` from the
sjabloon the screen itself served (7033 bytes, the server's own filename), so the FR-1.5 to FR-1.1 round trip is
exercised again rather than assumed. Thirteen screenshots in `fix-1/`, **md5-checked distinct** before being
cited as evidence.

| Claim | Evidence |
| --- | --- |
| MAJOR 1, school content | `R1` to `R2` to `R3`. After the commit: "De import is doorgevoerd", past tense, no commit control. After pressing *Bestand nakijken* again on the same file and modus: the **fresh** answer, "Dit bestand verandert niets aan de thema's…", "1 ongewijzigd" three times, future tense, and *Import doorvoeren* offered again. Three requests captured in order. |
| MAJOR 1, Op.stap (clause 6) | `R6` to `R7`. The committed panel gives way to the fresh review report: `ingelezen: false`, `ongewijzigd: true`, the import control back. |
| MAJOR 2 | `R9` (opt-in visible and ticked), then `R10` (**the state that carries the claim**: after the concurrent removal and a re-check, the panel is gone, `0` opt-in controls on screen, the flag disarmed), then `R11`. The standing evidence is the database transition: `DEMO-L3-05=Aanvaard, DEMO-L3-06=Aanvaard` **survives** the commit, where the unfixed build produced `(none)`. The wire was read in-page, because Chrome does not inline a multipart body in `Network.requestWillBeSent`: all three requests carried `menselijkeBeslissingenVerwijderen=false`. |
| MAJOR 3 | `R5` (the E1-12 refusal: the system frame, above "Laad eerst de decretale minimumdoelen in") and `R8` (the wrong discipline: "het hoort mogelijk bij een ander disciplinenummer dan je opgaf", above "Controleer of dit bestand bij discipline 3 hoort"). The two sentences now agree. |
| MINOR 8 | `R4`: the prerequisite is on screen at arrival, before a discipline number or a file has been entered. |
| MINOR 9 | `R12`: "Uit dit bestand wordt niets ingelezen" plus "Er is niets om door te voeren", **no** commit control, and the row problem still reported. |

Measured rather than assumed: **59 text nodes, 0 below AA** at 1440 and again at 390 (the single flagged node is
the `aria-hidden` decorative separator noted above). The new notice measures **9.39:1**, the new "niets om door
te voeren" line **6.08:1**, and the lowest passing value (5.39:1, `ink-zacht` on `paper-diep`) matches the
test-runner's independent measurement exactly. **390px:** `scrollWidth === clientWidth === 390` and nothing in
`main` extends past the viewport, checked with `Emulation.setDeviceMetricsOverride` rather than `--window-size`,
which clamps at about 504px on this machine. **Zero console errors** across the whole pass.

**What looking found that no test did:** the wrong-discipline frame and the server's `detail` printed two lines
under it both ended with "Er is niets gewijzigd." Only the *generic* frame states it now, because both specific
refusals already carry it in their own detail and the generic path may have no detail at all.

### For the test-runner

Everything under "For the test-runner" above still applies. The four things this round adds, cheapest first:

1. **MAJOR 1, either importer:** preview, commit, then *nakijken* again on the same file. The fresh answer must
   be on screen and committable. Unit-pinned; worth one browser confirmation because it is the headline defect.
2. **MAJOR 2:** the `test-report.md` repro verbatim, including the concurrent removal at step 3. The database
   must still show `Aanvaard` afterwards. Needs SQL, real PostgreSQL and a `Bijwerken` re-import.
3. **MAJOR 3:** upload a G-only file under discipline 2, then the same file under discipline 3. The frame must
   talk about the *file*, not about the tool; a file with an MD row still gets the system frame.
4. **MINOR 9:** any file whose only row is rejected. No *Import doorvoeren* may exist.

MINOR 6 is the one thing here I could not drive in a browser (it needs a gateway failure after a successful
save). If you can inject one with request interception, that is the gap worth closing.

### Open questions / Art. XIV touched

Unchanged from round 1: the durable-acknowledgement question, the browser-chrome file label, `GET /api/themas`
against dirty local data, and the raw .NET row diagnostic. One is now **closed**: round 1's open question 5,
"the 409 cannot be told apart structurally", is answered by `Probleemsoorten`. One is **surfaced for the owner**
rather than decided here: MAJOR 5 is fixed the way the orchestrator ruled, but whether the *whole* import screen
should be directie-only is a change to FA §3.2 and belongs in the functional analysis, not in a nav flag.
