# E3-04 — Pre-generation parameters (FR-5.4) · backend half

**Status:** `[~]` — backend built and audited 2026-07-30. The UI half is outstanding, so the story is not done.
**Branch:** `story/E0-10-gates` · **Ref:** FR-5.4, FR-12.1, Art. IV.1/IV.2/IV.3/IV.4/IV.6, Art. V, ADR-0020.

## What the criterion actually says

FR-5.4: *"De leerkracht kan parameters meegeven vóór generatie (**bv.** vakanties, vaste momenten, gewenste
startthema's)."*

The `bv.` is *bijvoorbeeld*. The three are illustrative, not an enumerated set. I did not read this from the FA at
first — I worked from the backlog story text, which had dropped the `bv.` and read as a definite list — and spent a
long commit message defending an exclusion the source grants outright. **The constitution ranks the FA above the
backlog; quote the FA when the FA is the criterion.** The story text now carries the `bv.`.

FR-12.1 settles the rest: *"De beheerder kan schooljaren aanmaken en de vakantie-/periodestructuur instellen."*
Vakanties belong to another role on another surface.

## Design

| Parameter | Kind | Mechanism |
| --- | --- | --- |
| `GewensteStartthemas` | preference | prompt (one line per thema, naming its own block) + `ParameterRapport` |
| `VasteMomenten` with `BlokkeertPlaatsing: true` | constraint | service refuses placements in that period |
| `VasteMomenten` with `false` | context | prompt only ("this period has less time") |
| vakanties | *not a parameter* | already `Schooljaar.Schoolsluiting`; blocks are derived from it |

**Why the preference is not enforced.** Force-placing means the tool places a thema no model proposed, and the
placement's provenance becomes unstatable: `voorgesteld` would be false (no AI proposed it) and `manueel` survives
regeneration, so it would strand a parameter the teacher had since changed.

**Why the constraint is enforced.** Merely asking means a teacher who said *"this period is taken"* gets a thema in it
anyway. Honouring an instruction a human stated outright is the opposite of the tool deciding (Art. IV.1) — this does
**not** reopen E3-02's refusal to veto a bad spread, which was about a *quality judgement* that belongs to the school.

**How "measurably influence the result" is evidenced, and its honest limit.** The AI client is faked in every test
(Art. IV.6), so a parameter that only reaches the prompt cannot be shown to change an *outcome* — asserting that would
assert the fake. The load-bearing test runs **one faked response twice with different parameters and gets two
different persisted plans**. The limit, stated because the story's wording is broader: that proves *one* parameter
kind, on the blocking path. The honest claim is *"both parameters reach the model measurably; one additionally changes
what is persisted."*

## The vakantie premise is narrower than first claimed

`Schooljaar.Lesperiodes()` cuts only on `BreektPeriode`:

- **`Vakantie`** — genuinely cannot be spanned by a block. The claim holds.
- **`VrijeDag`** (Hemelvaart, Pinkstermaandag, pedagogische studiedag) — sits *inside* a block by design (ADR-0020 §5)
  and is **not expressed to the model at all**.

Worse, the prompt prints `Planningsblok.AantalDagen`, a raw **calendar** span, while `Spreidingsrapport` measures the
same block in **open days**. So the model is told a block is longer than the report will measure it, can satisfy the
prompt's own fit rule, and still be flagged `IsOverbelast`. Pre-existing E3-01/E3-02 drift, not introduced here, but it
is the load-bearing premise of this story's headline decision. Filed on the story rather than fixed in passing: the fix
is to print open-day weeks from `Schooljaar.TelOpenDagen` — the method that exists *because* two callers disagreeing
about block length was already a defect — and it touches the E3-02 prompt, so it deserves its own gate.

## Audit findings, all six fixed

1. **Plural with singular semantics.** One sentence named one block for a comma-joined list, telling the model to put
   several 4–6 week thema's in one themaperiode, and guaranteeing a false *"niet gehonoreerd"* for anyone naming two.
   Now positional: i-th name → i-th block.
2. **`BlokkeertPlaatsing` defaulted to `false`** — the one outcome producing *no signal*: plan byte-identical to a
   no-parameter run, report empty, indistinguishable from "honoured". Default removed, `[JsonRequired]`, so omission is
   a 400.
3. **Refused placements were discarded.** Unlike an unknown name or date these are *resolvable* — thema, block and
   `motivatie` all exist — so discarding left a thema planned nowhere, destroyed the motivation and lowered the dekking
   Art. V exists to prove. And `HeeftAandachtspunten` excluded them, so a compliant UI would have hidden the loss.
4. **The report blamed the model for the tool's refusal** when a startthema targeted a blocked period. New
   `TegenstrijdigeStartthemas` separates the teacher's self-conflict from model non-compliance.
5. **Composed Dutch + ISO dates** headed for a screen — the shape E3-06 was reverted for. Now records; the UI writes
   the sentence from `nl.json`.
6. **Two moments in one period lost the second** from the report. `ToegepasteVasteMomenten` reports every resolved one.

Verified clean by the audit and re-checked: `IsGepland` correctly excludes `Geweigerd` without the mirror error of
demanding `Aanvaard` (generation output is `Voorgesteld`); the `with` on a record is a non-destructive copy, so the
shared `ParameterRapport.Geen` static is never mutated.

## A flake fixed that was not this story's

`Postgres/PostgresTestDatabase` dropped its database `WITH (FORCE)`, which terminates lingering backends and requires
superuser or `pg_signal_backend` — privileges the local and CI `jaarplanner` roles lack. It failed roughly **one full
run in three** with `42501: permission denied to terminate process`, on whichever Postgres test finished first, because
`ClearAllPools()` returns when the *client* releases handles, not when the server has closed the backends: when the
drop won the race, FORCE was never exercised. Replaced with a plain drop retried on `55006`, which needs no privilege
beyond ownership.

Fixed rather than filed because **a test that fails one run in three is indistinguishable from a real regression**, and
I could not honestly report "0 failed" while it stood.

## Gates

- **437 unit + 81 integration passed, 0 failed, 0 skipped**, against real PostgreSQL
  (`JAARPLANNER_TEST_POSTGRES`; 36 skip silently without it). Repeated **four consecutive full runs** to prove the
  flake above is gone.
- `dotnet format --verify-no-changes` exit 0; build 0 warnings.
- Reachability asserted **over HTTP** (`Een_vast_moment_uit_de_request_body_weigert_een_plaatsing`,
  `Een_vast_moment_zonder_blokkeertPlaatsing_is_een_400_geen_stille_false`), not only through unit tests — the M2
  lesson: a service only its own unit tests call is not done.

## Waived, so it is a choice and not an oversight

`JaarplanGeneratieParameters` is bound straight from the body by `[FromBody]`, so an Application type is the request
contract, while the same controller declares nested API records for its other two bodies. Responses being Application
types is established precedent here; requests were not. Left as-is.

## Open, and not to be answered by default in the UI half

- **Are parameters remembered?** Nothing persists them, so a blocking vast moment is a one-shot and an E4/FR-8
  regeneration will re-place a thema in the blocked period. Transience was assumed, not decided. Belongs on Art. XIV.
- **Where does a schoolfeest live** — `Schoolsluiting(VrijeDag)` on the schooljaar (beheerder, FR-12.1) or a transient
  `VastMoment` (leerkracht, FR-5.4)? The code states a boundary; the school has not agreed one.
- **The open-day vs calendar-day prompt gap** above.

---

# Persistence half (E3-04, 2026-07-31)

**Branch:** `story/E3-04-persistentie`, based on `main` (`b44c869`).
**Ref:** FR-5.4, FR-8, Art. II.2/II.3 (as amended `e420648`), Art. IV.1/IV.2/IV.5/IV.6, Art. IX.3, Art. X, Art. XII,
ADR-0020 §3.

The owner ruled on 2026-07-30 that the generation settings must be **kept**. This is that ruling, in the four parts it
names: an entity + table + migration, a form that loads what was saved, a generation path that reads the saved settings
when it is handed none, and the copy correction the ruling made mandatory.

## What was built

| Layer | Change |
| --- | --- |
| Domain | `Generatieparameters` aggregate + owned `BewaardStartthema` / `BewaardVastMoment` |
| Infrastructure | `GeneratieparametersConfiguration`, `DbSet`, `EfJaarplanOpslag` load/add, migration `20260730191341_GeneratieparametersPerKlasEnSchooljaar` |
| Application | `JaarplanGeneratieParameters` re-keyed + `Van` / `NaarBewaard` / `Genormaliseerde*`; `IJaarplanOpslag` +2 members; `GenereerAsync` persist-or-read; `HaalParametersAsync`; `ParameterRapport.VervallenStartthemas` |
| Api | `GET …/jaarplan/parameters` |
| Frontend | `useGeneratieparameters`, `haalGeneratieparameters`, form rewrite (loads settings, date-keyed rows, stranded-setting notice), a `Parameteroverzicht` line, `nl.json` |

## (a) Scoping: the key is `(KlasId, SchooljaarId)`, and the school-year half is load-bearing

The ruling says "per klas", and `KlasId` **alone would in fact be safe today**. It is worth being precise about why I did
not use it: `Klas.SchooljaarId` is immutable — no mutator exists, `Wijzig` touches only naam and leerjaar, and the type's
own doc says moving a class between years is a copy operation (E8-03), not a rename. So a klas cannot carry its settings
into a new year.

But that safety is borrowed from a **neighbouring aggregate's** invariant, expressed in a doc comment and in the absence
of a setter. Everything stored here is a **date**: a schoolfeest on 2026-09-15 and a block starting 2026-09-01 mean
nothing in 2027-2028, and loading them into next year's form would put a stale constraint in front of a teacher as if
they had set it. The brief asked for a key that makes that **impossible**, not unlikely, so the school year is part of
the key *and* part of the lookup predicate. A row written for another year is then not merely ignored: it is a different
row, and the query finds nothing rather than last year's dates. Pinned twice — against the fake
(`Bewaarde_parameters_van_een_ander_schooljaar_worden_niet_gelezen`) and against real Postgres
(`Parameters_van_twee_schooljaren_staan_naast_elkaar_en_worden_niet_verward`).

Cost: one column, one FK (`Restrict`, mirroring `SchooljaarConfiguration`'s treatment of `Klas`) and one composite
unique index. Cheap enough that "it is safe because another class has no setter" was not worth relying on.

## (b) Keying: storage **and** the request key on `blokStart`

Storage keys on the block's start date, as the brief required. I also **aligned the request contract**, which the
backlog framed as an open judgement call, for the reason it gave: there is exactly one consumer, the app has no deployed
users, and keeping two keying schemes means writing a position↔date mapping at the boundary, which is where the bug
would live. `gewensteStartthemas` is now `{ blokStart, themaNaam }[]`.

The backlog's prediction held exactly. Every awkward part of the form existed only to survive the ordinal, and all of it
is gone:

- the **growing list** (show the filled rows plus one) — every period is now an independent live row;
- the **clear-cascade** that wiped later periods, and the copy explaining it (`startthemasWisUitleg`, deleted);
- the **"a gap must be unexpressible"** rule — a gap is now simply "no preference for that period";
- `startthemasAlleGevuld`, which only meant anything for a contiguous prefix.

Normalisation moved with the key: de-duplication is now per **block** (one period opens with one thema, enforced by the
aggregate *and* by a unique index) rather than per **name**. The same thema in two different periods is now expressible
and is deliberately allowed — it is a plan a teacher may genuinely want, and it is not contradictory.

## The stale `blokStart`, surfaced in both places

A stored `blokStart` stops being a block start when a beheerder edits the vakantiedata. The brief asked for one visible
treatment; there are two, because they answer different questions and both were cheap:

1. **In the form, before a run, outside the collapse.** A named notice ("Water, bewaard voor de periode vanaf 5 okt")
   with a **Weghalen** button per entry. Outside the collapse because the setting is still being sent, and inside a
   panel that is closed by default it would be invisible — the exact defect UI audit round 2 finding 1 recorded.
2. **In `ParameterRapport.VervallenStartthemas`**, so a run through any client says the same thing and the server never
   silently drops an entry it cannot use.

The setting is **kept and still sent**, not dropped: reverting the vakantie edit restores it, and the teacher resolves it
explicitly. Nothing guesses a neighbouring period — directie's ruling of 2026-07-28 for placements, applied to the
parameter that persistence made durable enough to hit it. The prompt skips it, because telling the model to use a date
that starts no block would contradict the system prompt's own "use only these blocks" rule. Six tests cover it: two
backend unit, one backend over HTTP, three frontend.

## Order: validate → persist → model

`GenereerAsync` commits the settings **before** the AI call and before the plan is touched. Model binding rejects a
malformed body first (a vast moment without `blokkeertPlaatsing` is still a 400 and stores nothing), so a failed
generation costs the teacher nothing they typed. Not hypothetical: this environment has no `AzureAI:ApiKey`, so the
client throwing *is* the common path. Pinned by `Een_mislukte_generatie_verliest_de_ingevulde_parameters_niet`, which
also asserts the plan stayed untouched (Art. IV.5).

**No separate "Bewaren" button**, per the ruling. That makes "a body" and "no body" mean different things, deliberately:
a body **replaces** the kept settings, no body **uses** them. An explicitly empty body is therefore the only way to clear
them, and it is what the form sends when a teacher empties a field. The form reports only *edits*; the kalender falls
back to the settings it loaded, so an untouched form sends exactly what was saved, and a form still loading sends no body
at all (which makes the server use the saved settings anyway, never an accidental wipe). An earlier draft pushed the
loaded settings upward from an effect; it worked but produced React `act()` warnings in a neighbouring test file, and the
fallback is simpler.

## Regeneration (point 3): the seam E4 inherits

E4's regeneration UI is not built and was not built here. What is owed is that the persisted parameters are what the
**generation path** reads, and they are: `GenereerAsync(klasId)` with no parameters loads them. A period marked bezet
stays bezet on the next run, and E4-04/E4-05 get the behaviour by calling the service rather than by adding it.
`Een_tweede_run_zonder_body_honoreert_de_bewaarde_parameters` is the load-bearing test; the HTTP test asserts the same
over the wire, including that an empty body then clears the settings again.

## A real defect found on the way, and it was not this story's

**A new `Themaplaatsing` added to an already-persisted `Jaarplan` was tracked as `Modified`, not `Added`.** EF's default
for a Guid key is `ValueGenerated.OnAdd`, and when `DetectChanges` finds an untracked entity in a **loaded** parent's
collection it decides Added-vs-Modified from whether the key is already set. `Themaplaatsing.Id` is assigned in the
constructor, so `SaveChanges` issued an UPDATE for a row that does not exist:
`DbUpdateConcurrencyException: Attempted to update or delete an entity that does not exist in the store`.

**That is any second generation run that adds a thema** — the ordinary FR-8 case, and the second time a teacher presses
the button. It was invisible because every green path so far either created the plan and its placements in one
`SaveChanges`, or regenerated with an answer that added nothing (empty, refused or duplicate). No browser session caught
it either, because generation 500s here without an API key.

Fixed with `ValueGeneratedNever()` on the owned-collection keys: `themaplaatsingen`, both new tables, and
`schoolsluitingen` as hardening (same shape, unreachable today because a schooljaar is created with its closures in one
call, and E6-03 still owns editing them). Metadata only — `dotnet ef migrations has-pending-model-changes` reports no
schema diff for the existing tables. Regression tests:
`JaarplanPersistentieTests.Een_plaatsing_toevoegen_aan_een_bestaand_plan_slaagt` and
`GeneratieparametersPersistentieTests.Een_moment_vervangen_door_een_ander_slaagt_op_een_bestaande_rij`.

Fixed rather than filed, on this story's own precedent for the Postgres FORCE-drop flake: I could not demonstrate
E3-04's headline criterion without it. **`DoelKoppeling`'s owned collections are unaffected** — they have no explicit
key, so EF's shadow int key is unset on a new instance and the state resolves correctly.

*How it was found is the reusable part.* The first version of the HTTP test discarded the status code of two of its four
POSTs. One of them was already returning 500. The failure surfaced two requests later and looked mysterious for twenty
minutes. Every POST in that test now asserts its status, which is the same lesson E3-07 recorded about asserting the
premise rather than trusting it.

## Copy (point 4)

`parameters.uitleg` said *"Deze instellingen gelden voor deze generatie: genereer je later opnieuw, vul ze dan opnieuw
in"* — true before this commit and false after it. It now says the settings stay saved for this class, and that removing
something and generating again is how you clear it. Changed in the same commit as the persistence, as the ruling
required. Nine keys added, two deleted, no em dashes (guarded catalogue-wide by the existing test).

**No Art. II.3 log entry is owed:** every new user-facing string is authored by the frontend and lives in `nl.json`. The
one new backend message (`Vervang`'s duplicate-block guard) is an English `ArgumentException` for a programmer error the
application layer already prevents, which is what Art. II.2 asks for.

Plurals: three new counts (`samenvattingVervallen*`, `vervallenTitel*`, `rapportVervallen*`) all route through `tAantal`
with real singular copy, and the **singular** is the case the tests assert. This project has shipped *"1 thema's"* four
times.

## Gates (real numbers, run from Bash)

- `dotnet format --verify-no-changes` — **exit 0**. `dotnet build` — **0 warnings, 0 errors**.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (`Host=127.0.0.1`, `SSL Mode=Disable`, native Postgres 17):
  **475 unit + 109 integration passed, 0 failed, 0 skipped.**
- `corepack pnpm install` (this worktree needed its own), `corepack pnpm lint` — **exit 0**; `corepack pnpm test` —
  **122 passed / 9 files, 0 failed**, and **0 React `act()` warnings**; `corepack pnpm build` — **exit 0**.
  *(One earlier `pnpm build` invocation died with exit `3221225794` = `STATUS_DLL_INIT_FAILED`, a Windows
  process-launch failure under load rather than a compile error. Clean on re-run; recorded so nobody re-debugs it.)*
- The migration is applied to a scratch database by the `[PostgresFact]` fixtures, which migrate from the real
  migrations, and the round-trip is asserted against **real PostgreSQL** rather than the in-memory provider: eight new
  `GeneratieparametersPersistentieTests` covering the round-trip, the `date` mapping, the absence of any ordinal column,
  both unique indexes, both FKs, replace-deletes-rows, replace-with-a-different-row, the klas cascade and the column
  length.

## Deliberately left undone

- **A `gewenst startthema` is still advisory.** The ruling says persistence weakens the old argument and then says not to
  act on it in the same change. Not acted on.
- **No live AI round-trip.** The same residual E3-01/E3-02/E3-04 already record: no `AzureAI:ApiKey` here, so generation
  returns 500 and the UI correctly says *"nu niet beschikbaar"*. End-to-end enforcement is covered over HTTP with a stub
  client.
- **Not opened in a browser.** The gates are green and the flow is asserted over HTTP through the real DI container, but
  CLAUDE.md's *"look at it before claiming it works"* has **not** been satisfied for the new stranded-setting notice or
  for the all-periods row list at ~390px. This is the one gap in this entry and the test-runner should close it.
- **The open-day vs calendar-day prompt gap** (this story's existing clause) is untouched.
- **E4's regeneration UI** is not built, by instruction.
