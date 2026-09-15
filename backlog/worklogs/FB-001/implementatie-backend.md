# FB-001 — K3-leerkracht beheert de kinderen van de klas (backend half)

## Build round 1 — `Leerling`, two ontwikkelingsrapport matrix rows, the leerlingen routes, the klas guards

- **FR / Article:** FR-13.1, FR-13.7, FR-13.10; Art. VI.1, VI.2, VI.7, IX.4; ADR-0035 §3.1, §3.3, §3.8, §3.9 (R14, R15,
  R16, R17, R26; D8, D9); ADR-0030 §3 footnote ⁶, ADR-0011 §2.
- **Files changed (backend):**
  - `src/Jaarplanner.Domain/Ontwikkelingsrapport/Leerling.cs`: new entity: `Id`, `KlasId`, `Voornaam`, `Achternaam`,
    nothing else (Art. VI.7). Trimmed, required, at most 100 characters each. `Wijzig` checks both names before it
    changes either. Refusals name the parameter, never the value (§3.8). `KlasKanLeerlingenHebben(jaarfase)` is D9, asked
    of `Leeftijdsrechten.VoorKlas` (the one klas→leeftijden mapping, R22).
  - `src/Jaarplanner.Infrastructure/Persistence/Configurations/LeerlingConfiguration.cs`: table `leerlingen`, FK to
    `klassen` with **Restrict**, index on `KlasId`, max length 100.
  - `src/Jaarplanner.Infrastructure/Persistence/AppDbContext.cs`: `DbSet<Leerling> Leerlingen`.
  - `src/Jaarplanner.Infrastructure/Persistence/Migrations/20260915090431_AddLeerlingen(.Designer).cs` and the model
    snapshot: generated with `dotnet ef migrations add AddLeerlingen`. It creates `leerlingen`, its PK, the Restrict FK
    and the index, and nothing else. The snapshot diff is the one entity.
  - `src/Jaarplanner.Application/Toegang/Rechten.cs`: two raw relations, `RapportklasIds` and `LopendeRapportklasIds`,
    plus `IsRapportleerkrachtVan(klasId)` and `VultRapportIn(klasId)` (not directie-aware). They are optional
    constructor parameters: left out they are empty, which grants nothing, so the ~20 existing call sites stay as they
    are. The constructor keeps `Lopende…` a subset of `Rapportklas…`.
  - `src/Jaarplanner.Application/Toegang/Rechtenberekening.cs`: computes both from the klastoewijzing facts it already
    had (klas jaarfase and schooljaar end were already there, so `RechtenService` needed no change). Reading: every
    klastoewijzing on a klas where `Leerling.KlasKanLeerlingenHebben` holds, with no end date. Filling in: the same, while
    `TeltNog(eind, vandaag)`.
  - `src/Jaarplanner.Application/Toegang/Rechtenbronnen.cs`: `record Rapportklas(Guid KlasId)`, plus
    `IRechtenbronnen.VoorRapportklasAsync` and `VoorLeerlingAsync`.
  - `src/Jaarplanner.Application/Toegang/Rechtenmatrix.cs`: columns `LeerkrachtRapportLezen = 128` and
    `LeerkrachtRapportInvullen = 256`, rows `OntwikkelingsrapportLezen` and `LeerlingenBeheren` with their `Beleid`
    constants and `Rijen` entries, and a `StaatToe` clause that matches only a `Rapportklas`. The "no policy yet"
    paragraph is amended rather than deleted.
  - `src/Jaarplanner.Infrastructure/Toegang/EfRechtenbronnen.cs`: both resolvers, read-only id projections. The leerling
    resolver reads the klas id only, never a name.
  - `src/Jaarplanner.Api/Infrastructure/Autorisatie/RechtOpAttribute.cs`: `Rechtbron.Rapportklas` and
    `Rechtbron.Leerling`, with 404 sentences that name no child.
  - `src/Jaarplanner.Api/Controllers/AanmeldController.cs`: `IkWeergave` gains `RapportklasIds` and
    `LopendeRapportklasIds`.
  - `src/Jaarplanner.Application/Ontwikkelingsrapport/ILeerlingBeheerService.cs`: the service contract, `LeerlingInvoer`
    and `LeerlingWeergave`.
  - `src/Jaarplanner.Infrastructure/Ontwikkelingsrapport/LeerlingBeheerService.cs`: list (sorted), create (D9 for everyone,
    Dutch validation), rename, delete. It logs nothing.
  - `src/Jaarplanner.Infrastructure/DependencyInjection.cs`: registers it beside the algemene-fiche services.
  - `src/Jaarplanner.Api/Controllers/LeerlingenController.cs`: the four routes, each with its `[RechtOp]`. The GET is
    gated too.
  - `src/Jaarplanner.Infrastructure/PlanningBeheer/KlasBeheerService.cs`: the klas delete is refused while the klas has
    leerlingen. The klas edit is refused when it would change a klas with leerlingen to a jaarfase without K3. (`WijzigKlasAsync`
    is the only path that changes a jaarfase; there is no partial edit.)
  - `src/Jaarplanner.Application/Planning/Beheer/IKlasBeheerService.cs`: doc lines for both refusals.
  - `docs/adr/0030-rollen-en-rechten-in-de-app.md`: the italic "no policy yet" sentence gains the FB-001 note, without
    deleting the original.
- **Key decisions:**
  - **D9 lives in one domain function**, `Leerling.KlasKanLeerlingenHebben`, built on `Leeftijdsrechten.VoorKlas`. The
    rights computation, the create and the klas-edit guard all ask it. Directie's graadklas decision (Art. XIV) changes
    `Leeftijdsrechten` and moves all three with it. A klas without a stated jaarfase fails closed. `Klasleeftijden` is
    deliberately not used: it widens.
  - **`Rapportklas` is a type of its own**, not a `Klasplanning`. A report resource never passes a planning row, and a
    planning resource never passes a report row. Both directions are tested.
  - **Restrict, not Cascade, on `leerlingen.KlasId`**, unlike hoeken and algemene fiches. From FB-003 on, a child takes
    their reports along, and a klas delete must not remove those silently (D7, D8). The service guard answers first
    with a sentence that says what to do; the FK holds against any path that forgets.
  - **The jaarfase guard**: without it, a K3 klas changed to K2 keeps its children in the table, but they fall out of
    every route for leerkrachten, because the matrix gives them no rapportklas that is not K3.
  - **Sort order**: `StringComparer.InvariantCultureIgnoreCase` on voornaam, then achternaam, then id. It is
    culture-insensitive and case-insensitive, as asked, and sorts "Émile" beside E rather than after Z, which
    ordinal-ignore-case would do. The id makes the order of namesakes stable.
  - **Pupil data in logs:** the service and resolvers log nothing, and no thrown message carries a child's name. EF Core
    sensitive-data logging is not enabled anywhere in `src/`. Request-body logging is off app-wide.
- **Tests added:**
  - `UnitTests/Ontwikkelingsrapport/LeerlingTests.cs`: trim, required, 100/101 limit, own id, no name in the exception
    message, atomic `Wijzig`, the D9 theory, a reflection tripwire (the class has exactly `Id`, `KlasId`, `Voornaam`,
    `Achternaam`), and a model tripwire (table `leerlingen`, four columns, max length 100, Restrict FK to `Klas`).
  - `UnitTests/Ontwikkelingsrapport/LeerlingBeheerServiceTests.cs` (in-memory): roll order (case and accent), CRUD, D9,
    the six validation sentences on create and rename, the two 404s, and both klas guards.
  - `UnitTests/Toegang/RechtenmatrixTests.cs`: two relations added as `Rechtenberekening` builds them ("LK K3 lopend",
    "LK K3 afgelopen") and the matrix-as-data expectations for both rows. Also: LK of another K3 klas, LK of a K2/L1/no
    jaarfase klas (through the real computation), R26 after the schooljaar, HL+TB of K3 without a klastoewijzing, and
    the wrong resource type failing closed in both directions.
  - `UnitTests/Toegang/RechtenberekeningTests.cs`: K3 running, ended and next year; the last-day boundary; non-K3
    jaarfasen; an invalid jaarfase failing closed; a padded jaarfase; mixed klassen; the subset rule; defaults empty;
    `Geen` empty.
  - `IntegrationTests/Postgres/LeerlingEndpointsTests.cs` (12 tests):
    - own-klas CRUD with the exact JSON shape;
    - an LK of another K3 klas gets 403 on all four routes and nothing changes;
    - an LK of K2 gets 403, also on its own klas;
    - HL+TB of K3 gets 403;
    - directie POST to K2 gets 400 D9;
    - in an ended schooljaar the LK reads, gets 403 on writes, and `/api/ik` agrees, while directie still writes;
    - anonymous gets 401 on all four;
    - 404s, including before 403;
    - Dutch validation that repeats no name, where a refused rename changes nothing;
    - klas delete refused, then allowed;
    - jaarfase K3→K2 refused, a rename allowed, then K2 allowed;
    - `/api/ik` lists for LK K3+K2, LK K2 and directie.
  - `IntegrationTests/Postgres/ElkeWijzigendeRouteVraagtEenRechtTests.cs`: seeds a leerling and fills `{leerlingId}`,
    so the sweep sends the new write routes a real resource.
  - `IntegrationTests/Postgres/RechtenEndpointsTests.cs`: the `/api/ik` property-name set gains the two lists, with
    their values asserted.
- **Gates** (run from `backend/` on the final code, 2026-09-15; no frontend gate, since that half is the orchestrator's):
  - `dotnet format` made no changes, and `dotnet format --verify-no-changes` exits 0 ✓
  - `dotnet build`: succeeded, 0 warnings ✓
  - `dotnet test tests/Jaarplanner.UnitTests`: 1561 passed, 0 failed, 4 skipped. None of the skips is added here. ✓
  - `dotnet test tests/Jaarplanner.IntegrationTests` with `JAARPLANNER_TEST_POSTGRES` pointing at the local compose db
    (port 5433): 479 passed, 0 failed, 1 skipped, the live KOV import, which needs its own opt-in. ✓
    - This includes `ElkeRouteVraagtEenSessieTests`, `ElkeWijzigendeRouteVraagtEenRechtTests`, `RechtenEndpointsTests`
      and the 12 new `LeerlingEndpointsTests`, all green.
- **Branch:** `ticket/FB-001-kinderen-van-de-klas`. Nothing committed; the orchestrator commits.
- **Self-check vs acceptance criteria (the backend's share):**
  - *Add with voornaam and achternaam, nothing else asked* → the invoer has exactly two fields, and the entity and the
    table have no other. Pinned by `LeerlingTests` and the JSON-shape assertion.
  - *Rename or delete, kept after a reload* → PUT/DELETE, with a fresh GET in `De_leerkracht_van_de_K3_klas_…`.
  - *Another klas's leerkracht is refused, also by URL* → 403 on GET/POST/PUT/DELETE (R17), and the read is gated.
  - *After the schooljaar: read but not write; directie still writes* → `Na_het_schooljaar_…`, and
    `lopendeRapportklasIds` is empty in `/api/ik`.
  - *A klas that is not K3 gets no child* → 400 D9 for directie, 403 for its leerkracht.
  - *The tab only for a K3 klastoewijzing or directie* → `/api/ik` carries `rapportklasIds` (tab when non-empty) and
    `isDirectie`. The tab itself is the frontend's.
- **For the test-runner:** API only; the UI is the frontend half.
  - `GET/POST /api/klassen/{klasId}/leerlingen`, `PUT/DELETE /api/leerlingen/{leerlingId}`, `GET /api/ik`.
  - In the running dev app, sign in through the development sign-in as a gebruiker with a klastoewijzing on a K3 klas,
    then on a K2 klas, then as directie.
  - Automated: `dotnet test --filter "FullyQualifiedName~Leerling|FullyQualifiedName~Rechten"` with
    `JAARPLANNER_TEST_POSTGRES` set.
- **Open questions / Art. XIV touched:**
  - The graadklas question (Art. XIV, directie question 14): D9 goes through `Leeftijdsrechten`, so a menggroep recorded
    as K2 gets no children, as the ticket's *Buiten scope* says.
  - Leerlingzorg (FB-008) is not on `OntwikkelingsrapportLezen` yet.
  - No `Cache-Control: no-store` on the list GET. §3.6 asks it for the kindtekening only, and the JSON carries no
    validator that invites heuristic caching. The orchestrator may want it anyway, for pupil data.

## Note added by the orchestrator, 2026-09-15 (after antagonist round 1)

This worklog describes the implementer's hand-back, and three things in it stopped being true afterwards. They are
corrected here rather than rewritten above:

- **"Nothing committed"**: the orchestrator committed the backend and the frontend together as `2285acd` (the first
  version, `acecf2e`, was amended because it tracked a stray `dotnet` workload log; see the antagonist report).
- **"No `Cache-Control: no-store`"**: the orchestrator added `[ResponseCache(NoStore = true)]` to the list GET before
  that commit, and since fix round 1 every 200 list read in `LeerlingEndpointsTests` asserts it.
- **The 404 sentence** "Dit kind bestaat niet meer. Iemand anders heeft het verwijderd." is now "Dit kind is niet
  gevonden." (round 1, finding 2): it also answers an id that never existed.

Fix round 1 also added `KanLeerlingenHebben` to `KlasWeergave` (finding 1), computed by
`Leerling.KlasKanLeerlingenHebben`, so the frontend no longer compares a jaarfase to "K3". The frontend half is in
`implementatie-frontend.md`.
