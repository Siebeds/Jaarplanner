# TB-004 antagonist audit, round 5 (2026-09-14)

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 3 MINOR)

**Scope:** the round-4 fixes `89db74b` and `13d18a3`, the merge of `origin/main` (`0fbf913`, with the ADR-0035 constitution amendment) and the ADR-0036 index rows (`1c52a61`). Nothing in TB-004 conflicts with ADR-0035 or the new Art. VI.7.

## Findings and what was done

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | "A requested stop always ends as a cancellation" did not hold for the last call of a run: after it there was no next check, so a report came back. | Fixed. `RunAsync` checks the stop once more after the loops, before it builds the report. Test: `Een_stop_bij_de_laatste_aanroep_stopt_de_run_ook`. |
| 2 | ADR-0036's compliance trace did not cite the new Art. VI.7 (logs and repository), which its decision 4 enforces. | Fixed. VI.7 is cited next to VI.2 in decision 4, in the export note, in the compliance trace and in the traceability row of `docs/adr/README.md`. |
| 3 | `CLAUDE.md` still gave the ADR range as 0001…0035. | Fixed. It now reads 0001…0036; the file was claimed first. |

## Still open (not findings)

- AC3, the live Foundry run, which waits for the owner's go.
- The owner's acceptance of ADR-0036.
