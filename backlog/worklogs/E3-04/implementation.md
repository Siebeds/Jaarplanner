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
