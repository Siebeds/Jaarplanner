# E3-05 — Test report

**Executed locally, 2026-07-28:** `dotnet test backend/Jaarplanner.sln` → **319 unit passed / 0 failed**;
integration **19 passed / 0 failed / 22 skipped**. `dotnet format --verify-no-changes` clean. No migration
drift. Frontend untouched by this story.

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| Block unit configurable behind a seam | ✅ PASS | `Grain_volgt_configuratie_zonder_codewijziging` — same code, 5-wk vs 3-wk options, different grid |
| Default documented, not compiled-in | ✅ PASS | `Standaard_indeling_gebruikt_de_geratificeerde_twee_tier_cadans`; default lives in `PlanningsblokOptions`, documented against the 2026-07-14 decision |
| No month assumption (Art. IX.3) | ✅ PASS | `Geen_enkel_niveau_is_een_kalendereenheid` asserts exact enum membership — adding `Maand` fails |
| Belgian school year Sept→June | ✅ PASS | `Schooljaar_overspant_twee_kalenderjaren` |
| Blocks respect the vakantiestructuur | ✅ PASS | `Blokken_lopen_nooit_door_een_vakantie`, `Lesperiodes_splitsen_het_jaar_rond_de_vakanties` |
| Grid stays inside the year, ordinals gapless | ✅ PASS | `Blokken_blijven_binnen_het_schooljaar_en_zijn_opeenvolgend` |
| Bad configuration surfaces usefully | ✅ PASS | `Onbruikbare_configuratie_wordt_geweigerd` — message names the config section |
| Schooljaar persistence (owned vakanties) | ⏳ **unverified locally** | `Postgres/SchooljaarPersistentieTests` (3 tests) — **skipped**, no Docker/PostgreSQL on this machine; needs CI |

**Note on the skips.** The story's acceptance criteria are all covered by *executed* tests; the skipped
three cover the EF mapping (owned collection, `DateOnly` → `date`, cascade), which is additional assurance
rather than an acceptance criterion. Flagging the distinction explicitly because the previous round's
antagonist audit rightly criticised claiming things as done on skipped evidence.

---

## Round 2 — 2026-07-28 (after the antagonist fixes)

**Executed locally:** `dotnet test backend/Jaarplanner.sln` → **326 unit passed / 0 failed** (22 planning);
integration **19 passed / 0 failed / 22 skipped**. `dotnet format --verify-no-changes` clean. No migration drift.

The audit's central criticism of round 1 was *"the tests confirm the implementation's shape; they do not
falsify it"* — three properties were credited to tests that did not assert them. Those three now have tests:

| Property the audit showed was unasserted | Test | Result |
| --- | --- | --- |
| Every themaperiode falls inside the ratified 4–6 weeks | `Elke_themaperiode_valt_binnen_de_geratificeerde_vier_tot_zes_weken` | ✅ (was **failing** in round 1's code: three 1-week blocks) |
| Every subthemaperiode nests in exactly one themaperiode, children tile the parent | `Elke_subthemaperiode_ligt_in_precies_een_themaperiode` | ✅ (was **false** in round 1) |
| `Ordinaal` is *not* stable across a vacation edit | `Ordinaal_is_geen_stabiele_sleutel_over_vakantiewijzigingen` | ✅ pins the honest contract |
| Identity is `(Niveau, Start)` | `Identiteit_is_niveau_plus_startdatum` | ✅ |
| The grain binds from the real config section path | `Grain_wordt_gebonden_uit_de_configuratiesectie`, `Sectienaam_is_de_verwachte_configuratiesleutel` | ✅ |
| A too-short teaching stretch yields one short block (documented limit) | `Te_korte_lesperiode_levert_een_kort_blok` | ✅ |
| `SubthemaperiodeWeken > ThemaperiodeWeken` rejected | `Subthemaperiode_langer_dan_themaperiode_wordt_geweigerd` | ✅ |

**Cross-check against the approved wireframe.** The shipped derivation now produces, for 2026-2027:
7 themaperiodes of 31/31/42/42/42/37/36 days (4,4–6,0 weken) — **exactly** the grid the approved E3-10
wireframe depicts. Code and design agree.

**Still `[~]`:** the 3 PostgreSQL persistence tests remain unrunnable here (no Docker / no local PostgreSQL).

---

## CI round — 2026-07-28 (story closed)

**Run [30357426252](https://github.com/Siebeds/Jaarplanner/actions/runs/30357426252) — green.**
`Failed: 0, Passed: 42, Skipped: 0` integration · `Failed: 0, Passed: 328, Skipped: 0` unit.

The three PostgreSQL persistence tests round 2 left unrunnable are now executed and green:

| Test | Pins |
| --- | --- |
| `Schooljaar_met_vakanties_rondtript` | the owned `Sluitingen` collection and `DateOnly` → `date` survive a round-trip through real Npgsql, read back through the `Vakanties` projection |
| `Schooljaarnaam_is_uniek` | the unique index is enforced by the database (SQLSTATE `23505`), not just by application code |
| `Verwijderen_neemt_de_vakanties_mee` | cascade delete of the owned collection, verified in raw SQL against `schoolsluitingen` |

*Corrected 2026-07-28 (antagonist audit).* This table first credited the round-trip test with pinning "the owned `Schoolvakantie` collection" — a type renamed to `Schoolsluiting` in the commit immediately before, precisely because the old name asserted something false. It also named the wrong member: the owned collection is `Sluitingen`; `Vakanties` is the filtered projection `_sluitingen.Where(s => s.BreektPeriode)` that the test actually reads.

**Correction to round 2's framing.** It said the story was held at `[~]` "awaiting CI". Reading the logs
afterwards shows these three tests **passed on their very first CI run** (2026-07-28 09:11) and every run
since. The red CI that appeared to gate this story was four stale assertions in E1-07's
`SchoolcontentImportEndpointsTests` — a different story, a different file, an unrelated failure. E3-05 was
held for two days by a red badge it did not cause, because "CI is red" was taken at face value instead of
being read.

Worth noting for the same reason round 2 was written the way it was: the honest move is to name which test
failed, not which build failed.

---

## Round 4 — 2026-07-28: the gap the closing audit found

The audit that reviewed this story's closure accepted the `[x]` but identified **one unasserted property, and
it was the most consequential field in the entity**: no PostgreSQL test persisted a `Sluitingssoort.VrijeDag`.

All three tests above construct a `Schoolsluiting` without a `soort`, which defaults to `Vakantie` (enum `0`).
So no test anywhere persisted a `VrijeDag`, and there was no evidence that the field deciding whether a
closure breaks a planning period — the subject of the directie ruling of 2026-07-28 — survives storage as
anything other than `Vakantie`. The domain behaviour was unit-tested; storage was not, and storage is the
layer the E1 reopening proved cannot be taken on trust from the in-memory provider. Same failure shape as
round 1's, one level down: a property credited to tests that did not assert it.

> **Correction (2026-07-28, second audit).** An earlier revision of this section claimed that deleting
> `sluiting.Property(s => s.Soort).HasConversion<string>()` "would have left all three green while silently
> turning every persisted `VrijeDag` back into a `Vakantie`". That is **false**, and the audit was right to
> reject it. `Soort` is `varchar(16) NOT NULL`, so removing the conversion makes EF send an `int` at a
> `varchar` column → SQLSTATE `42804`, and the three tests above go **red**. Removing the mapping with
> `Ignore()` hits the `NOT NULL` column → `23502`, also red. And deleting the conversion *plus* regenerating
> the migration to an int column preserves the distinction perfectly — an int round-trips fine. **There is no
> single change to that file producing the silent corruption described.** The gap was real, but it was the
> absence of a positive assertion, not the presence of a silent-failure mode. Correcting this here because
> the round it belonged to was itself about documents crediting tests with guarantees they do not provide —
> repeating that sin while fixing it would be worse than the original.

**Added:** `Sluitingssoort_blijft_onderscheiden_en_alleen_een_vakantie_breekt_de_periode` persists a
`Vakantie` (Herfstvakantie) **and** a `VrijeDag` (Pinkstermaandag) in one schooljaar and asserts, after
reload:

| Property | Assertion | Kind |
| --- | --- | --- |
| The soort differentiates after a round-trip | `Sluitingen[0].Soort == Vakantie`, `Sluitingen[1].Soort == VrijeDag` | **The load-bearing one** — previously unasserted at any layer against a real database |
| Only a vakantie cuts the year | `Vakanties` contains **only** Herfstvakantie; `Lesperiodes().Count == 2`, not 3 | Consequence that matters to the grid |
| A vrije dag is a non-teaching day *inside* a stretch | `IsLesdag(21 May 2029)` false, yet that date falls within one of the returned stretches | Sharpest: pins the difference between "not a teaching day" and "ends a period" |
| Stored legibly, by name | raw SQL over `schoolsluitingen` returns `["Vakantie", "VrijeDag"]` | Change-detector, **not** a correctness guard — an int mapping would satisfy every row above. Kept so a move away from a readable schema is deliberate rather than accidental |

This makes the ratified vakantie/vrije-dag distinction falsifiable at the storage layer, where it was
previously only assumed.
