# E3-07 — antagonist audit

**Verdict on the first submission (commit `c484315`): VIOLATIONS FOUND** — 2 MAJOR, 10 MINOR, 1 QUESTION.
**All 12 findings addressed** in the follow-up commit; the QUESTION was recorded against the story that owns it.
Audit run 2026-07-30 against `CONSTITUTION.md`, read-only, in this worktree.

Eight things the audit *cleared* are worth naming, because they were the parts I was least sure of: ADR-0020
keying (traced exhaustively — no path where an ordinal decides a placement), the delete-confirmation predicate
(exact inverse of `IsVervangbaar`, so exactly the ratified rule, and it fails *safe*), the rewritten E3-06 test
(judged genuinely stronger, not weakened), the clause-4 "not verifiable" reporting (judged honest, not a quietly
retired criterion), the SC 2.5.7 reasoning behind having no `KeyboardSensor`, that `destructive` is not a second
chrome accent hue, that option (b) of the Art. II.3 ruling still costs no UI rework, and Art. III/VII/IX being
untouched. The auditor also re-ran the gates itself rather than trusting the report.

## The two MAJOR findings

### 1. A move was justified by a reversibility claim that is false

`VerplaatsPlaatsingAsync` carried: *"Moving it is also reversible (drag it back) … which is why no confirmation
is required for a move."* Dragging back restores `BlokStart` and **nothing else** — the AI motivation stays
`null` for good and an `Aanvaard` decision is overwritten. So the same worklog asserted "destroyed, not archived"
(decision 1) and "reversible" (decision 5) two decisions apart, and the UI disclosed nothing, while the *other*
route to `Manueel` on the same card explained itself in full.

**Fixed** by making the code true rather than the claim: the comments in `Themaplaatsing.VerplaatsNaar`,
`VerplaatsPlaatsingAsync` and the controller now state that a move is *not* reversible, and the picker discloses
the consequence **before** the move (`kalender.verplaatsGevolg`). Deliberately still not a confirmation dialog —
a move is a small unrecoverable edit where a delete is a total one — and the warning is suppressed for a card
that has nothing to lose, because a warning that does not apply teaches teachers to ignore warnings. Two tests.

### 2. Dragging a rejected placement silently granted it dekking

The story built an explicit, explained control for reversing a rejection, and then let a drag perform the same
`Geweigerd → Manueel` transition with no explanation. It is the **only** transition in this feature with an
Art. V.1 consequence: under the binding reading recorded in `E5-dekking-export.md`, only `aanvaard`/`manueel`
count as *placed*, so nudging a rejected thema one period sideways would flip it from "not taught" to "taught" in
the figure an onderwijsinspectie is shown. No test covered it.

**Fixed** by refusing it at every layer: the service throws `OngeldigeVerplaatsingFout` (400) — checked *before*
the no-op branch, so even a drop back onto its own period is refused rather than answered 200; the card is not
draggable and offers no picker; and the panel says why, pointing at the reversal control. Three tests (service,
endpoint, component) plus one on the extracted handler.

## The MINOR findings

| # | Finding | Fix |
| --- | --- | --- |
| 3 | **The contrast figure justifying `destructive` was wrong** — white on `attentie` is **4.53:1**, not 4.31:1, i.e. it *passes*. An arithmetic slip in the green channel, repeated into a code comment, two backlog entries, the worklog and the commit message. | Re-derived twice. Corrected in all five places, and the choice restated on the grounds that actually carry it: margin (0.03 is not a margin, per E7-10's own rule) and hierarchy. Hover measured too (8.98:1). |
| 4 | The drop handler — including the "nothing is guessed" guarantee — had **no automated coverage**. The jsdom argument is sound about the *gesture* and was wrongly stretched to cover the *logic*. | Extracted as `bepaalVerplaatsing` in `kalenderFormat.ts`; 6 unit tests including the `over: null` branch. |
| 5 | The stale-placement delete confirmation named neither period nor date, and the unique index permits the same thema stale at two vanished dates — so two cards could raise byte-identical questions for two different unrecoverable deletions. | Names the stored date. Test asserts two stale cards of one thema produce *different* questions. |
| 6 | Two new doc comments contradicted their code (a "beats a 200" comment above code returning exactly that 200; a controller doc claiming same-period is a 400). | Both rewritten; the controller now lists the full 400/200 contract. |
| 7 | **Nested live regions:** the delete confirmation is a `role="alert"` inside the stale notice's `role="alert"`, which now also holds a select and buttons. Undefined behaviour, and the outer region can re-announce everything each time a panel opens. | Outer became `role="region"` + `aria-labelledby`, with the count sentence in a small `sr-only role="status"`. Still not dismissible; two tests updated to match. |
| 8 | The grip spread dnd-kit `attributes` it then contradicted, shipping `aria-roledescription`/`aria-pressed` on a `role="presentation"` node — invalid ARIA that passed axe only because `aria-hidden` excluded it. | Spread `listeners` only. |
| 9 | Unused `sleepGreep` i18n key, reading as evidence of a label the grip deliberately lacks. | Removed. |
| 10 | `verplaatsMislukt` ("kies een periode uit dit jaarplan") was shown for **any** error, so a 500 sent the teacher round a loop that cannot succeed — the exact conflation the generation panel four lines away warns about. | Branches on `ApiError.status === 400`; new `verplaatsOnbeschikbaar` copy; test. The backlog claim that the frontend "branches on the 400" is now true, and was corrected where it was false. |
| 11 | Test report §1 asserted the drop target's border "turned to the attentie hue" — not measured, and not what the code paints for an *empty* period. | Corrected, with the reason stated: a detail asserted from expectation is the same defect as a wrong figure. |
| 12 | The story line promised "drag thema's **/activiteiten**"; the activiteiten half was neither built nor deferred. | Story line corrected to "thema's", with the reason: Art. IX.3 has no activiteit placement, so there is nothing to drag. |

## The QUESTION

**No authorization on the jaarplan write surface.** Pre-existing and project-wide (`grep Authorize` over
`backend/src` = zero hits; ADR-0011 assigns authn to E6-01/E6-02), so not an E3-07 regression — but E3-07 makes
it the fifth unauthenticated state-changing route on a class's plan, and this story's ratified compensating
control for the status-blind DELETE is a *UI confirmation*, which protects nothing at the API. Recorded as a
carry-forward on **E6-02** with all five routes enumerated.

## Still open after the fixes

- **Screen-reader verification** of the drag announcements and the restructured region. The nesting defect is
  fixed by construction, but nobody has listened to it; `axe` cannot evaluate announcement behaviour.
- **Integration tests were not re-run by the auditor** (they need `JAARPLANNER_TEST_POSTGRES`); I re-ran them:
  **455 unit + 92 integration, 0 failed, 0 skipped**.
- **Latent tier issue** the auditor spotted: `VerplaatsPlaatsingAsync` validates against the *themaperiode* grid,
  so a future `Subthemaperiode` placement would be unmovable and get the misleading *"is geen begin van een
  periode"* message. No such placement can exist today (generation only places on the coarse tier) and it fails
  safe, but the message would lie. Left as-is, recorded here.
- **The te-vol threshold** (review question C) now drives a second surface — the pre-drop preview — while still
  unratified. Correctly one named constant, phrased as a consequence rather than a refusal.
- **"Manueel" as teacher-facing copy**, which the audit independently reached: a drag now *produces* this status,
  so E3-07 multiplies the exposure of a word no non-technical teacher uses. Needs an owner's copy decision.
