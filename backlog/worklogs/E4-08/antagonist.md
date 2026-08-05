# E4-08 — antagonist rounds

## Round 1, on `777f9e6`: **VIOLATIONS FOUND** — 2 MAJOR, 6 MINOR, 2 QUESTION

The auditor's own summary of the split is worth keeping: *"The server half of this story is the strongest part
of the change and I could not falsify the klas invariant, the thin projection, or the dekking claim's
direction. The defects are all on the screen, and two of them are the exact family this story spent a commit
fixing."*

| # | Grade | Finding | Outcome |
| --- | --- | --- | --- |
| 1 | MAJOR | The move confirmation is silently suppressed for the rest of the session once a subthema has been created: `maakSubthema.isSuccess` is a **latched** flag, so E1-14's render-phase guard clears a notice on the render that raises it | **Fixed** in `afde19d`. Clearing moved to the create path's `onSuccess`. Regression test creates a subthema *then* moves. Mutation check: restoring the guard fails that test |
| 2 | MAJOR | With the panel open and the candidate list emptied, the picker offers only its placeholder under a message saying *"Kies een ander subthema"*, and **a passing test asserted that state as correct** | **Fixed** in `afde19d`. Explicit empty-state sentence; the test demands it. The failure notice was hoisted out of that branch in the same pass, because the empty-state sentence had replaced it |
| 3 | MINOR | Reopening the panel replays a failure that did not just happen | **Fixed**: `verplaats.reset()` on cancel. The twin on the trigger was written and then **removed** as unreachable, proven by a mutation check |
| 4 | MINOR | `activiteitVerplaatsGevolg` states the coverage mechanism unconditionally, while layer 4 counts only a **placed** thema | **Fixed**: the claim is tied to the thema being in this class's jaarplan. The auditor explicitly *did not* hold the omitted `Aanvaard`/`Manueel` condition against the copy, since every activiteitkoppeling is written `Manueel` today; it becomes an over-claim when E8 lands activiteit-level suggesties, and that carry-forward is recorded |
| 5 | MINOR | The destination grouping breaks on two thema's with the same naam, which nothing prevents | **Fixed** on both sides: `ThenBy(ThemaId)` in the query, and the grouping keyed on a map rather than on adjacency. Pinned by an integration test asserting every thema's rows are contiguous |
| 6 | MINOR | The new panel state is never audited by axe, and two open panels duplicate accessible names | **Fixed**: an axe assertion with the panel open, and heading/select/submit/cancel named per activiteit. Pinned as "no two names in the row collide", over every control and heading |
| 7 | MINOR | The ruling and the deferred sibling defect are recorded only where they do not survive (code comments; the gitignored chat board) | **Fixed**: the ruling and its rejected alternatives are in the story entry; the `Subthema.Require` defect is filed as **E7-19**. The auditor agreed that *leaving* that defect was right and only its filing location was wrong |
| 8 | MINOR | A new class-scoped read ships with no role check and no klas validation | **Half fixed, half declined.** `VereisKlasAsync` is now called, so an unknown klas is refused instead of answering `[]` (which the picker read as "nowhere to move to"). The missing `[Authorize]` is recorded as pre-existing drift: every class-scoped read is unauthenticated, roles are E6, and FR-10.2 is undecided |
| 9 | QUESTION | Was the **leeftijd** half of the ruling actually ruled? | **Owner's.** Honest answer: no. The options put to the owner were about the thema boundary. The code permits it and now says in a comment that it was **inferred, not ruled** |
| 10 | QUESTION | The klas boundary is unbypassable for this **verb**, not for the system: `PUT /api/subthemas/{id}` re-scopes a subthema with every activiteit in it | **Owner's.** The invariant's comment is narrowed to the verb it guards. Closing that route would be a new story |

**What the auditor could not falsify, recorded because it is evidence and not flattery:** the klas invariant
(`internal` setter, single caller, source derived from the activiteit, both refusals non-destructive and
pinned); the thinness and class-scoping of the destination projection; Art. II.5 (zero em dashes in any
product string); Art. III (nothing mutates curriculum); Art. IV.2 (a teacher's link decision survives the
move, asserted at both levels); Art. V.1 (nothing stored, and the dekking direction measured rather than
argued); and Art. VIII layering.

One correction the auditor made to its own reading, worth noting: it re-ran the frontend suite itself and got
19 files / 439 tests with one environment-level worker timeout, and said so rather than reporting a
discrepancy with the claimed 20 / 455.

## Round 2, on `c697d4f` (the fix round): **VIOLATIONS FOUND** — 2 MAJOR, 7 MINOR, 1 QUESTION

It began by doing the two things this repo has learned to ask for. It **verified every round-1 finding against
the code rather than against the table above** — all ten are really in the tree, none is a phantom repair — and
it **re-ran all four gates itself** on HEAD rather than on the commit the story quoted. Then: *"the pattern
held again: the fix round contains the next two defects, and both are in the code the fix round wrote."*

| # | Grade | Finding | Outcome |
| --- | --- | --- | --- |
| 1 | MAJOR | **Caused by the fix for round-1 MAJOR 2.** Replacing the empty picker with a sentence took the **cancel** with it, because the cancel lived inside the "there are destinations" arm. The empty, loading and list-error states had no control that closed the panel, beside a trigger that only set an already-set state | **Fixed.** The button row sits outside every branch; the submit stays conditional, the cancel does not. Test asserts a closing control exists in every state, including a new list-error fixture. Mutation check bites (third attempt, see below) |
| 2 | MAJOR | The confirmation was a `role="status"` region mounted **together with its text**, which this codebase forbids in two places after **E4-06 shipped exactly that and found it silent** | **Fixed.** Region mounted with the section, text conditional, as `Schoolcontentimport.tsx` and `Themakaart.tsx` do. The auditor stated it could not verify silence without a real screen reader and graded it on the contradicted rule, which is the honest form |
| 3 | MINOR | **The `geldigeKeuze` fix was untestable in its own fixture**: the refused destination was the klas's only candidate, so the picker vanished and the submit was absent whatever the component computed. Reverting the derivation left all 459 tests green | **Fixed.** New opt-in fixture with a second destination still on offer; the assertion is on the submit staying disabled on a stale id. Mutation check bites |
| 4 | MINOR | **Nothing asserted that a notice is ever *cleared***, so the replacement for round 4's latched guard was unpinned exactly as the guard had been. And rewriting that comment deleted the repo's only record of the defect round 4 described, which is **still live** | **Both halves.** A test now pins the clearing (mutation check bites), the record is restored to the comment, and the live defect is filed as **E1-20** rather than fixed, because the other writes live in `Subthemakaart` and hooking five call sites is E1-14's change |
| 5 | MINOR | A comment still called ruling 5 an open question, in the commit titled *"two owner rulings"* | **Fixed**: it points at E1-19 |
| 6 | MINOR | Two comments asserted *"the picker groups by consecutive ThemaId"*, which the fix round had replaced with a keyed map; and the client half is untested | **Fixed**: both comments describe the current mechanism, and each states that the client half is defence in depth pinned only server-side |
| 7 | MINOR | The refusal-message test claimed a property over **future** refusals that a hand-written list cannot have | **Fixed**: the claim is downgraded to what it does. Today's coverage is total; tomorrow's needs a line |
| 8 | MINOR | The story entry recorded gates on a commit that was no longer HEAD, and HEAD changed product code | **Fixed**, and the first repair invented a hash **before the commit existed**, which was the same defect in a new form. Now written as a placeholder and filled in afterwards |
| 9 | MINOR | The leeftijd disclosure printed unconditionally, including when no offered destination has another leeftijd | **Fixed**: tied to `kandidaten.some(k => k.leeftijd !== …)`. The ruling was that the crossing must be *disclosed*, not that the sentence must always appear. Mutation check bites |
| 10 | QUESTION | The two new endpoints carry no `[Authorize]`, and the destinations read is a new enumeration surface | **Routed, not answered.** Verified as consistent pre-existing drift (only `OpstapImportController` has one); E6 / FR-10.2 |

**Mutation 11 took three attempts, and the two failures are the useful part.** First attempt hid the button row
with a Tailwind `hidden` class — invisible to jsdom, which loads no CSS, so the button stayed queryable and the
mutation survived. Second attempt used the `hidden` attribute but a first-occurrence replace hit the **delete**
panel's identical class list, failing two unrelated tests while leaving the code under test untouched. Third
attempt anchored on the line below and failed exactly the intended test. *A mutation that fails the wrong test
is as uninformative as one that fails none.*

**Third browser pass**, on the round-2 fixes, against a live API and real PostgreSQL with a graadklas-shaped
scenario (source leeftijd 8, destination 9): the leeftijd sentence appears where it applies, the live region is
mounted and empty before anything happens, and in the emptied state the cancel is present, visible and closes
the panel.

## Round 3, on `38a64f8`: **VIOLATIONS FOUND** — 1 MAJOR, 6 MINOR, 2 QUESTION

It verified round 2's ten findings against the code and confirmed **both round-2 MAJOR fixes are correct and
bite under mutation**. The MAJOR it found is in round 2's *third* fix, the one round 2 called its most useful.

| # | Grade | Finding | Outcome |
| --- | --- | --- | --- |
| 1 | MAJOR | **A mutation check passed because the test's own setup had already done the thing under test.** The notice-clearing test clicked *Nieuw subthema* first, and that handler already clears notices, so the assertion never observed the `onSuccess` site round 1's MAJOR-1 fix installed. Deleting either site alone left 33/33 green | **Fixed.** A test that opens the create form *before* the notice exists, so `onSuccess` is the only thing that can remove the sentence. Mutation bites, and it fails exactly one test |
| 2 | MINOR | The "elke toestand" property test drove **three of four** panel states, and the missing loading state hid a live mutation: a submit rendered with no picker | **Fixed.** Four states, and a second property (`Boolean(submit) === Boolean(kiezer)`). A new `bestemmingenHangt` fixture reaches the loading state |
| 3 | MINOR | The gates block was relabelled to the new commit and its figures were not (459 where it was 466; "twice" where three passes had run) | **Fixed.** Round 2's MINOR 8 repaired the label and left the payload |
| 4 | MINOR | A comment quoted, in the present tense, the remedy half of a server message this story had deleted | **Fixed** |
| 5 | MINOR | The list-error state is the one of four that names no remedy, while the repo's sibling for the identical case ends *"Probeer het opnieuw."* | **Fixed**, then **fixed again** in round 4: the sentence alone was the half-measure `Themakiezer` had already rejected. See round 4 MINOR 1 |
| 6 | MINOR | `kanLeeftijdWisselen` reads `kandidaten`, and TanStack's `isRefetchError` keeps `data` while `isError` is true, so the disclosure could print above *"er is nu geen bestemming om uit te kiezen"* | **Fixed**: gated on `heeftKeuzelijst`, with a fixture that serves the list once and fails afterwards. Mutation bites |
| 7 | MINOR | Two factual errors in the record: "twelve keys" where there are seventeen, and E1-20's "exactly one event" where there are two | **Fixed.** The second was load-bearing: the forgotten site is what made the MAJOR possible |
| 8-9 | QUESTION | Authorization on the new endpoints; Art. XIV graadklassen now carrying shipped behaviour | **Routed**, both to their epics, neither held against this story |

## Round 4, on `9dbe204`: **VIOLATIONS FOUND** — 1 MAJOR, 6 MINOR, 1 QUESTION

Round 3's three fixes verified correct and biting. The MAJOR is the assistive-technology half of round 2's
MAJOR 1, which had stood through two further rounds because every test and every browser pass was looking at
pixels.

| # | Grade | Finding | Outcome |
| --- | --- | --- | --- |
| 1 | MAJOR | **The trigger announced `aria-expanded="true"` and did nothing when pressed in that state.** A screen reader heard *"uitgevouwen, knop"*; activating it called `setVerplaatsen(true)` on a state already `true`. No `aria-controls` either, so the announced disclosure could not be reached. `axe` has no rule for a lying `aria-expanded`, and the panel's axe run passed while it was live | **Fixed** by adopting the repo's existing shape: `aria-controls` plus a real toggle, sharing one close routine with the cancel so closing from the trigger also resets. Three mutations bite (open-only, no `aria-controls`, close-without-cleanup) |
| 2 | MINOR | `"Probeer het opnieuw."* with **no retry control**, which is exactly the half-measure `Themakiezer`'s own fix round rejected. Worse here: closing and reopening issues no request, because the query is section-scoped and its retries are spent | **Fixed**: the sentence states the fact and a button does the refetch, with an in-flight label. Mutation bites |
| 3 | MINOR | Three of the four notice-clearing behaviours survived mutation; only `onSuccess` was pinned. The comment claiming the two notices are mutually exclusive was unobserved | **Fixed** for the pair, in **both** directions, which needed two tests plus a one-shot-404 fixture: a successful cross-thema move takes the row off the screen, so there is nothing left to move a second time. Both mutations bite. The trigger's own clear is still unpinned and now says so |
| 4 | MINOR | The panel's 404 guard is unreachable: `onError` closes the panel in the same batch | **Deleted**, per this story's own rule about insurance that cannot fire |
| 5 | MINOR | `\|\| verplaatsen` survived mutation, and the E3-09 reason printed beside it had expired once round 2 made the cancel unconditional | **Fixed**: reworded to the reason that still holds, and asserted. Mutation bites |
| 6 | MINOR | Round 3's request counter was inserted between a doc comment and the variable it documents | **Fixed** |
| 7 | MINOR | No browser pass since fix round 3, which changed rendered copy and a render condition; and the list-error paragraph was the only one in the panel without `max-w-prose` | **Fixed**: fourth browser pass, and the cap added. Reaching the state needed `Network.setBlockedURLs` on a cold document, because the app's own QueryClient retries with backoff and a warm cache hides the state entirely |
| 8 | QUESTION | Round 3's own findings were not yet in this file, so its two QUESTIONs were invisible | **Fixed**: this file now carries all four rounds |

**Filed rather than fixed:** **E7-20** — `aria-expanded` on disclosure triggers is answered three different ways
in three files, each defended in its own comment, and no gate can catch a wrong call. Round 4 found the third
answer *as a MAJOR*, which is the argument for writing the rule down somewhere a builder meets it.

## Round 5

**Owed on the same reasoning as rounds 3 and 4, but the surface is now small**: fix round 4 is one render
condition, one deleted branch, one new control and six comment or record edits. Four rounds have found
1 MAJOR each in the last two, both of them in the *fixes* rather than in the original build.
