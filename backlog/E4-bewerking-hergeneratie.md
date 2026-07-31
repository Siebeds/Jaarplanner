# E4 — Manuele bewerking & (her)generatie

**Phase:** 4 · **Milestone:** M4 — Volledige controle
**Goal:** The teacher keeps full control: anything the AI proposed can be overridden manually, and the plan can be regenerated whole or per period, with locked blocks preserved and a preview before applying.
**Covers FR:** FR-7, FR-8. **Constitution:** [Art. IV.1](../CONSTITUTION.md#article-iv--ai-is-advisory-human-in-the-loop) (human-in-the-loop), [Art. V](../CONSTITUTION.md#article-v--coverage-must-be-provable-dekking).

---

### FR-7 — Manual edits

- [ ] **E4-01 — Immediate persistence + live coverage reflection**
  Every manual change (move/add/remove) saves immediately and is reflected in the dekkingsoverzicht.
  *Done when:* a drag or edit updates persistence and coverage without a manual save. Ref: FR-6.5, FR-7.

- [ ] **E4-02 — Override any AI suggestion**
  Anything proposed by AI can be manually overwritten; status moves to `manueel`.
  *Done when:* overriding a `voorgesteld`/`aanvaard` link sets `manueel` and sticks. Ref: FR-7.1, Art. IV.1.
  *Partly delivered early by **E3-07** (2026-07-30), for **placements**.* Dragging a thema to another period *is* overriding an AI proposal, so `Themaplaatsing.VerplaatsNaar` implements this rule: the status moves to `Manueel`, it sticks across a reload, and it survives a regeneration (`IsVervangbaar` turns false). Asserted by `Een_verplaatste_plaatsing_overleeft_een_hergeneratie`. **What this story still owns:** the same rule for **DoelKoppelingen** (a goal↔thema link overridden by hand), which E3-07 does not touch. Recorded here rather than only in E3-07's log — a rule implemented in one story and specified in another is exactly how this project has lost obligations before.

- [ ] **E4-03 — Manual add/move/remove independent of AI**
  Add/move/remove thema's, activiteiten, and goal links by hand, with no AI involved.
  *Done when:* a fully hand-built plan is possible. Ref: FR-7.2.

### FR-8 — (Re)generation

- [ ] **E4-04 — Regenerate the whole plan**
  Re-run generation for the entire class plan.
  *Done when:* full regeneration produces a new proposal. Ref: FR-8.1.

- [ ] **E4-05 — Regenerate a single period**
  Regenerate one block/period without touching the rest.
  *Done when:* only the chosen period changes. Ref: FR-8.2.

- [~] **E4-06 — Vergrendelde blokken excluded from regeneration** — *claimed 2026-07-31 by the orchestrator; built on `story/E4-06-vergrendeling` off `main` (`0de4851`), first story of `feature/e4-bewerking-hergeneratie`*
  A `vergrendeld` thema/block is preserved across (re)generation.
  *Done when:* locked content survives both full and partial regeneration. Ref: FR-8.4, Art. IX.3.
  > **Pre-flight finding (orchestrator, 2026-07-31): the server half is built and the story is a *user-surface* story.** `Themaplaatsing.Vergrendeld`, `Themaplaatsing.IsVervangbaar`, `Jaarplan.VerwijderVervangbarePlaatsingen()`, `JaarplanGeneratieService.WijzigVergrendelingAsync` and `PUT /api/klassen/{klasId}/jaarplan/plaatsingen/{plaatsingId}/vergrendeling` all exist, and `GenereerAsync` already discards only replaceable placements. What does **not** exist is any way for a teacher to set the flag: `frontend/src/features/jaarplan/api.ts` never calls that endpoint, yet `Themakaart.tsx` (lines 111 and 401) renders a *"Vast / Blijft staan bij hergenereren"* badge. So today the badge is unreachable state and FR-8.4 has no invocation surface, which is the E2-08 / E1-15 / E0-10 pattern for the fourth time and a breach of the E3-06 rule (never ship a control, or a state, a user cannot produce). This story owns the lock/unlock affordance plus proof that a locked placement survives regeneration; it must **verify** the server half rather than assume it.
  > *Scope boundary:* "partial regeneration" in the *Done when* is **E4-05**, which does not exist (`GenereerAsync` takes no period scope). This story proves preservation across the **full** regeneration path that exists, and E4-05 inherits the obligation to prove it for its own path. Do not mark the partial half proven.
  > **Two owner rulings, 2026-07-31, both taken on the antagonist's findings against `889471d`.**
  > 1. **The lock must say it is not a decision.** The audit found that after this story, locking is the *only* keep-affordance on the kalender: `useWijzigPlaatsingStatus` is called from exactly one place and never sends `Aanvaard`, so nothing on the anchor screen accepts a proposal. Meanwhile a locked `Voorgesteld` placement contributes **nothing** to dekking under the binding reading in [E5](E5-dekking-export.md) (only `Aanvaard`/`Manueel` count as placed), and the copy actively invited teachers to lock instead. **Ruled: add the distinction in copy, inside this story** — vastzetten keeps the thema in place, aanvaarden is what makes it count. The accept affordance itself stays out of E4-06. *Consequence for whoever builds it:* E4-01/E4-02 must add it, and until they do, every locked proposal in a plan is a figure E5 cannot honour. The audit is right that no number will contradict the teacher until E5 exists, which is precisely why the sentence has to carry the weight in the meantime.
  > 2. **The button weights get fixed here, not deferred.** "Losmaken" (reversible) and "Uit deze periode halen" (unrecoverable) were shipped as two visually identical `outline` buttons, adjacent, and this story added the third instance on the commonest card — the unlocked `Voorgesteld` one, which is exactly where deletion happens on a single click with no confirmation. The implementer flagged it and left it; the audit refused to let a self-flag count as a resolution. **Ruled: resolve it in this story**, even though it touches the button hierarchy rather than FR-8.4.

- [ ] **E4-07 — Pre-apply diff + cancel; manual-edit preservation rule**
  Before applying a (re)generation, show what will change with a cancel option; define and honor how manual edits are preserved.
  *Done when:* the diff is accurate and cancel is non-destructive; the preserve/overwrite rule is explicit. Ref: FR-8.3, FR-7.3 (precise rule: confirm with directie).
