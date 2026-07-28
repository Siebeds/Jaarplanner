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
