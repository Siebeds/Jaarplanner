# FB-035 — antagonist, round 2 (re-audit)

**Verdict:** COMPLIANT. Scope: commit `072b5125`, only the two blocking findings of round 1.

- **[MAJOR] The migration could leave two placements on the same days: RESOLVED.** The lone placement is cut at the
  last schooldag before the next group and deleted when no day is left; the case of a next group on the year's first
  schooldag is handled in both branches, and `v_volgende_begin` is reset per group. Each group ends before the next
  group's first schooldag and starts only increase, so the unique first day cannot be broken.
  `Een_losse_begindatum_in_een_periode_met_een_thema_overlapt_niet` covers both cases; its expected dates match the SQL
  traced by hand.
- **[MAJOR] Art. IV.2 contradicted rejection by deletion: RESOLVED.** IV.2 carries the exception; ADR-0049's trace, the
  ADR index and the constitutie-log row name it; IV.1 is correctly listed as unchanged.

The fix introduces no new CRITICAL or MAJOR finding.
