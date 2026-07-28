# Antagonist Review — E1-04 Doelsoort recognition & concordance

## Round 1 — Verdict: VIOLATIONS FOUND (one MAJOR, one MINOR)

**Scope:** `git diff eaa3a98..324e3b6` on `story/E1-04`.

### The crux: single FK vs ADR-0007 — ruling
**The code choice is correct and faithful to the data; ADR-0007 as written was the thing out of date.** The implementation keeps a real, DB-enforced nullable FK `Leerplandoel.MinimumdoelRef → Minimumdoel.Ref` (`Minimumdoel 1 — * Leerplandoel`). This satisfies minimumdoel-level coverage (E5): the coverage-critical direction minimumdoel→leerplandoelen is `IConcordantieQuery.LeerplandoelenVoorMinimumdoelAsync`, feeding ADR-0009's `minimumdoelGedekt(m) = ∃ d ∈ concordantie(m) : leerplandoelGedekt(d)`. The Constitution (Art. VII.1, IX.1) only ever describes a single `minimumdoelRef` per leerplandoel (Excel col D = B+C, one value). ADR-0007's "many-to-many-capable" was speculative over-provisioning. Resolution: **supersede/amend ADR-0007**, not change code.

### [MAJOR] ADR-0007 contradicted the built concordance model and was not superseded
- ADR-0007 line 18 said "many-to-many-capable link"; the code ships one-to-many. The narrowing is a significant architecture decision recorded only in the commit/worklog, not in the binding ADR log. Required fix: add a superseding ADR (and mark ADR-0007's clause superseded) — governance fix, not code rewrite.

### [MINOR] Commit message framed doelsoort recognition as new work
- Doelsoort recognition was already delivered in E1-01/E1-03 via single-source `DoelsoortCodes`; E1-04 only reused it (correctly, no duplication). Informational.

### Checks (round 1)
Art. III.1/III.2 read-only (AsNoTracking, pure builder, no mutation) PASS · Art. III.5 no phantom links (orphaned refs surfaced, never linked) PASS · Art. V/V.6 coverage-critical & well-tested bidirectionally PASS · Art. II Dutch domain language PASS · no secrets PASS · Art. VIII layering (interface+builder in Application, EF impl in Infrastructure, thin Api) PASS · no migration drift (FK shipped in E1-01) PASS · no scope creep (no dekking/re-import/discipline-selection/API/UI) PASS.

---

## Round 2 (fix re-audit) — Verdict: COMPLIANT — prior MAJOR RESOLVED

**Scope:** fix commit `ba3a604`, diff `324e3b6..ba3a604` (docs-only).

The prior MAJOR is **resolved**. Verification:
- **ADR-0018 exists and matches the shipped code** — confirmed against `Leerplandoel.cs:108` (`string? MinimumdoelRef`, nullable single, private setter) and `LeerplandoelConfiguration.cs:57-64` (`HasOne<Minimumdoel>().WithMany().HasForeignKey(MinimumdoelRef).HasPrincipalKey(Ref)`, nullable, indexed; no join table). Cardinality claim literally true. The `IConcordantieQuery` forward-compat seam is real.
- **ADR-0018 follows repo convention** — Status/Date/Deciders, Context, Decision, Alternatives, Consequences, Compliance trace; Accepted; supersedes clause stated.
- **ADR-0007 genuinely superseded, not rewritten** — original bullet preserved verbatim; status-header annotation + inline `>` pointer to ADR-0018 added. Satisfies "supersede, never rewrite".
- **Index + traceability matrix updated** — ADR-0018 row `Art. VII.1, IX.1, III.5, V | E1-04, E5 | FR-2.2/2.3, FR-9.3`; ADR-0007 annotated.
- **Decision is constitution-faithful** (Art. VII.1 / IX.1 singular minimumdoelRef; Art. VIII don't over-engineer; ADR-0009 roll-up matches; Art. III.5 no phantom coverage) — a true decision, not paper-over.
- **Docs-only, in-scope** — diff touches only the worklog, ADR-0007, ADR-0018, ADR index. No code/test/migration/frontend changed. No Art. XIV decision hard-assumed.

**Conclusion:** the binding architecture log now accurately describes the shipped one-to-many concordance; supersession recorded without erasing history. E1-04 is COMPLIANT.

(Post-merge: orchestrator updated the CLAUDE.md ADR-range reference 0017→0018 for index consistency — the one non-blocking nit round 2 noted.)
