# FB-020 — antagonist

One audit, round 1, on the finished branch (2026-09-15), taken while `main` (FB-013) was being merged in.

**Verdict: COMPLIANT**, on one condition: the merge commit must carry the two read rights. It does (`b9a0e29`):
`GET /api/klassen/{klasId}/hoekverrijkingen` is `KlasplanningBekijken` on `Klasinzage`, as every read of one klas's
planning since FB-013 (ADR-0040), and `GET /api/subthemas/{id}/hoekverrijkingen/aantal` is `SubthemaBeheren` on
`Subthema`. After the merge: unit 1645 passed, Postgres integration 507 passed (FB-013's
`Elke_leesroute_op_een_klas_weigert_een_gebruiker_zonder_enig_recht` included), Vitest 848 passed. FB-013 also took
ADR-0040, so this ticket's ADR is ADR-0041.

Found compliant: the write right and the implicit window (same route, same right and leeftijd check as the planner);
Art. IX.3 (no generation reaches a window or a verrijking); the cascades with their counts (Art. IV.2); the migration
(runs in EF's per-migration transaction, matches the ruling, proven on real old-shape rows); Art. V, II, VI.2/VI.7, X.

## MINOR findings

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | A subthema's delete could be confirmed while the count was still loading, or after it failed, without the number the owner's ruling requires | **Fixed.** The confirm waits (`bezig`) while the count is read; a failed read says the number is unknown (`subthemabeheer.verwijderGevolgVerrijkingenOnbekend`) |
| 2 | "Dit subthema heeft nog geen vastgelegde periode" could be false: a window of the same subthema that began in the previous themaperiode and reaches into these days is not folded into the run, and the server writes onto it | **Fixed.** The agenda looks for such a window among the stored ones before the balk and the sheet use the run, so both name it; the sentence shows only once the reads are in, and now says what its condition proves: "Voor deze dagen is nog geen periode van dit subthema vastgelegd." |
| 3 | The balk could say "Nog geen hoekverrijking" to a reader while the hoeken were still loading | **Fixed.** "None yet" needs both reads |
| 4 | The sheet sent every hoek, so an untouched blank field could remove a colleague's text written since the sheet read it | **Fixed.** Only changed fields are sent; nothing changed closes without a request |
| 5 | A run shows only the first stored window folded into it; a second window of the same subthema in the same themaperiode, or a one-day window stored from a single activiteit, can make the balk and the side panel disagree once the run widens | Listed, not fixed: a subthema stored twice in one themaperiode is rare, and the fix belongs to how runs and windows relate, which E10-01 touches too |
| 6 | The migration can join old texts beyond 2000 characters, after which that window's sheet cannot save until the text is trimmed | Listed, not fixed: only demo and development data had the old shape, and cutting a text in the migration would lose words silently |

## QUESTION for the owner

The hoek's delete takes its verrijkingen along, with the count in the confirmation. The owner ruled "mee weg, met
aantal" for the **subthema**; the hoek follows the same rule by the implementer's choice (ADR-0041 decision 4), where
the alternative is to refuse the delete as a placed hoek is refused. It pulls against FB-021 ("de directie moet
achteraf kunnen zien welke verrijkingen er waren"). The owner decides.
