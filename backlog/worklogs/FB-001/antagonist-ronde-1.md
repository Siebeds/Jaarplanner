# Antagonist review: FB-001, children of a K3 klas + the Ontwikkelingsrapport destination (round 1)

*Saved by the orchestrator, because the antagonist has no write tool. The content is the antagonist's report,
condensed only where it quoted file contents at length. How each finding was handled is in `implementatie-frontend.md`
(fix round 1).*

- **Verdict:** VIOLATIONS FOUND (0 BLOCKER, 1 MAJOR, 9 MINOR, 1 QUESTION). The change is not done until the MAJOR is
  fixed or the owner explicitly waives it, and each MINOR is fixed or waived.
- **Scope audited:** `git diff main...2285acd` on `ticket/FB-001-kinderen-van-de-klas` (49 files). Also:
  - `git ls-tree -r 2285acd` and the branch reflog;
  - the governing texts: CONSTITUTION Art. II, VI.1, VI.2, VI.4, VI.6, VI.7, IX.4, XII and XIV;
  - ADR-0035 §3.1, §3.3, §3.6, §3.8, §3.9 and §3.10;
  - ADR-0030 §3 rows 666 to 671 and footnote ⁶;
  - the working agreements in CLAUDE.md.

## Findings

### [MAJOR] 1. The frontend holds a second klas→leeftijden mapping (`jaarfase === "K3"`)

- **Rule:** Art. VI.1 (the klas-to-leeftijden mapping lives in one place in code), Art. XIV (graadklassen), ADR-0035 D9.
- **Where:** `OntwikkelingsrapportScherm.tsx:49` filtered on `kandidaat.jaarfase === "K3"`.
- **Why it matters:**
  - Once directie decides the graadklas question, `Leeftijdsrechten.VoorKlas` would admit a menggroep while the screen
    kept filtering it out, and would tell that leerkracht something false.
  - The screen also does not trim the jaarfase, where the server does.
  - `Doelkiezer.tsx:55` already names this hazard.
- **Required:** let the server say which klassen can hold children, and filter on that.

### [MINOR] 2. The not-found sentence says more than its condition proves (the E5-03 rule)

- **Where:** the sentence "Dit kind bestaat niet meer. Iemand anders heeft het verwijderd." in two places:
  - `RechtOpAttribute.cs:151`;
  - `LeerlingBeheerService.cs:24`.
- **Why it matters:** the sentence is also served for an id that never existed, and to a caller with no right at all.
- **Required:** say less.

### [MINOR] 3. Server sentences and their nl.json twins have no guard

- **Where:** the doc comment in `OntwikkelingsrapportScherm.tsx` said the server refuses "in the same words".
- **Why it matters:** nothing keeps that claim true.
- **Required:** add a guard test, or drop the claim.

### [MINOR] 4. `Cache-Control: no-store` is not tested

- **Where:** `LeerlingenController.cs:36`.
- **Why it matters:** no test under `backend/tests` asserts it.
- **Required:** assert it on the 200 list response.

### [MINOR] 5. The worklogs record a state that is no longer true, and the frontend has no worklog

- **Where:** three statements in the records are stale:
  - the backend worklog says "no no-store";
  - the backend worklog says "nothing committed";
  - the ticket Werklog line of 11:06 says "backend loopt nog".
- **Also missing:** no frontend worklog records the design step or the owner's rulings.
- **Required:** add dated notes, write a frontend worklog, and update the ticket Werklog.

### [MINOR] 6. No browser pass is recorded, and no contrast was measured

- **Required:** run and record a browser pass at desktop width and at about 390 px, with invented names.
- **To check:** the phone entry's `pt-[calc(env(safe-area-inset-top)+1rem)]` sits above an Outlet whose header may pad
  for the safe area as well.

### [MINOR] 7. The delete dialog borrows `klasbeheer.verwijderTitel` for a child's name

- **Required:** give the screen its own key.

### [MINOR] 8. `ontwikkelingsrapport.geenToegang` names who the report is for

- **Why it matters:** the sentence leaves out Leerlingzorg (R18), and it misleads a K3 hoofdleerkracht who has no
  klastoewijzing.
- **Required:** say what the render condition proves ("Je hebt geen toegang tot het ontwikkelingsrapport."), or record
  the current wording as owed by FB-008.

### [MINOR] 9. The directie empty state says "Dit schooljaar …" when no schooljaar exists

- **Required:** guard the no-schooljaar case, or say less.

### [MINOR] 10. The read row also covers the leerlingen list, and ADR-0030 §3 does not say so

- **Required:** add a dated note beside the row or in footnote ⁶.

### [MINOR] 11. Nothing stops the stray workload log from being staged again

- **Why it matters:** `git check-ignore "backend/Host=x/Microsoft.NET.Workload_1.log"` answers "not ignored".
- **Required:** add an ignore pattern.

### [QUESTION] 12. Changing a klas's jaarfase now requires deleting its children

- **Why it matters:** from FB-003 on, deleting the children deletes their reports too. The remediation is destructive
  and nobody ruled on it.
- **Required:** the owner confirms, or chooses another answer.

## The credential incident (verified)

- **The commit is clean.** `git ls-tree -r --name-only 2285acd` holds no `Host=…` path, no workload log and no `*.log`.
  `git grep` for the password value in `2285acd` finds nothing. The only `Password=` in the diff is a model-only test
  placeholder.
- **The worktree is clean.**
- **The old commit exists only locally.** The un-amended commit `acecf2e` is reachable only from the local reflog. There
  is no remote branch for FB-001, and a push never sends reflog-only objects.
- **The credential is a private local one.** It authenticates a throwaway role on 127.0.0.1:5433. Its presence in the
  owner's gitignored `.env` is not a repository problem.
- **Nothing further is owed.** Optional hygiene:
  - delete the two reflog entries;
  - do not run a repo-wide `reflog expire --all`, because the object store is shared;
  - rotate the local password if wanted;
  - add the ignore pattern (finding 11).

## Checks the antagonist ran

| Area | What was checked |
| --- | --- |
| Art. II | every string comes from `t()`; `catalogus.test.ts` passes; no em dash; English identifiers, Dutch domain names |
| Art. III, IV, V, VII | untouched; no AI path; no dekking code reads `Leerling` |
| Art. VI.1 | both rows match ADR-0030 §3 and footnote ⁶; `Rapportklas` is a separate resource; read has no end date and write lasts until the end of the schooljaar; the read is gated (R17) |
| Art. VI.2, VI.7, IX.4 | exactly four fields, pinned by tripwires; no logger; no sensitive-data logging; `autoComplete="off"`; the cache is cleared on sign-out; test names are invented; no screenshots in the commit |
| Restrict FK | `VerwijderKlasAsync` is the only `Klassen.Remove`; there is no schooljaar DELETE; the jaarfase guard fails closed |
| Art. VIII | the layers hold; no new packages; the migration creates only `leerlingen` |
| Art. X | 267 vitest tests and 278 unit tests re-run by the antagonist |
| ADR-0035 D17, D18 | carried out as the owner ruled on 2026-09-15 |

## Open questions surfaced

- **Graadklassen (Art. XIV, question 14):** finding 1 keeps that decision to one edit.
- **FB-003:** must make the delete confirmation's promise true ("Alle rapporten van dit kind verdwijnen mee."), with a
  test.
- **FB-008:** Leerlingzorg on the read row and the tab rule; revisit `geenToegang`; record in ADR-0030 that the read row
  also covers the leerlingen list.
