# ADR-0022 — Curriculum-administration authorisation seam (one named policy), and one endpoint per import source

- **Status:** Accepted
- **Date:** 2026-07-31
- **Deciders:** Architect (Siebe De Saedeleir / team), implementer of E1-15
- **Complements:** [ADR-0011](0011-authn-authz-rbac-gdpr.md) (AuthN/AuthZ, RBAC & GDPR). **Supersedes nothing.** ADR-0011's decision §2 — *"enforce role-based authorisation server-side … driven by the configurable §3.2 permission matrix (not compiled-in role checks scattered through code)"* — stands unchanged; this ADR records the first concrete enforcement point built against it, which ADR-0011 could not name because it predates it by a month.

## Context

E1-15 gave the Op.stap curriculum import an HTTP trigger (`POST /api/opstap-import` and
`POST /api/opstap-import/voorbeeld`). That immediately raised the Art. XIV question recorded in the story:
**who may run an import, and from where?** Importing reference data is administration, so it most likely
belongs to directie (`Beheerder`, Art. VI.1, FR-10) rather than to a teacher-facing screen.

Three facts constrained the answer:

1. **There is no authenticated user.** The API registers no authentication scheme (E6-01 will, over Entra
   ID) and there is no role matrix (E6-02). E7-11 tracks "the API is entirely unauthenticated" as a
   `[!]` deployment gate.
2. **The answer is not ours to invent.** Art. XIV forbids hard-assuming an open decision; inventing a role
   system inside an import story would have done exactly that.
3. **Client-side gating is not authorisation.** ADR-0011 already rejected frontend-only role gating as
   trivially bypassable.

So the choice was not *which role*, but *where the decision will live once it exists* — and how to make the
import reachable today without pretending to enforce something.

## Decision

### 1. One named authorisation policy, `Curriculumbeheer`

- Declared once, in `Jaarplanner.Api/Infrastructure/CurriculumbeheerAutorisatie.cs`, as the constant
  `CurriculumbeheerAutorisatie.Beleid` plus an `AddCurriculumbeheerAutorisatie()` registration called from
  `Program.cs`, with `app.UseAuthorization()` enforcing it.
- Applied with **one** `[Authorize(Policy = …)]` attribute per curriculum-administration controller. No
  inline role checks, no second policy, no per-action variation.
- **Its body is a deliberate no-op today:** `RequireAssertion(_ => true)`. It authorises everyone, because
  there is no principal to test. This is written down here, in the class comment, and asserted by a test
  that says so out loud, so nobody can mistake the seam for protection.
- **Deliberately not `RequireAuthenticatedUser()`.** With no authentication scheme registered, that would
  fail every request and leave the import unreachable — reintroducing the exact defect E1-15 exists to fix.
- **What E6-02 changes:** the assertion becomes the matrix-driven requirement (expected: the `Beheerder`
  role) in that one file. Every endpoint naming the policy inherits it with no further edits.

### 2. One endpoint per import source, not one shared "curriculum import" endpoint

The decreed-minimumdoelen import (E1-12) gets its **own** route and **shares this policy**, rather than
becoming a mode of `/api/opstap-import`:

- Different artefact and contract: one **per-discipline** Op.stap goal Excel on the Art. VII.1 A–M layout,
  which *requires* a discipline number because the sheet has no discipline column; versus a **single,
  discipline-less** decreed source with different columns (`ref` / `leeftijd` / `nr` / `omschrijving`),
  a different identity (`ref`, not `code`), and no "disappeared but still linked by a themadoel" concept.
- A shared route would need a `soort` discriminator forking the parser, the diff type *and* the response
  contract: two endpoints wearing one URL.
- The two imports have a **required order** (minimumdoelen first, or MD-concorded leerplandoelen cannot
  commit — the `Restrict` FK on `minimumdoelen.Ref`). One upload box labelled "curriculum" hides that.

What *is* shared, and is the point of this ADR: the policy, the multipart + `voorbeeld`/commit two-step, the
`isBestandGeldig` / `isVolledigVerwerkt` split, and the ProblemDetails conventions.

> **Note for E1-12's author:** `CurriculumbeheerAutorisatieTests` filters endpoints on the
> `api/opstap-import` route prefix, so it will **not** notice a new decreed-minimumdoelen route that forgets
> the `[Authorize]` attribute. Extend that filter (or add a sibling assertion) in the same change that adds
> the route. A seam only holds while every door names it.

### 3. Curriculum-integrity refusals are typed faults, mapped in the Api

`OpstapImportFout` (Application) carries the three refusals — unknown discipline, minimumdoelen not loaded,
a code that already belongs to another discipline — and `OpstapImportExceptionHandler` maps them to 400/409,
following the three exception handlers already registered in `Program.cs`. The PostgreSQL SQLSTATE reading
stays in Infrastructure with the `DbContext`, so no `Api` type names Npgsql or EF Core (Art. VIII). The
refusals are decided **before** anything is written, so the FR-2.5 preview refuses exactly what the commit
refuses.

## Alternatives considered

- **No authorisation at all until E6-02** — leaves nothing for the role matrix to bind to and no marker that
  reference-data administration differs from teacher content. It also invites the next author to copy an
  unguarded controller. Rejected.
- **Invent a role/permission model in E1-15** — hard-assumes the Art. XIV answer and pre-empts E6-02's
  matrix. Rejected.
- **Gate the import in the frontend** (hide the screen) — security theatre; already rejected by ADR-0011.
- **A custom `IImportToestemming` abstraction instead of an ASP.NET Core policy** — a second, parallel
  authorisation mechanism next to the framework's. ADR-0011 §2 says "centralise into a policy layer", and
  the framework has one. Rejected as over-engineering (Art. VIII).
- **One shared curriculum-import endpoint with a `soort` discriminator** — see decision 2. Rejected.

## Consequences

**Positive**
- The Art. XIV "who may import?" question is isolated to one constant and one policy body; resolving it is a
  small, reviewable change rather than a hunt through controllers.
- The enforcement point exists, is named, and is tested, so it cannot silently evaporate in a refactor.
- E1-12 inherits the seam and the conventions without inheriting a shared endpoint's compromises.

**Negative / trade-offs**
- **A policy that authorises everyone can be mistaken for protection.** Mitigated by naming it here, in the
  class comment, in E7-11's enumeration, and in a test that asserts the allow-everyone behaviour explicitly
  — but the mitigation is documentation, so it depends on people reading it. The real exposure remains open
  until E6-01/E6-02 land, and E7-11 is the gate that must hold.
- The test that pins the seam is route-prefix based, so it needs extending per new curriculum-admin route
  (see the note above).

**Follow-ups**
- **E6-02** — replace the policy body with the §3.2 role requirement (expected `Beheerder`); update this
  ADR's status note and E7-11 rather than rewriting the decision.
- **E6-01** — add the authentication scheme, at which point an unauthenticated call starts producing 401.
- **E1-12** — add the decreed-minimumdoelen route behind this policy, and extend the seam test's filter.
- **E7-11** — the deployment gate that must stay closed while the policy is a no-op.

## Compliance trace

- **Constitution:** Art. VI.1 (role-based permissions, configurable), Art. VI.5 (personal login;
  server-side enforcement), Art. XIV (open decision behind a seam, not hard-assumed), Art. VIII (thin Api,
  no second authorisation mechanism, no EF/Npgsql type in `Api`), Art. III.1/III.4 (the import this guards
  is the sanctioned writer of read-only reference data), Art. II.3 (the refusal messages are Dutch because
  the person running the import acts on them).
- **Backlog:** E1-15 (this seam); E1-12 (expected second consumer); E6-01/E6-02 (bind the policy);
  E7-11 (the gate while it is a no-op); E7-13 (the layering exception the import controller still carries).
- **FR/NFR:** FR-2.1, FR-2.5, FR-10 / §3.2 matrix; NFR-5.
