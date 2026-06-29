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

### Beheerpagina (FR-12)

- [ ] **E6-03 — Schooljaren + vakantie-/periodestructuur**
  Admin creates school years and the vacation/period structure (feeds planningsblokken in E3).
  *Done when:* a created schooljaar drives the calendar's available blocks. Ref: FR-12.1.

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
