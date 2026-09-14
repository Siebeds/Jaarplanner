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

## Code slice 1 — audit round 3

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 4 MINOR, 0 QUESTION)
**Scope audited:** `git diff 138a605 bdb6683` (13 files: `f75fb15` code, `bdb6683` docs), plus every caller of `WatIsErMisMet`/`IsBekend`/`LeesLeeftijd`, the subthema write path, the four Op.stap controllers, the delete routes, `ActiviteitenController`, `EfRechtenbronnen`, ADR-0022's status block and `ef6468b`.

| Round 2 | Status |
| --- | --- |
| MINOR 1 `UitInvoer` / `VereisLeeftijd` | Resolved: one predicate, tested through the real service. Doc residue: A and B. |
| MINOR 2 E7-06 removal triggers | Resolved; every claim verified. |
| MINOR 3 ADR index tense | Resolved in tense; overstates how long the no-op lasted (C). |
| MINOR 4 E7-11 coverage | Resolved. *Self-correction:* `Elke_opstap_importroute_zit_achter_het_curriculumbeheerbeleid` already pinned the policy on all seven endpoints via endpoint metadata; the real defect was the status-code claim. |
| MINOR 5 R25 pointer | Resolved, subject to the merge condition below; one word false today (D). |

### [MINOR] A. `UitInvoer` offers "let the write refuse it", and the new test names the wrong consequence of a drift
- **Where:** `Application/Toegang/Rechtenbronnen.cs:50-53` (`<returns>` of `UitInvoer`); `UnitTests/Schoolcontent/SubthemaLeeftijdInvoerTests.cs:9-14`.
- **Problem:** deferring to the write is safe only because the write refuses exactly the inputs `UitInvoer` maps to null (same function). If the rights check refused what the write accepts, a caller that defers to the write would run it with **no rights check at all** (fail open), not refuse a hoofdleerkracht. No behaviour is wrong today, but slice 3 reads this doc and test.
- **Required fix:** say in the `<returns>` that deferring is safe only because the write refuses exactly these inputs (same function, pinned by `SubthemaLeeftijdInvoerTests`); state the real stakes in the test summary. Slice 3's review checks that every body leeftijd reaches a rights check or a refusal.

### [MINOR] B. `LeesLeeftijd` calls itself "the one rule" for a leeftijd from outside the database; the FR-1 import keeps its own copy
- **Where:** `Domain/Curriculum/Jaarfasen.cs:95-105`; `Infrastructure/SchoolcontentImport/SchoolcontentImportService.cs:291, :936-937`; `Domain/Toegang/Hoofdleerkrachtaanstelling.cs:37`.
- **Problem:** the import tests the leeftijd inline with `IsBekend(...Trim())`; the doc also omits the hoofdleerkracht appointment among `WatIsErMisMet`'s callers. No rights consequence (the import is gated as a whole, R27).
- **Required fix:** narrow the headline to a request-body leeftijd and name the import's copy, or route both import sites through `LeesLeeftijd`; either way name the appointment among `WatIsErMisMet`'s callers.

### [MINOR] C. The ADR index says ADR-0022's seam was a no-op until 2026-09-14; it refused anonymous requests from 2026-09-11
- **Where:** `docs/adr/README.md:88` (and the same phrase at `:38`).
- **Problem:** ADR-0031 made the policy require a session on 2026-09-11 (ADR-0022 status line; `CurriculumbeheerAutorisatieTests.cs:16-18`). The paragraph also still lists ADR-0022 among ADRs that depend on an unresolved Art. XIV decision, which the Art. VI.1 ratification of 2026-09-14 settled.
- **Required fix:** write the two steps in both places: a no-op until E6-01 made it require a session (ADR-0031, 2026-09-11), and E6-02 slice 1 bound it to the directie row (2026-09-14).

### [MINOR] D. The E8-07 pointer says "today" a `geweigerd`/`voorgesteld` link blocks the maker's delete; no route enforces that row today
- **Where:** `backlog/E8-fast-follow.md:29`; `Infrastructure/Toegang/EfRechtenbronnen.cs:38`; `Api/Controllers/ActiviteitenController.cs:12-23`.
- **Problem:** `DELETE api/activiteiten/{id}` carries no policy yet; any signed-in gebruiker can delete any activiteit until slice 3 applies `ActiviteitVerwijderen`.
- **Required fix:** describe the declared rule: the delete row as declared in slice 1 counts every link, so once slice 3 applies it, such a link withholds the maker's delete.

### Merge condition (not a finding)
The two pointers name the R25 carry-forward, which is `ef6468b` on `feature/e6-rollen-rechten` only. They resolve if this branch merges back through that branch, or if `ef6468b` reaches `main` no later than this branch.

### Non-blocking nits
- `VereisLeeftijd` has two `<summary>` elements plus an older unattached "Verifies the klas exists" summary above them (`SchoolcontentBeheerService.cs:893-905`).
- `WatIsErMisMet`'s doc block (`Jaarfasen.cs:134-157`) is separated from it by a blank line, so it attaches to `LeerjaarVoor`.
- E7-11 (`E7-niet-functioneel.md:117`): 403 is pinned on both routes; 400 and 401 on the `POST` only.
- `SubthemaLeeftijdInvoerTests` is a tripwire against un-sharing the function, not a proof over all inputs.
- `RechtenEndpointsTests.cs:223-224`: "will" should be "may" for E6-03's future delete.

**Checks run:** each rewritten predicate proved equivalent (`VereisLeeftijd`, `WatIsErMisMet`, `UitInvoer`); no sentence, status, stored form, `nl.json`, controller or migration changed; reflection plus metadata test together cover all seven endpoints; E7-06 text verified; R25 premises hold. Run: `dotnet build` 0/0; filtered unit tests 303 passed; `CurriculumbeheerAutorisatieTests` 5 passed; `dotnet format --verify-no-changes` exit 0.

## Code slice 1 — audit round 4

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** COMPLIANT (0 CRITICAL, 0 MAJOR, 0 MINOR, 0 QUESTION; two non-blocking nits)
**Scope audited:** `git diff 5245dbe 464e47a` (`464e47a`, 9 files), plus every site the new comments describe: the callers of `LeesLeeftijd`/`WatIsErMisMet`, `SchoolcontentImportService.cs:291, :937`, `Subthema.Require`, `Rechtenmatrix` (delete and import rows), `EfRechtenbronnen`, `ActiviteitenController`, `SchoolcontentImportController`, the `RechtenEndpointsTests` assertions, ADR-0022/0031 status lines, the ratification log and Art. XIV.

| Round 3 | Status |
| --- | --- |
| MINOR A `UitInvoer` / test stakes | Resolved: `<returns>` states why deferring is safe and what drift costs (fail open); the test calls itself a tripwire. |
| MINOR B `LeesLeeftijd` headline | Resolved: callers enumerated correctly (incl. `Hoofdleerkrachtaanstelling`); the import's two inline copies named accurately, same set today. |
| MINOR C ADR index | Resolved in both places: no-op → session (ADR-0031, 2026-09-11) → directie row (2026-09-14); Art. XIV no longer carries the question. |
| MINOR D E8-07 "today" | Resolved: describes the declared row (`MakerZonderKoppelingen`, `Doelkoppelingen.Any()`), conditional on slice 3 applying it. |
| Nits (5) | All resolved: one `VereisLeeftijd` summary; `WatIsErMisMet` doc reattached; E7-11 pins match `RechtenEndpointsTests.cs:120-143`; "may"; tripwire. |

### Non-blocking nits
- `LeesLeeftijd`'s headline ("the rule for a leeftijd in a request body") is slightly wider than its callers: the wizard's step-6 `SubthemaOpbouwContext.Leeftijd` is a body leeftijd with no validation. Harmless today: it is advisory, not stored, and gated at route level. Slice 3's wizard-only write actions (I22) must route their leeftijd through `LeesLeeftijd`. *(The orchestrator passed this to the slice-3 implementer while it was building.)*
- "the import is gated as a whole (ADR-0030 R27)" describes the declared gate: `SchoolcontentImportController` carries no policy on this branch (session fallback only). `SchoolcontentImporteren` lands in slice 3. The load-bearing clause (no per-leeftijd rights check depends on the import's copy) is true either way. The phrasing was the antagonist's own round-3 wording.

### Merge condition (not a finding)
Met: `ef6468b` is on `feature/e6-rollen-rechten`, not on `main`. It holds only if this branch merges back through that branch.

**Checks run:** a diff filter found no changed `.cs` line that is neither comment nor blank; no `nl.json`, frontend, controller, policy, model or migration changed. Run: `dotnet build` 0/0; `dotnet format --verify-no-changes` exit 0; UnitTests 1340 passed, 4 skipped; `RechtenEndpointsTests` + `CurriculumbeheerAutorisatieTests` 5 passed. The 16 Postgres cases were not re-run (no local credential available to the auditor); immaterial, as their only change is one word in a comment and the suite compiles.

*Orchestrator's note on the test gate for fix round 3:* no test-runner round was run on `464e47a`, because the change is comment- and doc-only (verified by the diff filter above); the implementer ran the full unit suite (1340 passed) and the two touched integration suites (21 passed), and the build and format gates are green.
## Code slice 3 — audit round 1

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 2 MAJOR, 5 MINOR, 3 QUESTION)
**Scope audited:** `git diff 0073bd7 d85c0a5` on `story/E6-02-afdwingen` (40 files, migration `20260914114237_Wizardrun` included) and the "Code slice 3" worklog section; Art. IV, VI, IX.2 and X read fresh, plus ADR-0030 §2–§4 and the E6-02 story. *Correction to the brief:* I24/I25 are in this branch's base (`15a044c` is an ancestor of `0073bd7`).

### [MAJOR] A. `DELETE api/themas/{id}` lets a themabeheer holder delete, by hand, content the ratified text reserves to directie and the hoofdleerkrachten
- **Article/FR:** Art. VI.1 (R4, R5/R21, R19, R24, R25, R35); ADR-0030 §3 footnote ⁵.
- **Where:** `Api/Controllers/ThemasController.cs` (`[HttpDelete("{themaId:guid}")]`, now `[Authorize(Policy = ThemaBewerken)]`); `Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs:189-226` (cascade to themadoelen, subthema's, subdoelen, activiteiten and their goal links; refuses only a planned or scheduled thema).
- **Problem:** themabeheer alone deletes an unplanned thema with a hoofdleerkracht's subthema's and subdoelen, `Manueel`-linked activiteiten and others' activiteiten, at every leeftijd. Art. VI.1: "By hand, subdoelen, goal links and deleting any other activiteit are for directie and that jaarfase's hoofdleerkrachten only … The only exceptions are themabeheer's: the FR-1 import, and the wizard for a thema it builds from scratch." R35 withholds even the import switch that removes decided subdoelen. §3 has no thema-delete row; reading R4's "aanpassen" as the whole lifecycle cannot override the "only exceptions" sentence.
- **Required fix:** fail closed until Q1 is ruled (themabeheer deletes only a thema with no content beyond its own open run's items, otherwise directie); tests for TB on a thema with an HL's subthema (403), TB on an empty thema (204), directie (204).

### [MAJOR] B. The wizard's edit and delete reach content its run did not create; I25's "and nothing else" is applied to one path only
- **Article/FR:** Art. VI.1 (R19, R25; I13, I19, I25); Art. IX.2.
- **Where:** `Infrastructure/SchoolcontentBeheer/WizardrunService.cs:91-108` (`WijzigSubthemaAsync`), `:110-139` (`VerwijderSubthemaAsync`, ids only), `:217-231` (`VerwijderActiviteitAsync`, no link guard).
- **Problem:** (1) a themabeheer holder re-scopes a run-created subthema that meanwhile holds a leerkracht's activiteit or an HL's goal links, carrying them to another leeftijd without I13/I19; (2) the wizard deletes a run-created activiteit an HL has since linked, and the `Manueel` link goes with it (R19, R25); (3) the subthema delete passes when every activiteit under it is run-created, even if linked since.
- **Required fix:** refuse a leeftijd change of a run-created subthema while it holds a subdoel or activiteit the run did not create; require `DoelenKoppelen` at that leeftijd for a wizard delete that would take a goal link (mirroring `WizardrunsController.MaakActiviteit`); a test per path. Or the owner rules Q2 (b) and I25's text records it.

### [MINOR] C. A run-created activiteit moved out of the run's thema stays editable and deletable through the wizard
- **Where:** `WizardrunService.cs:198-231` (`VereisEigen` checks list membership only).
- **Required fix:** also run `VereisSubthemaVanRunAsync` on the activiteit's current subthema in edit and delete.

### [MINOR] D. The sweep accepts any 403
- **Where:** `IntegrationTests/Postgres/ElkeWijzigendeRouteVraagtEenRechtTests.cs:104`.
- **Problem:** with `[Authorize(Policy = Wizardinhoud)]` removed from `DELETE …/wizardruns/{runId}/subthemas/{subthemaId}` or `…/activiteiten/{activiteitId}`, a no-rights caller still gets 403 from `WizardrunWeigering`. Otherwise the enumeration is sound.
- **Required fix:** assert the authorisation detail ("Je hebt geen toegang tot deze actie.", `Aanmelding.cs:168`), not just the status.

### [MINOR] E. Server-composed Dutch: sentences without a value guard, one presupposing a fact
- **Where:** `WizardrunService.cs:29, :31, :129-131`; `WizardrunEndpointsTests.cs`.
- **Problem:** "Dit subthema hoort niet bij het thema van deze wizard.", the foreign-content sentence and "Deze wizard bestaat niet meer." are not checked by value; "bestaat niet meer" answers an id that never existed (E5-03 rule).
- **Required fix:** assert each wizard sentence in full with a no-em-dash check; reword to e.g. "Deze wizard is niet gevonden."

### [MINOR] F. The run's starter is staff personal data with no route to the processing register
- **Where:** `wizardruns.GestartDoorId` (migration, `WizardrunConfiguration.cs`), exposed on `GET /api/thema-opbouw/wizardruns/{runId}`.
- **Required fix:** an E7-06 carry-forward naming it, SetNull on removal as its retention rule.

### [MINOR] G. Stale docs this slice made false
- `Api/Controllers/DekkingController.cs:27-31, :178-181` ("Unauthenticated … blocked on E6-01/E6-02"); E6 epic `:97` ("`POST /api/schooljaren` has no role check"); the E2/E3-01/E3-07 carry-forwards (`:85-87`) now met; E7-11 (`:110`) at E6-02's close; ADR-0030 §3 notes (`Wizardinhoud` + run state in `IWizardrunService`; R19 asked on create with goal codes on both routes; the `[RechtOp]` pattern). Orchestrator's edits; no ruling needed.

### [QUESTION] Q1. What shape should deleting a thema take? (a) directie only; (b) themabeheer only when the thema holds nothing beyond its own open run's items, otherwise directie (the fail-closed interim); (c) themabeheer plus `SubthemaBeheren` at every leeftijd the thema has subthema's in; (d) R4 includes the delete with its cascade, by amendment.
### [QUESTION] Q2. May the wizard remove goal links a hoofdleerkracht added? (a) no: a wizard delete that would take a link needs `DoelenKoppelen`; (b) yes: the literal I25, recorded in its text.
### [QUESTION] Q3. Should a thema or themadoel edit during an open run move its 14-day window? (a) keep as built (only the wizard's own routes count); (b) E6-05 adds wizard routes for those steps that count; (c) any ThemaBewerken write on a thema with an open run counts.

### Judged compliant (summary of checks run)
The `[RechtOp]` filter (fails closed on a missing/unparseable route value or unknown `Rechtbron`; before model binding; 404 before 403 acceptable under I9); body leeftijden through `UitInvoer` (create, I13 at both leeftijden, both wizard inputs); R35 on preview and apply; mappings (b) goal codes on create need R19 and (c) fiche links under klas planning; wizard readings: any themabeheer holder continues a run, directie bound by the run rules on wizard routes, strict subthema delete; the 14-day window via `TimeProvider`; I22 on the ordinary routes; klas scoping of child ids (`EfJaarplanOpslag`, `EfWeekplanningOpslag`, `HoekplaatsingService:89`, `AlgemeneFicheplaatsingService:70`, `HoekBeheerService.NeemOver`); the move's same-leeftijd invariant (`Subthema.cs:156`); the two re-seeded slice-1 tests. Art. II, III, IV, V, VIII, IX: compliant (Dutch identifiers, English comments; no mutation of goals; doelsuggesties gated per R14; dekking untouched; no new package; `Wizardrun` is bookkeeping with sound cascades). 79 attribute-routed writes, 78 excluding the anonymous `afmelden`, each matched to a row. Not re-run by the antagonist: build, format, tests.

### What slice 4 must hide (in addition to the worklog's list)
The thema delete control per Q1; the subthema form's leeftijd select (I13); the Doelen header's "Inladen" button; the agenda's activiteit-create path with its goal picker; `makerId` on the frontend `ActiviteitWeergave`; a Dutch message for a stale 403.

## Code slice 3 — audit round 2

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 3 MINOR, 1 QUESTION)
**Scope audited:** `git diff d85c0a5 afe46bc` on `story/E6-02-afdwingen` (24 files) plus the slice code it touches (`RechtOpAttribute`, `Rechtenbeleid`, `WizardrunsController`, `SubthemasController`, `WizardrunConfiguration`, `ThemaConfiguration`/`JaarplanConfiguration`, `CsrfHeaderControle`, `TestAuthenticatie`, the sweep); Art. VI.1 read fresh from `feature/e6-rollen-rechten` HEAD (I26–I28, `2dd26a0`), ADR-0030 §2 rows I26–I28 and §3 with footnotes.

**Round 1 resolved:** A (I26: `ThemaVerwijderen`, `Themabron`, open-run items only; tests TB 403/204, directie 204, after-run TB 403), B (I27: re-scope, activiteit delete, subthema delete, each allowed/refused), C (current thema checked via `LaadActiviteitplekAsync`), D/D1 (sweep asserts the authorisation detail; wizard item routes get the run's own items; the CSRF 403 no longer counts), D2 (nullable leeftijd, its own Dutch sentence, tests on all four routes), E (sentences in full, "Deze wizard is niet gevonden."), F (E7-06 carry-forward matches the SetNull FK and the cascade), G code half. I28 as built (only `WizardrunService` calls `Registreer*`).

### [MINOR] 1. `ThemaVerwijderen` cites R4
- **Where:** `Application/Toegang/Rechtenmatrix.cs:73-83` (doc and label "(R4; I26)").
- **Problem:** round 1 held that R4's *aanpassen* does not reach the delete; under Art. VI.1's column-level citation rule the TB column would read as ratified. The orchestrator's §3 row would copy it.
- **Required fix:** cite "(R3; I26)" and say the TB column is a default.

### [MINOR] 2. Docs made false or incomplete by I27 and C
- `Rechtenmatrix.cs:22-28` ("is state, not a relation … so `IWizardrunService` enforces it"; the service now also asks `DoelenKoppelen`); `:9-16` (no `Themabron`; resource rows defined as those with an HL, LK or maker column); the `Wizardinhoud` row `:101-109` cites I22–I25 although I27 narrows it.
- `Api/Controllers/WizardrunsController.cs:11-28` (Rights, Order of answers: the two new 403s missing); action summaries `:70` ("its leeftijd included (I25)"), `:80`, `:142` cite only I25.
- **Required fix:** align with `IWizardrunService.cs`.

### [MINOR] 3. `ActiviteitMetDoelen` "verwijdert ze niet" reads as the goals
- **Where:** `Infrastructure/SchoolcontentBeheer/WizardrunService.cs:53`.
- **Required fix:** "… dus de wizard verwijdert deze activiteit niet."; update the constant in `WizardrunEndpointsTests`.

### [QUESTION] Q4. An HL's goal link on a run-created activiteit still leaves with a TB thema delete (I26) or a wizard re-scope (I27 second half)
- **Where:** `Infrastructure/Toegang/EfRechtenbronnen.cs:58-81` (counts ids, not links); `WizardrunService.cs:137-143` (re-scope counts only non-run items).
- Both are literal readings; I27's first half closes the same case for the wizard's own delete. The gap is in round 1's option (b) text, not a build error.
- **Asked:** (a) extend I26 and I27's second half with I27's `DoelenKoppelen` guard (conservative, R19); (b) keep the literal text. The same reading lets a leerkracht's content edits (R23) on run-created activiteiten leave with the delete, which the text allows and needs no ask.

### Judged
- **I26 reading** (the thema's run, which any TB continues): correct; grammar, round 1's option text and the unique `ThemaId` index support it.
- **The row:** declared once (`Rechtenmatrix.Rijen`, registered by `Rechtenbeleid.cs:30-35`), one evaluator branch, fails closed without a `Themabron`; consistent with §3's resource pattern apart from MINOR 1.
- **D2 exception:** acceptable (same order as round 1's accepted `""`/`3K`; reveals nothing stored; the sweep keeps the route covered through `Lichamen`).
- **I27 in the service:** fails closed (a null caller gets `Rechten.Geen`); the same `IRechtenService` and `StaatToe(DoelenKoppelen, Leeftijdsinhoud)` as `MatrixHandler` (`Rechtenbeleid.cs:89-91`).
- **Test sign-in 403 body:** weakens nothing; no test relied on an empty body; production forbids through the cookie's `OnRedirectToAccessDenied` with the same writer (proved by reading, not by a test on the real cookie).

### Non-blocking nits
- `WizardrunService.cs:22` overstates what READ COMMITTED guarantees; the I26 check runs in the filter, outside the service transaction (the same race round 1 accepted for the maker-delete row).
- No test pins I28 (an ordinary thema/themadoel edit leaves `LaatsteSchrijfactieOp` unchanged).
- The filter's thema 404 "Dit thema bestaat niet meer. Iemand anders heeft het verwijderd." carries round-1 E's presupposition, copied from the service (`SchoolcontentBeheerService.cs:154, :839`); if the E5-03 rule is applied, apply it to all item 404s together.
- `Geen_zin_van_de_wizard_draagt_een_em_dash` checks the test's own constants.

**Checks run:** by reading (build, format, tests and probes not re-run by the antagonist). Art. II, III, IV, V, VI.2, VII, VIII, IX, XIV compliant.

## Code slice 3 — audit round 3

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 1 MINOR, 1 QUESTION)
**Scope audited:** `git diff afe46bc e83a875` on `story/E6-02-afdwingen` (12 files) plus `WizardrunService` in full, `EfRechtenbronnen.VoorThemaAsync`, `Rechtenmatrix.StaatToe` and the `DoelenKoppelen` row, `IWizardrunService`, the `WizardrunsController` wizard create with `LeerplandoelCodes`, and the ordinary I13 test. Art. VI.1 read fresh from `feature/e6-rollen-rechten` HEAD (`20bad17`, I26/I27 narrowed by Q4 (a)), ADR-0030 §1 R3, §2 I26/I27, and the §3 column rule.

**Round 2 resolved:** MINOR 1 (R3 is "Directie sees and edits everything", ADR-0030:170, and every directie ✓ rests on it, :605; the doc marks the TB column as a default under R37). MINOR 2 (class doc names `Themabron` and both ways of applying a resource row; the wizard paragraph reads "state plus one relation"; `Wizardinhoud` cites through I27; controller Rights has four items; "Order of answers" matches the code order; summaries cite I27 and Q4). MINOR 3 (service and test constant identical; the em-dash test includes `GekoppeldVerhuist`). Test gaps (planned-thema TB 400 after the filter passes; the subthema and activiteit still exist after the refused delete; I28 pinned on the stored `LaatsteSchrijfactieOp`). The READ COMMITTED sentence is true: the transaction opens before the check (`:137`, `:176`, `:289`), the check runs just before the write, uses the server default isolation, and takes no row locks.

### [MINOR] 1. The old-leeftijd half of the Q4 re-scope check is untested
- **Where:** `WizardrunService.cs:157`; `WizardrunEndpointsTests` `…verhuist_alleen_mee_voor_wie_op_beide_leeftijden_mag_koppelen_Q4`.
- **Problem:** the four cases (TB 403, TB+HL(K3) 403, same-leeftijd 200, TB+HL(K3,K2) 200) all pass with `MagDoelenKoppelenAsync(gebruikerId, huidig.Leeftijd, …)` deleted, and that is the condition the ratified text asks for ("at its leeftijd"). The ordinary I13 test covers both ends (`RechtenAfdwingingTests.cs:189-190`).
- **Required fix:** TB+HL(K2 only) re-scoping K3 to K2 gets 403 `GekoppeldVerhuist`, and the leeftijd stays K3.

### [QUESTION] Q5. The re-scope asks the goal-link right at both leeftijden; I27 says "at its leeftijd"
- **Judged acceptable:** "its leeftijd" is ambiguous for a two-leeftijd action. Taking the link out of the old leeftijd's dekking is an unlink there, and putting it into the new one's is a link there. R19's stated reason covers both, and I13 and I19 apply the same reasoning to moves. The wizard exception is already read as not covering activity links (the wizard create with codes requires `DoelenKoppelen`, `WizardrunsController.cs:135-141`). It withholds only TB+HL(K3) moving a linked subthema to K2, which only the literal default grants.
- **Asked:** the owner confirms, and I27 (Art. VI.1, FA A.11, ADR-0030 §2) gains "at both leeftijden when the leeftijd changes" at the next amendment. If the owner means the old leeftijd only, drop one condition, knowing such a caller then carries an HL's link into K2's dekking without K2's right.

### Judged
- **Thema delete (Q4 in I26):** matches. The resolver reports only the open run's own linked activiteiten, since anyone else's content already sets `HeeftAndermansInhoud` (`EfRechtenbronnen.cs:86-96`). After the run ends, everything counts as someone else's. `StaatToe:249-252` requires `DoelenKoppelen` per leeftijd through the one evaluator, which for anyone but directie reaches only `IsHoofdleerkrachtVan`, so (c) holds. A missing `Themabron` fails. Tests: TB 403, directie 204, TB+HL(K3) 204; the unit test adds another leeftijd, two leeftijden, and HL without TB.
- **Wizard re-scope:** otherwise correct. It runs after the other-people's-content check and has its own true sentence (E5-03). It counts any link. A null caller gets `Rechten.Geen`, so it fails closed.

### Non-blocking nits
- `Themabron.GekoppeldeLeeftijden = null` counts as "none" (`Rechtenbronnen.cs:110`). No reachable path fails open, since the only producer, `EfRechtenbronnen.cs:98`, supplies it; making it required would make a future producer a compile error rather than a silent allow.
- `IWizardrunService.cs:18-19`, `WizardrunService.cs:16` and the `WizardrunWeigering` doc name deletes and "someone else's work", but not the Q4 leeftijd-change-with-link case. Incomplete, not false; the method docs and the controller are exact.
- The `Wizardinhoud` range "I22–I27" includes I26. The `ThemaVerwijderen` label's "het" reads as the thema; `Matrixrij.Actie` is read by no code.

**Checks run:** by reading (build, format and tests not re-run by the antagonist). Art. II, III, IV, V, VI.2, VI.4, VII, VIII, IX, XIV compliant; scope within E6-02.

## Code slice 3 — audit round 4

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 1 MINOR, 0 QUESTION)
**Scope audited:** `git diff e83a875 08c10a2` on `story/E6-02-afdwingen` (8 backend files, 3 worklogs), plus the re-scope path in `WizardrunService`, `EfRechtenbronnen.VoorThemaAsync`, and `RechtenTestOpzet.VerwachtAsync`. Art. VI.1 I27 read fresh from `feature/e6-rollen-rechten` HEAD (`8c95c57`, the Q5 clarification) with its ratification-log entry.

**Round 3 resolved:**
- MINOR 1: themabeheer + HL(K2 only) K3→K2 → 403 `GekoppeldVerhuist` (`WizardrunEndpointsTests.cs:242,259`), K3 kept (`:263-266`). `GekoppeldVerhuist` is thrown only at `WizardrunService.cs:161`. The K2 right is real: `beide` gets 200 at `:268`, and the mutation proof reports 200 for this case (probe not re-run).
- Q5: closed. I27 says "at both the old and the new leeftijd", and `:158-159` asks both.
- Nits: `Themabron.GekoppeldeLeeftijden` required (the only producer, `EfRechtenbronnen.cs:98`, passes a list; leaving it out is a compile error; an explicit null warns and then throws in `StaatToe`, failing closed); the class docs name the leeftijd-change-with-link case and keep its condition; "I22–I25, I27" cited; the `ThemaVerwijderen` label names the thema (`Matrixrij.Actie` is read by no code); the planned-thema 400 pinned by exact value, equal to `SchoolcontentBeheerService.cs:202-203`.

### [MINOR] 1. Two docs drop the goal-link condition from the re-scope rule
- **Where:** `Rechtenmatrix.cs:28-31` (class doc), `:112-116` (`Wizardinhoud` doc).
- **Problem:** both now say a wizard leeftijd change needs `DoelenKoppelen` "at both the old and the new leeftijd" without condition. The code asks it only while an activiteit under the subthema carries a goal link (`WizardrunService.cs:157`); a themabeheer-only re-scope of an unlinked run subthema is pinned at 200 (`WizardrunEndpointsTests.cs:84,103-105`). I27's sentence refers to "that right" of the linked-activiteit sentence before it. Round 3's wording was exact; this round dropped the condition. It fails closed if followed.
- **Required fix:** restore the condition ("…changes the leeftijd of a subthema whose activiteiten carry a goal link…"), or an owner waiver.

**Checks run:** `dotnet build` 0/0 at `08c10a2`, `Toegang` unit tests 209/209, format exit 0, tree clean. Integration tests not re-run (no `JAARPLANNER_TEST_POSTGRES` in the antagonist's shell). Art. II, III, IV, V, VI.4, VI.7, VII, VIII, IX, XIV compliant; VI.1 compliant in code; scope within E6-02.

Last fix round: the MINOR goes to the owner to fix or waive.

## Code slice 3 — audit round 5

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** COMPLIANT (0 CRITICAL, 0 MAJOR, 0 MINOR, 0 QUESTION)
**Scope audited:** `git diff 08c10a2 eaf12e7` on `story/E6-02-afdwingen` (the owner-approved doc-comment fix after round 4; `Rechtenmatrix.cs` plus 3 worklogs). Art. VI.1 I27 read at `feature/e6-rollen-rechten` HEAD, whose last `CONSTITUTION.md` change is still `8c95c57`.

**Round 4 resolved:**
- MINOR 1: the class doc (`Rechtenmatrix.cs:28-33`) and the `Wizardinhoud` doc (`:112-117`) now limit the both-leeftijden rule to "a subthema whose activiteiten carry a goal link". This matches `WizardrunService.cs:157-159` (any linked activiteit under the subthema; right asked at `huidig.Leeftijd` and at `nieuw`, only on a real change, `:145-146`, after the others'-content refusal, `:149`) and I27's last sentence.

**No executable change:** 4 lines removed and 5 added, all `///`; 0 changed lines outside blank or comment lines; the word diff shows only prose and the `///` markers moved by rewrapping; `WizardrunService.cs` unchanged; the doc XML is well formed. The worklog additions are records only (the round-4 audit and test report, the mini-fix entry) and contain no secret or pupil data.

**Checks run:** by reading (build, format and tests not re-run by the antagonist; the implementer reports build 0/0, format exit 0, `Toegang` 209/209). Art. II, III, IV, V, VI.1, VI.4, VI.7, VII, VIII, IX, X, XIV compliant; scope within E6-02.

Slice 3's audit is closed: test-runner PASS (round 4, `08c10a2`; the round-5 change is comment-only) and antagonist COMPLIANT (round 5, `eaf12e7`).
## Code slice 2 — audit round 1

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 1 MAJOR, 5 MINOR, 1 QUESTION)
**Scope audited:** `git diff 0073bd7 224815f` on `story/E6-04-beheer` (23 files), the "Code slice 2 — E6-04 beheer" worklog section, and what the diff leans on (`Gebruiker`, `Leeftijdsrechten`, `Rechtenberekening`, `RechtenService`, `Rechtenmatrix`, `Jaarfasen`, the FKs to `gebruikers`, the exception-handler order in `Program.cs`, the 403 writer, `ApiError`, `useIk`, ADR-0031 decision 7, the E6-04 story, the E7-06 register, the slice-1 audit's notes for slice 2).

### [MAJOR] 1. The last-directie guard counts invitations nobody has used, so the school can still lose its last working directie
- **Article/FR:** Art. VI.1; ADR-0031 decision 7 (`0031-sessielogin-via-de-api.md:167-168`); the E6-04 *Done when*; `Gebruiker.cs:91-92` ("a school without directie could never administer itself again").
- **Where:** `Infrastructure/Toegang/GebruikerBeheerService.cs:250-256` (`SELECT "Id" FROM gebruikers WHERE "IsDirectie" … FOR UPDATE` counts every directie row, bound or not; used at `:126`, `:163`); `frontend/src/features/instellingen/Rechtenblad.tsx:90-96` (the Directie box is offered for every gebruiker, including an unbound invitation and the signed-in directie).
- **Problem:** in four clicks a directie invites a typo UPN, ticks Directie on it, opens their own sheet and unticks their own Directie; `anderen` is 1, so the server allows it. The only directie left is an invitation nobody can use, and because gebruikers exist the bootstrap does not reopen. If the tenant later hands out that UPN, its holder becomes directie at first login (ADR-0031 decision 3's residual risk, with the directie right). No UPN edit makes it worse. The letter of decision 7 holds; its purpose does not.
- **Required fix:** count only **bound** directieleden other than the target (`"IsDirectie" AND "EntraObjectId" IS NOT NULL`), keeping the lock and id order; refuse in Dutch saying why, pinned by value; Postgres tests for "refused while only an unbound directie invitation remains" and "allowed once a second bound directie exists". *Waivable only by an owner ruling that an unused invitation counts as a directie.*

### [MINOR] 2. The E7-06 register now says something this slice made false
- **Where:** `backlog/E7-niet-functioneel.md:74` ("No route removes a gebruiker … yet").
- **Problem:** `DELETE /api/gebruikers/{id}` now exists and erases the gebruiker row (naam, UPN, Entra ids, themabeheer flag), cascades klastoewijzingen and aanstellingen, and nulls `Activiteit.MakerId` (I17).
- **Required fix:** update the carry-forward: directie-only, manual removal, only while a directie remains; list what it erases and nulls; the schooljaar delete is still E6-03's; the list's readers are directie only.

### [MINOR] 3. The (c) sentence claims more than its render condition guarantees (the E5-03 rule)
- **Where:** `nl.json` `gebruikers.zonderHoofdleerkracht` ("Zonder hoofdleerkracht past alleen de directie de subthema's van die leeftijd aan."), rendered at `GebruikersScherm.tsx:298` under `:277`.
- **Problem:** leerkrachten of that leeftijd edit the streefwoordenschat (a subthema field), and under I25 the wizard edits run-created subthema's; "die leeftijd" has no single referent when several lines say "Geen hoofdleerkracht".
- **Required fix:** say less (e.g. "Zonder hoofdleerkracht beheert alleen de directie de subthema's en subdoelen van die leeftijd."), or put it on the line it is about; add a catalogue case if general enough.

### [MINOR] 4. Two server-composed Dutch sentences have no value guard, and one sentence is duplicated in dead code
- **Where:** `GebruikerBeheerService.cs:81` (naam length), `:381` (aanmeldnaam length), `:393` (dead `?? "Kies een leeftijd: …"` fallback duplicating `Jaarfasen.cs:193`).
- **Required fix:** pin both length sentences by value (no em dash) in `GebruikerbeheerEndpointsTests`; replace the dead fallback with `Jaarfasen.WatIsErMisMet(jaarfase)!` or the domain's own sentence.

### [MINOR] 5. Every box is disabled while one save runs, which probably throws keyboard focus out of the sheet (suspicion)
- **Where:** `Rechtenblad.tsx:43` (`bezig`) → `disabled={bezig}` on every `Vinkje` (`:94, :101, :126, :142` → `:189`); Radix `Dialog` (`components/ui/Blad.tsx:1`).
- **Problem:** a control that becomes disabled loses focus to `body`; Radix FocusScope restores focus on removal, not on disable. WCAG 2.4.3 / 2.1.1 in practice. Not verified in a browser.
- **Required fix:** a keyboard and screen-reader pass; if focus drops, keep the boxes focusable during a save (`aria-disabled` and ignore input, or disable only the others).

### [MINOR] 6. A delete that races a link still ends in a 500 where a 404 belongs
- **Where:** `GebruikerBeheerService.cs:181-192`, `:213-226`; `BewaarIdempotentAsync` (`:354-364`) catches only 23505.
- **Required fix:** map `PostgresErrorCodes.ForeignKeyViolation` (23503) to `GebruikerbeheerNietGevondenFout`.

### [QUESTION] 7. Taking away your own directie right happens on one tick, with no confirmation and no way back
- **Where:** `Rechtenblad.tsx:90-96`; `gebruikerbeheer.ts:89-92` (`ververs` invalidates `ik`, `Onderdeelpoort` redirects; the overview refetch may briefly show `gebruikers.laadMislukt`, false advice).
- **Asked:** should demoting yourself ask for confirmation, as removal does, and should either name the consequence for yourself? Either is buildable.

### Checks run (summary)
Art. VI.1: `Beheer` on the whole controller (`Kolom.Geen`, directie only); 403 tested on all twelve routes × five profiles, 401 on all twelve; the frontend only hides and fails closed while `ik` loads. The guard: a real transaction, `FOR UPDATE` in id order, re-read after the lock; the race test waits then refuses; mutual removal/demotion is safe under READ COMMITTED; no deadlock cycle. Art. VI.2/VI.4/VI.6: no pupil data, minimal payload (`isAangemeld` boolean, no Entra id), no secret, every FK to `gebruikers` cascade or SET NULL. Art. II: new strings in `nl.json`, no em dash; last-directie, duplicate UPN, bad UPN and unknown jaarfase sentences pinned by value. Exception handler maps only its own three fault types; 409 title Dutch. R20 reuses `Rechtenberekening.TeltNog`, `Leeftijdsrechten.VoorKlas`, `Schoolklok.Vandaag`. UI rules: never colour alone; accent only on two primary actions and the focus ring; E3-06 respected. Art. VIII/IX/XIV: no new dependency or migration; graadklas seam reused; I9 untouched. Run by the auditor: vitest on the instellingen features, `catalogus.test.ts`, `App.test.tsx` (50 passed); `pnpm lint` clean; `dotnet format --verify-no-changes` exit 0. Not run: the Postgres suite. Open point 1 (klas routes enforced only in slice 3) is inside the single delivery (R12); the new `KlassenScherm` comment saying "the server refuses them" is false at `224815f` and must not reach `main` ahead of slice 3.

## Code slice 2 — audit round 2

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool). Condensed in layout only.*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 5 MINOR, one a suspicion). MAJOR 1 is resolved.
**Scope audited:** `git diff 224815f 3e4ee04` (16 files), plus what the fix leans on: `Aanmelding.cs` (mode guard, session check), `ToegangService.cs` (binding), `Gebruiker`, the FKs to `gebruikers`, the rest of `GebruikerBeheerService`, the test factories, `onderdelen.ts`, `Bevestiging.tsx`, E7-06, and Art. VI.1 with I24–I28 (`2dd26a0`).

### [MINOR] 1. The (c) sentence still says "alleen de directie"
- **Where:** `nl.json:434` `gebruikers.zonderHoofdleerkracht`; rendered at `GebruikersScherm.tsx:308` (`zonder`, `:287`).
- **Problem:** (c) says only directie does **by hand** what a hoofdleerkracht would; the sentence drops "by hand". At such a leeftijd, themabeheer still creates subthema's and subdoelen through the wizard at any leeftijd, edits and deletes run-created ones (I25, narrowed by I27), deletes a thema holding only its own run's content (I26), and the FR-1 import writes subdoel goal links (R24, R27, R34). At `3e4ee04` no subthema or subdoel route carries a policy yet, so it must not reach `main` ahead of slice 3. It stays false after slice 3 anyway. The antagonist's round-1 wording carried the same over-claim.
- **Required fix:** say less, e.g. "Bij een leeftijd zonder hoofdleerkracht doet de directie wat een hoofdleerkracht zou doen."; make the catalogue case refuse an unqualified "alleen de directie".

### [MINOR] 2. The E7-06 paragraph says only a cascade ends these rows
- **Where:** `backlog/E7-niet-functioneel.md` retention paragraph: "Nothing ends them earlier." and "an aanstelling otherwise goes **only** with its gebruiker, …".
- **Problem:** both are false. `HaalKlasWegAsync` (`:214-221`) and `TrekAanstellingInAsync` (`:248-260`) hard-delete the row on an untick, and unticking themabeheer or directie clears the flag. The rest of the paragraph was verified true: the erased fields, "stops on the next request" (`ValideerSessieAsync`), the cascades, MakerId SET NULL, no other gebruiker delete, no schooljaar delete, directie-only list.
- **Required fix:** say that directie can also end each one by hand (an untick deletes the row, no history kept; the flags clear the same way); drop "Nothing ends them earlier" and the "only".

### [MINOR] 3. The fix's server sentences
- **Where:** `GebruikerBeheerService.cs:141`, `:180-181`, `:143`, `:183`, `:242`.
- **Problem:** (a) "Geef het directierecht eerst aan iemand anders." is no longer enough: giving it to an invitation leads to a second refusal. (b) "De anderen …" is plural when there may be only one other directie. (c) "De gebruiker of het schooljaar bestaat niet meer." is unpinned.
- **Required fix:** "… aan iemand anders die zich al heeft aangemeld."; "Wie verder het directierecht heeft, heeft zich nog niet aangemeld, …"; update the pinned tests; pin (c) by value.

### [MINOR] 4. Toggles and removing a non-directie that race a removal still give a 500
- **Where:** `GeefDirectierechtAsync` (`:122-128`), `GeefThemabeheerAsync` (`:155-161`), `NeemThemabeheerAfAsync` (`:163-169`), `VerwijderAsync` of a non-directie (`:171-193`).
- **Problem:** a tracked save that affects 0 rows throws `DbUpdateConcurrencyException`, which nothing maps. The same class as round-1 MINOR 6.
- **Required fix:** map it to `GebruikerbeheerNietGevondenFout` (or make a repeated delete an idempotent 204); add a deterministic test like the FK test.

### [MINOR, suspicion] 5. The fade may cover the active part in the middle positions
- **Where:** `Instellingenindeling.tsx:153-173`, `:201-212`.
- **Problem:** `speling` decides only whether a fade shows, not what the 32px fade covers. `scrollIntoView` "nearest" leaves the active part flush at an edge. For Algemene fiches (part 4 of 5) the right fade would sit over about 27px of the active label (1.4.3). Only parts 2 and 5 were measured.
- **Required fix:** measure parts 3 and 4 at 390px in a real browser; if they overlap, add `scroll-px-8` (scroll-padding-inline) to the `ul`. Optional: `rij.scrollTo({ left })` rather than `scrollIntoView`; a ResizeObserver for font swaps.

### Checks run (summary)
MAJOR 1: the flag's only writer is `Program.cs:69-70`, and no configuration binds it. `Modus` defaults to Entra, and `Ontwikkeling` outside Development throws at startup (`Aanmelding.cs:57-61`, `AanmeldModusTests` passed); an accidental Development deploy has only the loopback dev sign-in. The dev sign-in binds nobody, and a binding is never undone. `FOR UPDATE` covers every directie row and reads `IsGekoppeld` after the lock; a first login waits on it. The guard is a superset of ADR-0031 decision 7 and E6-04's Done-when. `PostConfigure` forcing false is sound: it keeps the Postgres wiring, the dev-rule test is deliberate, and the mapping `[Fact]` runs without Postgres. The second-branch sentence holds because the caller is a bound directie (race-only exception). Focus fix: mechanism correct; the Vitest pins it, but jsdom does not move focus off a disabled element, so the CDP pass is the evidence (not re-run). The FK test and the removal race test are deterministic and sound. QUESTION 7 copy checked against its conditions; the orchestrator's decision still goes to the owner. The fade adds no hue and is aria-hidden. Art. II, VI.2, VI.4, VIII and XIV are clean; the `KlassenScherm` comment is now true. Runs: vitest (instellingen, catalogue) 46 passed; `pnpm lint` exit 0; `dotnet format --verify-no-changes` exit 0. Postgres suite not run by the auditor: SASL authentication failed and the credentials are in a gitignored `.env`; relying on the implementer's 419 passed.

## Code slice 2 — audit round 3

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool).*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 1 MINOR). All five round-2 findings are resolved.
**Scope audited:** `git diff 3e4ee04 02394a3` (10 files), plus the rest of `GebruikerBeheerService.cs`, `gebruikerbeheer.ts`, `Rechtenblad.tsx`, `GebruikersScherm.tsx`, `Schermkop.tsx:48`, the QueryClient defaults in `App.tsx`, the logging configuration, and Art. VI.1 as it stands on `feature/e6-rollen-rechten` HEAD (I24–I28 with the Q4/Q5 clarifications).

### [MINOR] 1. After the new 404, the screen still shows the removed gebruiker
- **Where:** `gebruikerbeheer.ts:127-140`, `:143-158` (only `onSuccess`); `App.tsx:39-41` (`staleTime` 60 s, no refetch on focus); `GebruikersScherm.tsx:50`, `:129-135`; `Rechtenblad.tsx:101-105`; `GebruikerBeheerService.cs:458-459`.
- **Problem:** nothing refreshes the list after "Deze gebruiker is intussen verwijderd.", so the person stays listed with their rights next to an alert saying they are gone. After a toggle the sheet stays open with live boxes, and the next tick answers "Gebruiker <guid> is niet gevonden.", with a raw id shown to directie. The sheet is also reachable without a race (a second tab after a removal in the first), which is the path the fix's doc comment rests on.
- **Required fix:** on a 404 from a beheer write, refresh the overview or drop the gebruiker from the cache. The alert then has to live at list level, because the sheet closes. Optionally, reword the not-found sentence without the id. Or the owner waives it (race and two-tab edge).

### Checks run (summary)
- **MINOR 1 (the (c) sentence), resolved.** The new sentence is strictly weaker than (c) and true beside I22, I25–I27, R24/R27/R34 and the leerkracht rights. Its render condition `zonder` guarantees what it says. The catalogue refuses "alleen".
- **MINOR 2 (E7-06), resolved.** An untick deletes the row (`:215-222`, `:249-261`). Every klas and jaarfase stays tickable for a past year. "No history" holds: no audit table, no action log, `Microsoft.AspNetCore` at Warning, no sensitive-data logging.
- **MINOR 3 (server sentences), resolved.** (a) needs `Totaal == 0`. (b) can only be reached when the target is the bound caller under Entra, and not at all in Development. All are pinned, and the schooljaar FK sentence by value.
- **MINOR 4 (500 on a lost row), resolved.** No concurrency token exists, so zero rows means the row is gone. The tests cover three toggles plus the removal. DELETE directierecht serializes under `FOR UPDATE` and ends in the older not-found 404. The 404 is sound: it matches a request after the removal, and a 204 would claim a removal this request did not make.
- **MINOR 5 (the fade), resolved.** `scroll-px-9` leaves a 4 px gap, matching the table. The `02394a3` figures add up.
- **Font-load re-placement:** it neither steals focus nor scrolls the page. The header is sticky, so `block: "nearest"` never scrolls vertically; `lg:hidden` makes it a no-op on desktop; the `actueel` guard stops a stale call.
- **Art. II, VI.2, VI.4, VIII, XIV:** clean.
- **Runs:** vitest (instellingen, catalogue) 46 passed; `pnpm lint` exit 0; `dotnet format --verify-no-changes` exit 0; `GebruikerbeheerEndpointsTests` on the local Postgres 41 of 41 passed.
- **Not raised:** the doc comment at `GebruikersScherm.tsx:31` ("leaves its subthema's to directie") is (c)'s own framing, not an exclusivity claim.

## Code slice 2 — audit round 4

*Recorded by the orchestrator from the antagonist's final message (read-only role, no Write tool).*

**Verdict:** VIOLATIONS FOUND (0 CRITICAL, 0 MAJOR, 1 MINOR, 1 QUESTION). The round-3 MINOR and both test-runner items are resolved; the new sentences are true in every branch that renders them.
**Scope audited:** `git diff 02394a3 ef4d23c` (11 files), plus `GebruikerBeheerService.cs:60-488`, `gebruikerbeheer.ts`, `GebruikersScherm.tsx`, `Rechtenblad.tsx:1-115`, the font callback in `Instellingenindeling.tsx`, the query keys in `queries.ts`, and the defaults in `App.tsx`.

### [MINOR] 1. A comment this fix made false (E5-03 rule, which binds comments)
- **Where:** `GebruikersScherm.tsx:142-143`; secondary `:52-54`.
- **Problem:** the `verwijder.isError` comment says the alert sits under the list because "the row it is about is still on screen". Since this round a 404 on removal refetches the list (`gebruikerbeheer.ts:172`), so the row is gone. The alert's text stays true. Secondary: the `verdwenen` comment says "a write just answered 404", which its condition does not prove (a refetch after a successful tick can reveal the same removal).
- **Required fix:** cover the 409 and the 404 in `:142-143`, and phrase the 404 in `:52-54` as the usual path. Comments only.

### [QUESTION] 2. Raw ids in the klas and schooljaar not-found sentences (pre-existing, not introduced)
- **Where:** `GebruikerBeheerService.cs:208`, `:241`.
- **Problem:** the fix routes a klas or schooljaar 404 to the open sheet "with the server's sentence", and that sentence carries a GUID. The fix removed the id from the gebruiker sentence for that reason (`:471-473`). The FK-race siblings (`:216`, `:250`) are already id-free.
- **Owner:** reword in the same style ("Deze klas bestaat niet (meer).") or waive. No constitution rule is breached.

### Checks run (summary)
- **Round-3 MINOR, resolved.** `bijNietGevonden` is on both write hooks, and the `klassen`/`schooljaren` prefixes match `queries.ts:142`, `:157`. The invalidation is needed (60 s stale time, no refetch on focus, `App.tsx:39-41`). The sheet closes because it renders only for a listed person, the alert sits at list level, and the new Vitest pins it.
- **"{naam} is intussen verwijderd …" is proven by its condition.** `LeesAsync` lists every gebruiker, so only a delete removes a row. A failed refetch keeps `data`, and a failed first load has none. The invite puts the new person in the cache before `onUitgenodigd`. Directie's own removal clears `rechtenVoor` first. Not raised: a same-name re-invite by a colleague leaves the alert up beside a namesake.
- **"(meer)" is a correct say-less.** Every `NietGevonden()` branch is true for a never-existing and for a removed id. "Intussen verwijderd" is said only after the pre-check passed or after a tracked read.
- **Test-runner LOW, resolved.** The lock query locks every directie row, including the target's, so the new theory waits on the lock and ends in `VindNaSlotAsync`. The pre-check reads committed state.
- **Test-runner MINOR (focus scrolled out of view), resolved.** The focused link is scrolled into view "nearest" when focus is in the row and not on the active link. Two Vitest cases pin it.
- **No em dash** in the source diff. **Nothing new:** no dependency, endpoint, migration or hue. Art. II, VI.2, VI.4, VIII and XIV are clean.
- **Runs:** vitest (instellingen, i18n) 49 passed; `pnpm lint` exit 0; `dotnet format --verify-no-changes` exit 0. Postgres suite not run by the auditor (the container password was not given to it); relying on the implementer's 426 passed.
- **Not raised (for the test-runner):** after a 404 closes the sheet, its trigger row is gone, so focus likely falls to the body (Radix `Blad`, no `onCloseAutoFocus`). The alert announces why. Not checked in a browser.

### Owner decision after round 4 (2026-09-14)
The three fix rounds were used up. The owner approved one extra mini-fix covering MINOR 1 (the two comments) and QUESTION 2 (the klas and schooljaar not-found sentences without a raw id), and the orchestrator added the test-runner's round-4 LOW notes (focus the list-level alert when the sheet closes on its own), which share that code path. **The owner waived an antagonist review of that mini-fix** ("nee skip de antagonist"). Its evidence is the diff check, the tests and the browser check reported by the implementer.
