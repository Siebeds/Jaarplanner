# Antagonist review: FB-001, round 3 (fix round 2)

*Saved by the orchestrator, because the antagonist has no write tool. The report is condensed; how each finding was
handled is in `implementatie-frontend.md` (fix round 3).*

- **Verdict:** VIOLATIONS FOUND. 0 CRITICAL, 0 MAJOR, 3 MINOR, 0 QUESTION.
- **Scope audited:** `git diff 7cdefc9..HEAD`, which is the one commit `0d39af2` (8 files, no backend).

## Round 2 findings, checked

| # | Status |
| --- | --- |
| A | **Resolved.** Four mutations were applied mentally against the directie test, among them `jaarfase === "K3" \|\| kanLeerlingenHebben` and `jaarfase === "K3"` alone. Each fails `toEqual`. |
| B | **Resolved.** The fix round 1 figures are recorded. Unit, format and build match the antagonist's own run. Integration (480/1) is still not reproduced independently. |
| C | **Resolved in substance**, apart from finding H below. See the details after this table. |
| D | **Resolved.** |
| E | **Resolved for a failed first load.** The branch order is correct and both tests pin it. No other consumer reads `fout`. The fix introduces F. |

**Details on C:**

- The contrast table was recomputed from the HSL tokens and matches within ±0.04 in both themes.
- **The safe-area acceptance is sound, and no fix is required.**
  - The gap is FB-001's own and costs only white space: no overlap, clipping, focus or contrast effect.
  - Browser tabs report an inset of 0 in portrait.
  - The app has no web manifest, so a full-screen mode is rarer than the addendum implies.
  - Only a device check could settle how a home-screen app on the newest iOS reports the inset.

## Findings

### [MINOR] F. `fout` is also true after a failed refetch, while the lists are still loaded

- **Rule:** the E5-03 rule; Art. X.
- **Where:**
  - `selectie.ts`;
  - `OntwikkelingsrapportScherm.tsx`;
  - the key `selectieLaadFout`.
- **Problem:** in TanStack Query 5.102.0, `isError` is `status === "error"`, and a failed refetch keeps its data. The
  screen reaches that state: a remount after the 5-minute `staleTime`, a reconnect, or a refetch after a refused write.
  What the teacher then sees:
  - the header still shows the choices, while the body says nothing loaded;
  - `<Kinderen>` unmounts, and a name half typed in the form is lost;
  - "De schooljaren en klassen …" says both lists failed, when the condition only proves that either one did;
  - the doc comment is false.
- **Required fix:**
  - use `isLoadingError`, so only a first load that failed counts;
  - say less in the sentence;
  - correct the comment;
  - add a test.

### [MINOR] G. How `fout` is derived is untested; every test mocks the hook away

- **Problem:** `fout: false`, `fout: schooljarenFout` and `fout: klassenFout` each still pass all 649 tests.
- **Required fix:** a `renderHook` test over a real `QueryClient` for:
  - schooljaren failing;
  - klassen failing;
  - a refetch failing while the data is present.

### [MINOR] H. `browsercheck.md` still says "Contrast was not measured"

- **Where:** the "Not covered here" section, directly under the addendum that measured the contrast.
- **Required fix:** strike or annotate the line as superseded.

## Checks the antagonist ran

- **Code and copy:** the new string is in `nl.json` with no em dash, and no hard-coded Dutch was added.
- **Rights, pupil data and secrets:** the rights logic is unchanged, the names are invented, and there is no secret or
  stray file.
- **Gates:**
  - `pnpm lint` exits 0;
  - the full vitest run passes: 65 files, 649 tests;
  - `tickets.mjs check` reports 0 errors.

## Open questions surfaced

- **A follow-up for another ticket.** Five other screens say "no klassen" on an empty list without checking whether the
  load failed:
  - `KlassenScherm.tsx:110`;
  - `Hoekensectie.tsx:145`;
  - `Algemenefichesectie.tsx:129`;
  - `Klaskiezer.tsx:65`;
  - `Rechtenblad.tsx:140`.

  This deserves a TB ticket, not a fix in FB-001.
- **Carried over:**
  - the graadklas decision should trigger a re-read of `geenK3Klas` / `geenEigenK3Klas` and the ADR-0030 Leerlingzorg
    note;
  - FB-003 must keep the delete confirmation's promise;
  - FB-008 puts Leerlingzorg on the read row.
