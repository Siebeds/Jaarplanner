# Antagonist Review — E1-01: Curriculum entities (read-only)

**Verdict:** COMPLIANT
**Scope audited:** Diff of branch `story/E1-01` against merge-base `1c439fa` (main). 18 files: 4 domain entities + 1 mapping type, 3 EF configs, AppDbContext change, EF migration + snapshot, 3 unit-test files, Api.csproj (EF Design package), dotnet-tools.json, worklog.

## Findings

No violations found. The change is tightly scoped to the read-only curriculum reference layer and honours every Article it touches. Minor observations below are non-blocking and recorded for transparency.

### [QUESTION] `jaarFase` stored as free string — open decision left open (correct, but flag for confirmation)
- **Article/FR:** Art. XIV (open: Excel col F uses `1K/2K/3K` vs `JK/K2/K3`)
- **Where:** `Leerplandoel.cs:80-81`; `LeerplandoelConfiguration.cs:36` (`HasMaxLength(8)`)
- **Problem:** `JaarFase` is a free `string(8)`, deliberately not an enum, so either code form imports cleanly. This is the *correct* way to avoid hard-assuming an Art. XIV answer — no fix needed. Flagging only so the directie confirms the form before any downstream code (ordering, milestone logic) parses it.
- **Required fix:** None now. Keep the parsing seam isolated when E1-04/coverage logic interprets jaarFase.

### [QUESTION] `MinimumdoelRef` modelled as a single optional FK, not many-to-many
- **Article/FR:** Art. V.1 / IX.1 (concordance), ADR-0007
- **Where:** `Leerplandoel.cs:107-108`; `LeerplandoelConfiguration.cs:58-64`
- **Problem:** Art. IX.1 specifies `minimumdoelRef` (singular) on Leerplandoel, so this matches the constitution literally. The worklog notes ADR-0007 envisions a many-to-many `Concordantie` for E1-04. This is a forward-compatible choice (identity stays `code`), not a violation — but the antagonist cannot confirm from this diff alone that a one-leerplandoel→many-minimumdoelen case never occurs in Op.stap. If it does, the singular FK would need promotion in E1-04.
- **Required fix:** None for E1-01. Verify concordance cardinality against real Op.stap data before E1-04 locks the parser.

## Checks run (proof of thoroughness)

- **Art. III.1 (read-only / immutable).** All three entities use `private set` on every property, a single validating public constructor, a private parameterless ctor for EF only, and no mutator methods. AppDbContext exposes only `DbSet`s — no update/edit service. Two reflection tests pin "no accessible setters" and "no public mutators". **Genuinely immutable from app code paths — pass.**
- **Art. III.3 (single-source doelsoort mapping).** Enum↔code mapping lives in exactly one place: `DoelsoortCode.cs`. EF value converter routes through `ToCode`/`FromCode`. **Pass.**
- **Art. III.5 (code = stable identity).** `Code` is the PK; confirmed by tests. **Pass.**
- **Art. VII.0 (taxonomy correctness).** Only Discipline/Domein/Subdomein modelled; no `leergebied` entity. `Cluster` nullable. Grouping is the composite `(Domein, Subdomein)` index, not a uniqueness constraint. `Discipline.Nummer` string PK with optional self-referencing parent for 9.x split. **No deviation — pass.**
- **Art. IX.1 (data model shape).** All fields present and match the article. **Pass.**
- **Art. II (Dutch domain language).** Entities/properties named in Dutch; infra/tooling/comments in English; `Doelsoort` enum members use descriptive English names (`+` isn't a valid C# identifier) with authoritative short codes preserved in the mapping. **Pass.**
- **Art. VI.2/VI.4 (no pupil data, no secrets).** No personal-data fields; no secrets in diff. **Pass.**
- **Art. VIII (tech stack).** EF Core 10 + Npgsql, standard migration; EF Design is design-time only; no EPPlus; no ClosedXML yet (correct — parser is E1-03/04). Layering respected. **Pass.**
- **Scope creep check.** No parser, no `Concordantie` table, no school-content/planning/AI entities. **Pass.**
- **Art. X (DoD).** Worklog reports format clean, build 0 warnings, 49 tests passing. *Caveat:* migration validated via `dotnet ef migrations script --idempotent`, **not applied to a live Postgres** (no Docker in build env) — verification step, not a violation.

## Open questions surfaced
- **Art. XIV — `jaarFase` code form**: confirm before downstream parsing.
- **Concordance cardinality** (ADR-0007): confirm 1→many possibility before E1-04 locks the parser.
- **Live migration apply** still pending a Postgres instance.

The verdict is COMPLIANT. The two QUESTION items are confirmations for later stories, not blockers for E1-01.
