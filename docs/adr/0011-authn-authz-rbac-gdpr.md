# ADR-0011 — AuthN/AuthZ, RBAC & GDPR data minimisation

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)
- **Ratified:** 2026-06-29 — **Microsoft Entra ID confirmed** as the identity provider (directie/auteur). The IdP seam is retained but Entra is the chosen implementation.

## Context

Access is per personal staff login; permissions are role-based and configurable per the §3.2 matrix (Art. VI.1). The MVP processes **no pupil personal data** (Art. VI.2) — staff/curriculum only. Roles: `Beheerder`, `Leerkracht`, optional `Zorgcoördinator/co-teacher`. Authorisation must be enforced server-side (the SPA is untrusted, ADR-0003), and the two-tier themalaag (ADR-0008) implies ownership-aware checks (school-scoped vs class-scoped edits).

## Decision

We will:
1. Authenticate staff via personal logins over **Microsoft Entra ID** (confirmed 2026-06-29); the auth mechanism is still wrapped so it is not hard-wired into use cases (swappable if ever needed).
2. Enforce **role-based authorisation server-side** in the Api/Application boundary, driven by the **configurable §3.2 permission matrix** (not compiled-in role checks scattered through code).
3. Apply **ownership-aware rules**: school-scoped content (Thema/Themadoel/kernwoordenschat) editable by team/directie; class-scoped content (Subthema/Subdoel/Activiteit/Jaarplan) editable by the owning teacher; colleagues get read per visibility scope (E6-09 `[!]`, Art. XIV).
4. Enforce **data minimisation**: the model has no schema for pupil PII; reviews confirm no such path exists.

## Alternatives considered

- **Frontend-only role gating** — trivially bypassable; authorisation must be server-side. Rejected.
- **Hard-coded role checks** — the matrix is "configurable" (Art. VI.1); scattered `if role ==` checks ossify it. We centralise into a policy layer.
- **Custom local password store** — more liability; an established IdP (Entra) is safer and EU-hostable.

## Consequences

**Positive**
- Permissions are auditable and adjustable without code changes; no pupil-data risk surface; ownership rules align with the themalaag tiers.

**Negative / trade-offs**
- A policy/authorisation layer is upfront work; visibility scope stays behind a seam until decided (E6-09).

**Follow-ups**
- E6-01 (login, **Entra ID**), E6-02 (RBAC matrix), E6-09 `[!]` (visibility), E7-06 (no pupil PII + register).

## Compliance trace

- **Constitution:** Art. VI.1/VI.2/VI.5, Art. IX.2 (ownership tiers), Art. XIV (visibility open).
- **Backlog:** E6-01/02/09, E7-06.
- **FR/NFR:** FR-10, FR-12.2, §3.2 matrix; NFR-5, NFR-6.
