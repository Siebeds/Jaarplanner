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

## Round 2

**Not run.** The story stays `[~]` for that reason, and because two of round 1's questions are the owner's to
answer. This repo's record is that a fix round is where the next defect lives: three consecutive rounds on
E1-14 and four on E4-02 found one.
