# TB-004 antagonist audit, round 4 (2026-09-14)

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 2 MINOR)

**Scope:** `35ba42c` and `d244332`. All six round-3 fixes were verified. Both findings came from those fixes.

## Findings and what was done

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | A failure that coincided with a requested stop let any exception through the new filters. `Program` catches only `OperationCanceledException`, so the runner crashed instead of printing "Gestopt". | Fixed on both sides. `EvalRunner.IsFailure` treats only a *requested* cancellation as a stop; every other exception, a timeout included, is recorded. The runner checks the stop between cases and between models (`ThrowIfCancellationRequested`), so a requested stop always ends as a cancellation. Test: `Een_fout_tijdens_een_gevraagde_stop_stopt_de_run`. |
| 2 | "Bij de kandidaten" meant two things. The retrieval table left failed selections out; the summary counted them as found-nothing. | Fixed. Both tables now use one rule: a case whose candidates could not be found counts in neither "Bij de kandidaten" nor "Kandidaten (gem.)", and appears under Fouten. The legend says so. The summary row is pinned in `Betaalde_embeddingtokens_blijven_zichtbaar_als_de_selectie_faalt`. |
| Nit | The test helper ignored the return value of `WaitForExit`. | Fixed. If git hangs, the helper kills the process and fails with a message. |

## Still open (not findings)

- Merge `origin/main` before the PR. It carries the ADR-0035 amendment to the constitution; nothing here conflicts with it.
- AC3, the live Foundry run.
- The ADR-0036 index row. The claim on `docs/adr/README.md` is now held by E6-02.
- The owner's acceptance of ADR-0036.
