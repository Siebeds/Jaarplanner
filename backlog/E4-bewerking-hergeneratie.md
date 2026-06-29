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

- [ ] **E4-06 — Vergrendelde blokken excluded from regeneration**
  A `vergrendeld` thema/block is preserved across (re)generation.
  *Done when:* locked content survives both full and partial regeneration. Ref: FR-8.4, Art. IX.3.

- [ ] **E4-07 — Pre-apply diff + cancel; manual-edit preservation rule**
  Before applying a (re)generation, show what will change with a cancel option; define and honor how manual edits are preserved.
  *Done when:* the diff is accurate and cancel is non-destructive; the preserve/overwrite rule is explicit. Ref: FR-8.3, FR-7.3 (precise rule: confirm with directie).
