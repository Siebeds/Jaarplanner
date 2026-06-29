# E2 — AI-matching thema ↔ doel

**Phase:** 2 · **Milestone:** M2 — AI koppelt
**Goal:** The core feature — the AI proposes which leerdoelen fit each thema/activiteit, each with a motivation, and the teacher accepts/rejects/adjusts. Everything advisory, validated, and fakeable in tests.
**Covers FR:** FR-4 (+ the goal-first authoring of Gap A.7). **Constitution:** [Art. IV](../CONSTITUTION.md#article-iv--ai-is-advisory-human-in-the-loop), [Art. III](../CONSTITUTION.md#article-iii--curriculum-data-integrity--professional-autonomy-non-negotiable).

---

- [ ] **E2-01 — AI client behind an injectable interface**
  Abstract Azure AI Foundry behind an interface; provide a **faked client** for tests. Keys server-side only.
  *Done when:* the matching service runs against the fake in unit tests with no network. Ref: Art. IV.6, VI.4.

- [ ] **E2-02 — Prompt builder grounded only on school data + loaded goals**
  Build the prompt from the relevant leerdoelen + the thema's themadoelen/subthema's/activiteiten; no external sources.
  *Done when:* prompt contains only school + Op.stap data; snapshot-tested. Ref: Art. IV.4.

- [ ] **E2-03 — Structured-JSON response contract + validation**
  Define the response schema (goal codes + one-line motivation); validate before use; reject/repair malformed output.
  *Done when:* invalid AI output never reaches the domain; validated objects only. Ref: Art. IV.5.

- [ ] **E2-04 — Suggestion persistence as `DoelKoppeling` (status + motivatie)**
  Persist each suggestion as `voorgesteld` with `aiMotivatie`.
  *Done when:* suggestions are stored and queryable per thema/activiteit. Ref: Art. IV.2, FR-4.1/4.2.

- [ ] **E2-05 — Accept / reject / adjust in the UI**
  Teacher reviews each suggestion with its motivation and sets status `aanvaard`/`geweigerd`/`manueel`.
  *Done when:* status changes persist and drive coverage (E5). Ref: FR-4.3, Art. IV.1/IV.3.

- [ ] **E2-06 — "Ongekoppelde doelen" view**
  Show which leerdoelen are not (yet) linked to any thema.
  *Done when:* the list updates as links change. Ref: FR-4.4.

- [ ] **E2-07 — Goal-first authoring assist (thema-opbouw wizard hooks)**
  Wire AI assist at **step 2 (themadoelen)** and **step 6 (subdoelen)** of the wizard (the wizard UI itself lives in E1/E6 beheer; this story provides its AI suggestions).
  *Done when:* the wizard can request themadoel/subdoel suggestions; all advisory. Ref: Art. IV.8 (committed MVP), Gap A.7.

> Optional confidence indicator per suggestion (FR-4.5) is **fast-follow** — see [E8](E8-fast-follow.md).
