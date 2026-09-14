# E6-02 — Antagonist verdicts

## Round 1 — amendment part 1 draft, commit `49e29b6` (2026-09-13)

**Verdict: VIOLATIONS FOUND** — 1 MAJOR, 7 MINOR, 3 QUESTION.

Scope: `git diff 309cc29..49e29b6` on `story/E6-02-amendering` (CONSTITUTION.md, FA, ADR-0030, ADR-0008, ADR-0022,
`docs/adr/README.md`, the worklog). The proposed ratification row and the proposed CLAUDE.md edits (a)–(e) were audited
as if applied. Cross-document sweep over `docs/adr/*`, `docs/besluiten-gevraagd.md`, `CLAUDE.md`, the backlog and the
live controller routes.

### [MAJOR] Ratifying Art. VI.1 would ratify defaults I10, I13 and the R17 goal-link reading without anyone ruling them
- Art. VI.1 makes the whole ADR-0030 §3 matrix binding (*"What each right allows is one matrix, ADR-0030 §3, which
  supersedes the table in FA §3.2"*). That matrix carries rows that exist only because of I10 (wizard step 2 to
  directie/TB only, step 6 to HL + LK leeftijd) and I13 (re-scoping a subthema needs the HL right at both leeftijden).
- Neither default is in Art. VI.1's *"Defaults, not rulings"* list nor in FA A.11's *"Nog niet beslist"*; the proposed
  ratification row excludes only *"the seven defaults Art. VI.1 lists"*, so by exclusion the owner's signature would
  ratify I10 and I13.
- I10 takes wizard step 2 away from ordinary leerkrachten, who can call `POST /api/thema-opbouw/themadoel-suggesties`
  today (`ThemaOpbouwController.cs:29`); no ruling names that.
- The §4 (h) gate is absent from the constitution: a builder reading only the binding article would enforce R17's
  goal-link editing without asking (h).
- The worklog contradicts the row: its proposed backlog edit counts the defaults as *"I1, I2, I6, I9–I13, (c), (e) and
  (h)"*, the row says "seven".
- **Required fix:** make the unratified set complete and identical in all three places — or, more robustly, state in
  Art. VI.1 that *any matrix row citing an I-item or a lettered §4 question is a default and is not ratified by this
  amendment*, and have the ratification row say the same instead of counting to seven.

### [MINOR] The R17 goal-link reading is filed under the rulings and called "narrow", though it is the wider reading
- ADR-0030 §1.2 R17 sub-bullet *"Read narrowly, by the recording session: … editing those links is part of this
  right"*; the §3 row *"met hun doelkoppelingen (R17; §4 (h))"*; the FA FR-7.2 pointer stated flat.
- For a subdoel the inclusion is inherent (Art. IX.2: a subdoel is a link to a leerplandoel); for an activiteit's goal
  links (`POST/DELETE /api/activiteiten/{id}/doelkoppelingen`) it is the *broader* reading. Worklog open question 1
  treats it as undecided.
- **Required fix:** relabel as the session's plain reading or move to §2 as an I-item; mark the FR-7.2 activiteit
  clause *voorlopig* until (h) is answered.

### [MINOR] Default I2 ("directie gives themabeheer") is stated as fact in three places
- Art. XII *"Themabeheer — the right, given by directie to a few named leerkrachten…"*; the FA FR-12.2 pointer
  *"… en geeft themabeheer of het directierecht aan wie ze kiest"*; proposed CLAUDE.md edit (d) *"the right directie
  gives"*. Art. VI.1 and A.11 mark I2 as a default; these three do not.
- **Required fix:** mark as default in all three, or drop "given by directie" from the glossary and CLAUDE.md (d) and
  add *voorlopig* to FR-12.2.

### [MINOR] A gebruiker with none of the four rights has no column, so default (e) "and reading" has no matrix row
- A zorgcoördinator, or an ICT-coördinator without a klas, holds no klastoewijzing, so under Art. VI.1 is not a
  leerkracht; ADR-0030 §3 defines *"LK ander = a leerkracht who is none of the above"*. Such a person matches no column
  and gets nothing, not even reading. Same gap for a hoofdleerkracht without a klastoewijzing.
- **Required fix:** define "LK ander" as *any gebruiker* who is none of the other relations (or add a baseline column),
  record the reading right for a gebruiker without a klastoewijzing as a marked default, and say in Art. VI.1 what a
  gebruiker holding none of the four rights may do.

### [MINOR] The doelsuggestie "aanpassen" action is missing from the matrix and from Art. VI.1
- FR-4.3 (*"aanvaarden, weigeren of aanpassen"*), Art. IV.2; the live route
  `PUT api/themas/{themaId}/doelsuggesties/{suggestieId}/leerplandoel` (`DoelsuggestiesController.cs:111`) has no row.
- **Required fix:** row reads *"aanvaarden, weigeren of aanpassen"*; Art. VI.1 reads "accepts, rejects or adjusts".

### [MINOR] The sweep missed who-may sentences in ADR-0026 and ADR-0010, and A.11 misreports its coverage
- `docs/adr/0026-streefwoordenschat-op-subthema.md:211` *"A K3-groen teacher edits K3-blauw's list, and the interface
  has to carry that."* Streefwoordenschat is a `Subthema` field edited through `PUT /api/subthemas/{id}`, which the
  matrix gives to directie + HL only. ADR-0026 (Proposed; E10-01 designed, not built) promises the opposite; question
  10 in `docs/besluiten-gevraagd.md` frames it as something "het team samen afspreekt".
- `docs/adr/0010-ai-advisory-architecture.md:9` *"it proposes, the teacher decides"* restates Art. IV.1 without the new
  clarification.
- FA A.11 claims a pointer at FR-4.2 (there is none; it is covered via FR-4.3), and its *"Nog niet beslist"* list omits
  I1.
- **Required fix:** status pointer on ADR-0026 (streefwoordenschat follows the subthema row) and a note on E10-01, or
  put it to the owner; a one-line pointer on ADR-0010; correct A.11's FR-4.2 claim and add I1.

### [MINOR] The "verbatim" record of statements 16, 17 and 21 contains elisions
- Statement 16 *"… wijzigt de constitutie en de FA … Die moet jij ratificeren"*, statement 21 *"… alleen omdat die
  hoofdleerkracht is? …"*, statement 17's rejected option *"R8 blijft zoals beslist …"*. The elisions make it
  impossible to check later whether a consequence was put to the owner — the test (f) and (h) apply.
- **Required fix:** restore the full question and option text, or mark each elision with what it left out.

### [MINOR] About twenty dated markers assume the amendment is ratified on 2026-09-13
- CONSTITUTION.md "amended/Clarified/Amended/narrowed 2026-09-13"; FA "Verfijnd op 13-09-2026" ×11, "Vervangen op
  13-09-2026"; the proposed row dated 2026-09-13. Under R13 the owner has not approved yet.
- **Required fix:** set markers to the ratification date at ratification, or reword as "rulings of 2026-09-13".

### [QUESTION] Art. XIV "Teacher visibility": the owner ruled part of a question reserved to directie
- R7 removes the "none at all" option from directie's choice; question 4 still offers "enkel na toestemming", which the
  bullet's "narrower" covers. The bullet itself does not say directie has not confirmed the owner's part (the
  ratification row does). **Suggestion:** add "directie has not confirmed" to the bullet.

### [QUESTION] Art. XIV graadklassen: the "LK leeftijd" column fixes one leeftijd per klas
- Named in ADR-0030 §3 and FA A.11, not in Art. VI.1. **Suggestion:** add the graadklas case to Art. VI.1's defaults,
  and require E6-02 to put the rights-side klas→leeftijden mapping in one place (I12's "documented sibling" half-says
  this).

### [QUESTION] The committed MVP wizard (Art. IV.8, FA A.7) now spans three rights
- Under R4, R5 and R17, steps 1–2 need themabeheer, the subthema steps HL, steps 6–7 "LK leeftijd": no ordinary
  leerkracht can finish the ten-step flow. The sweep calls IV.8 "still true"; I10 covers only the AI assist.
  **Suggestion:** tell the owner this is a consequence of the rulings, not a new rule, before the wizard UI is built.

### Checks the auditor ran (summary)
Art. II (Dutch domain terms, no em dashes in A.11), III (no official content touched), IV (IV.1 note clarifying, human
still decides; ThemaOpbouwController persists nothing), V ((f) resolved honestly, (h) surfaced), VI (R11–R18 checked
against statements 14–21 and found faithful; no pupil data, no secrets), IX (Thema line quotes old wording), X (docs
only, gates n/a), XI.1 (commit states what/why; CLAUDE.md edits (a)–(e) cover every sentence made false; ratification
must carry the CLAUDE.md edits and the log row together), R8 reversal struck and kept; ADR-0022's policy guards only the
two Op.stap imports, not the FR-1 import, so binding it to directie does not lock themabeheer out of R9.

## Round 2 — fix round `e9f32d1` (2026-09-13)

**Verdict: VIOLATIONS FOUND** — 2 MAJOR, 9 MINOR, 1 QUESTION.

Scope: `git diff 49e29b6..e9f32d1` and `git diff 309cc29..e9f32d1` in full; the proposed ratification row, CLAUDE.md
edits (a)–(f) and backlog edits audited as if applied; model/code claims checked against `Subdoel.cs`,
`Activiteit.cs`, `SchoolcontentImportService.cs`, `SchoolcontentImportDiff.cs`, `ActiviteitenController.cs`,
`SubthemasController.cs` and the live E6 epic file.

**Round-1 dispositions:** all eleven resolved in substance (MAJOR 1 via the "ratified only as far as the R-items it
cites" rule, judged sound and better than the round-1 suggestion because it keeps R7 ratified on the viewing row; the
unratified set is identical in Art. VI.1, FA A.11 and the ratification row). Residuals are the findings below. §1.3's
verbatim record is internally consistent; the auditor cannot compare it with the session transcript.

### [MAJOR] I14 empties the subdoel half of statement 22's grant, and is filed as an ordinary default without the (f)/(h) gate
- Statement 22's question and chosen option presuppose subdoel content separate from its link (*"Leerkrachten van dat
  jaar bewerken de inhoud van gedeelde activiteiten en subdoelen"*); `Subdoel.cs:20-37` holds only `SubthemaId`,
  `Leeftijd`, `Koppeling`, and `SubthemasController.cs:46/50` offers only create-link and delete. I14 therefore turns
  the subdoel half of the owner's grant into an empty set and takes delete/move away from leerkrachten on any activiteit
  with links — the (f)/(h) pattern (an answer given on a description that omitted a consequence), yet listed as a default
  the build follows, with worklog question 1 only asking "Agree?".
- I14 misquotes Art. IX.2: CONSTITUTION.md:230/:299 define a subdoel as *"a concrete, age-differentiated goal … linking
  to a Leerplandoel"*; only the `DoelKoppeling` line (:235) supports the pure-link reading.
- **Required fix:** state the premise mismatch in ADR-0030 §2, Art. VI.1 and A.11; gate it like (f)/(h) (put to the owner
  before E6-02 enforces anything on subdoelen); correct the Art. IX.2 paraphrase.

### [MAJOR] Art. VI.1's "only" on goal links contradicts the themabeheer FR-1 import; the ADR resolves it silently and misstates what the import writes
- CONSTITUTION.md:116 (*"for directie and that jaarfase's hoofdleerkrachten **only**"*) against :114 (themabeheer runs
  the FR-1 import) and :141. The import writes `Manueel` subdoel links (`SchoolcontentImportService.cs:321`, `:675`,
  `:712`). Statement 13 was put without the links and statement 22 without the import, so which governs is open; ADR §4
  (h)'s *"No row contradicts another, because each is its own ruling"* silently resolves it for R9.
- False fact: the ADR and worklog say the import writes links at activiteit level; `SchoolcontentImportService.cs:394-396`
  says *"Activiteit goal links (Doelkoppelingen) are not carried by this import"*, and `KoppelingNiveau.Activiteit`
  (`SchoolcontentImportDiff.cs:152-153`) is never emitted.
- **Required fix:** add the conflict with an explicit build default to Art. VI.1's defaults, A.11 and the row; qualify
  "only" ("by hand; for the FR-1 import see …"); remove "and activiteit" from §4 (h), the worklog and question 5.

### [MINOR] The ratification rule names the wrong rows as uncited, and A.11 states a different rule
- ADR-0030:355-357 names only the two wizard rows as citing no R-item; the Op.stap (:385) and Exporteren (:399) rows cite
  none either. A.11 lacks the "a row citing no ruling is a default entirely" clause. On the wizard rows Directie ✓ is
  ruled via R3 at column level. New anomaly: on Exporteren, "Ander" gets "lezen" while TB and HL get "–".
- **Required fix:** column-level citations count (R3 for Directie); name all four uncited rows or cite them; align A.11;
  fix or annotate the export row's TB/HL cells.

### [MINOR] "Nothing else." is ratified text no ruling made; footnote ¹ covers one of three cells
- CONSTITUTION.md:122 sits outside "by default (I9)" and the defaults list, contradicting footnote ¹ (E6-10) and §4 (e)
  ("still open"). Footnote ¹'s reasoning applies equally to the TB ✓ and HL ✓ personal-content cells for a holder
  without a klastoewijzing. **Required fix:** mark "nothing else" as default (e), personal content to E6-10; extend
  footnote ¹ to TB and HL.

### [MINOR] The hoofdleerkracht is defined inconsistently, and VI.1 omits a right R17 grants
- CONSTITUTION.md:318 and CLAUDE.md edit (d) make an HL "a leerkracht appointed…", :116 makes a leerkracht someone with a
  klastoewijzing, and I9 (ADR-0030:320) speaks of "a hoofdleerkracht who teaches no klas". The VI.1 HL bullet (:115)
  omits the R17 shared-activiteit content right. **Required fix:** define HL as a gebruiker appointed per (schooljaar,
  jaarfase), or mark the klastoewijzing requirement as a default; add the R17 content right.

### [MINOR] R20 is stated more broadly than the question put to the owner
- Statement 23 asked about *"rechten op de gedeelde inhoud"*; Consequences (:571-572) apply it to the klastoewijzing,
  which would end a leerkracht's right on their own klas's jaarplan at year end, a consequence never put to the owner;
  "LK eigen" (:372-373) cites only R15. **Required fix:** scope R20 to HL and LK leeftijd, or ask.

### [MINOR] I14 calls moving an activiteit "unlinking", which Art. IX.2 says it is not
- CONSTITUTION.md:232: the move *"keeps … every `DoelKoppeling` on the way"*. **Required fix:** keep the classification
  with the real reason (the links travel and start counting for the klassen that plan the other thema).

### [MINOR] R22 answers part of an Art. XIV question, but Art. XIV and FA §11 were not annotated
- CONSTITUTION.md:340/:355 and FA §11:334 carry no pointer; `docs/besluiten-gevraagd.md` has no graadklas question for
  directie (only question 11, the move). **Required fix:** annotate, and add graadklassen to worklog question 9.

### [MINOR] Several phrases become false on ratification day, and no checklist names them
- ADR-0030:352-353, §5 :489-491, the index and trace rows ("drafted 2026-09-13 for the owner's approval").
  **Required fix:** name them in the worklog's ratification checklist.

### [MINOR] The proposed backlog edits, taken together, still carry stale defaults
- Round-1 edits at worklog :217-218, :222-225, :240-241 are stale (I11 as a default, I14 missing, R17 without R19).
  **Required fix:** one consolidated set of backlog edits, not a delta.

### [MINOR] I2 residual: the directie bullet still ratifies what I2 calls a default
- CONSTITUTION.md:113 *"maintains gebruikers, klassen, schooljaren and rights"* against I2 (:134); the FR-12.2 pointer
  states appointment of hoofdleerkrachten by directie as fact. **Required fix:** narrow I2 to statement 8's missing verb,
  or qualify the bullet; treat HL appointments and klastoewijzingen alike.

### [QUESTION] I10, wizard step 6, against Art. IV.8
- CONSTITUTION.md:92 calls step 6 *"subdoel selection (step 6, the matching of FR-4)"*; round 1's alternative (all AI
  goal suggestions with themabeheer) was dropped from the question list. **Suggestion:** restore it and cite IV.8.

*Orchestrator's note:* the two MAJORs and the QUESTION were put to the owner in the same session before this verdict
arrived (statements 26–29, recorded by fix round 2). The orchestrator's question for statement 27 repeated the false
"activiteit level" fact; the owner's answer is recorded with that correction.

## Round 3 — fix round 2 `c5b8f69`, merge `55f6a75`, `31e059e` (2026-09-13)

**Verdict: VIOLATIONS FOUND** — 1 MAJOR, 5 MINOR, 1 QUESTION.

Scope: `git diff e9f32d1..c5b8f69`, `git diff 0fcb700..31e059e` (merge base = `origin/main`), the merge `55f6a75`, and
the worklog's ratification row, CLAUDE.md edits (a)–(f), consolidated backlog edits and checklist as if applied. Code
claims checked against `Subdoel.cs`, `Activiteit.cs`, `SchoolcontentImportService.cs:394/:446/:657`,
`ThemaOpbouwController.cs`, `ThemasController.cs`, `SubthemasController.cs`, `ActiviteitenController.cs`,
`SchoolcontentBeheerService.cs:567-594`.

**Round-2 dispositions:** all eleven resolved in substance, with file:line (I14 premise §1.3 :361-364 and R24 :203-206;
import "by hand" CONSTITUTION.md:114/:116, R19, R27, §4 (h); per-column rule CONSTITUTION.md:128 and ADR §2/§3, every
row now cites a ruling; (e) :124 and footnote ¹; HL definition :115, XII :326, I20; R20 scoped, I21; I19 move ≠ unlink;
graadklas annotations Art. XIV :349 and FA §11; checklist; one consolidated set of backlog edits; I2 narrowed). The
merge lost and duplicated nothing (Art. VII.2 and its XIV resolution intact, PR #53's row once and last, the 0031 index
row keeps "Decision 2 amended by 0034"). The maker is new model data, routed to E7-06, and explicitly not E6-10
personal content; a maker's delete cannot empty a parallel klas's agenda (`SchoolcontentBeheerService.cs:581-590`
refuses deleting a placed activiteit).

### [MAJOR] R24's "only" contradicts R27 and R29 in the same article, and the wizard has no write path of its own
- `CONSTITUTION.md:116` (*"Subdoelen, goal links by hand, and deleting any other activiteit are for directie and that
  jaarfase's hoofdleerkrachten only"*, *"The rest of the subthema stays with directie and the hoofdleerkrachten"*), R24
  (`:201`), matrix rows `:526`/`:531` (TB "–") against `:522` (import) and `:523` (wizard) (TB ✓), FA A.11.
- A subdoel *is* its link, so the import creates subdoelen (`SchoolcontentImportService.cs:657`), and R29's wizard
  creates subthema's and subdoelen at any leeftijd. R24's "only" is also stronger than statement 26, which asked what a
  *leerkracht* may do and does not exclude themabeheer.
- Enforcement consequence unwritten: `ThemaOpbouwController` has only two suggestion routes and there is no wizard UI;
  a wizard built in E6-05 would write through `POST api/themas/{id}/subthemas`, `POST api/subthemas/{id}/doelkoppelingen`
  and `POST api/subthemas/{id}/activiteiten` — the very routes the subthema/subdoel rows deny to TB. E6-02 must either
  give TB those routes outright (widening R29 beyond "in de wizard") or build wizard-only write endpoints (a design
  choice to record). Whether the grant reaches an **existing** thema (statement 29 said *"van nul"*) is unstated; if it
  does, the wizard bypasses R24 on every existing subthema.
- **Required fix:** qualify R24, `CONSTITUTION.md:116` and A.11 as R19 was; add a marked default (how the server tells a
  wizard write from a hand write, and whether the grant reaches existing thema's) in all three lists; route to E6-05
  and E6-02; an owner ruling if TB may create subthema's and subdoelen outright.

### [MINOR] The matrix limits the maker's delete right to the "LK leeftijd" column, which R25/R26 do not
- Matrix `:529` "maker²" only under LK leeftijd; footnote ² says "Only the **leerkracht** who created that activiteit";
  against R26 ("the gebruiker who created it"), `CONSTITUTION.md:118`, statement 30 (*"Verwijderen mag wie ze maakte"*)
  and I18 (a TB holder is the maker of wizard-created activiteiten). A TB maker without a klas at that leeftijd, or a
  leerkracht whose klastoewijzing lapsed under R20, cannot delete their own. CLAUDE.md edit (d) states the maker right
  unqualified; backlog edit 3 omits directie as a possible maker.
- **Required fix:** "maker²" in the TB and Ander cells, or a marked default "the maker right requires LK leeftijd" in
  all three lists; add directie to backlog edit 3.

### [MINOR] The consolidated backlog edits leave "every leerkracht reviews doelsuggesties" and the pre-ratification gates in place
- `backlog/README.md:39` and `:42`, `backlog/E6-beheer-rollen-samenwerking.md:24-25` (*"Its matrix only binds once part
  1 of the amendment lands"*), E6-04 `:71` (*"Waits on part 1 of the Art. XI amendment"*). **Required fix:** add them.

### [MINOR] The ratification checklist misses a phrase that becomes false on the day
- ADR-0030 `:781` compliance trace *"Art. VI.1 (roles, configurable; amendment part 1 owed)"*. **Required fix:** add
  it, and the backlog lines above.

### [MINOR] The ADR index row for 0030 contradicts itself on subdoelen
- `docs/adr/README.md:43` says the shared subdoelen and activiteiten are edited by every leerkracht of that leeftijd,
  then that subdoelen are for directie and the hoofdleerkrachten. **Required fix:** "the shared activiteiten (their
  content; not subdoelen)".

### [MINOR] Art. IV.8 and FA A.7 are not carried for R29
- `CONSTITUTION.md:92` *"AI never skips ahead of **the teacher** in this flow"*; FA A.7 (`:387`) has no pointer; the IV.1
  note is scoped to IV.1. After R29 the wizard's user is a themabeheer holder. **Required fix:** extend the IV.1 note to
  IV.8 (or a one-line pointer), a pointer at A.7, and add IV.8/A.7 to A.11's list, the version row and the ratification
  row.

### [QUESTION] The statement 27 correction: did the owner respond?
- ADR-0030 §1.3 `:373-377`, R27 `:216-220`. The record is honest and the reasoning that the answer stands holds, but it
  records only that the orchestrator *said* so. **Suggestion:** state whether the owner responded; if not, the owner's
  signature on a row that states the correction is the confirmation.

*Orchestrator's note:* the MAJOR's owner half, the maker-right MINOR and the QUESTION were put to the owner in session
after this verdict (statements 32–34, recorded by fix round 3).

## Round 4 (final) — fix round 3 `a6d36f9` (2026-09-14)

**Verdict: VIOLATIONS FOUND** — 0 CRITICAL, 0 MAJOR, 5 MINOR, 2 QUESTION. *No finding is a constitutional defect; the
ratified content is consistent. Every contradiction sets an unratified default against a ruling, or is a summary
that falls short of its text.* The build loop's three fix rounds are used, so the findings go to the owner.

Scope: `git diff 31e059e..a6d36f9` and `git diff 0fcb700..a6d36f9` in full; CONSTITUTION.md, ADR-0030 and FA A.11 in
full; ADR-0008/0010/0022/0026 pointers; worklog "After the merge with main" and "Fix round 3" (:661–941); ratification
row, CLAUDE.md edits (a)–(f) and backlog edits 1–11 as if applied against `016474e`; code claims against
`SchoolcontentImportService.cs:425-453/:630-663` and `ActiviteitenController.cs`.

**Round-3 dispositions:** all seven resolved in substance — R24 "by hand" (ADR :212/:217-219, CONSTITUTION.md:114/:116,
A.11:415/:417), R32 wizard write path (:243-247), I22/I23 in all three lists, wizard row split with footnote ⁵; maker²
in TB/LK leeftijd/Ander (:590) and footnote ²; backlog edits 1–5 verified against `016474e`; checklist :766; index row
:43; IV.8/A.7 pointers (:92, FA :387); S27 correction answered by the owner as S34.

### [MINOR] R33 was carried into the matrix but not into two defaults it contradicts: (e) and I22
- (e) at CONSTITUTION.md:124/:151, A.11:425/:449, ADR §4 (e) :665-666 says a gebruiker with none of the four rights
  may do nothing but read; I22 at CONSTITUTION.md:148, ADR :511, Consequences :853-854 and backlog edit 4 closes the
  ordinary activiteit routes to themabeheer. R33 lets any maker delete their own activiteit without links, through
  `DELETE api/activiteiten/{id}` (`ActiviteitenController.cs:23`). The matrix is right (:590, :624-625), the
  absolute wording elsewhere is not. Also (c) at :150 lacks "by hand".
- **Required fix:** add "apart from the maker's delete right (R33)" to (e) in its five places and to I22 in its four;
  optionally "by hand" to (c). *The auditor would fix this one before the owner signs.*

### [MINOR] Two members of the unratified set carry a ruled clause, and only A.11 separates it out
- I18 at CONSTITUTION.md:144 (*"…who may then delete it on the terms above"* = R33) and I2 at :136 (*"directie
  does"* = ruled text at :113); the row excludes "I2, …, I15–I23" wholesale. **Required fix:** "I18 (the maker
  assignment only; its delete right is R33)" at :144 and in the row; "I2 (the reading only)" in the row.

### [MINOR] Proposed CLAUDE.md edit (d) states default I18 as fact
- Worklog :806 lists "a themabeheer holder through the wizard" as a maker without marking I18. **Required fix:** mark
  it "(by default, ADR-0030 I18)" or drop the clause.

### [MINOR] The FR-7.2 pointer describes the wizard reach that statement 32 rejected
- FA:205 lacks the "for a new thema" limit. **Required fix:** add *"voor een thema dat in de wizard van nul wordt
  opgebouwd"*.

### [MINOR] The ADR index traceability row for 0030 was not updated in fix rounds 2 and 3
- `docs/adr/README.md:79` misses IX.2 `Activiteit` (the maker), the IV.8 pointer, A.7, and backlog E6-05, E10-01,
  E1-19. **Required fix:** extend it in the ratification commit.

### [QUESTION] I23's "new" window has no server-visible end and no in-run edit right
- No wizard run exists in the model; an abandoned run is never "finished or closed"; R32/the matrix grant only
  *aanmaken*, so renaming a subthema made earlier in the same run is granted to nobody but the HL. Unratified, so not
  needed before ratification; give E6-05/E6-02 a default for expiry and in-run edits, or put both to the owner.

### [QUESTION] The import exception also covers deleting, and no question put that to the owner
- A re-import deletes every subdoel whose code the file no longer carries (`SchoolcontentImportService.cs:645-663`,
  themadoelen :433-453): AI-only ones always, decided ones when `MenselijkeBeslissingenVerwijderen` is set. Under R9
  a themabeheer holder can therefore delete a hoofdleerkracht's hand-made subdoelen and lower the dekking of every
  klas at that leeftijd — the effect (h)/R19/R25 keep from leerkrachten. Disclosed in ADR §4 (b) since round 1 and
  behind an opt-in with a preview. **Suggestion:** name it in the ratification row's premises, or ask the owner.

*Orchestrator's note:* the second QUESTION and the ratification itself were put to the owner right after this
verdict; see statements 35 onward.

## Code slice 1 — audit round 1

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 5 MINOR, 1 QUESTION)
**Scope audited:** `git diff 60020b9 d6460ef` on `story/E6-02-fundament` (47 files). The worktree was clean at `d6460ef`. Slices 2–4 are out of scope and their absence is not reported. `15a044c` (I24/I25) is not in scope either.

The matrix code is faithful to ADR-0030 §3. I compared every row and every column cell, and nothing grants themabeheer or "Ander" a right the matrix withholds. No right the constitution grants is denied, except the dormant R25 reading below. Every finding is drift in the documents around the code, or a seam slice 3 will lean on. Under the rule of this role the slice is **not done** until they are fixed or explicitly waived.

## Findings

### [MINOR] E7-11 now states something false
- **Article/FR:** Art. VI.1 (E7-11 is its deployment gate); backlog accuracy (CLAUDE.md working agreement).
- **Where:** `backlog/E7-niet-functioneel.md:105`, "every signed-in person can still run the curriculum import".
- **Problem:** since `d6460ef` the four Op.stap routes admit directie only (`CurriculumbeheerAutorisatie.cs:26`, pinned 403/400/401 in `RechtenEndpointsTests`). The list of what the gate still waits on is wrong by one item.
- **Required fix:** annotate the line rather than delete it: the Op.stap routes are directie-only since E6-02 slice 1, and the rest of the matrix waits on slice 3. The entry stays `[!]`.

### [MINOR] ADR-0022 describes a registration and a body that no longer exist
- **Article/FR:** ADR discipline (supersede, never rewrite); ADR-0011 §2.
- **Where:** `docs/adr/0022-curriculum-administration-authorisation-seam.md:3`, whose status still says the role half is owed by E6-02, and decision 1, `:35-46`: `AddCurriculumbeheerAutorisatie()`, the `RequireAssertion(_ => true)` body, and "What E6-02 changes".
- **Problem:** the method is gone (`Program.cs` now calls `AddRechtenbeleid()`). The policy is the matrix row `Rechtenmatrix.Curriculumbeheer`, registered with every other row. A reader following the ADR looks for a file body that is now a constant.
- **Required fix:** a status pointer. The seam got its answer in E6-02 slice 1: the policy is the Op.stap row of the ADR-0030 §3 matrix, declared in `Rechtenmatrix` and registered by `Rechtenbeleid.AddRechtenbeleid()`, directie only. The name `Curriculumbeheer` is unchanged.

### [MINOR] The processing register carry-forward misses the new staff-data tables
- **Article/FR:** Art. VI.6 (processing register and retention), Art. VI.2.
- **Where:** `backlog/E7-niet-functioneel.md:62-63` covers the `Gebruiker` (E6-01) and the activiteit maker only. This slice adds `klastoewijzingen`, `hoofdleerkrachtaanstellingen` and `gebruikers.HeeftThemabeheer` (`20260914093928_RechtenModel.cs`).
- **Problem:** these record which named staff member teaches which klas and holds which role in which schooljaar. That is staff personal data, which Art. VI.2 allows, but Art. VI.6 needs it registered with a retention rule. The rule exists only in code: cascade on removal of the gebruiker, of the klas (toewijzing) and of the schooljaar (aanstelling).
- **Required fix:** extend the E6-02 carry-forward of E7-06 with the three facts and that retention.

### [MINOR] `Schoolklok` says its callers announce the UTC fallback; the rights caller does not
- **Article/FR:** Art. VI.1 / R20; the CLAUDE.md rule that a conditional sentence asserts only what its own condition guarantees (it binds code comments).
- **Where:** `backend/src/Jaarplanner.Infrastructure/Schoolklok.cs:14-18` ("callers fall back to UTC and say so"); `backend/src/Jaarplanner.Infrastructure/Toegang/RechtenService.cs:68`.
- **Problem:** on a host without zone data, `Zone` is null and "today" becomes the UTC date. After a schooljaar ends, an HL or "LK leeftijd" right then lasts until 02:00 Brussels (01:00 in winter) instead of midnight. That window fails open, and nothing logs it. The export stamps "UTC" and the rights path says nothing, so the comment is false for one of its two callers. No Dockerfile is in the repo, so I could not check whether a target host lacks the zone.
- **Required fix:** log a warning once when `Zone` is null, and scope the comment to what each caller does. Optional: in the rights path, fail closed on such a host.

### [MINOR] No single place turns a leeftijd taken from a request body into a `Leeftijdsinhoud`
- **Article/FR:** ADR-0011 §2 (one decision point); the stated purpose of `IRechtenbronnen` (`Rechtenbronnen.cs:13-18`: "every route asks the same question the same way").
- **Where:** `backend/src/Jaarplanner.Application/Toegang/Rechtenbronnen.cs:20-24`. It resolves stored ids only.
- **Problem:** two slice-3 routes have no stored leeftijd to resolve: the subthema create (`POST api/themas/{id}/subthemas`), and the new leeftijd of an I13 re-scope (`PUT api/subthemas/{id}`). Each will build `new Leeftijdsinhoud(body.Leeftijd)` by hand. `Rechten.IsHoofdleerkrachtVan` compares ordinally against the canonical codes, while `Jaarfasen.WatIsErMisMet` (`Jaarfasen.cs:172-182`) accepts a padded code by trimming it. So a validating path accepts `" K3"` while the rights check refuses a K3 hoofdleerkracht. That fails closed, so nothing leaks. But the same question gets asked two ways on two routes, which is what the seam exists to prevent.
- **Required fix:** before slice 3 uses it, add one normalising entry point, for example `Leeftijdsinhoud.VoorInvoer(string)` or an `IRechtenbronnen` member. It trims and validates through `Jaarfasen`, and every slice-3 route uses it for a body leeftijd, including both ends of an I13 re-scope.

### [QUESTION] R25 "while no goal is linked": the build counts `geweigerd` and `voorgesteld` links
- **Article/FR:** Art. VI.1 (maker bullet; R25, R31, R33); Art. XIV and "do not invent rules"; Art. IV.2; Art. V.1.
- **Where:** `Rechtenbronnen.cs:44-48` (the doc of `HeeftDoelkoppelingen`), `EfRechtenbronnen.cs:36` (`Doelkoppelingen.Any()`), `Rechtenmatrix.cs:224-238`.
- **Judgement:** acceptable to build, and **dormant today**:
  - activiteit links are only ever created `Manueel` (`SchoolcontentBeheerService.cs:494, :722`);
  - no route changes the status of an activiteit link (`WijzigStatus` is called only at `DoelMatchingService.cs:246`, thema doelsuggesties, and `JaarplanGeneratieService.cs:686`, placements);
  - the FR-1 import writes no activiteit links (R27).

  The reading can only withhold the right of the maker. HL and directie can still delete, so it cannot grant anything the constitution denies. The two readings pull in opposite directions:
  - The stated reason for statement 31 is dekking, and a `geweigerd` or `voorgesteld` link counts for no dekking (Art. V.1). That favours the narrower reading.
  - A `geweigerd` link is a persisted human decision (Art. IV.2), and letting the maker delete it would erase the decision of a hoofdleerkracht. That favours the stricter one.

  Neither reading is ruled, and this one is not among the defaults Art. VI.1 lists, so it must not live only in a code comment and a worklog. It becomes live with the activiteit-level matching of E8 (Art. IX.2 deferral), the first path to a `voorgesteld` activiteit link.
- **Required fix:** record it as a default in ADR-0030 §2 (the next free I-number, marked "E6-02, E8"), or put it to the owner. Either way, before E8 builds activiteit-level suggestions.

## Checks run (proof of thoroughness)
- **Art. VI.1, matrix fidelity.** Every `Matrixrij` against its §3 row, cell by cell:
  - `Curriculumbeheer`, `Beheer` and `MenselijkeBeslissingenVerwijderen`: directie only.
  - `ThemaBewerken`, `SchoolcontentImporteren`, `ThemaOpbouw` and both doelsuggestie rows: TB.
  - `SubthemaBeheren`, `SubdoelenBeheren` and `DoelenKoppelen`: HL only. TB is "–⁵", correctly absent.
  - `StreefwoordenschatAanpassen` and `GedeeldeActiviteitBewerken`: HL and "LK leeftijd", no TB.
  - `ActiviteitVerwijderen` is the union of the two delete rows: HL always, and the maker of any relation while no goal is linked (footnote ², including TB and Ander).
  - `ActiviteitVerplaatsen`: HL, plus "LK leeftijd" only without links (I19). The maker gets nothing.
  - `KlasplanningBewerken`: "LK eigen" only.

  Four more properties hold:
  - The TB flag is on resource-free rows only, so footnote ⁵ holds.
  - A resource row put in an attribute fails closed.
  - (c) and (e) fall out of the matrix with no special case.
  - A move stays inside one leeftijd (Art. IX.2, enforced in `Subthema.VerplaatsActiviteitNaar`, `SchoolcontentBeheerService.cs:638`), so "one leeftijd suffices" is true.

  The deferred rows (wizard write actions, R6 personal content, I9 reading) are documented as deferred, not granted.
- **R20, I21, I12, I20, R22.**
  - `Rechtenberekening`: `vandaag ≤ Eind`, inclusive.
  - "LK eigen" has no end date.
  - A klas with no stated or an unknown jaarfase grants nothing.
  - An HL needs no klastoewijzing.
  - `Leeftijdsrechten.VoorKlas` is the only klas-to-leeftijd mapping on the rights path (its one caller is `Rechtenberekening`), and it does not reuse the widening in `Klasleeftijden`.
- **Test identity (`TestAuthenticatie.cs:56-78`) cannot reach production.**
  - It lives in the IntegrationTests project, and `Jaarplanner.Api.csproj` references only Application and Infrastructure.
  - It is registered only through `ConfigureTestServices` (`JaarplannerApiFactory.cs:48-51`).
  - The production principal carries only the gebruiker-id claim (`Aanmelding.cs:132-133`), so no right can come from a cookie.
  - No `src` code reads a role or directie claim or names the test id.

  *Consequence for slice 3:* the 152 headerless call sites run as directie, so they prove nothing about denial. A route slice 3 leaves ungated passes every existing test. Slice 3 needs its own denial sweep: every mutating route, as a gebruiker with no rights, answers 403 (the E7-11 enumeration).
- **Maker stored null when the id has no gebruiker row.** Acceptable.
  - `ValideerSessieAsync` (`Aanmelding.cs:176-185`) re-reads the gebruiker on every request, so the branch is reachable only by a removal that races the request, or under the test scheme.
  - Null is the state I17 leaves anyway, and it fails closed: only HL and directie can then delete.
  - A removal between `AnyAsync` and the insert gives an FK error, never a wrong maker.
  - The import passes no maker; the only `VoegActiviteitToe` callers are the import and the hand create.
  - `MakerId` is set only in the constructor, and the `SetNull` FK is pinned on Postgres.
- **Time.** `Schoolklok.Vandaag` is the Brussels wall clock through `TimeProvider`, pinned at 30 June 22:30 UTC. The zone lookup of the export moved without changing behaviour. For the silent fallback, see the MINOR above.
- **Art. VI.2, VI.4, VI.6.** No pupil data and no secret in the diff. `/api/ik` exposes only the relations of the caller. Staff data: see the MINOR above.
- **Art. II.** Domain names are Dutch and in the Art. XII glossary. Comments are English. No hard-coded Dutch in `.ts` or `.tsx`: the diff there is types only. The Dutch `Matrixrij.Actie` labels are not user-facing today.
  - *Slice 2 note:* `Gebruiker.VereisAndereDirectie` throws an English message. The last-directie refusal is something directie acts on, so slice 2 must show it in Dutch (Art. II.3).
- **Art. III, IV, V, VII.** No curriculum mutation. No AI or prompt change. Dekking is still computed and untouched. The Op.stap mapping is untouched.
- **Art. VIII.** No new dependency (no csproj or package change). The layering holds: matrix and computation in Application, EF reads and the clock in Infrastructure, and the policies in the thin Api.
- **Art. IX.** `Klastoewijzing` (many-to-many, unique per pair), `Hoofdleerkrachtaanstelling` (unique per gebruiker, schooljaar and jaarfase; several per jaarfase) and a nullable `Activiteit.MakerId` match the ADR-0030 Consequences. One migration.
- **Op.stap stand route.** `GET /api/opstap-import/stand` is now directie-only. That is consistent with its own doc and the Op.stap row, and only `frontend/src/features/import` calls it. Until slice 4 hides the import section, a non-directie sees an erroring screen. That is inside the single delivery of R12, so it is not a finding here.
- **Art. X.**
  - Run by me: `dotnet test` UnitTests filtered to Toegang and ActiviteitMaker, 181 passed; `dotnet format --verify-no-changes`, exit 0.
  - Not run by me: the integration and Postgres suites, and `pnpm lint/test`. The implementer reports them green; I did not verify that.

## Open questions surfaced
- The link-status reading of R25 (QUESTION above). It becomes live with E8.
- Art. XIV graadklassen: the seam is in place (`Leeftijdsrechten.VoorKlas`); nothing is hard-assumed.
- Art. XIV visibility / I9: untouched. Reading still rides the fallback policy, behind E6-09.
- The wizard's own write actions (I22, I23 and the I24/I25 defaults on `15a044c`): deferred to slice 3 / E6-05, with no resource type yet.

## Code slice 1 — audit round 2

*Recorded by the orchestrator from the antagonist's final message: the antagonist is read-only and has no Write tool,
and it declined to append through Bash. Condensed in layout only; the findings are as it wrote them.*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 5 MINOR, 0 QUESTION)
**Scope audited:** `git diff d6460ef 138a605` (12 files); the parts of `60020b9..138a605` the fix makes newly relevant
(the subthema write path that `UitInvoer` guards, every controller behind `Curriculumbeheer`, the `RechtenModel`
cascades, the delete routes, the ADR index); and `ef6468b` on `feature/e6-rollen-rechten`.

| Round 1 | Status |
| --- | --- |
| MINOR E7-11 | Resolved. One claim in the annotation goes too far (MINOR 4), taken from the round-1 text. |
| MINOR ADR-0022 | Resolved; every claim in the pointer is true. The ADR index was not updated (MINOR 3). |
| MINOR E7-06 | Resolved for the schema. The retention text names triggers no route can pull (MINOR 2). |
| MINOR Schoolklok | Resolved. No behaviour change, no broken caller. |
| MINOR Leeftijdsinhoud | Resolved in behaviour. Its doc names the wrong rule and its tests only check it against itself (MINOR 1). |
| QUESTION R25 | Disposition adequate. The gate is not where its trigger fires (MINOR 5). |

### [MINOR] 1. `UitInvoer` names a rule the subthema write does not use, and its tests only check it against itself
- **Article/FR:** ADR-0011 §2; Art. II.3; the CLAUDE.md rule that a sentence (code comments too) asserts only what its code guarantees.
- **Where:** `Application/Toegang/Rechtenbronnen.cs:44-54`; `Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs:302, :332, :902-908`; `UnitTests/Toegang/LeeftijdsinhoudTests.cs:19-21, :33-35`.
- **Problem:** the doc says the rule is the one a klas's jaarfase and a subthema's leeftijd obey (`Jaarfasen.WatIsErMisMet`); the subthema create and re-scope actually validate with `VereisLeeftijd` (`Jaarfasen.IsBekend(leeftijd?.Trim())`) and refuse with a different Dutch sentence. The two accept the same inputs today, but nothing ties them together and the tests compare `UitInvoer` with the function it is built from, so they cannot fail. Fail-closed if they drift.
- **Required fix:** make one rule serve both (e.g. `VereisLeeftijd` delegating to the same predicate), or correct the doc to name `VereisLeeftijd` and its sentence; either way add a test that checks `UitInvoer` against the subthema write's own validation.

### [MINOR] 2. The E7-06 retention text names removal triggers no route can pull
- **Article/FR:** Art. VI.6, VI.2.
- **Where:** `backlog/E7-niet-functioneel.md` (the E6-02 slice 1 carry-forward); the comment in the new schooljaar test in `RechtenEndpointsTests.cs` ("the way a real delete would take them").
- **Problem:** the cascades are real, but no route deletes a gebruiker or a schooljaar (no `HttpDelete` on either controller; only the klas delete exists, `KlasBeheerService.cs:239`). A reader of the register would think a departing teacher's rows can be removed today.
- **Required fix:** say that no route removes a gebruiker or a schooljaar yet, so these rows are kept indefinitely until one exists; correct the test comment to "a future delete".

### [MINOR] 3. The ADR index still presents ADR-0022's seam as a no-op
- **Where:** `docs/adr/README.md:38` and `:88` (present tense: "is deliberately a no-op until E6-02 binds it").
- **Required fix:** mirror the ADR-0022 pointer in both places, in the past tense (bound to the directie row by E6-02 slice 1, 2026-09-14).

### [MINOR] 4. E7-11 says `RechtenEndpointsTests` covers every Op.stap route; it covers two of seven endpoints
- **Where:** the new annotation in `backlog/E7-niet-functioneel.md` (wording from round 1, `antagonist.md:335`).
- **Problem:** all four Op.stap controllers carry the attribute (`OpstapImportController.cs:55`, `OpstapImportStandController.cs:19`, `OpstapMinimumdoelenImportController.cs:32`, `OpstapLeerplandoelenImportController.cs:30`), but the tests request only `POST /api/opstap-import` and `GET /api/opstap-import/stand`, and there is no reflection guard.
- **Required fix:** narrow the sentence, or add a reflection test that every controller under `api/opstap-import` names the `Curriculumbeheer` policy.

### [MINOR] 5. The R25 carry-forward sits under a story that will close, not where its trigger fires
- **Where:** `ef6468b` (under E6-02); `backlog/E8-fast-follow.md:27-28` (E8-07, no pointer); `Application/Toegang/Rechtenbronnen.cs:67-70` (points to "the E6-02 worklog").
- **Problem:** the premises hold (activiteit links only `Manueel`; `Voorgesteld` only on thema doelsuggesties; the import writes only themadoel and subdoel links; the reading lives in one expression, `EfRechtenbronnen.cs:36`), but E8-07, the story that trips it, says nothing, and the code doc points to a worklog.
- **Required fix:** a one-line pointer on E8-07; point the `HeeftDoelkoppelingen` doc at the carry-forward.

**Checks run:** every `Schoolklok` caller updated, label and conversion read the same zone, DI lifetimes fine, one warning per process via `Interlocked.Exchange`, comment now true; `UitInvoer`'s accept set proved equal to `VereisLeeftijd`'s by case analysis; the ADR-0022 pointer verified line by line; unit tests filtered to `Toegang` and `ClosedXmlDekkingExport` 217 passed; `dotnet format --verify-no-changes` exit 0. Worklog nit: `LeeftijdsinhoudTests` has 12 cases, not 11. Art. II–VIII: nothing new.
