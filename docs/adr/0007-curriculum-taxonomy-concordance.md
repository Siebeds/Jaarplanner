# ADR-0007 — Curriculum taxonomy & concordance model

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

The Op.stap reference material (ratified gap-analysis, 2026-06-29) established the *real* taxonomy, which the original analysis got wrong. Two distinct structures exist (Art. VII.0): the **ordeningskader** (`Discipline → Domein → Subdomein`, three levels, no cluster/leergebied) and the **per-discipline goal Excel** (rows carrying optional `cluster`, `code`, `jaarFase`, concordance). Subdomein names are not globally unique; disciplines are numbered with a 9.1/9.2/9.3 split; minimumdoelen are concorded to leerplandoelen and anchored at mijlpalen.

## Decision

We will model the curriculum as:
- **`Discipline`** — `nummer` as a **string** (`"1"`, `"9.2"`), optional `parentDiscipline` for the 9.x split.
- **`Domein`** and **`Subdomein`** as the ordeningskader levels; the **grouping key is the composite `(domein, subdomein)`** (names are not globally unique).
- **`Leerplandoel`** — **`code` is the unique identity**; `doelsoort` (MD/G/+/P/S/A enum), `jaarFase`, `domein`, `subdomein`, **`cluster` nullable**, tekst, voorbeelden?, toelichting?, woordenschat?, `minimumdoelRef`.
- **`Minimumdoel`** — `ref`, `leeftijd` (K-/4-/6-), `nr`, `omschrijving`.
- **`Concordantie`** — many-to-many-capable link Leerplandoel ↔ Minimumdoel via `minimumdoelRef` (= Excel B+C), enabling coverage roll-up to minimumdoel level.
- `leergebied`/`Wereldoriëntatie` is **not** a stored taxonomy level — at most a presentation mapping over disciplines (open decision, Art. XIV).

## Alternatives considered

- **Four-level `domein/subdomein/cluster` chain (original analysis)** — contradicts the ordeningskader; would create empty/forced cluster levels and break roll-ups. Rejected per ratified GAP 0a.
- **Integer discipline id** — cannot express `9.2`/`9.3` or the nesting. Rejected.
- **Subdomein as a global lookup keyed by name** — collides (e.g. Muzische vorming repeats "Bouwstenen"). Rejected for the composite key.

## Consequences

**Positive**
- Coverage and filtering group correctly; the model matches the official artifact, so import maps cleanly.
- Cluster being nullable means roll-ups never assume a level that may be absent.

**Negative / trade-offs**
- The composite grouping key and string discipline number need care in queries and indexes.

**Follow-ups**
- E1-01 (entities + keys), E1-03 (import maps to this shape), E1-04 (concordance). Open: cluster presence per discipline, leergebied surfacing, jaarFase code form (Art. XIV).

## Compliance trace

- **Constitution:** Art. VII.0/VII.1 (taxonomy + mapping), Art. IX.1 (entities), Art. III (read-only).
- **Backlog:** E1-01, E1-03, E1-04.
- **FR/NFR:** FR-2.1/2.2/2.3, prerequisite for FR-9.3 (minimumdoel coverage).
