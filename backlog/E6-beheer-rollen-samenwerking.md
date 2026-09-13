# E6 — Beheer, rollen & samenwerking

**Phase:** 6 · **Milestone:** M6 — School-breed
**Goal:** The admin/directie runs the school from a beheerpagina: school years, classes, teachers, permissions; plus role-based access, school-wide and per-class overviews, and colleagues viewing each other's plans.
**Covers FR:** FR-12, FR-9.4, FR-10 (10.1), FR-3.3 sharing surface. **Constitution:** [Art. VI](../CONSTITUTION.md#article-vi--roles-privacy--security) (roles), [Art. V.5](../CONSTITUTION.md#article-v--coverage-must-be-provable-dekking) (school-wide overviews).
**UX & a11y:** the thema-opbouw wizard (E6-05) follows [`docs/ux/ui-ux-approach.md` §6](../docs/ux/ui-ux-approach.md) and [ADR-0017](../docs/adr/0017-ui-ux-design-system.md); WCAG 2.2 AA.

---

### Auth & roles

> **Owner rulings of 2026-09-11 reshape this section** ([ADR-0030 §1](../docs/adr/0030-rollen-en-rechten-in-de-app.md),
> which supersedes ADR-0011 §3):
> - **R1:** rights live in the app, and Entra only authenticates, in the school's own tenant.
> - **R2:** only people directie added can log in.
> - **R3:** directie sees and edits everything.
> - **R4:** thema's are edited by directie and a few leerkrachten or zorgcoördinatoren.
> - **R5:** a jaar's subthema's are edited by its hoofdleerkrachten, appointed per schooljaar, several allowed.
> - **R6:** a leerkracht may add activiteiten and subdoelen for themselves.
> - **R7:** a leerkracht edits their own klassen and can view other klassen.
> - **R8:** every leerkracht may generate and review doelsuggesties.
> - **R9:** the FR-1 import is for directie and themabeheer.
>
> **Everything else in that ADR is a default, not a ruling** (its §2). Its matrix only binds once part 1 of the
> amendment lands (its §5).

- [~] **E6-01 — Authentication (personal login)** — *in progress 2026-09-11 on `story/E6-01-authenticatie`; mechanism in [ADR-0031](../docs/adr/0031-sessielogin-via-de-api.md) (Accepted)*
  Personal login for staff accounts only (no pupil data), over the school's own Entra ID tenant. Only people directie has added may log in (ADR-0030 R2).
  *Done when:*
  - login works, and sessions are secure (HTTPS, encrypted at rest and in transit);
  - **every `/api` route answers 401 without a session**, except health and the login/logout routes, pinned by a test that enumerates the endpoint data source rather than a route prefix;
  - a person with no `Gebruiker` gets no session and a Dutch explanation;
  - a token without the `acct` claim is refused;
  - `terugNaar` is refused unless it is a local path without control characters;
  - the Vite proxy sends `X-Forwarded-For` (`xfwd`), and the development sign-in refuses any non-loopback entry in it;
  - the first directie is provisioned from configuration;
  - the shell shows who is logged in and offers *afmelden*;
  - development and the integration tests run without a tenant.

  Ref: NFR-5, Art. VI.2/VI.5, ADR-0011 §1, ADR-0031.
  *Explicitly not in scope:* any right beyond "is directie" and every per-klas or per-jaar check (E6-02); the beheer-UI to invite users (E6-04). **So after this story a logged-in leerkracht can still edit another klas, and E7-11 stays `[!]`**: its authentication half closes here, its authorisation half does not.

- [ ] **E6-02 — Role-based authorization (the ADR-0030 matrix)** — *roles ruled by the owner 2026-09-11*
  Enforce the matrix in [ADR-0030](../docs/adr/0030-rollen-en-rechten-in-de-app.md) server-side, as named policies declared in one place (ADR-0011 §2): directie (everything), themabeheer (thema's, themadoelen, kernwoordenschat), hoofdleerkrachten per (schooljaar, jaarfase), several allowed (that jaar's subthema's, R5; their shared subdoelen and activiteiten only under default I5), leerkracht (the planning of their own klassen, R7; read on other klassen, how many under default I9, behind the E6-09 seam). The per-klas and per-jaar columns depend on the resource a request is about, so they are resource-based authorization handlers, not role claims. Binds `Curriculumbeheer` to directie (ADR-0022).
  *Done when:* each action in the matrix is allowed/denied per role and per resource; checks are server-enforced. Ref: FR-10/§3.2, Art. VI.1, ADR-0030.
  *Waits on part 1 of the Art. XI amendment* ([ADR-0030 §5](../docs/adr/0030-rollen-en-rechten-in-de-app.md)): Art. VI.1, the `Thema` line of Art. IX.2, the Art. XIV visibility bullet, the Art. XII glossary, FA §3.1/§3.2, FR-3.1, FR-10.2, FR-12.2. Whichever of E6-02 and E6-04 starts first writes it, as its first task. Do not encode a right the constitution does not yet name.
  *Treat nothing in ADR-0030 §2 as ruled.* Its items I1, I2 and I5–I9 are interpretations with defaults, awaiting the owner.
  *Open questions this story owns (ADR-0030 §4):*
  - **(b) Import: settled** by the owner on 2026-09-11 (R9): directie and themabeheer only, which reverses the 2026-08-03 ruling. What this story owes is the gate. Gate the section rather than the route, as the 2026-08-03 ruling asked. The frontend marker it relied on (`magBeheerder` plus a section constant) no longer exists in `frontend/src`, so recreate it.
  - **(c)** A jaar with no hoofdleerkracht is edited by directie only, until ruled otherwise.
  - **(e)** Zorgcoördinator rights beyond themabeheer and read access.
  - **(f) Doelsuggesties: ruled** (R8): every leerkracht generates and reviews them. **Owed before enforcing it:** tell the owner that one teacher's acceptance moves the dekking of every klas that plans that thema. The question as put did not mention it.
  *Carry-forward (E1-22 antagonist, 2026-09-13, QUESTION):* the Doelen register's two empty states (`frontend/src/features/doelen/Minimumdoelenlijst.tsx`, `Laadlink`: "Nog geen leerplandoelen" and "Nog geen minimumdoelen") show every signed-in person a *Laad ze in bij Inladen* link to `/inladen`. That is right while `Curriculumbeheer` admits any session; once this story binds it to directie (and themabeheer, R9), gate that link on the same role, or a leerkracht meets a link to something they cannot do (the E3-06 rule). The Inladen button in the Doelen header is the same case.
  *(The three carry-forwards below predate E6-01. Since 2026-09-11 every route requires a session, so "no `[Authorize]`" and "zero hits" are no longer true. What they still name correctly is the surface the role matrix must cover.)*
  *Carry-forward (E2 antagonist notes):* no endpoint carries `[Authorize]` yet — cover the E2 AI endpoints `POST /api/thema-opbouw/*` (E2-07) and `/api/doelsuggesties/*` (E2-05) when this lands (Art. VI.1).
  *Carry-forward (E3-01 antagonist, 2026-07-29):* a `grep` for `Authorize`/`AllowAnonymous` across `backend/src` returns **zero hits** — authz is unbuilt project-wide, so nothing regressed, but the matrix must be applied **retroactively** to every route shipped before this story. E3-01 added four of the most sensitive yet: `POST /api/schooljaren` (a beheerder action, FR-12.1) and `POST /api/klassen/{id}/jaarplan/generatie` plus the placement status/vergrendeling routes — *"generate or overwrite another teacher's year plan"* is materially more sensitive than anything that existed before it. Enumerate the full route surface when this lands rather than only the endpoints named in these notes.
  *Carry-forward (E3-07 antagonist, 2026-07-30) — the jaarplan write surface is now five endpoints, and one story's safety argument leans on the client.* E3-07 added `PUT …/jaarplan/plaatsingen/{id}/blok`, so the unauthenticated state-changing routes on a class's jaarplan are: `POST …/jaarplan/generatie`, `PUT …/plaatsingen/{id}/status`, `PUT …/plaatsingen/{id}/vergrendeling`, `PUT …/plaatsingen/{id}/blok`, `DELETE …/plaatsingen/{id}`. **Treat these five as one unit when the matrix lands.** Worth flagging beyond the count: E3-07's ratified compensating control for the status-and-lock-blind DELETE is a **UI confirmation**, which protects nothing at the API — so until this story ships, the only guard on destroying another teacher's accepted, locked year plan is a dialog in a browser the caller need not use. Not an E3-07 defect (the endpoint predates it and ADR-0011 assigns authn here), but it is the clearest example yet of why this story is a deployment gate and not a nicety.

### Beheerpagina (FR-12)

- [ ] **E6-03 — Schooljaren beheer-UI + wijzigen/verwijderen + rolpoort** — *narrowed 2026-07-29: the create/read API landed in E3-01*
  The **admin-facing** half: the beheer screen for school years and their vacation/period structure, plus update and delete, behind the beheerder role.
  *Done when:* a beheerder can create, edit and delete a schooljaar and its sluitingen **from the UI**, only a beheerder can, and the result drives the calendar's available blocks. Ref: FR-12.1, Art. VI.1.
  *Already delivered by E3-01 (do not rebuild):* the `Schooljaar` aggregate with its `Schoolsluiting` collection classified `Vakantie`/`VrijeDag` (E3-05), the Schooljaar↔Klas containment, and a `SchooljarenController` giving **create / list / read** plus nested klas-creation. E3-01 needed it because making `Klas.SchooljaarId` required with no creation path would have made class creation — and therefore E3-01 itself — unreachable.
  *Why this story was narrowed rather than closed:* FR-12.1 names an **admin** doing this, and the E3-01 audit flagged that leaving E6-03's original wording would silently retire the FR's user-facing half on the strength of a server story — the exact failure that produced E1-13 and E1-14. What remains is genuinely the UI, update/delete, and the role gate.
  *Carry-forward:* `POST /api/schooljaren` has **no role check**. Since E6-01 it requires a session, but any signed-in person may call it. Creating a school year is a beheerder action under the FA §3.2 matrix; apply it here.

- [ ] **E6-04 — Klassen + leerkrachten + rechten**
  Admin creates/manages klassen (naam, jaarfase), **invites users by their Microsoft sign-in name (UPN)**, which is often not their mailbox address (ADR-0030 R2, ADR-0031 decision 3), links leerkrachten to klassen, **appoints the hoofdleerkrachten of each jaarfase per schooljaar, several allowed** (R5), and **grants themabeheer** to named leerkrachten or zorgcoördinatoren (ADR-0030 R2, R4, R5, R7).
  *Done when:* directie can do all of the above from the UI, and a teacher sees only what their rights allow; **the last directie cannot be removed or demoted** (ADR-0031 decision 7). Ref: FR-12.2, ADR-0030.
  *Waits on part 1 of the Art. XI amendment* (ADR-0030 §5), like E6-02.
  *Not ruled, confirm with the owner before building (ADR-0030 §2):* whether a klas may have several leerkrachten (I7; default yes), and whether an ICT-coördinator gets directie's rights (open (g)).
  *Show whether an invitation is bound yet.* That is the only way directie can see ADR-0031 decision 3's residual risk: a UPN reassigned before the invitee's first login.

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
  *Owner ruling 2026-09-11 (ADR-0030 R7):* a leerkracht can view other klassen. How many is not ruled: the build's default is every other klas (ADR-0030 I9). Directie has not yet confirmed that scope (Art. XIV, FR-10.2), so **build the read access behind the E6-09 seam**: one place decides which klassen a leerkracht may read. That seam, not this story, is what a narrower directie answer changes.

- [!] **E6-09 — Visibility scope** — *blocked: Art. XIV teacher visibility*
  Configure visibility (school-wide / per graad / narrower).
  *Done when:* the scope rule is configurable per directie decision. Ref: FR-10.2.
  *Narrowed 2026-09-11:* the owner ruled the default (every klas, read-only) and that directie sees everything (ADR-0030 rulings 3 and 7). Whether directie wants it narrower or configurable is still theirs to decide (question 4 in [`docs/besluiten-gevraagd.md`](../docs/besluiten-gevraagd.md)), so this stays `[!]`.

### Eigen inhoud per leerkracht

- [ ] **E6-10 — Personal activiteiten and subdoelen** — *filed 2026-09-11 from ADR-0030 ruling 6; an owner ruling is owed before building*
  A leerkracht adds activiteiten and subdoelen under a subthema **for themselves**, next to the shared per-leeftijd content of ADR-0025, without going through the hoofdleerkracht.
  *Done when:* a teacher can add, edit and delete their own activiteit or subdoel under a subthema; nobody but that teacher and directie can edit it; the shared content of that jaar is unchanged for every other klas; Art. IX.2 is amended to say so. Ref: FR-3, Art. IX.2, ADR-0030.
  *Owner question first (ADR-0030 open (a)):* does personal content belong to the **leerkracht** (it follows them into next year) or to their **klas** (it stays with the planning)? Can colleagues see it, and does it count only for the coverage of the owner's klas? Nothing personal is built until this is answered.
