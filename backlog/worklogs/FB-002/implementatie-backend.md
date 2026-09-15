# FB-002 — K3-leerkrachten beheren de gedeelde rapportdoelen en de sterrenschaal (backend half)

## Build round 1 — `Gradatie`, `Rapportdoel`, the `RapportsetBewerken` row, the two controllers, the D12 prune

- **FR / Article:** FR-13.2; Art. VI.1, VI.7, IX.2, IX.4; ADR-0035 §3.1, §3.2 (D1, D2, D3, D11, D12), §3.3 (R3–R7,
  R31, D4); ADR-0030 §3 row "De K3-rapportdoelen en de sterrenschaal aanpassen" and footnote ⁶; ADR-0011 §2.
- **Owner rulings applied (2026-09-15, in session):** the scale starts with the owner's example ("Volledig bereikt"
  groen first, "Nog niet volledig" oranje second). The fixed palette is six: Groen, Lichtgroen, Geel, Oranje, Rood,
  Blauw, in that order. FB-002 is stacked on FB-001.
- **Files changed (backend):**
  - `src/Jaarplanner.Domain/Ontwikkelingsrapport/Sterkleur.cs`: the six-colour enum, stored and serialised by name.
  - `src/Jaarplanner.Domain/Ontwikkelingsrapport/Gradatie.cs`: `Id`, `Label` (trimmed, required, max 60), `Kleur`,
    `Volgorde`. `Wijzig` checks label and kleur before it changes either. `ZetVolgorde`. No schooljaar (R7).
  - `src/Jaarplanner.Domain/Ontwikkelingsrapport/Rapportdoel.cs`: `Id`, `Titel` (trimmed, required, max 120),
    `Volgorde`, and a set of `RapportdoelSubdoel` rows. `Wijzig(titel, subdoelIds)` dedupes, refuses `Guid.Empty`,
    keeps the row of a subdoel that stays, and changes nothing on a refusal. `SubdoelLeeftijd = "K3"`.
  - `src/Jaarplanner.Domain/Ontwikkelingsrapport/RapportdoelSubdoel.cs`: the join row `(RapportdoelId, SubdoelId)`.
  - `src/Jaarplanner.Application/Ontwikkelingsrapport/IRapportsetService.cs`: the contract and the DTOs
    (`GradatieInvoer`, `GradatieWeergave`, `VolgordeInvoer`, `RapportdoelInvoer`, `RapportdoelWeergave`,
    `RapportdoelSubdoelWeergave`).
  - `src/Jaarplanner.Infrastructure/Ontwikkelingsrapport/RapportsetService.cs`: the CRUD, the membership check on
    every write, the membership filter on every read, the reorder rule, the Dutch sentences.
  - `src/Jaarplanner.Infrastructure/Persistence/Configurations/GradatieConfiguration.cs`: table `gradaties`, colour by
    name (max 16).
  - `src/Jaarplanner.Infrastructure/Persistence/Configurations/RapportdoelConfiguration.cs`: tables `rapportdoelen` and
    `rapportdoel_subdoelen` (composite PK; FK to `rapportdoelen` Cascade; FK to `subdoelen.Id` Cascade, with no
    navigation on the `Subdoel` side).
  - `src/Jaarplanner.Infrastructure/Persistence/AppDbContext.cs`: `Gradaties`, `Rapportdoelen`, `RapportdoelSubdoelen`.
  - `src/Jaarplanner.Infrastructure/Persistence/Migrations/20260915122050_AddRapportdoelenEnGradaties(.Designer).cs`
    and the model snapshot: generated with `dotnet ef migrations add`. It holds only the three tables, their keys, the
    two FKs and the `SubdoelId` index. The seed was added by hand: an `InsertData` of the two starting gradaties with
    fixed ids. The snapshot diff is the three entities and nothing else.
  - `src/Jaarplanner.Infrastructure/DependencyInjection.cs`: registers `IRapportsetService`.
  - `src/Jaarplanner.Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs`: `WijzigSubthemaAsync` deletes
    the join rows of the subthema's subdoelen when its leeftijd changes away from K3, in the same `SaveChanges` (D12).
  - `src/Jaarplanner.Application/Toegang/Rechtenmatrix.cs`: `Matrixrij.ZonderDirectie`. The column
    `Kolom.Rapportsetleerkracht = 512`. The row `RapportsetBewerken` with its `Beleid` constant and `Rijen` entry. In
    `StaatToe`, directie short-circuits only when `!rij.ZonderDirectie`, and the new column matches
    `LopendeRapportklasIds.Count > 0`. The docs that said directie passes every row now name the exception.
  - `src/Jaarplanner.Application/Toegang/Rechten.cs`, `src/Jaarplanner.Api/Infrastructure/Autorisatie/Rechtenbeleid.cs`,
    `src/Jaarplanner.Api/Controllers/AanmeldController.cs`: doc comments only, naming the R31 exception. `IkWeergave`'s
    `LopendeRapportklasIds` doc says that non-empty is exactly the edit right on the set.
  - `src/Jaarplanner.Api/Controllers/GradatiesController.cs`, `RapportdoelenController.cs`: the routes. Every write
    carries `[Authorize(Policy = Rechtenmatrix.Beleid.RapportsetBewerken)]`, and the reads fall under the fallback
    policy (signed in).
  - `docs/adr/0030-rollen-en-rechten-in-de-app.md`: the FB-002 note after the FB-001 one, and in footnote ⁶ how "LK
    leeftijd" is enforced for this row and why.
- **API (JSON camelCase, enums by name through the app-wide `JsonStringEnumConverter` in `Program.cs`):**
  - `GET /api/gradaties` → `[{ id, label, kleur, volgorde }]` by volgorde; `kleur` is e.g. `"Groen"`.
  - `GET /api/gradaties/kleuren` → `["Groen","Lichtgroen","Geel","Oranje","Rood","Blauw"]`.
  - `POST /api/gradaties` `{ label, kleur }` → 201, appended. `PUT /api/gradaties/{id}` → 200. `DELETE` → 204.
    `PUT /api/gradaties/volgorde` `{ ids }` → 204.
  - `GET /api/rapportdoelen` → `[{ id, titel, volgorde, subdoelen: [{ id, leerplandoelCode, leerplandoelTekst,
    doelsoort, themaNaam, subthemaNaam }] }]`. `GET /api/rapportdoelen/kandidaten` → the same item shape.
    `doelsoort` is the `Doelsoort` enum name, e.g. `"Gemeenschappelijk"`, as on the leerplandoel read endpoints.
  - `POST /api/rapportdoelen` `{ titel, subdoelIds }` → 201, appended. `PUT /api/rapportdoelen/{id}` → 200.
    `DELETE` → 204. `PUT /api/rapportdoelen/volgorde` `{ ids }` → 204.
- **Key decisions:**
  - **Membership (D11, D12)** is decided by one query shape (`RapportsetService.Kandidaten`): the subdoel's
    **subthema** has leeftijd `K3` (not `Subdoel.Leeftijd`, which goes stale on a re-scope), and its link is
    `Aanvaard` or `Manueel` (the `EfDekkingOpslag` filter). Writes refuse any other id with one sentence, unknown ids
    included, so the answer reveals nothing about which ids exist. Reads filter on the same rule, so a stored row that
    stops qualifying is not shown.
  - **D3 lives in the database**: the Cascade from `subdoelen` to `rapportdoel_subdoelen` covers every delete path
    (subdoel route, subthema delete, thema delete cascade, FR-1 re-import, wizard) whether or not a path loaded the row.
    The rapportdoel keeps its titel.
  - **D12 "leaves" is a delete, not just a filter**, so a subthema moved back to K3 does not re-add its subdoelen.
    Both subthema PUT paths (ordinary and wizard) go through `SchoolcontentBeheerService.WijzigSubthemaAsync`.
  - **No route sets a subdoel to `Geweigerd` today.** The read filter carries D11 for when one exists; the service doc
    says that such a route must also delete the join rows, as the re-scope does, or a subdoel accepted again would come
    back unasked.
  - **An empty `subdoelIds` was allowed (a default, flagged in a comment).** R3 rules out a titel-only *kind* of
    rapportdoel; it does not stop a teacher naming one first. Refusing it would also make the last subdoel impossible
    to remove, while D3 and D11 can empty a rapportdoel anyway. What a report does with an empty rapportdoel is FB-003's.
    *Overruled by the owner on 2026-09-15, after antagonist round 1 ("Altijd minstens één"):* create and update both
    refuse an empty list with `RapportsetService.GeenSubdoel`, "Kies minstens één subdoel.". The last subdoel cannot be
    taken out; the teacher deletes the rapportdoel. The domain still allows an empty one, for D3's cascade.
  - **The column is `LopendeRapportklasIds.Count > 0`**, not `IsLeerkrachtVanLeeftijd("K3")`, so the graadklas decision
    (Art. XIV) moves the set's editors together with the leerlingen and reports (the D9 function).
  - **A directie who also held a running K3 klastoewijzing passed the row as that leerkracht.** `ZonderDirectie`
    removed the directie column, and ADR-0030 §3's union rule kept every other column. *Overruled by the owner on
    2026-09-15, after antagonist round 1 ("Nooit wie directie heeft"):* `StaatToe` returns `!rij.ZonderDirectie` for
    directie, whatever other column they hold, so a directeur with a K3 klas does not edit the set or the scale. The
    unit and integration tests now assert the refusal.
  - **Seeded by `InsertData` in the migration, not `HasData`**, so the rows belong to the school once inserted. With
    `HasData`, a later edit of the seed would generate an `UpdateData` over what the teachers made of it.
  - **The kleur binds as a string** and is parsed by name, ignoring case like the JSON converter (`"geel"` is accepted,
    `"3"` and `"Paars"` are not). So an unknown colour gets the Dutch 400 and not ASP.NET's English binding error.
    `label`, `titel`, `subdoelIds` and `ids` are nullable for the same reason.
  - **Reorder**: the list must name every item exactly once, or nothing changes. A stale screen is refused rather than
    half applied. Places are renumbered 1..n. New items are appended at max + 1.
  - **Sort orders**: gradaties and rapportdoelen by volgorde, then id. Subdoelen by thema naam and subthema naam
    (`InvariantCultureIgnoreCase`, as FB-001 sorts names), then code (ordinal), then id.
  - **D1 is not built** (it needs FB-003's ratings). Both deletes say so in a comment.
  - **The reads carry no `no-store`**: the set and the scale are not pupil data.
- **Tests added:**
  - `UnitTests/Ontwikkelingsrapport/GradatieTests.cs`: the six colour names in order; own id; trim; required; 60/61;
    unknown colour and negative order refused; `Wijzig` atomic; `ZetVolgorde`; the table has exactly `Id`, `Kleur`,
    `Label`, `Volgorde` (no schooljaar), and the colour converts by name.
  - `UnitTests/Ontwikkelingsrapport/RapportdoelTests.cs`: trim; dedupe; empty set allowed; required; 120/121;
    `Guid.Empty` refused; `Wijzig` keeps the row of a subdoel that stays; a refused `Wijzig` changes nothing; the tables
    have no schooljaar; composite key; both FKs Cascade; no navigation from `Subdoel` or `Subthema`.
  - `UnitTests/Toegang/RechtenmatrixTests.cs`: `Verwacht[RapportsetBewerken] = ["LK K3 lopend"]`. The directie test
    becomes "every row except the rapportset", and asserts that `RapportsetBewerken` is the only `ZonderDirectie` row
    and that directie is refused with every resource. Also: a K3 leerkracht of any klas, running year, with or without a
    resource, passes; after the schooljaar does not; K2, L1 or no jaarfase does not; HL of K3 without a klastoewijzing,
    HL + TB, and TB do not; a directie with a running K3 klastoewijzing does.
  - `IntegrationTests/Autorisatie/RechtenbeleidTests.cs`: directie passes every row via an attribute except
    `RapportsetBewerken`, asserted by name. A K3 leerkracht of a running year passes via an attribute, and of an ended
    year does not.
  - `IntegrationTests/Postgres/RapportsetEndpointsTests.cs` (9 tests, each on its own database):
    - the seed and the palette, with the exact JSON shape;
    - two K3 leerkrachten share one scale (create, rename, recolour, reorder, delete);
    - two K3 leerkrachten share one set (kandidaten order and shape, create with dedupe and trim, an empty rapportdoel,
      update, reorder, delete);
    - membership: K2, undecided and unknown ids refused with one sentence and nothing created; a legacy undecided row
      filtered on read; a refused goal drops out while the titel stays; aanvaard counts as decided;
    - D3: a subdoel delete, then a subthema delete, then a thema delete, each drops its subdoelen; the titel stays, and
      the join rows are gone from the table;
    - D12: an edit that stays K3 keeps membership; K3→K2 drops it; K2→K3 does not restore it; the table agrees;
    - directie (default identity and a seeded one), HL-K3 + TB without a klastoewijzing, and a K2 leerkracht read all
      four GETs and get 403 on all eight writes, with real ids and valid bodies; nothing changed;
    - a K3 leerkracht of an ended schooljaar reads and gets 403 on all eight writes;
    - a directie with a running K3 klastoewijzing creates a gradatie;
    - every Dutch validation sentence, the 404s, 60 and 120 characters accepted, `"geel"` accepted, and a refused reorder
      changes nothing.
  - `IntegrationTests/Postgres/RechtenAfdwingingTests.cs`: doc line only. `ElkeWijzigendeRouteVraagtEenRechtTests` needs
    no seed: an attribute policy refuses before binding, and `{gradatieId}` and `{rapportdoelId}` get the sweep's random
    guid.
- **Gates** (run from `backend/` on the final code, 2026-09-15; no frontend gate, since that half is the orchestrator's):
  - `dotnet format` made no changes, and `dotnet format --verify-no-changes` exits 0 ✓ (re-run after the last edit)
  - `dotnet build`: succeeded, 0 warnings, 0 errors ✓ (re-run after the last edit)
  - `dotnet ef migrations has-pending-model-changes`: "No changes have been made to the model since the last migration." ✓
  - `dotnet test` with `JAARPLANNER_TEST_POSTGRES` pointing at the local compose db (port 5433):
    - UnitTests: 1596 passed, 0 failed, 4 skipped (the live KOV contract tests; none added here) ✓. FB-001 ended at 1561.
    - IntegrationTests: 491 passed, 0 failed, 1 skipped (the live KOV import) ✓. FB-001 ended at 479. The run includes
      `ElkeRouteVraagtEenSessieTests`, `ElkeWijzigendeRouteVraagtEenRechtTests`, `RechtenbeleidTests`,
      `RechtenAfdwingingTests`, `LeerlingEndpointsTests` and the 9 new `RapportsetEndpointsTests`.
    - The first targeted run failed 2 of the new tests, and both faults were in the tests: a tuple holding an array
      compares the array by reference. The asserts were split; the service's answers were already right.
  - No stray file in the tree: no `Microsoft.NET.Workload_*.log`, and no directory named after a connection string.
- **Branch:** `ticket/FB-002-rapportdoelen-sterrenschaal`. Nothing committed; the orchestrator commits.
- **Self-check vs acceptance criteria (the backend's share):**
  - *AC1, one set for every K3 leerkracht*: `Een_K3_leerkracht_bundelt_…_elke_K3_leerkracht_ziet_dezelfde_set`.
  - *AC2, the picker holds only decided K3 subdoelen*: `GET /api/rapportdoelen/kandidaten`, and the membership test
    (K2 and Voorgesteld are absent; Aanvaard and Manueel are present).
  - *AC3, a gradatie with a label, a fixed colour and an order*: the scale test, and the palette endpoint. That every
    star shows with its label beside it is the frontend's.
  - *AC4, a refused or deleted subdoel leaves and the titel stays*: the membership test (Geweigerd) and the D3 test
    (subdoel, subthema, thema). D12 has its own test.
  - *AC5, directie and HL-K3 without a klastoewijzing view but cannot change, also by URL*: the directie/HL/K2/TB test
    (200 on reads, 403 on every write). Hiding the buttons is the frontend's: `/api/ik` `lopendeRapportklasIds`
    non-empty is exactly the right.
- **For the test-runner:** API level, plus the UI steps of the frontend half.
  - Automated: `dotnet test --filter "FullyQualifiedName~Rapportset|FullyQualifiedName~Rechten|FullyQualifiedName~Gradatie|FullyQualifiedName~Rapportdoel"`
    with `JAARPLANNER_TEST_POSTGRES` set.
  - By hand, in the dev app: sign in as a gebruiker with a klastoewijzing on a K3 klas of the running schooljaar, then
    as directie, then as a K2 leerkracht. Exercise the routes above. The seed shows on a freshly migrated database.
- **Open questions / Art. XIV touched:**
  - **A directie who also teaches a K3 klas edits the set** (the union rule). R31 reads "Alleen de K3-leerkrachten",
    and such a directie is one. If the owner means "never directie, even as a leerkracht", the fix is one line in
    `StaatToe` and two tests. *Answered 2026-09-15: the owner means that, and the fix is in.*
  - **The graadklas (Art. XIV)**: the column goes through the D9 function, so a menggroep recorded as K2 gives its
    leerkracht no edit right on the set, as it gives no leerlingen.
  - **The empty rapportdoel default** (above): the owner may want a titel-only rapportdoel refused on save.
    *Answered 2026-09-15: refused, on create and on update.*
  - **D11 on a future status route**: whoever builds a route that sets a subdoel to `Geweigerd` must delete the join
    rows there. The service doc says so.
