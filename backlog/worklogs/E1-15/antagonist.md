# E1-15 — antagonist audit record

Three passes by the `antagonist` subagent, each on a specific commit. Verdicts and findings are recorded
here; the fixes are described in `implementation.md`, the independent verification in `test-report.md`.

| Pass | Commit | Verdict |
| --- | --- | --- |
| 1 — full audit | `57a21b1` | **VIOLATIONS FOUND** — 3 MAJOR, 4 MINOR, 2 QUESTION |
| 2 — re-audit of fix round 1 | `cd426cf` | **VIOLATIONS FOUND** — 4 MINOR; all three MAJORs resolved |
| 3 — narrow close-out | `43a38eb` | **COMPLIANT** — story may close; nothing remains, code or records |

The audit was harder on the *records* than on the code, which is the pattern worth carrying: of the eleven
findings, four were wrong numbers or missing register entries rather than defects in behaviour. Two of those
four would have understated a filed debt to whoever picks it up next.

---

## Pass 1 — `57a21b1`, VIOLATIONS FOUND

Opened by stating that none of the findings said the story built the wrong thing: the trigger was real, the
import logic genuinely untouched, and the Art. III.4 guarantee newly pinned by an HTTP-level test against real
PostgreSQL, which it called a material improvement.

**[MAJOR] Provider-specific database error translation in the `Api` layer** (Art. VIII).
`OpstapImportController` read `Npgsql.PostgresException { SqlState: "23505" / "23503" }`. Two facts made it a
fresh breach rather than inherited style: `Npgsql` is not a declared dependency of `Jaarplanner.Api.csproj`
(the type arrived transitively), and the comment defending the placement cited `KlasBeheerService` /
`SchooljaarBeheerService`, both of which live in `Infrastructure` — before this commit all four
`PostgresException` hits in `backend/src` were in Infrastructure. It also bypassed the repo's own idiom: three
`IExceptionHandler`s exist so services throw typed faults and controllers stay free of mapping.
→ **Fixed** in round 1: typed `OpstapImportFout` in `Application`, translation beside the `DbContext`, new
`OpstapImportExceptionHandler`. Verified in pass 3: no `Npgsql` type remains in `Api` outside comments.

**[MAJOR] The controller constructor-injects two Infrastructure-owned ports** (Art. VIII; filed as E7-13), and
put a second Infrastructure DTO on the wire, while the worklog claimed "Thin REST controller (Art. VIII)" and
never mentioned E7-13.
→ **Documented, not moved**, on the orchestrator's decision: the move is E7-13's and would drag the
school-content parser with it. E7-13 gained a blast-radius paragraph and the controller's doc comment now
states the filed exception instead of claiming compliance. The audit had offered this as the alternative
remedy and accepted it in pass 2.

**[MAJOR] Two new anonymous, mutating endpoints over decreed reference data, and E7-11's register was not
updated** (Art. VI.1/VI.5, Art. III.4). The seam itself was accepted without reservation: one named policy,
one attribute, no client-side gating, no invented roles, a documented no-op body, and a test asserting the
allow-everyone behaviour out loud. What was missing was the consequence in the register. The audit verified
the damage scenario rather than asserting it: a well-formed single-row file for one discipline clears the
empty-file guard and sets `NietMeerInOpstap = true` on every other loaded goal in that discipline, besides
rewriting official `Tekst`/`Toelichting` for any code it carries. Aggravating: an anonymous caller can hand
ClosedXML a 20 MB workbook.
→ **Fixed:** both routes added to E7-11 with the new dimension (first anonymous *write* to decreed reference
data), the mass-flag scenario and the ClosedXML surface.

**[MINOR] Em-dashed Dutch shipped through `diff.opmerkingen[]`** (Art. II.5). Two notices authored by
E1-05/E1-06 were unreachable until this commit put them on the wire, and E1-13 clause 6 is written to render
exactly this diff. The worklog's "no em dashes in any of the new strings" was true and did not cover the
strings the change newly exposed. → **Fixed:** both rewritten rather than de-dashed, and the config key moved
out of the Dutch sentence into an operator comment.

**[MINOR] The preview could not warn about the three failures the commit added**, contradicting the
controller's own documented promise that both paths run the same logic (FR-2.5, Art. X.5). All three fired on
`SaveChanges`, which the preview never calls, so a preview green-lit an import that then answered 409.
→ **Fixed with the real fix, not the fallback:** `ControleerVoorwaardenAsync` runs before any diffing on both
paths, discipline first.

**[MINOR] The Art. II.3 log line was accurate on what was added and silent on what became user-reachable**;
also `"Ongeldige aanvraag"` was a copy-pasted literal, not a shared constant. → **Fixed**, taking the share
option: five independent definitions became one `Probleemtitels` constant.

**[MINOR] A new authorisation policy and a routing decision recorded only in code comments and a worklog**
(Art. X.5; the `CLAUDE.md` ADR instruction). E6-02's implementer will read ADR-0011, not this worklog.
→ **Fixed:** ADR-0022, complementing ADR-0011 without superseding it.

**[QUESTION] The uncapped FR-4.1 candidate set** is now live, and the story instructed it be weighed. The
audit found no article mandating a cap and judged leaving it defensible, while noting the second-order Art. V
effect. → **Owner ruled 2026-07-31:** it stays, because deciding which goals are withheld from the model is
pedagogical, not technical; the note was re-filed onto E2-08 and E7-11 so it does not live in a worklog.

**[QUESTION] What should happen when Op.stap moves a `code` between disciplines** (Art. III.5, Art. XIV). The
answer was compiled in as "refuse the whole file with a 409" without ratification. → **Owner ruled
2026-07-31:** refuse and inform the uploader, recorded as RESOLVED in `backlog/README.md`.

On the E1-12 share-or-not decision, which the orchestrator asked about specifically: judged **legitimate,
within remit, and not pre-empting directie** — it hard-assumes nothing on the Art. XIV list and is reversible
at zero cost.

---

## Pass 2 — `cd426cf`, VIOLATIONS FOUND (MINOR only)

Re-derived Art. III.1 and III.4 from the new code rather than carrying pass 1's conclusion forward, because
fix round 1 had edited the sanctioned importer. Confirmed the preflight issues three read-only queries, never
touches `inkomend`, and runs after the discipline seam and the empty-file guard but before every write and
every `ZetReviewVlag` — which it called *stronger* than round 1, where the same refusals fired after flagging
had been staged in the change tracker. Transaction behaviour unchanged: still one `SaveChangesAsync` in an
implicit transaction, and throwing from inside the service changes nothing because the `DbContext` is
request-scoped.

On the 15 modified unit tests: **not weakened.** The diff is insertions only; two fixture constructors now
seed the `Discipline` rows the fixtures always implied. Those fixtures had been asserting against a state
PostgreSQL rejects via a required `Restrict` FK, and the in-memory provider hid it. Had the seed been omitted
the tests would now fail loudly rather than pass vacuously.

On the four-controller title refactor: correct, complete and behaviour-preserving; the constants are
byte-identical to the literals they replaced, so no other endpoint's wording moved.

On FR-2.5 and the information the preview no longer shows: **refusing at preview is the constitutionally
better answer**, and the audit explicitly said it does not need an owner ruling. A preview that reports
"these goals would be added" for a file that cannot commit signals something false, and what disappears is the
diff of an import that cannot occur, replaced by the only actionable fact there is.

Four new MINOR findings, all fixed in round 2:

1. **The same three refusals had two independently authored sets of Dutch copy** (Art. II.3 clause 3) — the
   commit that consolidated five copies of one title created three duplicated details one layer down, and the
   duplicates were the ones no test could reach.
2. **Translating the race-path failure destroyed the operator diagnostic** (Art. II.3, operator half): the
   `DbUpdateException` and its SQLSTATE were discarded at the throw site.
3. **E7-13's new paragraph stated a wrong count** ("1 to 3" where the truth is 3 to 5) and thereby implicitly
   answered its own open question "no" when the answer is yes; plus a wrong "nearly made it six" claim.
4. **The Art. II.3 log line was stale a second time**, in both count and location.

**[QUESTION] `CLAUDE.md` still says "(ADR-0001…0020)".** The audit looked for a binding article and found
none: it conflicts with the filesystem, not the constitution. It judged the implementer's restraint correct,
since a repo file is authored by whoever committed last, and routed it to the owner with the suggestion to
write "ADR-0001 onwards" rather than a range that will drift again.

---

## Pass 3 — `43a38eb`, COMPLIANT

Narrow close-out, offered by the audit itself in pass 2 in place of a third full round. It re-counted every
number the commit asserts rather than accepting them, and re-ran `dotnet build` (clean).

- **Reachable Dutch unchanged character for character**, traced by hand through all three concatenations,
  including the observation that the truncation renders identically despite the preflight now passing the full
  list. This matters because four existing tests substring-match that copy.
- **The only permitted difference is now structurally enforced** rather than asserted by eye, and
  `OpstapImportFoutTests` pins it at the only level where the divergence is observable.
- **Layer judged right:** all three sibling faults carrying Dutch live in `Application`, and under Art. II.3
  as amended the language of a message follows its audience, not its layer. `Probleemtitels` staying in `Api`
  is the correct split, because an RFC 7807 `Title` is an HTTP classification `Application` knows nothing of.
- **One runtime risk checked rather than assumed:** the constructor projection after `OrderBy`/`Take` is
  covered by two `[PostgresFact]` tests in a 0-skipped run. (The test-runner later confirmed live that Npgsql
  translates it, from the projected values appearing in a real refusal message.)
- **All numbers verified independently** and found correct: 3 to 5, five-not-six, and 8 authored across three
  files.

Two things it read and deliberately did not file: `OpstapImportFoutTests` asserts three Dutch words literally
(test-internal, and asserting the truncation marker is desirable), and `Staart` splits on the first `". "`
(no Op.stap code contains that).

Closing statement, quoted because it is the part a later reader needs: *"there is no remaining item of any
kind against this story, so nothing is being held over a sentence. Round 1's three MAJORs were fixed properly,
round 2's four MINORs are fixed properly, and the fact that this round was written in two halves after the
implementer died mid-round shows in the record rather than in the code, which is the correct outcome.
Art. X.7 is satisfied."*
