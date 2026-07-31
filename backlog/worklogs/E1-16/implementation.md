# E1-16 — Doelen-UI: doorzoeken, filteren en één doel inspecteren

## Build round 1 — the read API plus the register screen, end to end

- **FR / Article:** FR-2.1/2.2/2.3/2.4 · Art. III.1 (curriculum read-only), Art. VII.0/VII.1 (taxonomy:
  only Discipline → Domein → Subdomein, `(domein, subdomein)` grouping, nullable `cluster`), Art. VIII
  (layering), Art. XII + WCAG 2.2 AA (doelsoort colour **and** label), Art. II.3 (Dutch copy in `nl.json`),
  ADR-0017, ADR-0021, `ui-ux-approach.md` §1/§2.1/§3.
- **Branch:** `story/E1-16-doelen-ui`, off `feature/e1-curriculum-content` at `8203dbb`. Three commits,
  local only: `afb6e6c` (backend), `ad847aa` (screen), `165859b` (what the browser check found).
  Not pushed, no PR. The backlog checkbox and `README.md` were deliberately **not** touched.

### Files changed

Backend:

| Path | Why |
| --- | --- |
| `backend/src/Jaarplanner.Application/Curriculum/ILeerplandoelenQuery.cs` | The read port: page/search, one detail, the facets. Mirrors `IOngekoppeldeDoelenQuery`. |
| `backend/src/Jaarplanner.Application/Curriculum/LeerplandoelFilter.cs` | The filter criteria + page size as part of the contract. |
| `backend/src/Jaarplanner.Application/Curriculum/LeerplandoelWeergaven.cs` | Row, page, detail, concordance, link and facet read views. |
| `backend/src/Jaarplanner.Infrastructure/Persistence/LeerplandoelenQuery.cs` | EF Core adapter: `ILIKE` search with an escaped pattern, exact filters via `lower()`, paging, grouped facets, links across the four Art. IX.2 tables. |
| `backend/src/Jaarplanner.Api/Controllers/LeerplandoelenController.cs` | Thin controller; three GETs, no write verb; explicit 400s. |
| `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` | Registers the query. |
| `backend/tests/Jaarplanner.IntegrationTests/Postgres/LeerplandoelRegisterEndpointsTests.cs` | 17 Postgres-backed tests (see below). |

Frontend, all new under `frontend/src/features/doelen/` unless noted:

| Path | Why |
| --- | --- |
| `types.ts` | Wire types mirroring the read views. No request type for a mutation exists, because no endpoint does. |
| `api.ts` | Three GETs; the filter becomes a query string here, once. |
| `useDoelen.ts` | TanStack Query: `useInfiniteQuery` for the register, the facets, one detail. |
| `doelenfilter.ts` | URL ↔ filter mapping, the active-chip list, and the doelsoort→border-token table. |
| `DoelenPagina.tsx` | The screen: header, filters, list pane, detail pane via `<Outlet />`. |
| `Doelenfilters.tsx` | Search form + five data-driven selects + removable chips. |
| `Doelenlijst.tsx` | The paged register and two of the three empty states. |
| `Doelregel.tsx` | One dense row with the doelsoort edge. |
| `Doeldetail.tsx` | One doel in full, plus the unknown-code empty state. |
| `testdata.ts` | Fixtures and a fetch fake that filters/sorts/pages server-side. |
| `DoelenPagina.test.tsx`, `Doeldetail.test.tsx` | 47 tests. |
| `frontend/src/App.tsx` | `/doelen` now renders the register, with `:code` as a **nested** route. |
| `frontend/src/app/routes.ts` | `/doelen` flipped to `isGebouwd: true`, with a note on what is and is not behind it. |
| `frontend/src/i18n/nl.json` | The `doelen.*` copy; `binnenkort.doelen` removed as now-orphaned. |

### Key decisions

1. **A register, not a card grid.** E2-06's cards suit a short gap list; after a full import this is
   thousands of rows. One dense row: code in mono as a left spine, doelsoort badge, jaar/fase, text clamped
   to one line, `domein · subdomein` right-aligned.
2. **The doelsoort edge is the one bold element** and introduces **no new hue and no new token**: the six
   existing `doelsoort-*` tokens used as a 4px left border instead of a fill. It is redundant with the letter
   badge on purpose (Art. XII).
3. **Volume is a server concern.** Page size 50, ordered `(domein, subdomein, code)` like the existing gap
   query, with a total and a "meer laden" that fetches the *next* 50. `useInfiniteQuery` rather than a
   growing `aantal`, which would re-download what is already on screen.
4. **Filters are built from the data**, via a facets endpoint. This is the **Art. XIV seam**: which
   disciplines are in scope, whether `leergebied`/Wereldoriëntatie is surfaced, and whether jaar/fase reads
   1K/2K/3K or JK/K2/K3 are all unresolved, and each of them *is* one of these lists. A compiled-in enum
   would answer all three silently and then disagree with the database. `(domein, subdomein)` is nested
   structurally, and a subdomein arriving without its domein is dropped rather than sent (Art. VII.0).
5. **Selection in the path, filters in the query string** (ADR-0021), so a doel is deep-linkable and a
   filtered register is shareable. Filters are written with `replace` so filtering does not bury the exit
   from the screen in history.
6. **Search is a form submit, not per-keystroke.** Every keystroke would be a database query over thousands
   of rows *and* a URL write, and the URL is the shareable source of truth. Enter submits natively.
7. **`doelsoort` is bound as a string and parsed explicitly.** ASP.NET Core binds any integer to an enum
   parameter without validating it, which is exactly how `?niveau=99` produced a 500 in E3-06.
8. **The port is in Application, the adapter in Infrastructure.** Stated because putting a port in
   Infrastructure is a live filed defect here (E7-13).

### Tests added

**Backend, 17 Postgres-backed tests** in `Postgres/LeerplandoelRegisterEndpointsTests.cs`. They cannot live
on the EF in-memory provider: it has no `ILIKE`, no collation and no real ordering, so a green in-memory run
would have said nothing about this class.

- `Register_pageert_in_de_database_op_echt_volume` — seeds **2 507** goals, asserts the page cap (50), the
  total, and that the concatenated pages equal one unpaged read with nothing repeated or skipped. An
  unstable sort breaks that last assertion, which is why it is phrased that way rather than as "ordering
  looks right".
- `Gefilterde_zoekopdracht_is_een_vast_aantal_statements` — counts SQL statements through a
  `DbCommandInterceptor` and pins them at **2** for both a 3-row and a ~2 500-row match. This is the
  no-N+1 claim measured rather than asserted.
- Search on code and on free text, case-insensitively; LIKE metacharacters matched literally (`%` and `_`).
- `Subdomein_filtert_alleen_binnen_zijn_domein` — the seed repeats "Bouwstenen" under two domeinen, so a
  subdomein-only filter returns 2 and the qualified pair returns 1 each.
- Discipline / doelsoort / jaar-fase filters, combining, and both doelsoort spellings.
- `Facetten_komen_uit_de_data` — including that each domein's count equals the sum of its subdomeinen's.
- The detail: every field, the loaded concordance, and all four Art. IX.2 link layers each in a different
  status (`Manueel`, `Voorgesteld`, `Aanvaard`, `Geweigerd`).
- Absent optional fields as null; the review flag in list **and** detail; case-insensitive code lookup.
- `Curriculum_heeft_geen_schrijfpad` — POST/PUT/PATCH/DELETE all 405, and the row unchanged afterwards.
- `Ongeldige_invoer_geeft_400_geen_500` — six bad inputs, all 400.
- `Onbekende_code_geeft_404`, and `Ongekoppeld_blijft_zijn_eigen_route` (the E2-06 gap list shares the route
  position with `{code}`; if precedence ever flipped, only the E2 screen would notice).
- `Concordantie_naar_een_niet_ingeladen_minimumdoel_kan_niet_bewaard_worden` — documents the **E1-04
  blockage as an executed test**: SQLSTATE 23503. See the honesty note below.

**Frontend, 47 tests** (159 total across 11 files). The fetch fake filters, sorts and pages *server-side*,
so a screen that narrowed a local copy would fail rather than pass; the filter tests assert the **request
carried the filter**, not merely that the visible rows changed. Covered: the row's five fields and the
doelsoort abbreviation; read-only stated exactly once; **every count through `tAantal`, with the singular
case pinned** (the "1 doelen" bug has shipped here four times); the review marker as visible text with no
`title`; a bounded page request, "meer laden" appending, and the action disappearing on the last page; each
of the five filters plus search; subdomein disabled until a domein is chosen; a subdomein-only link dropped;
chips removable individually and all at once; **the three empty states each asserted to exclude the other
two's copy**; the nested route, Back, and filters preserved when a doel opens; the detail's absent-field
handling, all three concordance states, all four link layers with their statuses; and one test that walks
**every control on the screen** and fails on anything not read-side, including `contenteditable` and a form
with an `action`.

### Gates — real output

| Gate | Result |
| --- | --- |
| `dotnet build` | Build succeeded, 0 warnings, 0 errors |
| `dotnet format --verify-no-changes` | clean (exit 0, no output) |
| `dotnet test` (unit) | **Passed! Failed: 0, Passed: 468, Skipped: 0, Total: 468** |
| `dotnet test` (integration, `JAARPLANNER_TEST_POSTGRES` set) | **Passed! Failed: 0, Passed: 111, Skipped: 0, Total: 111** |
| `corepack pnpm install` | Done in 16.6s |
| `corepack pnpm lint` | clean (`eslint . --max-warnings 0 && tsc --noEmit`) |
| `corepack pnpm test` | **Test Files 11 passed (11) · Tests 159 passed (159)** |
| `corepack pnpm build` | ✓ built, `index-B0oRwVj8.js` 387.26 kB / `index-BvPuHgGG.css` 37.82 kB |

Exact integration command, from `backend/`:

```
JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable" dotnet test
```

**0 skipped in both projects**, so nothing here is a locally-skipped test being reported as done. The
password is the throwaway local one sanctioned by Art. VI.4.

*Note on a false start:* the first attempt at the final `dotnet test` failed with MSB3027/MSB3021 because
the dev API from the browser check still held the DLLs. That is a machine state, not a test failure; the run
above is after stopping it.

### Browser check — what I actually saw

API on **:5286**, Vite on **:5275**, as instructed, against local PostgreSQL 17. Headless Chrome, screenshots
inspected at 1440px and at a true 390px viewport.

**Dev data I inserted** (fabricated, local only, never committed and not official Op.stap content):
3 `minimumdoelen` (`K-CHK-01`, `4-CHK-02`, `6-CHK-03`) and **288** leerplandoelen whose codes all carry the
`-CHK-` infix, across 11 `(domein, subdomein)` pairs in 5 disciplines and 9 jaar/fasen, with "Bouwstenen"
deliberately repeated under Muziek / Beeld / Drama / Dans. Doelsoort spread afterwards so all six occur
(MD 47, G 105, S 44, A 42, + 40, P 24); 47 carry a concordance; 2 flagged `niet_meer_in_opstap` through EF
property metadata, the same mechanism the sanctioned import uses. With the 14 pre-existing `DEMO-*` rows the
register holds **302**. Remove with:

```sql
DELETE FROM leerplandoelen WHERE "Code" LIKE '%-CHK-%';
DELETE FROM minimumdoelen  WHERE "Ref"  LIKE '%CHK%';
```

What the browser showed, and what it found that 157 green tests had not:

1. **`?doelsoort=MD` filtered nothing** while the URL claimed it did: the UI read only the wire name, though
   `MD` is the official Op.stap code (Art. VII.1) and the API accepts it. Fixed and normalised; two tests
   added.
2. **The filter grid could blow out its container.** A `1fr` track is `minmax(auto, 1fr)` and a `<select>`'s
   min-content width is its widest option, so a long discipline name could push the grid past the viewport.
   `min-w-0` per cell. Same defect shape as E3-06's 600px-wide period column.
3. **390px layout.** One-column filters were taller than the phone viewport and pushed every doel below the
   fold; a row spent a whole line on the jaar/fase. Two-column filters, jaar/fase on the code line: **9**
   doelen visible instead of 6. The filters are now hidden at phone width while a doel is open, because
   there the detail replaces the list and they would act on something invisible; after that the whole doel
   fits on one phone screen.
4. **Desktop:** 4 columns left "Jaar of fase" orphaned on a second row; now 5 at `xl`.

Also confirmed by looking: no horizontal overflow at a true 390px viewport (measured:
`documentElement.scrollWidth == clientWidth`, and nothing inside `main` extends past the right edge); the
selected row highlighted *and* carrying its "nakijken" marker; the review-flag panel in the attentie
language; the filtered-to-nothing state offering "Wis alle filters" and **not** claiming the curriculum is
missing; `?domein=Beeld` and `?doelsoort=MD` restoring the select, the chip and the count from a link.

*A trap worth recording:* headless Chrome on Windows **clamps `--window-size` to about 504px**, so a
`--window-size=390` screenshot shows a 504px layout with 114px cropped and reads as a horizontal-overflow
bug that is not there. I chased that before measuring it. The reliable way is an exactly-390px iframe, which
has its own viewport and its own media queries.

**Contrast, measured in the browser with alpha composited** (jsdom cannot evaluate colour, and this repo has
shipped two WCAG failures behind a green axe run):

| Pair | Ratio | Floor |
| --- | --- | --- |
| `ink` on paper / card | 14.55 / 15.42 | 4.5 |
| `ink-zacht` on paper / card | 5.73 / 6.08 | 4.5 |
| `petrol` on card / on `petrol-wash` | 8.90 / 7.96 | 4.5 |
| `petrol-foreground` on `petrol` | 8.90 | 4.5 |
| `attentie-ink` on `attentie-zacht` | 9.39 | 4.5 |
| `suggestie-geweigerd` on card | 6.48 | 4.5 |
| doelsoort edge md / gemeenschappelijk / verdieping | 7.13 / 7.46 / 5.08 | 3.0 (SC 1.4.11) |
| doelsoort edge precurriculum / specifiek / anderstalige | 5.82 / 5.53 / 5.40 | 3.0 (SC 1.4.11) |

All pass. The measurement pages used for this were temporary and are deleted; they are not in any commit.

### Self-check vs the four acceptance criteria

1. **Paginated list at real volume** — met. Server-paged at 50 with a total and "meer laden"; proven at
   2 507 rows in Postgres (page cap, total, stable order across every page) and at a constant 2 SQL
   statements regardless of match size; seen in the browser at 302 rows.
2. **Search + filter, taxonomy grouped by `(domein, subdomein)`** — met. One field over code and free text,
   case-insensitive `ILIKE` with an escaped pattern; discipline / domein / subdomein / doelsoort / jaarFase
   all from the data; the repeated-subdomein case tested in Postgres and present in the dev data.
3. **Open one doel and read every imported field, its `minimumdoelRef` and its thema links with status** —
   met for every field, the concordance, and all four link layers. **One qualification, stated rather than
   rounded up:** the branch "concorded, but the decreed omschrijving is not loaded" is pinned by a frontend
   test and **not** by a Postgres test, because the schema cannot produce it —
   `leerplandoelen.MinimumdoelRef` is a `Restrict` FK, so such a row fails to commit (asserted:
   SQLSTATE 23503). That is the E1-03/E1-04 blockage, not a gap in this story. I deliberately did not fake
   it by dropping the constraint in a fixture, which would have tested a database this app never runs
   against.
4. **Visibly read-only, no edit affordance whatsoever** — met. No write method on the port, no mutating
   action on the controller (POST/PUT/PATCH/DELETE all 405 against a live server), one line of read-only
   copy above the list and none per row, and a test that walks every control and fails on anything not
   read-side.

### For the test-runner

- **Unit/integration:** `corepack pnpm test` in `frontend/` (from Bash), and from `backend/`
  `dotnet test` with `JAARPLANNER_TEST_POSTGRES` set as quoted above. Expect 159 / 468 / 111, 0 skipped.
- **Playwright, worth doing** — the value here is layout and colour, which jsdom cannot see:
  1. `GET /doelen` — the register renders with a count line and the doelsoort edge per row.
  2. Choose **Domein = Natuur**, then **Subdomein**: it is disabled until the domein is set, and then offers
     only that domein's subdomeinen. Check the chips and "Wis alle filters".
  3. Open `/doelen?doelsoort=MD` and `/doelen?domein=Beeld` cold: the select, the chip and the count must all
     reflect the link.
  4. Click a row: URL becomes `/doelen/<code>`, the detail appears, **Back** returns to the list with the
     filters intact.
  5. `/doelen/BESTAAT-NIET-1` must say the doel does not exist, not show an empty pane.
  6. `?zoek=zzzzzz` must offer "Wis alle filters" and must **not** say the curriculum is unimported.
  7. At **390px**: the detail replaces the list, the filters are hidden while it is open, "Terug naar de
     lijst" works, and there is no horizontal scrollbar.
  8. Contrast at both widths, alpha composited. Do not trust a green jsdom axe run for colour.
- **Note on data:** the "no curriculum imported" empty state needs an **empty** `leerplandoelen` table. With
  the dev data above it cannot be reached in the browser; it is covered by a frontend test. Delete the
  `-CHK-` rows *and* the `DEMO-*` rows to see it live.
- Ports: I used API **:5286** and Vite **:5275**; both are stopped now.

### Open questions / Art. XIV touched

- **Three open Art. XIV decisions are behind this screen's filters and none is answered here:** disciplines
  in scope, `leergebied`/Wereldoriëntatie surfacing, and the `jaarFase` code form. Every list is derived from
  the loaded rows, so whichever way they resolve, the register follows the data with no code change. Nothing
  in this story should be read as having chosen.
- **E1-12 still gates the minimumdoel half of §3's "Doelen" destination.** No `Minimumdoel` row can exist,
  so I built **no** minimumdoel tab or screen: the concordance is shown per doel with an honest line. This is
  the E3-06 rule (never ship a control that renders nothing), and it means the nav's `isGebouwd: true` for
  `/doelen` covers the leerplandoel register only. That is recorded in `routes.ts` beside the flag rather
  than only here.
- **E1-15 remains the missing Op.stap import trigger.** The "nothing imported yet" empty state therefore
  says loading Op.stap is beheerderswerk and links to nothing, because there is nothing to link to.
- **Facets are unfiltered**, i.e. the option counts describe the whole curriculum rather than the current
  filter. Deliberate: cascading counts would make the filter list shift as it is used. Worth a directie
  opinion if teachers find it confusing.
- **No authorisation.** Like every other screen today, this one is unauthenticated (E6-01/E7-11). It is a
  pure read of decreed reference data, so there is nothing to leak beyond the curriculum itself, but it is
  not role-scoped either.
