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
E3-04's headline criterion without it. **`DoelKoppeling`'s owned collections are unaffected**, and the mechanism matters
more than the verdict, so here it is corrected (audit round 1, finding 7): they have no explicit key, so EF's discovered
key is a **shadow `Guid`** — `ValueGeneratedOnAdd`, exactly like `Themaplaatsing.Id` — *not* the shadow `int` this
paragraph first claimed. What makes them safe is not the type but that the property is a **shadow** one: a new
`DoelKoppeling` has no `Id` to assign in its constructor, so the shadow value is `Guid.Empty` when `DetectChanges` looks,
`IsKeySet` is false, and the entity resolves as `Added`. The stated rule is therefore *"a constructor-assigned key plus
`OnAdd` is the dangerous combination"*, not *"an int key is safe"* — which would have given the wrong answer for the next
type someone checks. Verified against the model snapshot
(`AppDbContextModelSnapshot`: `b1.Property<Guid>("Id").ValueGeneratedOnAdd()` on `activiteiten_Doelkoppelingen`,
`themas_Doelsuggesties` and their siblings).

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

## Fix round 1 (2026-07-31) — the collapsed screen, the request contract, and the race

Test-runner: **PASS** on every acceptance criterion, including a 390px browser pass with contrast pixel-sampled in real
Edge. Antagonist: **VIOLATIONS FOUND** — 1 MAJOR, 7 MINOR, 2 QUESTION. Two items were owner decisions and out of scope;
one of those (the concurrent-run 500) was then ruled **in** scope mid-round and is item 10 below. The
`ValueGeneratedNever()` fix was verified independently by the antagonist against the real `AppDbContext` (with the line:
`Added` and a clean save; without it: `Modified` and `DbUpdateConcurrencyException`) and via `IMigrationsModelDiffer` to
produce no schema diff either way. Kept.

### 1. MAJOR — a failed settings load asserted the opposite of what would happen

`GET …/jaarplan/parameters` failing left `instellingen.data` undefined, so the trigger read **"(niets ingesteld)"**
while `genereerJaarplan` sent **no body** — and by this story's own contract a bodyless run applies the *stored*
settings. A teacher with a saved blocking vast moment therefore read the exact inverse of what the run would do, with
the explanation (`parameters.instellingenFout`) rendered only inside a panel that is closed by default. The same
mitigation placement that hid finding 1 of UI audit round 2, and it contradicted this file's own rule three paragraphs
up: *"a stranded setting must be visible without opening anything, since it is being sent."*

Three changes, and the third is the one I would defend hardest:

1. **The summary distinguishes *unknown* from *absent*.** `(instellingen laden…)` while pending,
   `(instellingen niet geladen)` on error. It never falls through to `(niets ingesteld)`, which is a claim about the run
   and must therefore be true about the run.
2. **The failure is stated outside the collapse**, as a `role="alert"` (inert text, so no live region wraps a control).
   The in-panel copy is gone rather than duplicated.
3. **Generation is refused until the settings are known** — the kalender disables the button while
   `isPending || isError`. Offered as optional by the finding; taken, because a run whose parameters the screen cannot
   state is a run a teacher cannot consent to, and FR-5.4's one *enforced* parameter (a blocking vast moment) changes
   the outcome silently. The cost is one request's worth of a disabled button in the normal case, with the summary
   saying why; the alternative is a screen that invites a run it cannot describe. The error copy now names the
   consequence and the remedy ("Herlaad de pagina").

**Pinned by two tests that never open the disclosure** (`…failed to load, while collapsed` and `…still loading`), each
asserting the summary, the visible notice, the disabled button *and* that `posts` stays empty. The old test called
`openForm()` first, which is exactly why it could not see this. `genereer()` in the suite now waits for the button to be
enabled, so no test can assert an empty `posts` array for the wrong reason.

### 2. The summary counted a stranded preference twice

`aantalStartthemas` counted every non-empty entry *and* `vervallen.length` added its own clause, so one kept preference
for a vanished period read *"(1 startthema, 1 zonder periode)"*. Stranded entries are now excluded from
`aantalStartthemas`, so the clauses partition the set. Pinned: with only a stranded setting the summary is
`(1 zonder periode)` and contains no "startthema" at all.

### 3. The stranded notice, and where I disagree with the finding's premise

Now a labelled `role="region"` with an sr-only `role="status"` carrying the count sentence, non-dismissible (no close
control anywhere in it). **Not** a `role="alert"`, which is what the finding asked for on the grounds that its E3-06
sibling is one: that premise is stale. `TeHerzien` was changed *away* from `role="alert"` in E3-07, precisely because it
gained interactive controls, and a live region wrapping controls re-announces its whole contents on every interaction —
which would swallow the nested delete confirmation. My notice holds a **Weghalen** button per entry, so it is in the
same position. Matching the sibling therefore means region + status, and that is what it does. The test pins the full
control set, so a dismiss affordance added later as a button *or* a link fails it.

### 4. Two contract holes

**An omitted array wiped the kept list.** `GewensteStartthemas` and `VasteMomenten` are now `[JsonRequired]`. A body
*replaces* the settings, so an omitted array was indistinguishable from `[]` and deleted durable teacher input with no
report entry — the identical argument that made `BlokkeertPlaatsing` required one level down. Posting **no body** is
still a first-class case meaning "use what is stored"; the requirement is on the shape of a body that *is* sent, and the
new test asserts both halves. Four existing integration tests relied on the loose behaviour and now send both arrays
explicitly — including the one that used to clear a preference by omission, where the clearing is now written down.

**Two preferences for one period were silently de-duplicated.** `GenormaliseerdeStartthemas` dropped `groep.First()`'s
losers, so a fully resolvable instruction vanished with nothing in the report, and with persistence it vanished for
good. The de-duplication is gone; the shape is a **400** via `IValidatableObject` on the request type. Chose 400 over a
report entry deliberately: a report tells a teacher *after* the second preference has already been deleted, while a
400 stores nothing at all, and the form (state keyed on the period) cannot produce this shape, so no real user is
refused. The message is **English**, matching the framework's own `[JsonRequired]` failures it joins in `ModelState` and
the 422 parser diagnostic beside it: it describes a malformed request no teacher can produce or act on (Art. II.2), so
**no Art. II.3 log entry is owed**. The domain's `ArgumentException` stays as the loud backstop for a caller that skips
the boundary — loud is the point, since the previous behaviour was silence.

### 5. Backlog drift, fixed in the place a reader consults

`backlog/E3-jaarplan-kalender.md` still described the **positional** contract, the growing rows and the clear-cascade as
current, still said persistence "is not built yet", and still listed the positional question as open. All rewritten: the
five clauses of the owner's ruling are marked done (four) or deliberately-not (one), the positional open item is
**closed** with the decision and its reasoning, and a compact "persistence half + audit round 3" block records what
changed. The E3-01 entry now carries the `DbUpdateConcurrencyException` defect its aggregate shipped, with the gate
lesson attached: a suite whose second-save path is never exercised reports green on a feature that fails on second use.
The story checkbox and `backlog/README.md`'s progress table are untouched, as instructed.

### 6. A comment that claimed a guarantee the code did not give

`BewaarParametersAsync` said a class that never uses parameters carries no row, while the form posts `{[], []}` on every
run once its query resolves. Fixed in the code rather than in the comment: an empty submission for a class with no row
now writes **no row** and returns `Geen`. Nothing is lost, because no row and an empty row read back identically. Pinned
by `Een_lege_inzending_maakt_geen_parameterrij_aan`.

### 7. The `DoelKoppeling` mechanism, corrected above

The shadow key is a **`Guid`** with `ValueGeneratedOnAdd`, not an int. The conclusion was right for a different reason:
what makes it safe is that the property is a **shadow** one, so a new instance leaves it `Guid.Empty`, `IsKeySet` is
false and the state resolves as `Added`. The reusable rule is *"a constructor-assigned key plus `OnAdd` is the dangerous
combination"*, not *"an int key is safe"*. Corrected in place, with the model-snapshot evidence.

### 8. The stranded check was coupled to whichever tier the kalender showed

`vervallen` compared kept `blokStart`s against the `blokken` prop, i.e. `grid.blokken`, while the server always keys on
`GeneratieNiveau = Themaperiode`. They agreed only because `/rooster` defaults to that tier: the moment E3-08's zoom
fetches `Subthemaperiode`, **every** kept preference would be flagged *"zonder periode"* and every offered row would
carry a date the server reports as `VervallenStartthemas`.

The form now takes `niveau` and compares against an exported `GENERATIEBLOKNIVEAU` mirroring the backend constant. At
any other tier it renders neither period rows nor a stranded claim — it cannot tell, so it claims nothing — and says
where startthema's are set instead (`parameters.anderNiveau`). The kept settings are still sent unchanged. Pinned by a
test that hands the kalender a `Subthemaperiode` grid, **before** E3-08 lands.

*Considered and rejected:* having the form fetch the generation-tier grid itself. It is more correct (the stranded
signal would survive a zoom) but needs a second query with its own pending/error states and two more copy keys, for a
state no user can reach today. The checked-tier version is what the finding asked for at a fraction of the surface, and
E3-08 can upgrade it with the reasoning written down here.

### 9. 390px

The disclosure trigger is `flex-wrap` with the label and the summary as separate items, so three summary clauses wrap to
their own line instead of forming two narrow three-line columns beside each other.

### 10. The concurrent-run 500 (added to scope mid-round by the owner)

Two runs starting together both found no settings row, both inserted one, and the loser got a raw Postgres `23505` out of
`SaveChanges` — a 500 with an English detail on an ordinary second press.

**Resolved by using the winner's row, not by a 400.** `SchooljaarBeheerService` turns its analogous race into a Dutch
400 because there the loser's intent is *contradictory* (that name is taken). Here it is fully **satisfiable**: the run
asked for these settings to be kept, and the row it needs now exists, so it writes its own settings into it — last write
wins, exactly as two runs a second apart already behave. Refusing would tell a teacher their parameters were invalid
because of somebody else's timing. **Consequence: no new Dutch fault message, so no Art. II.3 log entry is owed** (and
none was owed for the round's other work either — structured records the UI formats do not trigger it).

Mechanically: `IJaarplanOpslag.VoegGeneratieparametersToe` became `ProbeerGeneratieparametersToeTeVoegenAsync`, which
inserts, commits, and returns `false` on a unique-key violation *scoped by constraint name* — detaching the losing owner
**and both owned collections** so the caller's reload runs on a usable context. Recognising a `23505` is a storage
concern; deciding what to do about it is the service's, which keeps EF Core out of the Application layer (Art. VIII,
Art. IV.6). Two tests: a service-level unit test with the fake simulating the lost race, and
`Een_geweigerde_gelijktijdige_insert_laat_de_context_bruikbaar` against **real Postgres**, since the whole mechanism is
the database's.

### Gates (fix round, real numbers, run from Bash)

- `dotnet format --verify-no-changes` — **exit 0**. `dotnet build` — **0 warnings, 0 errors**.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (`Host=127.0.0.1`, `SSL Mode=Disable`, native Postgres 17):
  **478 unit + 112 integration passed, 0 failed, 0 skipped** (was 475 + 109).
- `corepack pnpm lint` — **exit 0**; `corepack pnpm test` — **125 passed / 9 files, 0 failed**, 0 React `act()`
  warnings (was 122); `corepack pnpm build` — **exit 0**.
- *Note on the connection string:* the password is `jaarplanner_local` locally (`jaarplanner_ci` on CI, per
  `.github/workflows/ci.yml`). Getting it wrong fails **50 tests with `28P01`**, which looks like a regression and is
  not; recorded so the next run does not re-diagnose it.

### Not done, by instruction

- **`Generatieparameters` in Art. IX.3 and the three glossary terms in Art. XII** — the owner has decided they *will* be
  added, as a separate amendment commit after E3-04 lands (Art. XI.1). `CONSTITUTION.md` untouched here.
- **Enforcing `gewenste startthema's`** — still deferred by the ruling.
- **The open-day vs calendar-day prompt gap**, the missing `[Authorize]` (E7), the duplicated `/**` in `api.ts` and the
  demo `Klas.Naam` em dash — all pre-existing and left alone.
- **Not re-opened in a browser this round.** The test-runner's 390px + contrast pass covered the pre-fix screen; the
  trigger's wrap, the new alert outside the collapse and the two new summary strings are unlooked-at, and the notice
  changed from a plain `div` to `region` + `status`. Structure and copy are pinned by tests and axe is green, but the
  *look* of the three changed surfaces still needs one real pass, which is the test-runner's to do.

## Fix round 2 (2026-07-31) — the refusal gates the form, and the failure state gets a way out

Test-runner: **PASS** — 478 unit + 112 integration / 0 skipped and 125 frontend reproduced exactly, plus a browser pass
in real Edge with route interception that confirmed the MAJOR fix, measured the new alert's composited contrast at
**5,45:1** and drove the tier guard. Antagonist: **VIOLATIONS FOUND** — 1 MAJOR, 5 MINOR, 3 QUESTION, with eight of its
ten round-1 findings closed.

**Round 1's disputed finding was withdrawn by both gates, so the record should say *wrong*, not *waived*.** The claim
that the stranded notice should be `role="alert"` because its E3-07 sibling is one was stale, exactly as argued:
`git log -S` shows `TeHerzien` was an alert through E3-07's own commit `c484315` and moved to region + sr-only status in
`57a4c5e`, the commit addressing E3-07's audit, for the reason given (it gained controls, and a live region wrapping
controls re-announces everything on every interaction). The test-runner confirmed it independently on `main` @ `b44c869`
and checked the behaviour. Nothing changed here; item 3 of round 1 stands as written.

### 1. MAJOR — the refusal gated the button but not the form, and a successful retry desynced the screen

Both limbs, one fix. The form now receives `generatie.isPending || instellingenOnbekend` instead of
`generatie.isPending`, so every fieldset, select, input, radio and button inside it is dead while the kept settings are
unknown.

- **Limb 1 (controls that do nothing):** with the GET failing a teacher could open the panel, set a startthema for any
  of the seven periods and answer the blocking question, behind a primary action that could never fire.
- **Limb 2 (the desync), and this is why the gate is the *right* shape rather than merely the cheap one:** an errored
  TanStack query is stale, so it refetches. If a retry succeeded, the effect keyed on `[geladen]` overwrote the typed
  state **without** calling `meld`, so the parent's `wijziging` still held the old edit: the screen showed the loaded
  settings and the run would have posted the ones it no longer displayed. That is round-2 finding 7 again. With editing
  gated until the settings are known, **no edit can exist for the effect to clobber**, so the desync is closed by
  construction rather than by a second effect.
- **The alternative was refused on the antagonist's own reasoning, and it is a safety argument rather than a taste
  one:** a body *replaces* the kept settings wholesale, so a teacher looking at an empty form whose settings failed to
  load who sets one startthema would silently delete a stored blocking vast moment they never saw. An editable form in
  that state is worse than a disabled one.

Pinned by `refuses edits too while the kept settings are unknown, not just the run` (error) and an addition to
`…still loading` (pending), each asserting a disabled select per period and a disabled *Vast moment toevoegen*.

**A mechanism found while writing the retry test, worth recording because it falsified my first attempt.** The kalender
and the form share one query key but mount at *different* times, since the form only exists once the plan and the grid
have resolved. An errored query is stale, so the form's own observer refetches on mount — the failure therefore heals
itself on call two with nobody pressing anything, and a "second call succeeds" stub made a retry test pass without a
retry. The stub now takes a switch the test owns, and the test proves the fetch came from the click (`pogingen`
increases across it).

### 2. The failure state had no way forward, which is what actually answers the availability objection

The test-runner enumerated every control on the screen and found no retry and no escalation. Two specifics:

- The copy said *"Herlaad de pagina en probeer opnieuw"* — which `QueryClient` had **already done three times** before
  the notice could appear (~7 s in). It prescribed the one remedy already exhausted.
- The sibling generation failure ends with *"Meld dit aan de beheerder van de tool."* and this one did not.

Now: an **"Opnieuw proberen"** button calling `instellingen.refetch()`, labelled *"Opnieuw proberen, even geduld"* while
`isFetching`; and copy that states the consequence (nothing can be set and nothing generated, because the tool cannot
say which settings would travel) and ends with the escalation sentence. No reload instruction at all, and the test
asserts both the absence of *"herlaad"* and the presence of *"beheerder"* so the copy cannot drift back.

**The button is a *sibling* of the `role="alert"`, not a child of it.** Same separation `TeHerzien` and the stranded
notice use: a live region wrapping a control re-announces its whole contents on every interaction, and pressing retry
changes the button's own label. So the alert stays the sentence, and the control sits beside it. It is also deliberately
**not** gated on `disabled` — that prop means (among other things) "the settings are unknown", which is the state this
button exists to leave; `isFetching` covers the in-flight retry instead.

*For the test-runner:* the retry button is `variant="outline"` on `bg-suggestie-geweigerd/10`, i.e. a border token over
a tinted background this combination has not been measured on. The precedent is the stranded notice's *Weghalen* on
`bg-attentie-zacht`, but precedent is not a measurement.

### 3. `IsUniekeSleutelSchending` claimed a scoping the substring did not give

`Contains("generatieparameters", OrdinalIgnoreCase)` also matches `IX_startthemavoorkeuren_GeneratieparametersId_BlokStart`
and `IX_vastemomenten_GeneratieparametersId_Datum`, because both child tables' FK column is `GeneratieparametersId`. Had
either fired, a child-table `23505` would have been reported as the lost race, the reload would have found no row, and
the request would have 500'd blaming a duplicate settings row that never existed. Unreachable today
(`Generatieparameters.Vervang` refuses a duplicate `BlokStart` before any insert), so this is robustness plus a false
comment.

Now `string.Equals(pg.TableName, "generatieparameters", Ordinal)`. **The table rather than the index name on purpose:** a
`23505` on that table can only be the `(KlasId, SchooljaarId)` index or the primary key, and the key is a
client-generated `Guid`; naming the index would tie the recovery to an EF-generated identifier whose rename would fail
*silently*, and the failure mode of that is the 500 this method exists to prevent. The new composed test (item 5)
exercises the real predicate against a real `23505`, so a mismatch now fails a test rather than a request.

### 4. "Two runs starting together do not 500" was overclaimed

Narrowed everywhere it was asserted: the test is now `Een_gelijktijdige_run_verliest_de_parameterrace_zonder_fout`, and
its docstring plus the backlog bullet scope the claim to the **settings row**.
`JaarplanGeneratieService.LaadOfMaakJaarplanAsync` does the identical unguarded load-or-create for `Jaarplan`,
`JaarplanConfiguration` has a unique index on `KlasId`, and `BewaarAsync` catches nothing — so two simultaneous
first-ever runs for one class still 500 one step later, and two simultaneous regenerations can still lose the
`VerwijderVervangbarePlaatsingen` delete. **Filed as a known residual** in the E3-04 backlog entry, attributed to
E3-01's aggregate, and not fixed here: the resolution is genuinely different, since a plan write is not "last write
wins" in any obvious sense.

### 5. The race recovery was asserted in two halves that never met

True, and the composition is cheap enough to have no excuse. New `[PostgresFact]`
`De_service_overleeft_de_verloren_race_op_de_echte_opslag`: the **real** `JaarplanGeneratieService` on the **real**
`EfJaarplanOpslag` against **real Postgres**, calling `GenereerAsync` (so `BewaarParametersAsync` is invoked rather than
reproduced). The race is made deterministic by a decorator that delegates every call and, on the first
`LaadGeneratieparametersAsync` that returns `null`, commits the winner's row through a *separate* context — precisely
the interleaving the race needs, with nothing about the code under test faked. It asserts `WinnaarIsGeschreven`, so a
version of this test that quietly stopped racing fails instead of passing.

What that now covers end to end: the insert hits the real unique index, `IsUniekeSleutelSchending` reads a real `23505`,
the detach runs on a real change tracker, the reload finds the winner's row, and `Vervang` writes the loser's settings
into it. The two old tests stay: the unit test is the fast statement of the *decision*, the EF test the statement of the
*mechanism*.

### 6. The generation tier was duplicated across the wire with nothing binding the halves

`types.ts`'s `GENERATIEBLOKNIVEAU` and `JaarplanGeneratieService.GeneratieNiveau` were coupled by a doc comment, and
`PlanningsroosterEndpointTests` pins the *rooster* default, a different decision that merely agrees today. Move
generation to another tier and the form degrades to `parameters.anderNiveau` permanently, startthema's become
unsettable, and no test fails.

Bound by `De_frontendconstante_voor_het_generatieniveau_volgt_de_backend`, which **reads**
`frontend/src/features/jaarplan/types.ts` and compares the literal against `GeneratieNiveau.ToString()`. Reading the
TypeScript is the point: an assertion on the C# value alone would pass while the halves disagreed. The repo root is
found by walking up from `AppContext.BaseDirectory` until a directory holds both source trees, so it survives a
different target framework or output path, and the failure message names the file to change. *Considered and rejected:*
stating the tier in a server response — a wire field plus a type plus a mapping, for a value that changes at most once,
when a nine-line test binds the same pair.

Chose the backend for the test because the frontend cannot cheaply read a file: `@types/node` is not resolvable from
`frontend/node_modules/@types`, so importing `node:fs` fails `tsc --noEmit`, and a `?raw` import needs a `vite/client`
types entry the app tsconfig deliberately does not carry.

*Related (test-runner):* `parameters.anderNiveau` promised *"zet de kalender terug op het hele jaar"* while no zoom
control exists until E3-08. Softened to *"Je kan ze instellen zolang de kalender het hele schooljaar toont"*, which
describes the state instead of naming a control, and the obligation is recorded on **E3-08** in the backlog so its
control label and this sentence land together.

### 7. `IValidatableObject` widens a recorded waiver — widened, as ruled

Per the adjudication: the waiver in the backlog now covers the validation as well as the binding, with the reasoning
(no framework dependency is added, the behaviour is proven over HTTP, and moving the contract to a nested Api record is
a bigger change than the thing being waived). Recorded as a **choice**, not an oversight. No code change.

### 8. 390px: the orphaned chevron

`flex-wrap` on the trigger let the long label become its own flex item and wrap to the next line, leaving the glyph
alone above it. Chevron and label are now **one** non-wrapping inner flex item (`min-w-0` on the wrapper so the label
still wraps inside it, `shrink-0` on the glyph), so the arrow cannot separate from the text it belongs to. Still one
button and one tab stop.

### 9. Recorded as decisions rather than fixed

- **Last write wins** is ratified design and byte-for-byte the semantics of two runs a second apart. The residual worth
  naming, and now named in the backlog: the **winning** run generates from settings the database no longer holds by the
  time it finishes, and neither run's `ParameterRapport` says a concurrent run replaced them. Nobody is shown a lie;
  nobody is shown the fact either.
- **The test-runner's eight evidence PNGs** (`docs/ux/wireframes/e3-04-fix-*.png`) are committed, with its report, in
  `c8b9be1`.

### Gates (fix round 2, real numbers, run from Bash)

- `dotnet format --verify-no-changes` — **exit 0**. `dotnet build` — **0 warnings, 0 errors**.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (`Host=127.0.0.1`, `SSL Mode=Disable`, native Postgres 17):
  **479 unit + 113 integration passed, 0 failed, 0 skipped** (was 478 + 112: +1 tier binding, +1 composed race).
- `corepack pnpm lint` — **exit 0**; `corepack pnpm test` — **127 passed / 9 files, 0 failed** (was 125);
  `corepack pnpm build` — **exit 0**.

### Not done, by instruction (unchanged from round 1)

`CONSTITUTION.md` untouched (the Art. IX.3 / Art. XII amendment is a separate commit the owner lands before the story
goes `[x]`); enforcing `gewenste startthema's`; the open-day vs calendar-day prompt gap; `[Authorize]`.

**Not looked at in a browser this round either.** Three visual surfaces changed: the trigger's inner flex at 390px, the
retry button's contrast on the red-tinted notice, and the disabled state of seven period rows plus the moment fields.
Tests and axe are green, and axe says nothing about colour.

---

## Fix round 3 — the state that outlives its class, and three smaller things

**Findings addressed:** antagonist MAJOR (pending edit survives a class switch), test-runner MAJOR (retry button
boundary 2,86:1 vs SC 1.4.11's 3:1), test-runner MINOR (`isFetching` unreachable, its copy dead, a gap where the
button was), antagonist MINOR (two fields with no disabled styling), antagonist MINOR (table-name constant unbound),
plus the two documentation slips. **Ref:** FR-5.4, Art. IV.2, Art. IV.5, Art. XII, WCAG 2.2 SC 1.4.11, ADR-0021.

### 1. MAJOR — one class's edit could be posted as another class's parameters

Upheld in full, and the audit is right that this is worse than a wrong run: a generation body **replaces** the kept
settings wholesale, so the misdirected run also deletes the target class's stored settings. Reproduced in a test
before fixing, and the failing output is the finding verbatim: with klas B selected, the POST went to B's URL
carrying `{ blokStart: 2026-09-01, themaNaam: "Herfst" }` — A's edit — and an empty `vasteMomenten`, so B's stored
blocking *Oudercontact* was gone.

**Fix:** `<Jaarplankalender key={klasId} klasId={klasId} />` in `JaarplanPagina.tsx`. One line, and it is the right
line rather than the cheap one: the state that must not outlive the class is spread over two components (`wijziging`
in the kalender, `startthemas`/`momenten`/`open` in the form), and remounting the subtree retires all of it at once.
Resetting each by hand would leave the next piece of per-class state in this subtree to remember on its own.

It also closes the second limb: while B's settings are pending, the form no longer shows A's selections under B's
heading, because the rows are gone with the instance.

**The wording was wrong in four places and is corrected in three of them** (the fourth, a round-2 commit message, is
immutable — this entry is its correction of record):

- `Jaarplankalender.tsx`, the note on `wijziging`: now states the invariant that actually holds, *"while this
  component instance lives, `wijziging` and `instellingen` describe the same class"*, and names the caller's `key`
  as what enforces it.
- `Jaarplankalender.tsx`, the note on the `disabled` prop: now says explicitly that the gate does **not** cover a
  class change and cannot, since it closes only while the settings are *unknown* while the desync begins once they
  are known (and with `staleTime: Infinity` a revisited class is cached, so there is no window at all).
- `Generatieparametersformulier.tsx`, the `disabled` docstring: same correction, one paragraph.
- This worklog's round-2 *"closed by construction"* claim: **withdrawn.** It was true of the door the gate covers and
  false of the door beside it.

### 2. MAJOR — the retry button's boundary, measured

Accepted, and re-derived independently before changing anything rather than taking the number on trust. Composing
`suggestie-geweigerd/10` over the panel's `bg-card` gives `rgb(248, 233, 233)`; against that:

| | ratio | |
|---|---|---|
| panel wash vs the button's own `bg-card` fill | **1,18:1** | the fill delineates nothing |
| `border-input` (the `outline` variant's default) vs the wash | **2,87:1** | fails the 3:1 floor |
| `border-suggestie-geweigerd` vs the wash | **5,47:1** | ✓ |
| `border-suggestie-geweigerd` vs the button's fill | **6,47:1** | ✓ (the inner boundary too) |

My 2,87 sits between the test-runner's two in-browser routes (2,858 and 2,874), which is the agreement I wanted before
editing. **Fix:** `border-suggestie-geweigerd` on the button. It reuses the hue the panel already spends, so no second
chrome accent enters (Art. XII), and `pnpm build` shows the utility really is generated
(`.border-suggestie-geweigerd{border-color:hsl(var(--suggestie-geweigerd)…)}` in `dist`), which is the check this repo
has been bitten by twice.

### 3. MINOR — `isFetching` was unreachable, and pressing retry left a hole

Confirmed from TanStack's own reducer, not just from the observation: the `fetch` action spreads
`fetchState(data, options)`, and that helper sets `error: null, status: 'pending'` **whenever `data === undefined`**.
So a refetch of an errored query with no data leaves `isError` false for the whole fetch, the
`{instellingen.isError && …}` block unmounts, and the in-flight branch it contained could never render.

**Fix:** the notice's visibility no longer depends on `isError` alone. A `herstelGeprobeerd` flag records that the
teacher pressed the button on this instance, and the block renders while `isError || (herstelGeprobeerd &&
isPending)`. The button keeps its `isFetching` guard — that guard was never *wrong*, it was unobservable — and now
that the block survives the retry, `parameters.instellingenOpnieuwBezig` is live copy instead of dead copy. So the
double-press is prevented by a disabled button the teacher can see, and the gap is gone.

`herstelGeprobeerd` is deliberately never reset: it is only ever read alongside `isPending`, which stops being true
the moment any load succeeds. An effect watching `isFetching` to clear it would be more machinery for the same
behaviour.

### 4. MINOR — two fields that looked live while dead

`momentNaam` and `momentDatum` carry `bg-card text-ink`, and an author-set background and colour override the UA's
disabled rendering, so fieldset-disabled fields kept looking editable. They now carry the same
`disabled:cursor-not-allowed disabled:text-ink-zacht` the startthema select has. Agreed on the escalation the finding
names: this was cosmetic while `disabled` meant "a run is in flight for three seconds", and is not while it also
means "the settings failed to load", a state a teacher can sit in.

### 5. MINOR — the table-name constant is now bound

Accepted, and the finding is right that my own round-2 argument cuts this way: I rejected the index name because a
rename would fail *silently* into the 500 the recovery prevents, and the table name I chose instead has the same
failure mode. `GeneratieparametersTabelnaamTests` asserts `EfJaarplanOpslag.ParametersTabel ==
Model.FindEntityType(typeof(Generatieparameters)).GetTableName()`. No database: building the model opens no
connection. The constant went from `private` to `internal` with an `InternalsVisibleTo` for the unit-test assembly,
which is cheaper than putting a persistence detail on the port's public surface; the ceremony is two lines.

### 6. Evidence and the two documentation slips

- **The test-runner's eight round-3 PNGs are committed** (`docs/ux/wireframes/e3-04-r3-*.png`).
- **The pending-state test now asserts what the worklog claimed it did.** It asserted only `periodeKeuze(1)`; it now
  also asserts `periodeKeuze(2)` and the disabled *Vast moment toevoegen*, matching its errored-state sibling. Fixed
  the test rather than the prose, because the prose described the stronger assertion worth having.
- **Declared drift, not fixed:** `e3-04-fix-instellingenfout.png` (round 2) shows the superseded *"Herlaad de
  pagina"* copy with no retry button. It is left in place because the round-2 test report links to it twice and a
  dangling link is worse than a dated screenshot; **it is not evidence of what ships.** Three of the round-3 PNGs
  (`e3-04-r3-retry-knop-dpr3.png`, `e3-04-r3-390-fout.png`, `e3-04-r3-gegate-collapsed.png`) predate fixes 2 and 3
  and are now dated too: the button's border colour and its in-flight state both changed. **No artefact in the repo
  depicts the shipped failure state.** I cannot produce one — I have no browser — so this is handed to the
  test-runner as the one thing this round leaves open.

### Tests added

- `Generatieparameters.test.tsx` → *"does not send one class's pending edit as another class's parameters"*. Renders
  the **real `JaarplanPagina`** under a `MemoryRouter`, with a stand-in for the shell's klas selector as a *sibling
  above it* — mirroring where the selector really sits (ADR-0021). A test that keyed the kalender itself would pass
  without the fix, which is the trap worth naming: the fix lives on the page, so the page is what the test must
  render. Verified to fail on the pre-fix code with exactly the finding's symptom.
- `Generatieparameters.test.tsx` → *"keeps the retry on screen and says it is running while it is in flight"*. Uses a
  settings GET that never resolves, because a retry that lands immediately cannot show this either way. Verified to
  fail on the pre-fix code: `findByRole` for the *bezig* button times out, because the block had unmounted.
- `GeneratieparametersTabelnaamTests.Recovery_constant_matches_the_mapped_table` (xUnit).
- Strengthened: *"does not claim nothing is set while the kept settings are still loading"* now asserts both selects
  and the add button.

### Files changed

- `frontend/src/features/jaarplan/JaarplanPagina.tsx` — the `key`, with the reason it is load-bearing.
- `frontend/src/features/jaarplan/Jaarplankalender.tsx` — two corrected comments; no behaviour change.
- `frontend/src/features/jaarplan/Generatieparametersformulier.tsx` — retry visibility across the refetch, the border
  token, `disabled:` variants on the two moment fields, corrected docstring.
- `frontend/src/features/jaarplan/Generatieparameters.test.tsx` — two new tests, one strengthened, `"hangt"` added to
  the retry stub.
- `backend/src/Jaarplanner.Infrastructure/Planning/EfJaarplanOpslag.cs` — constant `private` → `internal`, doc note.
- `backend/src/Jaarplanner.Infrastructure/Jaarplanner.Infrastructure.csproj` — `InternalsVisibleTo`.
- `backend/tests/Jaarplanner.UnitTests/Planning/GeneratieparametersTabelnaamTests.cs` — new.
- `docs/ux/wireframes/e3-04-r3-*.png` — the test-runner's eight round-3 shots, committed.

### Gates (fix round 3, real numbers, run from Bash)

- `dotnet format --verify-no-changes` — **exit 0**. `dotnet build` — **0 warnings, 0 errors**.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (`Host=127.0.0.1`, `SSL Mode=Disable`, user `jaarplanner`):
  **480 unit + 113 integration passed, 0 failed, 0 skipped** (was 479 + 113: +1 table-name binding).
- `corepack pnpm lint` — **exit 0**; `corepack pnpm test` — **129 passed / 9 files, 0 failed** (was 127);
  `corepack pnpm build` — **exit 0**.

### Nothing disputed this round

All six findings were accepted as stated. The one thing I could not do is re-shoot the failure state; see §6.

### Still not done, by instruction (unchanged)

`CONSTITUTION.md` untouched; enforcing `gewenste startthema's`; the open-day vs calendar-day prompt gap; `[Authorize]`;
the two accepted residuals (the jaarplan concurrency race, and last-write-wins not reporting a replacement).

**Not looked at in a browser.** Two visual surfaces changed: the retry button's border colour and its in-flight state.
The contrast is arithmetic I re-derived and it agrees with the test-runner's two in-browser routes to within 0,02, but
arithmetic is not a look.
