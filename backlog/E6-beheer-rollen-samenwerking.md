# E6 — Beheer, rollen & samenwerking

**Phase:** 6 · **Milestone:** M6 — School-breed
**Goal:** The admin/directie runs the school from a beheerpagina: school years, classes, teachers, permissions; plus role-based access, school-wide and per-class overviews, and colleagues viewing each other's plans.
**Covers FR:** FR-12, FR-9.4, FR-10 (10.1), FR-3.3 sharing surface. **Constitution:** [Art. VI](../CONSTITUTION.md#article-vi--roles-privacy--security) (roles), [Art. V.5](../CONSTITUTION.md#article-v--coverage-must-be-provable-dekking) (school-wide overviews).
**UX & a11y:** the thema-opbouw wizard (E6-05) follows [`docs/ux/ui-ux-approach.md` §6](../docs/ux/ui-ux-approach.md) and [ADR-0017](../docs/adr/0017-ui-ux-design-system.md); WCAG 2.2 AA.

---

### Auth & roles

> **The owner's rulings of 2026-09-11, 2026-09-13 and 2026-09-14 reshape this section**
> ([ADR-0030 §1](../docs/adr/0030-rollen-en-rechten-in-de-app.md), **ratified into Art. VI.1 on 2026-09-14**; it
> supersedes ADR-0011 §3):
> - R1–R3: rights in the app; only invited people log in; directie sees and edits everything.
> - R4, R18: themabeheer edits thema's, and a hoofdleerkracht only with themabeheer.
> - R5, R21, R24: hoofdleerkrachten per (schooljaar, jaarfase) create, edit and delete that jaar's subthema's and
>   subdoelen.
> - R6: personal content (E6-10).
> - R7, R15: a leerkracht edits their own klassen' planning (many-to-many) and views others.
> - ~~R8~~ → R14: doelsuggesties for directie and themabeheer only.
> - R9, R27, R34, R35: the FR-1 import for directie and themabeheer, links on themadoelen and subdoelen included;
>   its option to delete human decisions for directie alone.
> - R16: no ICT role.
> - R17, R19, R23–R26, R33: every leerkracht of that leeftijd edits and creates shared activiteiten; goal links by
>   hand for directie and HL; a maker deletes their own activiteit while no goal is linked to it; otherwise HL deletes.
> - R20: appointments count for shared content until their schooljaar ends.
> - R22: graadklas, provisionally.
> - R28: streefwoordenschat is shared.
> - R29, R32: the wizard is for themabeheer; it creates subthema's and subdoelen only for a thema built from scratch,
>   through its own actions.
> - R37: the build follows the defaults as written until the owner changes one.
>
> **Everything else in that ADR is a default, not a ruling:** I1, I2, I6 with (a), I9 with (d), I12, I13, I15–I25,
> (c), (e). The matrix is ratified only as far as the rulings each row cites.

- [x] **E6-01 — Authentication (personal login)** — *built 2026-09-11 on `story/E6-01-authenticatie` and merged into `main` as PR #48 (`7e23dcf`); mechanism in [ADR-0031](../docs/adr/0031-sessielogin-via-de-api.md) (Accepted).* **Closed 2026-09-13 by owner ruling, without a round trip against a real tenant.** The code-round-1 audit asked whether E6-01 may close without one; the owner answered yes, because that round trip is a prerequisite on E7-11 before any real deployment either way. *What the `[x]` does not carry:* the last audit round (code round 2 on `e27cc53`: 0 MAJOR, 6 MINOR) was fixed in `3dff436` and not re-audited, and `worklogs/E6-01/` holds only `implementation.md`, which records code round 1 but not round 2 (the round-2 findings and fixes are in the commit message of `3dff436`).
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

- [~] **E6-02 — Role-based authorization (the ADR-0030 matrix)** — *roles ruled by the owner on 2026-09-11, 2026-09-13 and 2026-09-14, and **ratified into Art. VI.1 on 2026-09-14**; in progress since 2026-09-13 on `feature/e6-rollen-rechten`, **built and delivered together with E6-04** (ADR-0030 R12).* Its first task, part 1 of the Art. XI amendment, is done: drafted on `story/E6-02-amendering`, audited in four rounds, and ratified on 2026-09-14.
  *What:* enforce the [ADR-0030](../docs/adr/0030-rollen-en-rechten-in-de-app.md) §3 matrix server-side, as named policies declared in one place (ADR-0011 §2). The "HL", "LK leeftijd", "LK eigen" and maker relations are resource-based authorization handlers, not role claims. Bind `Curriculumbeheer` to the directie right (ADR-0022).
  *Model:*
  - A nullable **maker** on `Activiteit` (R26). It is set on create to whoever creates the activiteit: a leerkracht, a hoofdleerkracht, **directie**, or a themabeheer holder through the wizard (the last by default, I18). It is null for existing rows and for the FR-1 import. Its delete right follows the person (R33).
  - **One place maps a klas to the leeftijden it grants rights for** (R22). It reads the stated `Jaarfase` only and fails closed (I12), without reusing `Klasleeftijden`' widening.
  - Appointments and klastoewijzingen count for shared content until their schooljaar ends (R20), and for the klas's planning without an end date (I21).
  - **Wizard-only write actions** (R32; their shape is I22). They admit themabeheer and directie, and only for a thema the wizard itself created, until that run is finished or closed (I23), which is at the latest 14 days after its last write action (I24); within an open run they may also edit and delete what that run created (I25). Themabeheer gets no right on the ordinary subthema, subdoel and activiteit routes, apart from the maker's delete right (R33).
  - The FR-1 import's `MenselijkeBeslissingenVerwijderen` option is **directie-only** (R35). It governs themadoelen and subdoelen alike, because it is one switch.

  *Done when:* each action in the matrix is allowed or denied per relation and per resource, server-side, with a test per row. **No control that does nothing (the E3-06 rule):**
  - the doelsuggestie controls on the themadetail screen (`frontend/src/features/themas/ThemadetailScherm.tsx`, `useGenereerDoelsuggesties` and the accept/reject/adjust controls) are shown only to directie and themabeheer;
  - the same holds, each per its row, for the thema form, the FR-1 import section and its delete-decisions option (directie only), the E1-22 `Laadlink`s below, the wizard, the subthema form, the subdoel controls, the goal-link controls, the activiteit delete (maker or HL), the move and the streefwoordenschat editor;
  - `GET /api/ik` carries the caller's rights; the server still enforces.

  *Routes to cover:*
  - `api/themas/{themaId}/doelsuggesties` with `…/genereer`, `…/{id}/status` and `…/{id}/leerplandoel`;
  - `api/thema-opbouw/*` and the new wizard write actions;
  - the FR-1 import routes, with the option;
  - the activiteit and subdoel routes, including `POST/DELETE /api/activiteiten/{id}/doelkoppelingen` and the move;
  - `PUT /api/subthemas/{id}` (a re-scope follows I13);
  - the five jaarplan write routes, and `POST /api/schooljaren`.

  Ref: FR-10/§3.2, Art. VI.1, ADR-0030.
  ~~*Waits on part 1 of the Art. XI amendment*~~ **Satisfied on 2026-09-14:** part 1 is ratified (ADR-0030 §5).
  *Defaults it builds on* (ADR-0030 §2; the owner ruled that the build follows them, R37): I1, I2, I9, I12, I13, I15–I25.
  *Open questions this story owns (ADR-0030 §4):*
  - **(b) Import: settled** (R9, R27, R34, R35). What this story owes is the gate, including the directie-only option. Gate the section rather than the route, as the 2026-08-03 ruling asked. The frontend marker it relied on (`magBeheerder` plus a section constant) no longer exists in `frontend/src`, so recreate it.
  - **(c)** A jaar with no hoofdleerkracht: only directie does, by hand, what a hoofdleerkracht would, until ruled otherwise.
  - **(e)** Zorgcoördinator rights beyond themabeheer and read access. The default is nothing else, apart from the maker's delete right.
  - ~~**(f) Doelsuggesties: ruled** (R8): every leerkracht generates and reviews them.~~ **Settled by R14:** directie and themabeheer only. (h) is settled by R19.
  *Carry-forward (E1-22 antagonist, 2026-09-13, QUESTION):* the Doelen register's two empty states (`frontend/src/features/doelen/Minimumdoelenlijst.tsx`, `Laadlink`: "Nog geen leerplandoelen" and "Nog geen minimumdoelen") show every signed-in person a *Laad ze in bij Inladen* link to `/inladen`. That is right while `Curriculumbeheer` admits any session; once this story binds it to directie (and themabeheer, R9), gate that link on the same role, or a leerkracht meets a link to something they cannot do (the E3-06 rule). The Inladen button in the Doelen header is the same case.
  *(The three carry-forwards below predate E6-01. Since 2026-09-11 every route requires a session, so "no `[Authorize]`" and "zero hits" are no longer true. What they still name correctly is the surface the role matrix must cover.)*
  *Carry-forward (E2 antagonist notes):* no endpoint carries `[Authorize]` yet — cover the E2 AI endpoints `POST /api/thema-opbouw/*` (E2-07) and `api/themas/{themaId}/doelsuggesties/*` (E2-05; the name `/api/doelsuggesties/*` that this note carried never existed) when this lands (Art. VI.1).
  *Carry-forward (E3-01 antagonist, 2026-07-29):* a `grep` for `Authorize`/`AllowAnonymous` across `backend/src` returns **zero hits** — authz is unbuilt project-wide, so nothing regressed, but the matrix must be applied **retroactively** to every route shipped before this story. E3-01 added four of the most sensitive yet: `POST /api/schooljaren` (a beheerder action, FR-12.1) and `POST /api/klassen/{id}/jaarplan/generatie` plus the placement status/vergrendeling routes — *"generate or overwrite another teacher's year plan"* is materially more sensitive than anything that existed before it. Enumerate the full route surface when this lands rather than only the endpoints named in these notes.
  *Carry-forward (E3-07 antagonist, 2026-07-30) — the jaarplan write surface is now five endpoints, and one story's safety argument leans on the client.* E3-07 added `PUT …/jaarplan/plaatsingen/{id}/blok`, so the unauthenticated state-changing routes on a class's jaarplan are: `POST …/jaarplan/generatie`, `PUT …/plaatsingen/{id}/status`, `PUT …/plaatsingen/{id}/vergrendeling`, `PUT …/plaatsingen/{id}/blok`, `DELETE …/plaatsingen/{id}`. **Treat these five as one unit when the matrix lands.** Worth flagging beyond the count: E3-07's ratified compensating control for the status-and-lock-blind DELETE is a **UI confirmation**, which protects nothing at the API — so until this story ships, the only guard on destroying another teacher's accepted, locked year plan is a dialog in a browser the caller need not use. Not an E3-07 defect (the endpoint predates it and ADR-0011 assigns authn here), but it is the clearest example yet of why this story is a deployment gate and not a nicety.
  *Carry-forward (E6-02 slice 1 antagonist, 2026-09-14, QUESTION): owed to the owner before any path creates an activiteit goal link that is not `Manueel` (E8).* R25 lets a maker delete their own activiteit *"while no goal is linked to it"*. The build counts **every** link as linked, `geweigerd` and `voorgesteld` included. That can only withhold the maker's delete, never grant it, and nothing reaches it today: activiteit links are only ever created `Manueel`, no route changes their status, and the FR-1 import writes none. It is neither ruled nor among Art. VI.1's defaults, so put it to the owner, or record it as a default by amendment, before that changes.

### Beheerpagina (FR-12)

- [ ] **E6-03 — Schooljaren beheer-UI + wijzigen/verwijderen + rolpoort** — *narrowed 2026-07-29: the create/read API landed in E3-01*
  The **admin-facing** half: the beheer screen for school years and their vacation/period structure, plus update and delete, behind the beheerder role.
  *Done when:* a beheerder can create, edit and delete a schooljaar and its sluitingen **from the UI**, only a beheerder can, and the result drives the calendar's available blocks. Ref: FR-12.1, Art. VI.1.
  *Already delivered by E3-01 (do not rebuild):* the `Schooljaar` aggregate with its `Schoolsluiting` collection classified `Vakantie`/`VrijeDag` (E3-05), the Schooljaar↔Klas containment, and a `SchooljarenController` giving **create / list / read** plus nested klas-creation. E3-01 needed it because making `Klas.SchooljaarId` required with no creation path would have made class creation — and therefore E3-01 itself — unreachable.
  *Why this story was narrowed rather than closed:* FR-12.1 names an **admin** doing this, and the E3-01 audit flagged that leaving E6-03's original wording would silently retire the FR's user-facing half on the strength of a server story — the exact failure that produced E1-13 and E1-14. What remains is genuinely the UI, update/delete, and the role gate.
  *Carry-forward:* `POST /api/schooljaren` has **no role check**. Since E6-01 it requires a session, but any signed-in person may call it. Creating a school year is a beheerder action under the FA §3.2 matrix; apply it here.

- [~] **E6-04 — Klassen + leerkrachten + rechten** — *in progress since 2026-09-13 on `feature/e6-rollen-rechten`, **built and delivered together with E6-02** (owner ruling 2026-09-13).* The owner's rulings are ratified (2026-09-14): several leerkrachten per klas and several klassen per leerkracht (ADR-0030 R15); no separate ICT role, and directie may give the directie right to someone else (R16).
  Admin creates/manages klassen (naam, jaarfase), **invites users by their Microsoft sign-in name (UPN)**, which is often not their mailbox address (ADR-0030 R2, ADR-0031 decision 3), links leerkrachten to klassen, **appoints the hoofdleerkrachten of each jaarfase per schooljaar, several allowed** (R5), and **grants themabeheer** to named leerkrachten or zorgcoördinatoren (ADR-0030 R2, R4, R5, R7).
  *Done when:* directie can do all of the above from the UI, and a teacher sees only what their rights allow; **the last directie cannot be removed or demoted** (ADR-0031 decision 7). Ref: FR-12.2, ADR-0030.
  ~~*Waits on part 1 of the Art. XI amendment* (ADR-0030 §5), like E6-02.~~ **Satisfied on 2026-09-14.**
  *Defaults it builds on (ADR-0030 §2, R37):* a hoofdleerkracht needs no klastoewijzing (I20). Show whether an appointment or klastoewijzing currently counts for shared content (R20), and name klassen without a stated jaarfase, which grant no leeftijd right (I12). Removing a gebruiker leaves their activiteiten purely shared (I17).
  *Show whether an invitation is bound yet.* That is the only way directie can see ADR-0031 decision 3's residual risk: a UPN reassigned before the invitee's first login.

- [ ] **E6-05 — Thema-opbouw wizard (beheer UI)**
  The 10-step goal-first wizard UI (thema → 2–3 themadoelen → subthema's → subdoelen → rijk aanbod → … → reflectie), consuming E2-07 AI assist.
  *Done when:* a thema can be built end-to-end via the wizard. Ref: Art. IV.8 (committed MVP), Gap A.7.
  *Rights (ADR-0030 R29, R32, ratified 2026-09-14):* the wizard is for themabeheer and directie. It creates subthema's, subdoelen and activiteiten only for a thema it builds from scratch, through **its own write actions**, and E6-02 builds their authorisation. Their shape (I22) and when a thema stops being new (I23) are defaults. The maker of an activiteit the wizard creates is the themabeheer holder (by default, I18).
  ~~*Owed before building the wizard write actions* (round-4 audit QUESTION, no owner ruling): choose two defaults and record them in ADR-0030 §2.~~ **Answered by the owner on 2026-09-14** (ADR-0030 I24 and I25, added to Art. VI.1):
  - a run ends when themabeheer or directie finishes or closes it, or **14 days after the wizard's last write action** in it;
  - while the run is open, the wizard may also **edit and delete** what that same run created, and nothing else.

  The combined E6-02/E6-04 build writes the wizard's write actions and their authorisation, so this story builds the screens that call them.

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
  *Since the ratification of 2026-09-14:* the activiteit **maker** (ADR-0030 R26, R33) is not personal content; the activiteit stays shared. The shared layer exists and is edited by every leerkracht of that leeftijd (R17, R23). Whether it remains next to personal content is I6. Open question (a) is unchanged, and part 2 of the amendment is owed with this story.
