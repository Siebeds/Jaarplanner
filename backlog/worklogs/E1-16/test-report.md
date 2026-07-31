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
