# E2 — AI-matching thema ↔ doel

**Phase:** 2 · **Milestone:** M2 — AI koppelt
**Goal:** The core feature — the AI proposes which leerdoelen fit each thema/activiteit, each with a motivation, and the teacher accepts/rejects/adjusts. Everything advisory, validated, and fakeable in tests.
**Covers FR:** FR-4 (+ the goal-first authoring of Gap A.7). **Constitution:** [Art. IV](../CONSTITUTION.md#article-iv--ai-is-advisory-human-in-the-loop), [Art. III](../CONSTITUTION.md#article-iii--curriculum-data-integrity--professional-autonomy-non-negotiable).

---

- [x] **E2-01 — AI client behind an injectable interface**
  Abstract Azure AI Foundry behind an interface; provide a **faked client** for tests. Keys server-side only.
  *Done when:* the matching service runs against the fake in unit tests with no network. Ref: Art. IV.6, VI.4.

- [x] **E2-02 — Prompt builder grounded only on school data + loaded goals**
  Build the prompt from the relevant leerdoelen + the thema's themadoelen/subthema's/activiteiten; no external sources.
  *Done when:* prompt contains only school + Op.stap data; snapshot-tested. Ref: Art. IV.4.

- [x] **E2-03 — Structured-JSON response contract + validation**
  Define the response schema (goal codes + one-line motivation); validate before use; reject/repair malformed output.
  *Done when:* invalid AI output never reaches the domain; validated objects only. Ref: Art. IV.5.

- [x] **E2-04 — Suggestion persistence as `DoelKoppeling` (status + motivatie)**
  Persist each suggestion as `voorgesteld` with `aiMotivatie`.
  *Done when:* suggestions are stored and queryable **per thema**. Ref: Art. IV.2, FR-4.1/4.2.
  *Scope (directie decision 2026-07-13):* FR-4 matching persists at **thema (school-wide) scope** as `Thema.doelsuggesties[]` (Art. IX.2 amended to sanction it). Activiteit-/subdoel-level (class/age) matching is deferred to fast-follow **[E8-07]**.

- [x] **E2-05 — Accept / reject / adjust in the UI**
  Teacher reviews each suggestion with its motivation and sets status `aanvaard`/`geweigerd`/`manueel`.
  *Done when:* a teacher's accept/reject/adjust decision **persists**, in the form E5 will later read for coverage. Ref: FR-4.3, Art. IV.1/IV.3.
  *AC clarified 2026-07-28:* this criterion previously read "status changes persist **and drive coverage (E5)**", which made half of it depend on an epic that is 0/9 with no coverage code written. Coverage is E5's job; E2-05's job is that the decision survives and is queryable. Forward reference, not an unmet criterion — this story keeps its `[x]`.
  *FR-4.3's "aanpassen" is only partly built (decided 2026-07-28):* FR-4.3 names **three** actions — aanvaarden, weigeren, **aanpassen**. What exists is a third button setting status `Manueel`. That is a *status*, not an adjustment: the teacher has changed no part of the suggestion. Reading taken — **"aanpassen" means substituting a different leerplandoel** ("the AI proposed this doel; I think it should be that one"), with `Manueel` as the correct status *resulting* from such a change. So the status vocabulary is right and the action is missing. Assigned to **E2-08**, which touches this flow; the underlying link-creation endpoints already exist (E1-10) and their generic UI is E1-14. *Reversible:* if directie reads "aanpassen" as merely overriding the AI's verdict, this is already done — flag it rather than assuming.
  *Drift noted 2026-07-28 (third audit), not a breach:* the review row renders the bare `leerplandoelCode` plus the AI motivation — the leerplandoel's own `tekst` is not in `Doelsuggestie` at all. Art. IV.3's literal requirement (surface the motivation) is met, but FR-4.2's *purpose* clause is *"zodat de leerkracht ze kan **beoordelen**"*, and judging a suggestion from an opaque code plus one AI sentence is thin for a non-technical teacher. The sibling `OngekoppeldeDoelenLijst` **does** render `tekst`, so this is an asymmetry rather than a deliberate contract. Fold the doel text (and ideally the doelsoort badge) into the payload when **E2-08** touches this flow.

- [x] **E2-06 — "Ongekoppelde doelen" view**
  Show which leerdoelen are not (yet) linked to any thema.
  *Done when:* the list updates as links change. Ref: FR-4.4.

- [x] **E2-07 — Goal-first authoring assist (thema-opbouw wizard hooks)**
  Wire AI assist at **step 2 (themadoelen)** and **step 6 (subdoelen)** of the wizard (the wizard UI itself lives in E1/E6 beheer; this story provides its AI suggestions).
  *Done when:* the wizard can request themadoel/subdoel suggestions; all advisory. Ref: Art. IV.8 (committed MVP), Gap A.7.

> **Owner's ruling (2026-07-28): E2-01…E2-07 stay `[x]`.** The third audit surfaced that FR-4.1 has no
> invocation surface and asked whether the epic should be reopened. Decision: **leave the stories closed and
> revisit when everything is wired together.** Each was built and tested against its own acceptance criteria;
> what is missing is the wiring between components, which is its own piece of work (E2-08) rather than a defect
> in any one story. **M2 stays withdrawn** in the meantime — the milestone claims something a teacher can do,
> and until E2-08 lands they cannot. Do not re-open this question; do not re-flip these checkboxes.

- [ ] **E2-08 — Trigger the matching: an invocation surface for FR-4.1** — *added 2026-07-28 (third antagonist audit): E2's headline feature is unreachable*
  Give `DoelMatchingService.MatchThemaAsync` a way to be called in a running application — an endpoint (e.g. `POST /api/themas/{themaId}/doelsuggesties/genereer`) plus the frontend action that invokes it and refreshes the review list.
  *Why this story exists:* `MatchThemaAsync` is invoked from **exactly one place in the repository — its own unit tests.** No controller, no hosted service, no frontend function calls it. `DoelsuggestiesController` exposes only `GET` (list) and `PUT .../status` (accept/reject), so suggestions can be *read* and *decided on* but never *created*. In a deployed app `DoelsuggestieLijst` would always render `matching.leeg`. `DoelsuggestieEndpointsTests` seeds rows directly into the database, bypassing generation, which is why no test caught it. FR-4.1 reads *"de tool **stelt** … **voor**"* — the same verb class as FR-1.2's *toont*, and it fails the same test.
  *Consequence:* **M2 is withdrawn** until this lands (see `README.md`). E2's other six stories are genuinely built; this is the missing wire between them.
  *Done when:* a teacher can trigger matching for a thema from the UI and see the resulting `voorgesteld` suggestions with their motivation, generated through the real service (not seeded); the AI client stays server-side (Art. VI.4) and behind its interface so the flow is testable with the faked client (Art. IV.5); nothing is auto-applied (Art. IV.1). Ref: FR-4.1, Art. IV.1/IV.3/IV.5.
  *Also owns (assigned 2026-07-28):* **FR-4.3's "aanpassen"** — substituting a different leerplandoel on a suggestion, landing as status `Manueel` (see E2-05); and **FR-4.2's judgeability gap** — the review row shows a bare doel code, so add the leerplandoel `tekst` to the payload. Both are in this flow and both are cheap once it is being touched.
  *Depends on:* E2-01…E2-05 `[x]` (the service, parser, persistence and review UI all exist).
  *Left undone on purpose, recorded here rather than only in the worklog (implementation 2026-07-29):*
  1. **A substitution loses which code the AI originally proposed.** `DoelKoppeling.VervangLeerplandoel` overwrites `LeerplandoelCode` and clears `AiMotivatie` (the motivation argued for the *old* goal, so carrying it over would present an AI justification for something the AI never suggested — Art. IV.3). The consequence is that afterwards nothing distinguishes an overridden AI suggestion from a purely manual link. Retaining it needs a nullable `VervangenLeerplandoelCode` column and therefore a migration, which was judged out of proportion to the story; **decide whether that audit trail is wanted** before any export claims to show how a coupling came about (E7/FR-11).
  2. **`LeerdoelSelectie.Alles` puts every loaded leerplandoel in the prompt.** Safe today — the database holds only the demo seeder's `DEMO-*` goals and no Op.stap import can be triggered yet — but **the first real per-discipline import (E1-05/E1-15) makes the matching prompt grow with the curriculum.** No cap was invented here on purpose: choosing which goals are silently withheld from the model is a pedagogical decision, not a coding one. The endpoint's optional `selectie` and the UI's two filters are the lever that exists; whoever ships the real import should weigh whether a default narrower than "alles" is needed at that point.
  3. **Both "aanpassen" readings ship side by side.** The pre-existing status-to-`manueel` button (override the verdict) and the new substitution (replace the doel) are both offered, because directie has not ruled which one FR-4.3 means (E2-05 note above). Whichever way it lands, one of the two is removable without rework — but until then the review row carries two controls a teacher could confuse.

> Optional confidence indicator per suggestion (FR-4.5) is **fast-follow** — see [E8](E8-fast-follow.md).
