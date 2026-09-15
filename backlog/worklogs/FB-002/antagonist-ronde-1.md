# Antagonist Review: FB-002, de K3-rapportdoelen en de sterrenschaal (round 1)

**Verdict:** VIOLATIONS FOUND. 1 MAJOR, 3 MINOR, 3 QUESTION. The ticket is not done until the MAJOR is fixed or the owner explicitly waives it. The MINORs need fixing or waiving too.

**Scope audited:** `git diff ticket/FB-001-kinderen-van-de-klas...HEAD` in `C:\Source\Jaarplanner\.claude\worktrees\fb-002-rapportdoelen`.
- The merge base is `8a54bf9` (FB-001 fix round 4). FB-001's tip has since moved to `d4bbff2`, but those two commits only record the PR and the status, and they are outside this diff.
- The three-dot diff holds no FB-001-only files. Every changed file is FB-002's, including the doc-comment edits in `AanmeldController.cs`, `Rechten.cs` and `Rechtenbeleid.cs` and the `Foutregel`/`foutzin` extraction from `OntwikkelingsrapportScherm.tsx`.
- 50 files. I read all source and test hunks, the migration, the ADR-0030 note, the ticket and the three worklogs.

## Findings

### [MAJOR] A rapportdoel that is only a titel can be created on purpose and kept, which the ticket puts out of scope and R3's rejected option describes
- **Article/FR:** Art. VI.7 / IX.4 (ratified as far as R3). ADR-0035 R3: chosen *"De leerkracht bundelt subdoelen … onder een zelfgekozen titel"*, rejected *"Vrije titel, geen koppeling"*. FB-002 "Buiten scope": *"Rapportdoelen die leerplandoelen bundelen in plaats van subdoelen, of een titel zonder subdoelen (R3)."*
- **Where:**
  - `backend/src/Jaarplanner.Infrastructure/Ontwikkelingsrapport/RapportsetService.cs`, `KeurSubdoelenAsync`: `if (ids.Count == 0) return ids;`, with the comment "An empty list is allowed, and that is a default, not a ruling".
  - `Rapportdoel.cs` constructor ("none is allowed while editing").
  - `RapportdoelenScherm.tsx` `bewaar()` only checks the titel.
  - Pinned by `RapportsetEndpointsTests` ("A titel alone while it is being built") and `RapportdoelTests.Een_rapportdoel_zonder_subdoelen_mag_terwijl_het_bewerkt_wordt`. `browsercheck.md` records saving "Luisteren en spreken" with no subdoelen.
- **Problem:** Nothing makes the empty state temporary. There is no draft flag, and nothing forces a subdoel to be added later. A teacher can create a titel-only rapportdoel, and it stays in the one K3 set for good. FB-003 will then rate children on it.
  - That is operationally the free titel with no link that the owner rejected under R3.
  - It is also exactly what the ticket, the scope document for this work, lists under Buiten scope, citing R3.
  - The implementer's two arguments do not reach this:
    - "R3 rules out a kind, not a state": the ticket reads R3 as excluding the state.
    - "D3/D11 can empty one anyway": D3 empties a rapportdoel as a side effect of someone else's delete. That is not the same as the app letting a user create an empty one on purpose.
  - Flagging a default in a code comment and a worklog does not override the ticket's scope line.
- **Required fix:** either
  - (a) refuse an empty `subdoelIds` on create, server-side with a Dutch sentence plus the frontend pre-check; or
  - (b) put the question to the owner and record his answer in the ticket Werklog. The question: may a titel-only rapportdoel be saved, and may an update remove the last subdoel? The implementer's point that (a) on update would make the last subdoel impossible to remove is a real trade-off, and it is the owner's to settle.

  Until then the default contradicts the ticket.

### [MINOR] The core flow (bundling subdoelen) was never looked at in a browser
- **Article/FR:** Art. X (Definition of Done). CLAUDE.md working agreement *"Look at it before claiming it works. Open the real app in a browser at desktop and ~390px."*
- **Where:** `backlog/worklogs/FB-002/browsercheck.md` "Not covered here". The ticket Werklog of 14:50 says "browsercheck geslaagd op 1440 en 390".
- **Problem:** The throwaway database held no leerplandoelen, so no decided K3 subdoel existed. The following were never rendered with real data in a real browser:
  - the picker sheet (`Blad maat="breed"`) with a populated, grouped pool;
  - the checkbox rows with long leerplandoel texts;
  - the folded `<details>` subdoel list with `Doelsoortmerk`;
  - the "thema › subthema" micro line;
  - all of the above at 390px.

  AC1 and AC2, the heart of the ticket, were only seen in jsdom. The Werklog's "geslaagd" reads wider than what was checked. The worklog is honest about the gap; the Werklog line is not.
- **Required fix:** import or seed a few leerplandoelen and one or more decided K3 subdoelen (invented content, no names) in the throwaway database. Then walk AC1 to AC4 at 1440 and 390, including picking, searching and the folded list, and append the result to `browsercheck.md`.

### [MINOR] A literal NUL byte in a source file makes grep and ripgrep skip it
- **Article/FR:** Art. X.6 (small and reviewable), and the working agreements' reliance on grep-style review and guards.
- **Where:** `frontend/src/features/ontwikkelingsrapport/RapportdoelenScherm.tsx`, in `groepeer()`: ``const sleutel = `${subdoel.themaNaam}<NUL>${subdoel.subthemaNaam}`;``. It is in the HEAD blob (`git show HEAD:… | grep -caP '\x00'` → 1).
- **Problem:** Both `grep` and ripgrep treat the file as binary. My own ripgrep search for `accent-[` returned nothing for this file. Only `grep -a` found it. Any reviewer's or agent's grep for hard-coded Dutch, em dashes or rights terms silently skips this screen. `catalogus.test.ts` reads files with Node and is not affected, but human and agent review is. The Read tool renders the byte as a space, so it is also invisible in review.
- **Required fix:** write the separator as an escape (`\u0000`, or `\u001f`), or build the key with `JSON.stringify([themaNaam, subthemaNaam])`. The file must then be text to `grep -I`.

### [MINOR] The record of the hue-collision check names only green and orange; red and blue share hues with status and doelsoort signals
- **Article/FR:** Art. XII (colours already spent). CLAUDE.md *"Colour is already spoken for … Never introduce a hue without checking what it collides with."* ADR-0024.
- **Where:**
  - `frontend/src/index.css`, the `ster` token comment: "chosen … from a proposal that showed them next to what the app already means by green and orange (aanvaard, gedekt, doelsoort +, attentie, doelsoort A)".
  - `implementatie-frontend.md`, "Owner rulings": the same list.
- **Problem:**
  - `--color-ster-rood` (hsl 4) sits on the hue of `gevaar` = `suggestie-geweigerd` = `dekking-niet-gedekt` (hsl 0).
  - `--color-ster-blauw` (hsl 214) sits on `doelsoort-md` = `suggestie-voorgesteld` (hsl 217).

  The recorded check covers neither. Nobody has recorded whether the owner saw these two collisions when he chose the six. The artifact is private, so the repo cannot show it. The comment's argument (a star never stands where those signals do, and it always carries its label) would probably cover red and blue as well. But the comment says a check was made against green and orange only, and a reader will take the other two as unchecked.
- **Required fix:** add red (geweigerd, niet gedekt, gevaar) and blue (MD, voorgesteld) to the token comment and the worklog, and state whether the proposal showed them to the owner. If it did not, show him.

### [QUESTION] A directie with a running K3 klastoewijzing edits the set, and directie can give itself that klastoewijzing
- **Article/FR:** Art. VI.1 (union rule, via ADR-0030 §3). Art. VI.7 *"Directie does not edit them, but can view them (R31)"*. ADR-0035 R31 *"Alleen de K3-leerkrachten passen de set en de schaal aan."*
- **Where:**
  - `Rechtenmatrix.StaatToe`: `if (rechten.IsDirectie && !rij.ZonderDirectie)`, then the `Rapportsetleerkracht` column.
  - `lib/rechten.ts` `staatToe`.
  - Pinned by `RechtenmatrixTests.Een_directeur_die_zelf_een_K3_klas_heeft…`, `RapportsetEndpointsTests.Een_directeur_die_zelf_een_K3_klas_heeft…` and `rechten.test.ts`.
- **Problem, stated as fact:** The implementation follows ADR-0030 §3's union rule ("a '–' … never takes away what another column grants"), and that is a defensible reading.
  - But directie maintains klastoewijzingen (Art. VI.1). So one self-assignment to any running K3 klas turns R31's exception into a switch directie can flip for itself.
  - I did not verify whether the gebruikersbeheer refuses linking oneself; I found no such guard.
  - The implementer flagged the question only in `implementatie-backend.md`. It is not in the ticket Werklog and not in `docs/besluiten-gevraagd.md`, so the owner has not been asked.
- **Needs:** the owner's answer, recorded in the ticket Werklog: does R31 mean "not as directie" (what is built) or "never a person holding directie"? The implementer notes that the second is a one-line change in `StaatToe` plus tests.

### [QUESTION] The set and the scale are viewable by address only for anyone outside D18's tab condition
- **Article/FR:** ADR-0035 D18 (a default), FB-002 AC5, and the E3-06 reachability lesson.
- **Where:** `Navigatie.tsx` `toonRapport = mag.ontwikkelingsrapportZien` (unchanged). `rapportdelen.ts` shows the two parts to everyone who reaches the destination.
- **Problem:** A hoofdleerkracht of K3 without a klastoewijzing is AC5's second viewer, but has no path to the screen other than typing `/ontwikkelingsrapport/rapportdoelen`. The same holds for a K2 leerkracht, who may read the set by the server's open reads. D18's premise, that for anyone else the tab "would lead to a screen with nothing they may see", stopped being true when FB-002 made the set and the scale viewable by everyone. This is not a violation, because D18 is a default and AC5 says "ook niet via het adres". But the default was not revisited when its premise changed.
- **Needs:** the owner's choice between keeping it URL-only for non-report holders (as built) and showing the tab, or the two parts, to K3 hoofdleerkrachten or to everyone. Record the choice.

### [QUESTION] Does a checked picker checkbox count as a "selected row" in the accent's ration?
- **Article/FR:** ADR-0024, `index.css` accent comment: *"spent on exactly five things: the primary action, the active destination, the focus ring, the fill of the year strip, and a selected row."*
- **Where:** `RapportdoelenScherm.tsx`, the picker checkbox `accent-[var(--color-accent)]`. It is the only use of `accent-[…]` in the frontend. The other checkboxes use `accent-attentie` (`Schoolcontentimport.tsx`) or no accent.
- **Needs:** either add the picker's checked item to the comment's "a selected row" note (as TB-014 did for the time grid), or draw the checkbox in ink.

## Checks run (proof of thoroughness)
- **Art. II (language):**
  - Every new UI string is a `t()` key in `nl.json`. I found no Dutch literal in the new `.tsx`/`.ts` files. The remaining literals are the test fixtures and the seed.
  - Server sentences a teacher acts on are Dutch (`RapportsetService` constants). The domain `ArgumentException`s are English and only reached behind the service's Dutch pre-check.
  - No `—` in the frontend diff, the `nl.json` additions, the seed or the server sentences.
  - Domain names are Dutch (`Gradatie`, `Rapportdoel`, `Sterkleur`, `RapportsetService`) and comments are English.
  - The `sterkleurnaam` fallback shows the raw server name only for a colour the table does not know. None exist.
- **Art. III:** `RapportdoelSubdoelWeergave` only reads `Leerplandoel.Code/Tekst/Doelsoort`. Nothing writes to a leerplandoel or a minimumdoel.
- **Art. IV:** no AI in the diff.
- **Art. V:** nothing touches dekking. No rapportdoel or gradatie table is read by `EfDekkingOpslag`.
- **Art. VI.1 / VI.7 / ADR-0030 §3 footnote ⁶:**
  - The row `RapportsetBewerken` has the column `Rapportsetleerkracht` = `LopendeRapportklasIds.Count > 0`.
  - `Rechtenberekening` builds `LopendeRapportklasIds` only from the gebruiker's own klastoewijzingen whose klas passes `Leerling.KlasKanLeerlingenHebben` (which goes through `Leeftijdsrechten.VoorKlas`, so the ADR-0030 note is true) and whose schooljaar has not ended. That is ADR-0035 D4 exactly.
  - Directie gets no list of all klassen, so R31 holds for plain directie.
  - Leerlingzorg does not exist yet (FB-008), so there is nothing to check there.
  - All eight writes carry the policy. The reads fall under the fallback (signed in).
  - The integration test proves 403 on all eight writes for directie, HL-K3+TB, a K2 leerkracht and a K3 leerkracht after the schooljaar, with real ids and valid bodies. `ElkeWijzigendeRouteVraagtEenRechtTests` covers the new routes.
  - The frontend mirror (`ZONDER_DIRECTIE`, `mag.rapportsetBewerken`) matches the server, and the row count 21 is asserted.
- **Art. VI.2 / VI.7 (pupil data):**
  - `Rapportdoel`/`Gradatie` are not pupil data (ADR-0035 §3.1).
  - The diff adds no field about a child and no logging. The service logs nothing.
  - No child's name in tests, seed, worklogs or ticket. The staff names in the browser pass (Lotte, Bram) are invented staff, and screenshots stay in a gitignored folder.
  - Opening the reads to any signed-in gebruiker does not reach R17, which covers reports only.
- **Art. VI.4:** no secret added. The unit tests' `Username=x;Password=x` model-only connection string is inert.
- **Art. VII:** not touched.
- **Art. VIII:**
  - No new package in `package.json` or any `.csproj`.
  - Layering: Domain entities; Application interface and DTOs; Infrastructure service, EF configuration and migration; thin controllers. This is proportionate.
- **Art. IX.4 / IX.2:**
  - `Rapportdoel` has titel, order and subdoelen, and no schooljaar (R7; the columns are pinned by a test).
  - `Gradatie` has label, a colour from the fixed enum stored by name, and order, with no schooljaar.
  - Membership reads the subthema's leeftijd (level scoping per ADR-0025) and not the possibly stale `Subdoel.Leeftijd`.
  - The seed via `InsertData` has fixed ids and matches the owner's ruling. `has-pending-model-changes` is reported clean.
- **ADR-0035 D1/D2/D3/D11/D12:**
  - D1 is deferred, and the deletes say so.
  - D2 is FB-003's.
  - D3: a DB `Cascade` from `subdoelen` in the migration, and an integration test over subdoel, subthema and thema deletes.
  - D11:
    - Every write is validated against `Kandidaten()` and every read filtered.
    - The only `WijzigStatus` path (`DoelMatchingService`) touches thema doelsuggesties only, so the "no path sets a subdoel to Geweigerd" claim holds.
    - The FR-1 import only creates `Manueel` or deletes.
    - No subdoel-move or link-change route exists.
  - D12:
    - The prune in `WijzigSubthemaAsync` runs on subdoelen that are really loaded (`LaadSubthemaAsync` includes `Subdoelen`) and is saved in the same `SaveChanges`.
    - The wizard's re-scope calls `_beheer.WijzigSubthemaAsync`, so both PUT paths prune.
    - The import has no re-scope.
    - A K2→K3 return does not restore membership (tested).
- **Art. X:** gates as reported (backend 0 warnings, format clean, 1596/4 and 491/1; frontend oxlint, tsc, vitest 682). I did not re-run them. The antagonist is running now.
- **Art. XII:**
  - Every star is rendered through `Sterlabel` beside its label, or inside a named chip. `Ster` is `aria-hidden`.
  - The colour choice is a native radio group named by the colour's Dutch name, and selection is shown by border and background, not by hue.
  - I recomputed the edge contrast of all six stars on `kaart`, `vlak` and `vlak-diep`, in both themes. The lowest is 3.97:1 (geel on light `vlak-diep`, the selected chip), so everything clears 1.4.11's 3:1. The worklog's figures on `kaart` match mine to within 0.03.
  - `inkt-zwak` text is about 5:1 on white.
- **E5-03 rule:** the conditional sentences (`setAlleenBekijken`, `schaalAlleenBekijken`, `geenKandidaten`, `geenSubdoelen`) each assert only what their branch proves. The R7 sentence is unconditional and mandated by the ticket.
- **E3-06 rule:** no control renders without an action. The edit controls are hidden, not disabled, for non-editors.
- **Art. XIV:** the graadklas decision reaches the editors through the one klas→leeftijden mapping. The pool's `SubdoelLeeftijd = "K3"` is a subthema code, not a klas mapping, and R3/R4 fix it. No other open decision is hard-assumed.
- **Scope (FA):** within FR-13.2. Gradaties are labels with a star: no points, no totals (Art. I.2).

## Open questions surfaced
- R31 vs the union rule: whether a directie who teaches K3, or who assigns itself to a K3 klas, may edit the set (QUESTION 1; to the owner, via the ticket Werklog).
- The empty rapportdoel (the MAJOR): an owner ruling is the alternative to refusing it.
- D18's tab condition now that the set and the scale are viewable by everyone (QUESTION 2).
- Art. XIV graadklassen: touched correctly through the D9 function. A menggroep recorded as K2 gives its leerkracht no edit right on the set, which matches D9's effect on leerlingen.
