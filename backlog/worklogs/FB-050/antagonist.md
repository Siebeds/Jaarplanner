# FB-050 antagonist audit

Verdict: COMPLIANT, one round, no CRITICAL or MAJOR findings.

MINOR findings, left open (outside this ticket, for the owner to decide):
- `frontend/src/features/koppelen/Nieuweactiviteitregel.tsx`: the quick "new activiteit" row in the koppelen sheet
  still preselects the first soort (Experiment). The ticket covers the activiteit form; this second path is not in its
  scenarios.
- `SchoolcontentBeheerDtos.cs`: the create DTO's `ActiviteitType` is non-nullable, so a raw API call without the field
  gets the enum default. The UI always sends a soort.
- Browser check was still open at audit time; it has since passed (see `test-report.md`).

Test-runner observation: after a refused save, focus stays on Bewaren (same as the existing naam check); the alert is
announced.
