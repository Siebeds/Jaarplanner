# E6 — Beheer, rollen & samenwerking

**Phase:** 6 · **Milestone:** M6 — School-breed
**Goal:** The admin/directie runs the school from a beheerpagina: school years, classes, teachers, permissions; plus role-based access, school-wide and per-class overviews, and colleagues viewing each other's plans.
**Covers FR:** FR-12, FR-9.4, FR-10 (10.1), FR-3.3 sharing surface. **Constitution:** [Art. VI](../CONSTITUTION.md#article-vi--roles-privacy--security) (roles), [Art. V.5](../CONSTITUTION.md#article-v--coverage-must-be-provable-dekking) (school-wide overviews).
**UX & a11y:** the thema-opbouw wizard (E6-05) follows [`docs/ux/ui-ux-approach.md` §6](../docs/ux/ui-ux-approach.md) and [ADR-0017](../docs/adr/0017-ui-ux-design-system.md); WCAG 2.2 AA.

---

### Auth & roles

- [ ] **E6-01 — Authentication (personal login)**
  Personal login for staff accounts only (no pupil data).
  *Done when:* login works; sessions are secure (HTTPS, encrypted at rest/transit). Ref: NFR-5, Art. VI.2/VI.5.

- [ ] **E6-02 — Role-based authorization (configurable matrix)**
  Roles `Beheerder`, `Leerkracht`, optional `Zorgcoördinator/co-teacher`; enforce the §3.2 permission matrix; configurable.
  *Done when:* each action in the matrix is allowed/denied per role; checks are server-enforced. Ref: FR-10/§3.2, Art. VI.1.
  *Carry-forward (E2 antagonist notes):* no endpoint carries `[Authorize]` yet — cover the E2 AI endpoints `POST /api/thema-opbouw/*` (E2-07) and `/api/doelsuggesties/*` (E2-05) when this lands (Art. VI.1).
  *Carry-forward (E3-01 antagonist, 2026-07-29):* a `grep` for `Authorize`/`AllowAnonymous` across `backend/src` returns **zero hits** — authz is unbuilt project-wide, so nothing regressed, but the matrix must be applied **retroactively** to every route shipped before this story. E3-01 added four of the most sensitive yet: `POST /api/schooljaren` (a beheerder action, FR-12.1) and `POST /api/klassen/{id}/jaarplan/generatie` plus the placement status/vergrendeling routes — *"generate or overwrite another teacher's year plan"* is materially more sensitive than anything that existed before it. Enumerate the full route surface when this lands rather than only the endpoints named in these notes.

### Beheerpagina (FR-12)

- [ ] **E6-03 — Schooljaren beheer-UI + wijzigen/verwijderen + rolpoort** — *narrowed 2026-07-29: the create/read API landed in E3-01*
  The **admin-facing** half: the beheer screen for school years and their vacation/period structure, plus update and delete, behind the beheerder role.
  *Done when:* a beheerder can create, edit and delete a schooljaar and its sluitingen **from the UI**, only a beheerder can, and the result drives the calendar's available blocks. Ref: FR-12.1, Art. VI.1.
  *Already delivered by E3-01 (do not rebuild):* the `Schooljaar` aggregate with its `Schoolsluiting` collection classified `Vakantie`/`VrijeDag` (E3-05), the Schooljaar↔Klas containment, and a `SchooljarenController` giving **create / list / read** plus nested klas-creation. E3-01 needed it because making `Klas.SchooljaarId` required with no creation path would have made class creation — and therefore E3-01 itself — unreachable.
  *Why this story was narrowed rather than closed:* FR-12.1 names an **admin** doing this, and the E3-01 audit flagged that leaving E6-03's original wording would silently retire the FR's user-facing half on the strength of a server story — the exact failure that produced E1-13 and E1-14. What remains is genuinely the UI, update/delete, and the role gate.
  *Carry-forward:* `POST /api/schooljaren` currently has **no authorisation** (nothing in the codebase does — E6-01/E6-02 are `[ ]`). Creating a school year is a beheerder action under the FA §3.2 matrix; apply it here.

- [ ] **E6-04 — Klassen + leerkrachten + rechten**
  Admin creates/manages klassen (naam, leerjaar), links teachers, assigns rights.
  *Done when:* a teacher sees only what their rights allow. Ref: FR-12.2.

- [ ] **E6-05 — Thema-opbouw wizard (beheer UI)**
  The 10-step goal-first wizard UI (thema → 2–3 themadoelen → subthema's → subdoelen → rijk aanbod → … → reflectie), consuming E2-07 AI assist.
  *Done when:* a thema can be built end-to-end via the wizard. Ref: Art. IV.8 (committed MVP), Gap A.7.

### Overzichten & samenwerking

- [ ] **E6-06 — School-wide & per-class overviews (directie)**
  From the beheerpagina, pull coverage/progress across all classes/leerjaren.
  *Done when:* directie sees aggregated coverage per class and school-wide. Ref: FR-9.4, FR-12.3, Art. V.5.

- [ ] **E6-07 — Export of overviews**
  Export the school-wide/per-class overviews.
  *Done when:* exported overviews match the screen. Ref: FR-12.3.

- [ ] **E6-08 — Colleagues view each other's plans (read, per rights)**
  Teachers can view colleagues' jaarplannen (read-only per permissions) to align.
  *Done when:* a teacher reads another class's plan iff allowed. Ref: FR-10.1.

- [!] **E6-09 — Visibility scope** — *blocked: Art. XIV teacher visibility*
  Configure visibility (school-wide / per graad / narrower).
  *Done when:* the scope rule is configurable per directie decision. Ref: FR-10.2.
