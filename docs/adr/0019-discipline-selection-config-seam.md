# ADR-0019 — Discipline-selection config seam for an open decision

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

Which Op.stap disciplines to import first — **all** of them, or a **starter selection** — is an
unresolved directie decision (Art. XIV "Disciplines first"; the authoritative discipline list is in
Art. VII.0). The constitution forbids hard-assuming an answer: until it is resolved, the choice must
sit behind a clear seam, not be compiled into logic. The Op.stap import path (E1-05
`OpstapImportService`) imports one discipline per file and therefore needs to know which disciplines
are in scope — but it must not be the place that *decides* the set. The related "cluster presence per
discipline" question (Art. XIV / VII.0) must likewise not be answered by baking per-discipline cluster
rules into this seam (`cluster` is nullable regardless).

## Decision

We introduce a **discipline-selection seam** whose answer is **data-driven via the standard .NET
options pattern**, so "all" and "a starter selection" are two *configured outcomes of the same code*,
switchable with **no recompile**:

- **`IDisciplineSelectie`** (Application layer) — `IsInScope(disciplineNummer)` + an `Omschrijving`
  for review notices. The single question the import path asks; the answer is never a list compiled
  into logic.
- **`GeconfigureerdeDisciplineSelectie`** (Infrastructure) — a pure function of
  **`DisciplineSelectieOptions`** (`Modus = Alle | Selectie`, plus a configured `Disciplines` list),
  bound from the **`Opstap:DisciplineSelectie`** configuration section (appsettings / environment /
  user-secrets / Key Vault — any standard config source).
- **`OpstapImportService` consults the seam first.** An out-of-scope discipline is **skipped** (no row
  inserted, flagged, or deleted) with a Dutch review notice — mirroring the existing empty-file guard.
- **The default is an overridable placeholder, not an answer.** An absent config section resolves to
  `Modus = Alle`; this lives in configuration space, is overridable purely by adding the section, and
  is documented (in `appsettings.json` and the options XML doc) as a **placeholder pending the
  Art. XIV directie decision** — not the project's answer to "which disciplines first".
- The seam scopes by discipline number only and makes **no** assumption about cluster presence.

## Alternatives considered

- **Hard-code "import all" in the import logic** — the exact violation this story exists to prevent;
  silently presupposes one end of the open decision. Rejected.
- **Hard-code a starter list (`["1","2","6"]`)** — presupposes the other end; same problem inverted.
- **A DB-backed selection table** — more flexible but heavier than needed now (Art. VIII "don't
  over-engineer"); the options pattern already makes the set runtime-configurable. The seam interface
  leaves room to swap in a data-source-backed implementation later without touching the import path.

## Consequences

**Positive**
- We can run the import now without betting on the decision; the directie sets the scope by editing
  config — not a code change. Switching to a DB-backed source later is a new `IDisciplineSelectie`
  implementation, not a refactor of the import path.

**Negative / trade-offs**
- A little extra indirection (one interface + one options class) and a new first-party package
  reference (`Microsoft.Extensions.Options.ConfigurationExtensions`).

**Follow-ups**
- When the directie decides, set `Opstap:DisciplineSelectie` accordingly (config-only) and record the
  resolution in Art. XIV; no code change is required.

## Compliance trace

- **Constitution:** Art. XIV (open decision behind a seam; `cluster` presence kept non-assuming),
  Art. III (import is the sanctioned writer), Art. VII.0 (taxonomy; `cluster` nullable), Art. VIII
  (config-driven, no over-engineering), Art. II (Dutch domain language), Art. XI.2 (resolving it
  updates the article + config, not a refactor).
- **Backlog:** E1-06 (this story); builds on E1-03/E1-05.
- **FR/NFR:** FR-2.
