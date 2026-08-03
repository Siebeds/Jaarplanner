# E1-16 — Test report (round 1)

**Verdict:** FAIL
**Mode:** unit/integration + independent HTTP verification against real PostgreSQL 17.
**Playwright:** NOT RUN. The MCP server was disconnected for this session, so the browser-only claims
in `implementation.md` are unconfirmed by me. See "What could not be verified independently".

Worktree: `C:\source\Jaarplanner\.claude\worktrees\agent-a4e870c1b588e7ada`, branch
`story/E1-16-doelen-ui` at `38b71c6` (four commits on `8203dbb`). Working tree clean before and after.

**Summary:** all four *Done when* clauses are met, and I re-derived each one from evidence rather than
from the implementer's report. The FAIL is for one separate, reproducible user-visible defect in new
copy: the register's paging button interpolates a count without `tAantal`, so it renders
**"Volgende 1 doelen laden"**. That is the exact plural bug the project has shipped four times, and
`implementation.md` claims the opposite ("every count through `tAantal`, with the singular case
pinned"). It is a small fix, but a false claim about the repo's most-repeated defect is not something
to round up.

## Criteria checked

### Clause 1: a paginated list with code, doelsoort badge, jaarFase and text, at real volume -> PASS

Verified independently, not from the reported numbers. I built my own database (`jp_verify_e116`),
applied all migrations, and seeded 3 000 bulk goals across 7 subdomeinen plus 5 hand-written shapes;
with the 14 migration-seeded `DEMO-*` rows the register held **3 019**.

- `GET /api/leerplandoelen?aantal=50` gave `totaal 3019, regels 50, aantal 50, overslaan 0`. The page
  is capped and the total is the whole match.
- I walked **all 61 pages** and compared the concatenation against an unpaged
  `ORDER BY "Domein","Subdomein","Code"` read straight from Postgres: `collected: 3019,
  distinct: 3019`, and the two lists are **element-for-element identical** (0 differing positions).
  Nothing repeated, nothing skipped, order stable across every boundary.
- Paging past the end: `?aantal=10&overslaan=1000000` gave `regels 0, totaal 3019`, an empty page with
  the total intact rather than a 404 or a 500.
- Paging is genuinely server-side: `api.ts` always sets `aantal=50` (`PAGINA_GROOTTE = 50`), and
  `useDoelen` uses `useInfiniteQuery` with `getNextPageParam` derived from the server total, so
  "meer laden" fetches the next 50 rather than re-fetching a growing page.
- Row fields: `Doelregel.tsx` renders the code (mono), `DoelsoortBadge`, `jaarFase` and `tekst`
  (truncated), plus domein and subdomein. The badge carries the letter code as text, so colour is
  never the only signal (Art. XII).

**The volume claim about the test suite also holds, and is not vacuous.**

- `Register_pageert_in_de_database_op_echt_volume` seeds `VolumeAantal = 2_500` bulk rows plus 7 shaped
  rows = 2 507, asserts `eerste.Totaal > 2500` and `Totaal == AantalInDatabaseAsync()`, then walks
  every page and asserts `Assert.Equal(verwacht, uitPaginas)` against `VerwachteOrdeningAsync()`,
  which is a real unpaged database read through the same provider and collation. It cannot pass on a
  client-side filter or an unstable sort.
- `Gefilterde_zoekopdracht_is_een_vast_aantal_statements` cannot pass vacuously: the interceptor is
  attached to the context under test (`AddInterceptors(teller)` in `MaakGeteldeContext`), it counts
  both sync and async reader and scalar hooks, and the test first asserts
  `klein.Totaal < groot.Totaal` and `groot.Totaal >= 2500` before asserting the count is 2 and that
  the two counts are equal. A stray warm-up statement would make the small case 3 and fail.
  Corroborated over HTTP: `?domein=Volume&aantal=50` (3 000 matches) took 0.017 s versus 0.014 s
  unfiltered.

### Clause 2: search on code and free text, five filters, taxonomy grouped by (domein, subdomein) -> PASS

All of the following are my own requests against a live API on **:5286** backed by real PostgreSQL 17,
so ILIKE, collation and ordering are the real ones and not the in-memory provider's:

- `?zoek=nat-k3` (lowercase, matches a code) gave `totaal 2`: NAT-K3-01, NAT-K3-02.
- `?zoek=SEIZOENEN` (uppercase term, lowercase data) gave `totaal 1`: NAT-K3-02.
- `?zoek=ditbestaatniet` gave `totaal 0`, an honest empty result and not everything.
- **`?zoek=%25`, a literal percent sign, gave `totaal 1`: WIS-L4-99**, the one row whose text contains
  "50%". It did **not** return the 3 019-row curriculum.
- `?zoek=WIS_L4` (literal underscore) gave `totaal 0`; the control `?zoek=WIS-L4` gave `totaal 1`. So
  the underscore is not treated as a wildcard.
- `?zoek=%5C`, a literal backslash (the escape character itself), gave `totaal 0` and no error.
- `?discipline=2` gave 751. `?doelsoort=MD` and `?doelsoort=Minimumdoel` both gave 501, so the Op.stap
  short code and the wire name agree. `?jaarFase=k3` (lowercase) gave 336. `?jaarFase=K3&doelsoort=MD`
  gave 1, so filters combine. `?domein=Volume` gave 3 000.

So the search is honest: **a literal percent sign in the search box cannot return the whole
curriculum**, and case-insensitive matching is proven against real PostgreSQL in both directions.
`LeerplandoelenQuery.LikePatroonVeilig` escapes the backslash first, then the percent and the
underscore, and passes the backslash as the explicit ILIKE escape character.

**Taxonomy grouped by (domein, subdomein), Art. VII.0.** My seed repeats the subdomein name
"Bouwstenen" under both Muziek and Beeld.

- `GET /facetten` nests them separately: Muziek has one subdomein "Bouwstenen" with count 1, and Beeld
  has its own "Bouwstenen" with count 1. They are never merged.
- Every domein's count equals the sum of its subdomeinen's counts, checked for all six domeinen.
- `?domein=Muziek&subdomein=Bouwstenen` returned MUZ-L2-01 only; `?domein=Beeld&subdomein=Bouwstenen`
  returned BEE-L2-01 only. `?subdomein=Bouwstenen` alone returns both (2), and the UI closes that hole
  from its side: the subdomein select is disabled until a domein is chosen, and `leesFilter` drops a
  `subdomein` parameter that arrives with no `domein`.
- Facets are derived from the loaded rows, not from a compiled-in enum: only the 6 disciplines, 6
  doelsoorten and 9 jaarFasen my data actually contained were offered, each with a count. That keeps
  the three open Art. XIV questions (disciplines in scope, leergebied, the jaarFase code form)
  genuinely unanswered.
- Bad input is a 400 and never a 500. I re-ran all six cases myself: `aantal=0`, `aantal=100000`,
  `overslaan=-1`, `doelsoort=99`, `doelsoort=bestaatniet`, `aantal=veel`. All six returned **400**.

### Clause 3: open one doel, read every imported field, the concordance, and the thema links with status -> PASS, with the stated qualification confirmed as genuinely blocked

I seeded one thema exercising all four Art. IX.2 link layers by direct SQL, then read
`GET /api/leerplandoelen/NAT-K3-01`. It returned every Op.stap column of the CLAUDE.md A-M mapping:
doelsoort (Minimumdoel), jaarFase (K3), disciplineNummer and disciplineNaam ("3" and "Wetenschap en
techniek"), domein, subdomein, cluster (Planten), tekst, voorbeelden, toelichting, woordenschat,
minimumdoelRef (K-12), nietMeerInOpstap, **plus the decreed minimumdoel object** (ref, leeftijd, nr,
omschrijving), **plus all four links each with its own status**:

    Themadoel      / Herfst /                 / Manueel
    Doelsuggestie  / Herfst /                 / Voorgesteld
    Subdoel        / Herfst / Bladeren        / Aanvaard
    Activiteit     / Herfst / Bladeren zoeken / Geweigerd

- `GET /nat-k3-01` in lowercase returned NAT-K3-01, so the code lookup is case-insensitive.
- `GET /NAT-K3-02` returned every absent optional column as null rather than an empty string, with
  `minimumdoelRef` null and `minimumdoel` null. `Doeldetail.tsx` renders the "niet gekoppeld aan een
  minimumdoel" line for that, and omits an absent field entirely rather than showing a label with
  nothing under it.
- `GET /BESTAAT-NIET-1` returned **404**. `GET /ongekoppeld` returned **200**, so the E2-06 gap route
  still wins route precedence over the code parameter.

**On the stated qualification, I confirmed the path is blocked and not merely untested.**
`LeerplandoelConfiguration.cs` lines 66-70 declare the concordance as
`HasOne<Minimumdoel>().HasForeignKey(l => l.MinimumdoelRef).HasPrincipalKey(m => m.Ref)
.OnDelete(DeleteBehavior.Restrict)`, and `\d leerplandoelen` shows the real constraint
`FK_leerplandoelen_minimumdoelen_MinimumdoelRef ... ON DELETE RESTRICT`. I then tried to create such a
row by hand, bypassing EF Core entirely:

    INSERT INTO leerplandoelen (...,"MinimumdoelRef")
    VALUES ('MD-ZONDER-RIJ',...,'4-07');

    ERROR:  insert or update on table "leerplandoelen" violates foreign key constraint
            "FK_leerplandoelen_minimumdoelen_MinimumdoelRef"
    DETAIL: Key (MinimumdoelRef)=(4-07) is not present in table "minimumdoelen".

So the state "concorded, but the decreed omschrijving is not loaded" genuinely cannot exist in this
schema. It is the E1-03/E1-04 blockage, not a hole in this story, and pinning it with a frontend test
only is the correct call. The implementer explicitly declined to fabricate it by dropping the
constraint in a fixture; I agree with that choice, and clause 3 is met as written.

### Clause 4: visibly read-only, no edit affordance whatsoever -> PASS on every check I could run

- **Verified by me against the live server on :5286.** Eight requests, all **405 Method Not Allowed**:
  POST, PUT, PATCH and DELETE on both `/api/leerplandoelen` and `/api/leerplandoelen/NAT-K3-01`.
  Afterwards `GET /NAT-K3-01` still returned the original tekst and `nietMeerInOpstap: false`.
- **No write path exists in any new backend file.** A grep for SaveChanges, Update(, Remove(, Add(,
  ExecuteUpdate and ExecuteDelete across `LeerplandoelenQuery.cs`, `LeerplandoelenController.cs` and
  `ILeerplandoelenQuery.cs` matched only a doc-comment. The port declares three methods, all read
  views. The controller has three HttpGet actions and nothing else. `DependencyInjection.cs` registers
  the query and nothing more.
- **Would the frontend "walks every control" test fail if a mutating control were added?** Yes, for
  the realistic cases. It is an allowlist rather than a denylist: it asserts zero textboxes, exactly
  one searchbox, zero checkboxes, zero radios, zero textareas and zero contenteditable elements, and
  then requires **every** button's accessible name to be one of Zoeken, Wis alle filters, Terug naar
  de lijst, a filter chip, or the meer-laden pattern. A new Bewerken / Opslaan / Verwijderen button
  fails that loop with a named message. It also asserts no form carries an action or a method.
  Two narrowness notes, non-blocking: it queries only inside `#hoofdinhoud`, and it does not inspect
  link destinations, so a mutating control implemented as a link would pass. The API's 405s are what
  actually closes that gap.
- Read-only is stated once above the list (`DoelenPagina.tsx:58`, the `doelen.leesAlleen` key) and
  never per row, asserted by `getAllByText(...)` having length exactly 1.

## Commands run, and their real output

All from `C:\source\Jaarplanner\.claude\worktrees\agent-a4e870c1b588e7ada`.

- `dotnet format --verify-no-changes` (in `backend/`) -> exit **0**, no output.
- `dotnet test` (in `backend/`, no Postgres env var) -> UnitTests **468 passed, 0 skipped**;
  IntegrationTests **56 passed, 55 SKIPPED** (expected: the `PostgresFact` gate).
- `JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable" dotnet test`
  -> `Failed: 0, Passed: 468, Skipped: 0, Total: 468` (Jaarplanner.UnitTests) and
  `Failed: 0, Passed: 111, Skipped: 0, Total: 111` (Jaarplanner.IntegrationTests, 1 m 5 s).
- `corepack pnpm install` (Bash, in `frontend/`) -> exit 0.
- `corepack pnpm lint` -> exit **0** (`eslint . --max-warnings 0 && tsc --noEmit`).
- `corepack pnpm test` -> **Test Files 11 passed (11), Tests 159 passed (159)**, 0 skipped.
- `corepack pnpm build` -> `built in 3.06s`, `index-B0oRwVj8.js` 387.26 kB, `index-BvPuHgGG.css`
  37.82 kB. Matches the reported hashes.
- `dotnet ef database update` against a fresh `jp_verify_e116`, then
  `dotnet run --project src/Jaarplanner.Api --no-build --no-launch-profile --urls http://127.0.0.1:5286`
  -> `GET /health` returned **200**. About 40 further curl and psql calls, quoted above.

**Skip counts, stated explicitly as required.**

- `Jaarplanner.UnitTests`: **0 skipped** (468 of 468), with and without the Postgres connection string.
- `Jaarplanner.IntegrationTests`: **0 skipped** (111 of 111) with `JAARPLANNER_TEST_POSTGRES` set. The
  55 skips in the plain run are the `PostgresFact` gate and disappear entirely once the variable is
  supplied, so no test is skipped while the database is available.

**The E7-14 teardown flake did not reproduce.** The full Postgres run completed cleanly on the first
attempt, no retry needed. Orphan databases do sit on the local server (`jp_test_klas_...`,
`jp_test_import_...`, `jp_test_jaarplan_...`) from earlier runs, but **no `jp_test_doelenregister_...`
database leaked from my run**, so this story's own fixture tears itself down correctly.

Vitest emits three `An update to X inside a test was not wrapped in act(...)` warnings (KlasKiezer,
Doeldetail, DoelenPagina). Non-failing, and the KlasKiezer one is pre-existing. Noted, not charged.

## Evidence

- Independent API run on **:5286** (Vite was not needed, since no browser pass was possible) against a
  database I created and migrated myself: `jp_verify_e116` with 3 019 leerplandoelen, 1 minimumdoel and
  1 thema carrying all four link layers in four different statuses. Port :5184 was already occupied by
  another agent's API, which is why `--no-launch-profile` was needed: `launchSettings.json` pins
  `applicationUrl` to :5184 and overrides `ASPNETCORE_URLS`.
- Paged-walk comparison files, temporary and outside the repo:
  `...\scratchpad\http_codes.txt` (61 pages concatenated, 3 019 codes) versus
  `...\scratchpad\db_codes.txt` (one unpaged ORDER BY read, 3 019 codes). Identical line for line.
- The verification database was dropped and the API process stopped afterwards
  (`DROP DATABASE jp_verify_e116`). The worktree is clean and I committed nothing.
- No screenshots exist for this report, deliberately: see the next section.

## What could NOT be verified independently

The Playwright MCP server was disconnected for this session, so **I ran no browser pass**. I did not
open the app, did not render a pixel, and I am not laundering the implementer's screenshots into a
verification of my own. The following therefore rest on `implementation.md` alone and remain
**unconfirmed by this report**:

1. **The four browser-found defects and their fixes.** The `?doelsoort=MD` fix is confirmed in code
   (`DOELSOORT_PER_SPELLING` in `doelenfilter.ts`) and by two tests; the grid `min-w-0` fix is present
   in `Doelenfilters.tsx` at lines 181, 223 and 233; the 390px re-layout and the `xl:grid-cols-5`
   desktop fix are present in the markup. That the **rendered result** is correct is unverified.
2. **The 390px layout claims**: "9 doelen visible instead of 6", "the detail replaces the list", "the
   filters are hidden while a doel is open", and "no horizontal overflow, scrollWidth == clientWidth".
   The classes implementing all of this are present (`hidden lg:block`,
   `lg:grid-cols-[minmax(0,1fr)_26rem]`), but jsdom cannot lay out and I could not measure.
3. **Every contrast figure in the worklog's table** (14.55, 15.42, 5.73, 6.08, 8.90, 7.96, 9.39, 6.48
   and the six doelsoort edge ratios). jsdom cannot evaluate colour, and this repo's record is that a
   green axe run says nothing here. **Entirely unverified by me.** The frontend suite's axe check is a
   structural check only, which its own comment states.
4. The eight manual review steps the implementer listed "for the test-runner".

If the orchestrator needs those closed, this story needs a browser round once the MCP server is back.

## Defects (these go back to the implementer)

**[medium] "Volgende 1 doelen laden": the paging button's count bypasses `tAantal`, so the singular
reads as plural.**

`frontend/src/features/doelen/Doelenlijst.tsx` line 115:

    : t("doelen.meerLaden", { aantal: Math.min(PAGINA_GROOTTE, totaal - regels.length) })}

`nl.json` holds `"meerLaden": "Volgende {aantal} doelen laden"` and **no singular counterpart**; the
only sibling key is `meerLadenBezig`. Rendering the catalogue string directly gives:

    50 -> "Volgende 50 doelen laden"
     7 -> "Volgende 7 doelen laden"
     2 -> "Volgende 2 doelen laden"
     1 -> "Volgende 1 doelen laden"   <-- ungrammatical Dutch

**Repro.** Load the register with any filter whose total satisfies `totaal % 50 == 1` (51, 101, ...,
3 001 matching leerplandoelen), then load pages until exactly one row remains unloaded. With a real
Op.stap import this is roughly a 1-in-50 chance per filtered view, and each of the five filters
produces new totals, so a browsing session will hit it.
**Expected:** a singular sentence, for example "Volgende doel laden" or "Nog 1 doel laden".
**Actual:** "Volgende 1 doelen laden".

Why this is the blocking finding rather than a nit:

- It is the same defect class CLAUDE.md and `tAantal`'s own doc-comment single out as having shipped in
  this repo four times, twice inside the commit that announced fixing it. `tAantal` exists precisely so
  a new call site does not reintroduce it, and this new call site does.
- `implementation.md` states the opposite: "every count through `tAantal`, with the singular case
  pinned". Four of the five count strings do go through it (`aantalGetoond` with
  `aantalGetoondEnkelvoud`, and `koppelingenAantal` with `koppelingenAantalEnkelvoud`;
  `optieMetAantal` is `"{naam} ({aantal})"`, a bare parenthesised numeral with no inflected noun, so it
  is correctly exempt). This one does not, and the suite does not notice: `DoelenPagina.test.tsx` line
  148 only ever exercises `{ aantal: 50 }`, and line 515's read-only walk accepts it through a loose
  `naam.startsWith("Volgende")` bucket.
- It sits on the primary control of the screen this story delivers, in Dutch copy that a non-technical
  teacher reads.

**Fix shape.** Add a `doelen.meerLadenEnkelvoud` entry and route the label through
`tAantal(resterend, "doelen.meerLadenEnkelvoud", "doelen.meerLaden")`, then add a test that renders the
last page with exactly one row remaining (51 rows at page size 50) and asserts the singular string.
The 51-row case is precisely what the current tests miss.

Nothing else needs rework: clauses 1 to 4 all passed, so this is a one-string fix plus one test, not an
architectural change.

## Observations (not blocking, for the record)

- **No em dashes reached `nl.json`.** Zero occurrences in the whole file, and none anywhere in the diff
  to it. The em dashes under `frontend/src/features/doelen/` are all in code comments and Vitest
  `describe` titles, which are not user-facing.
- The read-only control walk checks buttons and form fields but not link destinations, and its
  meer-laden bucket is a `startsWith("Volgende")` string match. A future mutating link, or a button
  whose label happens to start with "Volgende", would pass it. The API's 405s are the real guarantee.
- Facets are unfiltered by design, so option counts describe the whole curriculum rather than the
  current filter. The implementer flagged this for a directie opinion; I agree it is a judgement call
  and not a defect.
- The endpoint is unauthenticated, like every other screen today (E6-01 / E7-11). It exposes only
  decreed reference data, so nothing new leaks, but it is not role-scoped either.
- The 14 `DEMO-*` leerplandoelen are seeded by migration, so a freshly migrated database is never
  actually empty. The "nothing imported yet" empty state is therefore unreachable in a real local
  environment without deleting them, and is covered by a frontend test only. Worth knowing before
  someone tries to review that state in a browser.

---

# E1-16 — Test report (round 2, second pass)

**Verdict:** PASS
**Mode:** both — unit/integration + **a real browser pass** (Playwright driving Microsoft Edge), plus
independent HTTP verification against a live API and real PostgreSQL 17.

**The browser pass that round 1 could not run has now been run.** The Playwright *MCP server* is still not
exposed to this agent (no `browser_*` tool exists in my toolset), so I drove Edge myself with the
`playwright-core` build in the local npx cache (v1.62.0-alpha) via `chromium.launch({ channel: "msedge" })`.
Every screenshot and every measurement below is mine. I adopted none of the implementer's or the
orchestrator's figures.

## The tree I verified, which is not the tree I was given

I was pointed at `6fc4967` on `feature/e1-curriculum-content`. **HEAD moved under me during this run:** a
parallel session fast-forwarded the branch to `origin/main` at **`6f608a9`** = `bb34198` (PR #17: E1-16 +
E1-15 onto `main`) plus PR #18 (**E3-04**). So E1-16 is already on `main`.

This does not invalidate the verification: `git diff 6fc4967 6f608a9` touches **none** of E1-16's own files.
`features/doelen/*`, `catalogus.test.ts`, `LeerplandoelenController.cs`, `LeerplandoelenQuery.cs` and
`Application/Curriculum/*` are byte-identical. The only shared file that moved is `nl.json`, which E3-04
extended with four new count strings. **Everything below is E1-16 as it now stands on `main`, with E1-15
and E3-04 alongside it.** The gate numbers are higher than the ones I was given for exactly that reason.

## Gates, re-run by me on `6f608a9`

| Gate | Result |
|---|---|
| `dotnet format --verify-no-changes` | exit **0**, no output |
| `dotnet test tests/Jaarplanner.UnitTests` | **496 passed, 0 failed, 0 skipped** (5 s) |
| `dotnet test tests/Jaarplanner.IntegrationTests` with `JAARPLANNER_TEST_POSTGRES` | **152 passed, 0 failed, 0 skipped** (2 m 48 s) |
| `corepack pnpm test` | **187 passed / 12 files**, 0 skipped (23 s) |
| `corepack pnpm lint` | exit **0** |
| `corepack pnpm build` | built in 3.86 s, `index-DMIOuPBj.js` 392.38 kB, `index-MtY8iBuD.css` 37.95 kB |

**Skip counts, explicitly, for both backend projects: `Jaarplanner.UnitTests` 0 skipped of 496;
`Jaarplanner.IntegrationTests` 0 skipped of 152.** The **E7-14 teardown flake did not reproduce** — the
Postgres run completed cleanly on the first attempt. The numbers I was told to distrust (484 / 133 / 174)
were measured before E3-04 merged; the deltas are E3-04's, not a discrepancy.

## The round-1 defect: fixed, and confirmed in a browser

> *"Volgende 1 doelen laden": the paging button's count bypasses `tAantal`.*

- `nl.json` now holds `doelen.meerLadenEnkelvoud` = **"Laatste doel laden"**, and `Doelenlijst.tsx` routes
  the count through `tAantal(Math.min(PAGINA_GROOTTE, totaal - regels.length), …)`.
- **Original repro, driven in Edge, on data imported through E1-15's endpoint.** I built an Op.stap workbook
  with **51** rows in domein *Muziek* (plus 3 in *Beeld*), imported it via `POST /api/opstap-import`, then
  filtered the register to `?domein=Muziek`:
  - count line: `50 van 51 doelen getoond.`
  - paging button: **`Laatste doel laden`** (screenshot `e1-16-r2-51rijen-laatste-doel-laden.png`)
  - after clicking: `51 van 51 doelen getoond.`, 51 rows, 0 paging buttons left.
- The Dutch is grammatical, and it drops the numeral rather than inflecting a noun around it, which also
  removes the "1" a reader would otherwise have to reconcile with the "51" on the line above.

## The guard: proven able to fail

`frontend/src/i18n/catalogus.test.ts` is **not vacuous**. Proven by mutation in a throw-away worktree of
`6f608a9` (never in the working tree), each mutation reverted afterwards:

| Mutation | Result |
|---|---|
| M1: add `mutatietest.nieuweTelling = "{aantal} nieuwe dingen gevonden"` (no singular) | **FAILS**, naming the key and the fix ("…has no singular: add \"mutatietest.nieuweTellingEnkelvoud\" and render it through tAantal, or add an entry to GEEN_ENKELVOUD_NODIG…") |
| M2: delete `doelen.meerLadenEnkelvoud`, i.e. re-open the round-1 defect | **FAILS**, naming `doelen.meerLaden` |
| M3: rename an exemption key to one that does not exist | **FAILS** the second test ("ongekoppeld.bestaatNietMeer is exempted but no longer in the catalogue") |

**Both exemption lists are honest.** The catalogue holds 21 `{aantal}` strings; 17 have an `…Enkelvoud`
sibling and the four that do not are exactly the four accounted for:

- `kalender.doelenGekoppeld` maps to `kalender.eenDoelGekoppeld` ("1 doel gekoppeld"), which exists.
- `doelen.optieMetAantal` = `"{naam} ({aantal})"`: a bare parenthesised numeral, correct at 1.
- `ongekoppeld.aantal` = `"{aantal} nog niet gekoppeld"`: non-inflecting phrase, correct at 1.
- `kalender.teVol` = `"Te vol: {aantal} thema's"`, exempt as unreachable at 1. **I checked the coupling the
  comment warns about:** `VOORLOPIGE_TE_VOL_DREMPEL = 3` (`kalenderFormat.ts:91`), `isTeVol` is `>= 3`, and
  `Periodekolom.tsx:57` uses `gepland.length + 1 >= 3`, so the smallest count that can reach the string is 2.
  The claim holds and the comment names who owns it if the constant drops.

**Cross-story evidence that the guard bites:** E3-04 merged four new count strings
(`parameters.samenvattingStartthema|Moment|Onvolledig|Vervallen`) into `nl.json` *after* this guard landed,
and all four arrived with an `…Enkelvoud` sibling.

## The empty-state ordering: pinned, and verified in a browser

Mutation-tested the same way, all reverted:

| Mutation | Result |
|---|---|
| M5a: `if (curriculum === "leeg")` becomes `if (curriculum !== "gevuld")` in `Doelenlijst.tsx` | **1 test fails**: "does not conclude the curriculum is empty from a facets request that failed" |
| M5b: collapse the three-valued derivation in `DoelenPagina.tsx` back to `(facetten.data?.totaalAantalDoelen ?? 0) > 0` | **same test fails** |
| M6: re-insert the original shape, claiming "nothing imported" *above* the loading branch | **3 tests fail** (pending first paint, facets failure, zero-result) |

So the fix cannot be reverted silently, and the test's own comment ("a fix whose test survives reverting it
is not pinned") is accurate.

**Driven directly in Edge, with `/api/leerplandoelen/facetten` intercepted:**

1. **Facets 500, register non-empty.** No false claim at any point. 50 rows stay on screen, the filter block
   hides itself, and after React Query's default retries the Dutch alert appears: *"De doelen konden niet
   geladen worden. Probeer de pagina opnieuw te laden."* (`role="alert"`). Timeline I measured: request at
   t≈0, retries at t≈3 s and t≈6 s, alert visible at **t≈7 s**. `Er zijn nog geen doelen van Op.stap
   ingeladen` count: **0** throughout. Screenshot `e1-16-r2-facetten-500.png`.
2. **Facets 500 *and* a filter matching nothing** (`?zoek=bestaatabsoluutniet`): shows **"Geen doelen met
   deze filters"**, not the beheerder message. This is the state the three-valued type exists for.
3. **Facets pending 6 s:** sampled every 400 ms for 4 s, the false claim count was **0** at every sample
   while 50 rows were already on screen.
4. **Genuinely empty curriculum** (both queries resolve to zero): the honest message appears and offers
   **no** control, as E3-06's rule requires. Screenshot `e1-16-r2-leeg-curriculum.png`. Note this state is
   reachable locally after all: a freshly migrated database has **0** leerplandoelen, so round 1's remark
   about the `DEMO-*` rows making it unreachable does not hold for a fresh migrate.

## The `subdomein`-without-`domein` 400, over HTTP against a live API

Live API on **:5287**, real PostgreSQL 17, database `jp_e116_pass2` created and migrated by me:

    GET /api/leerplandoelen?subdomein=Bouwstenen                        -> 400  'subdomein' requires 'domein' ... (Art. VII.0)
    GET /api/leerplandoelen?subdomein=Bouwstenen&domein=Muziek          -> 200
    GET /api/leerplandoelen/facetten?subdomein=Bouwstenen               -> 400  (same message)
    GET /api/leerplandoelen/facetten?subdomein=Bouwstenen&domein=Muziek -> 200
    GET /api/leerplandoelen?domein=%20&subdomein=Bouwstenen             -> 400  (whitespace domein does not satisfy it)
    GET /api/leerplandoelen?subdomein=%20%20                            -> 200  (blank subdomein is no filter)

**On "both list and detail endpoints":** the two endpoints that accept the filter are the **list** and
**facetten**, and both refuse it identically because they share `ProbeerFilter`. The **detail** route
(`GET /api/leerplandoelen/{code}`) has **no `subdomein` parameter at all**, so there is nothing to guard;
`GET /api/leerplandoelen/BESTAAT-NIET-1?subdomein=Bouwstenen` returns 404 on the code and ignores the stray
parameter. I read the clause as satisfied. If it was meant literally as "the detail must also 400", the
answer is that the parameter does not exist on that route.

The other bad-input cases still 400 and never 500: `aantal=0`, `aantal=100000`, `overslaan=-1`,
`doelsoort=99`, `doelsoort=bestaatniet`, plus the framework's own 400 for `aantal=veel`.

## Clauses 1 to 4, re-confirmed on the merged tree

**Clause 1, paginated list with code, doelsoort badge, jaarFase and text, at real volume: PASS.**
In the browser at 1440px: 50 rows on the first page of 54, count line `50 van 54 doelen getoond.`, row 1
reads `BLD-P2-001 | MD | L6 | De leerling mengt ... | Beeld - Bouwstenen`. `scrollWidth == clientWidth` at
1440 and at 390. Paging is server-side (`?aantal=50`, `useInfiniteQuery`); round 1's 3 019-row paged walk
against an unpaged `ORDER BY` still stands in this tree, and the volume test
(`Register_pageert_in_de_database_op_echt_volume`, 2 507 rows) passes in the 152-test Postgres run.

**Clause 2, search plus five filters, taxonomy grouped by `(domein, subdomein)`: PASS.**
The imported workbook deliberately repeats the subdomein name *Bouwstenen* under both *Muziek* and *Beeld*.
`GET /facetten` nests them separately (`Beeld -> Bouwstenen (3)`, `Muziek -> Bouwstenen (51)`) and never
merges them; the browser's Domein select offers `Alle / Beeld (3) / Muziek (51)`, and the Subdomein select
stays disabled with the visible text *"Kies eerst een domein"* until a domein is chosen. Filtering wrote
`?domein=Muziek` to the URL, so a filtered view is shareable.

**Clause 3, open one doel and read every imported field, the concordance and the thema links with status:
PASS, and this pass exercised the concordance *with* a decreed omschrijving.** I seeded one `Minimumdoel`
row (`6-07`) so the MD path could be walked end to end, then read `/doelen/BLD-P2-001` in the browser. It
rendered: code, MD badge plus the word *Minimumdoel*, `Jaar of fase: L6`, tekst, `PLAATS IN OP.STAP`
(`Muzische vorming - Beeld - Bouwstenen`), `CLUSTER Kleur`, `VOORBEELDEN` with the illustratief caveat,
`TOELICHTING`, `WOORDENSCHAT` with the richtinggevend caveat, `GEKOPPELD MINIMUMDOEL` with *"Gekoppeld aan
minimumdoel 6-07."*, the decreed omschrijving, `Leeftijd 6-, nummer 07`, and `WAAR DIT DOEL VOORKOMT` with
all four Art. IX.2 layers:

    Kleur en klank / Themadoel            / hele school             / Manueel
    Kleur en klank / AI-suggestie         / hele school             / Voorgesteld
    Kleur en klank / Mengen / Subdoel     / klas L6 zesde leerjaar  / Aanvaard
    Kleur en klank / Kleurencirkel maken / Activiteit / klas L6 zesde leerjaar / Geweigerd

Every class-scoped row names its klas and every school-wide row says *hele school*, so antagonist finding 3
is closed on screen and not only in the type. A doel with nothing optional (`MUZ-P2-007`) omits the labels
entirely (no empty `CLUSTER` heading) and says *"Dit doel is niet gekoppeld aan een minimumdoel."* and
*"Nog geen enkel thema verwijst naar dit doel."*

**Clause 4, read-only with no edit affordance whatsoever: PASS.** Full inventory of `#hoofdinhoud` in the
live browser: **1** input (`type=search`), **5** selects (the filters), **2** buttons (*Zoeken*, *Volgende 4
doelen laden*), **0** textareas, **0** contenteditable, one `<form>` with no `action` and no `method`, and
all 50 links point at `/doelen/<code>`, so round 1's "a mutating control implemented as a link would pass"
gap is empirically empty here too. The API answers **405** to POST/PUT/PATCH/DELETE on both
`/api/leerplandoelen` and `/api/leerplandoelen/{code}`. The read-only sentence appears **once**.

## E1-16 and E1-15 together: nobody had checked this, and it holds

E1-15 writes the reference data E1-16 reads, so I ran the chain rather than reasoning about it. On a fresh
migrated database with 0 leerplandoelen:

1. `POST /api/opstap-import/voorbeeld` (discipline 6, my 54-row workbook) returned `isBestandGeldig: true`,
   `problemen: []`, a diff listing 54 additions, and **wrote nothing**.
2. `POST /api/opstap-import` committed it. `GET /api/leerplandoelen` immediately reported `totaal 54`, and
   `GET /facetten` rebuilt itself around the new data (`Muzische vorming (54)`, `Beeld (3)` / `Muziek (51)`,
   4 doelsoorten, 9 jaarFasen). No compiled-in vocabulary, no stale facet.
3. The register rendered the imported rows in the browser with their doelsoort badges and jaarFase, and the
   detail read back every column the workbook carried, so the A-M mapping survives import -> query -> UI.
4. **Re-import with the three *Beeld* rows removed:** the diff reported
   `verdwenen: [BLD-P2-002, BLD-P2-003]` and `verdwenenMaarGekoppeld: [{BLD-P2-001, aantalKoppelingen: 3}]`
   with `vereistReview: true`. The register then showed those rows with `nietMeerInOpstap: true`, the row
   carried the visible word **"nakijken"** (text, not a tooltip, not colour alone), and the detail led with
   *"Nakijken: dit doel staat niet meer in Op.stap"* plus the honest explanation that it was kept so the
   jaarplan stays intact. Screenshot `e1-16-r2-vervallen-na-herimport.png`.

I found **no** defect that the combination creates. Two observations from it are in the list below.

## Design check at 1440px and exactly 390px, measured in a real browser

- **No horizontal overflow** at either width, in list view and detail view (`scrollWidth == clientWidth`).
- **390px with a doel open:** the list is genuinely **not visible** (`isVisible() === false`), the detail is,
  the five filter selects are hidden (0 visible), a *Terug naar de lijst* control is present, and the browser
  Back button returns to `/doelen` with the list visible again. At 1440px both panes show at once.
- **Contrast, alpha-composited in the live page** (my own measurement): titel **14.55**, `leesAlleen` and the
  count line **5.73**, row code **15.42**, muted taxonomy/jaarFase **6.08**, doelsoort badges **MD 7.13,
  + 5.08, P 5.82, G 7.46**. All at or above 4.5:1, and these agree with the figures the worklog claimed,
  which round 1 could not check.
- **Colour is never alone:** every badge carries its letter code (MD, G, +, P) as text, and the detail spells
  out the Dutch name (*Minimumdoel*).
- **All copy comes from `nl.json`.** Grepping `features/doelen/*.tsx` for Dutch string literals outside
  `t()`/`tAantal()` matched only a code comment. Nothing user-facing is hard-coded, and no server-generated
  string is rendered to a user: the 404's English `"Not Found"` never reaches the screen, because the pane
  shows its own `doelen.onbekendTitel`.

## Still open, deliberately not charged against this story

1. **The filed Art. II.3 language item is unfixed**, as the backlog says it would be while the story is
   `[~]`: `GET /api/leerplandoelen` answers a validation failure with a **bare English string**
   (`'subdomein' requires 'domein': ...`) rather than `ProblemDetails`, while the framework's own 400 for
   `aantal=veel` *is* `ProblemDetails`, and a missing code returns the default 404 with the English title
   `"Not Found"`. Confirmed still present over HTTP. Neither reaches a teacher's screen today, so this is an
   envelope and diagnostics decision for whoever closes the story, not a criterion failure.
2. **`aantalKoppelingen` means two different things in two stories.** E1-15's re-import diff counted **3**
   links for `BLD-P2-001`; E1-16's detail says **4 verwijzingen** for the same doel. Both are defensible
   (E1-16 counts the `Voorgesteld` AI suggestion, E1-15 evidently does not) and E1-16's copy explains that
   only *Aanvaard* and *Manueel* count for dekking. But two user-facing counts of "how many links" that
   differ by construction will eventually be compared by a directie. Worth one shared definition.
3. **The "kies een doel" placeholder sits next to the empty-curriculum message.** With zero doelen the right
   pane still invites *"Kies een doel in de lijst om het volledig na te lezen."* while the left pane says
   nothing has been imported. Low severity, visible in `e1-16-r2-leeg-curriculum.png`; the two panes should
   not disagree about whether a list exists.
4. **About 7 seconds pass before a facets failure becomes visible**, because `main.tsx` uses a bare
   `new QueryClient()` whose default is three retries with backoff. The screen is honest throughout (rows
   show, no false claim), so nothing is wrong; it is a long silence for a teacher. Repo-wide default, not
   this story's.
5. **At 390px only about 2.5 rows sit above the fold** (roughly 665px of shell, heading and filter card above
   the list). The worklog's "9 doelen visible" claim does not reproduce as an above-the-fold figure at
   390x844. No criterion states a row count, the layout has no overflow and the filters are the tool, so this
   is an observation for the directie review rather than a defect.

## Commands run

- `git worktree add ... 6f608a9 --detach` plus a `node_modules` junction: all mutation experiments ran there,
  and the worktree was removed afterwards (`git worktree remove --force`). The real `node_modules` is intact
  and the main working tree ended clean of any change of mine.
- `dotnet format --verify-no-changes` -> 0. `dotnet test` twice with `JAARPLANNER_TEST_POSTGRES` -> 496/0
  and 152/0.
- `corepack pnpm test | lint | build` -> 187/12, exit 0, built in 3.86 s.
- `psql` (native PostgreSQL 17): created, migrated and dropped `jp_e116_pass2`; seeded 1 minimumdoel,
  1 schooljaar, 1 klas and 1 thema carrying all four link layers. The shared dev database (`jaarplanner`,
  302 rows including the `-CHK-` fabrications and `DEMO-*`) was **read only, never written**.
- `dotnet run --project src/Jaarplanner.Api --no-launch-profile --urls http://127.0.0.1:5287` and
  `pnpm dev --port 5276` with `VITE_API_PROXY_TARGET=http://127.0.0.1:5287`. Both stopped afterwards and the
  verification database dropped. Note Vite bound **`[::1]:5276` only**, so `http://127.0.0.1:5276` refuses
  the connection while `http://localhost:5276` works.
- About 40 `curl` calls, two Op.stap `.xlsx` workbooks built with Python/openpyxl, and seven Playwright
  scripts driving Edge.

## Evidence

Screenshots copied into `docs/ux/wireframes/` (**untracked**, commit or delete as you see fit):
`e1-16-r2-register-1440.png`, `e1-16-r2-51rijen-laatste-doel-laden.png`, `e1-16-r2-detail-1440.png`,
`e1-16-r2-facetten-500.png`, `e1-16-r2-leeg-curriculum.png`, `e1-16-r2-390-lijst.png`,
`e1-16-r2-390-detail.png`, `e1-16-r2-vervallen-na-herimport.png`.

Console output during the whole browser pass was four Vite HMR lines and the React DevTools notice: no
errors, no warnings and no failed network requests other than the ones I injected deliberately.

## Defects

**None.** The round-1 defect is fixed and confirmed in a browser; the guard that closes its class is proven
able to fail; the empty-state ordering is pinned by tests that fail on the exact regression and behaves
correctly in a live browser against a broken facets endpoint. The five items above are observations, and I
recommend none of them block closing E1-16.
