# Antagonist — FB-061 calmer thema form

**Verdict:** COMPLIANT (round 1, on 65ec6c58..c91f973f)

No CRITICAL or MAJOR findings. Checked: Dutch copy only in nl.json and no em dashes (Art. II); the changed marker and
the discard question are words, never colour alone; rights unchanged (the create form renders only behind
`nieuwOpen`, the edit form only behind `bewerkOpen`, server checks untouched); `nietBewaard` renders only when there
are unsaved changes; no new accent use, the attention hue on the discard question matches `RapportScherm.tsx`;
navigation to `/themas/${thema.id}` matches the route; scope stays inside the ticket.

## MINOR findings and what was done

1. The worklog claimed the square chips also apply in the woordweb. False: `Woordweb.tsx` renders its own chips.
   Corrected with a new worklog line.
2. Escape or the close cross during a running save closed the sheet, after which creating still navigated. Fixed:
   the sheet stays open while `bezig`.
3. The "gewijzigd" marker was written twice with different classes. Fixed: one `components/ui/Gewijzigd.tsx`.
4. The marker sits inside the `<label>`, so a changed field is announced as "Naam gewijzigd". Kept on purpose: a
   screen reader user hears that the field changed.
5. No browser pass or contrast measurement recorded yet. Done by the test-runner (see `test-report.md`).
