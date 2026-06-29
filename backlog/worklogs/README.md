# Worklogs — per-story build trail

One folder per backlog story, named by its stable id (`E<epic>-<nn>`), written by the
build agents driven by the [`jaarplan-build`](../../.claude/skills/jaarplan-build/SKILL.md)
skill. This keeps the audit trail ordered per use case, alongside the [backlog](../README.md).

```
worklogs/
└─ E0-04/                  ← one folder per story
   ├─ implementation.md    ← implementer: what was built, files, decisions, gates
   ├─ test-report.md       ← test-runner: PASS/FAIL + evidence (unit/integration or Playwright)
   └─ antagonist.md        ← antagonist: COMPLIANT/VIOLATIONS verdict against CONSTITUTION.md
```

A story is only checked off `[x]` in its epic file once its worklog shows **PASS + COMPLIANT**.
The orchestrator (not the agents) owns the backlog checkboxes and the progress table.
