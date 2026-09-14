# ADR-0030 — Roles and rights live in the app: directie, themabeheer, a hoofdleerkracht per jaar, and personal content

- **Status:** Accepted for the rulings in §1. **Part 1 of the amendment (§5) was ratified by the owner on
  2026-09-14**, so the §3 matrix binds as far as the rulings it cites. Everything in §2 is **not ruled**: each item
  there carries a default, which the build follows until the owner changes it (R37).
- **Date:** 2026-09-11. **Revised 2026-09-13 and 2026-09-14** with the rulings of those days (§1.3); ratified
  2026-09-14.
- **Deciders:** Project owner (Siebe De Saedeleir), for §1 only. The rulings were given in session, partly in reply
  to direct questions with the options and their costs stated: two rounds on 2026-09-11, recorded the same day by
  session `E6-01`, and six sets of questions on 2026-09-13, recorded by session `E6-02` as the first task of the
  combined E6-02/E6-04 build. Each round was recorded before any code depended on it.
- **Amends:** [ADR-0011](0011-authn-authz-rbac-gdpr.md). **Supersedes its decision §3** ("ownership-aware
  rules"), which assigned class-scoped content to "the owning teacher" at a time when a subthema still named a
  klas. ADR-0011 §1 (personal login over Microsoft Entra ID), §2 (server-side enforcement driven by one
  configurable matrix, no scattered role checks) and §4 (no pupil PII) stand unchanged.
- **Relates to:** [ADR-0022](0022-curriculum-administration-authorisation-seam.md) (the `Curriculumbeheer`
  seam), [ADR-0025](0025-subthema-per-leeftijd.md) (content per leeftijd), [ADR-0031](0031-sessielogin-via-de-api.md)
  (the login mechanism).
- **Realises:** FR-10, FR-12.2, FA §3.1/§3.2. **Backlog:** E6-01, E6-02, E6-04, E6-08, E6-09, E6-10.

> **Revised twice on the day it was written, on its antagonist's findings.**
> - The first version (`30b7031`) presented several of the recording session's own design choices as numbered owner
>   rulings, among them "at most one hoofdleerkracht per jaar per schooljaar". It also let a matrix row take
>   doelsuggesties away from ordinary teachers without anyone ruling that.
> - The second version (`68e296e`) fixed the body. It still had the summaries (index, backlog) carry the old claims,
>   and it gave "leerkracht of another klas" rights on the import and on doelsuggesties while citing FA §3.2, which
>   denies them.
>
> The owner has since answered four more questions (statements 10–13), which settle the import, the doelsuggesties
> and the hoofdleerkracht appointment.

> **Revised on 2026-09-13 with a third round of rulings (statements 14–21, §1.3).**
> - **Statement 17 reverses R8.** §4 (f) required that R8's consequence be put to the owner before E6-02 enforced it:
>   one teacher's acceptance moves the dekking of every klas that plans the thema. It was put, and the owner changed
>   the answer. Doelsuggesties are now generated **and** reviewed by directie and themabeheer only (R14). R8 is
>   struck below rather than deleted.
> - **Three defaults became rulings.** I7 as it stood (several leerkrachten per klas, R15). I8 as it stood (a
>   hoofdleerkracht edits thema's only with themabeheer, R18). And I5, **differently from its default**: every
>   leerkracht with a klas of that leeftijd edits the shared subdoelen and activiteiten as well (R17).
> - **Open question (g) is settled** (R16): there is no separate ICT role.
> - **Process:** E6-01 closes (R11), E6-02 and E6-04 are built and delivered as one (R12), and the amendment of §5
>   is shown to the owner as a draft before it is logged or built on (R13).
> - **New in §2 and §4, from the recording session and not ruled:**
>   - who uses the wizard's AI assist (I10);
>   - which schooljaar makes someone "hoofdleerkracht of that jaar" or "leerkracht of that leeftijd" (I11);
>   - what a klas without a stated jaarfase grants (I12);
>   - who may re-scope a subthema to another leeftijd (I13);
>   - what R17 does to the dekking of parallel klassen (§4 (h)).

> **Revised again on 2026-09-13 (fix round 1),** on the antagonist's first audit of the draft
> (`backlog/worklogs/E6-02/antagonist.md`) and a third set of rulings (statements 22–25).
> - **The MAJOR:** by making the §3 matrix binding, Art. VI.1 would have ratified rows that rest on defaults (I10,
>   I13) and on a goal-link reading nobody ruled. §2, §3 and Art. VI.1 now say that **a row is ratified only as far
>   as the R-items it cites**; what it takes from an I-item or a lettered §4 question is a default.
> - **Statement 22 settles §4 (h)** (R19): goal links on shared activiteiten and subdoelen are for directie and the
>   hoofdleerkrachten, and leerkrachten of that leeftijd edit only the content. **Statement 23 rules I11** (R20).
>   **Statement 24** gives a hoofdleerkracht the whole lifecycle of their jaar's subthema's (R21). **Statement 25**
>   rules graadklassen provisionally (R22).
> - §1.3 now quotes every question and option in full, with the "(Aanbevolen)" label the owner saw. "LK ander"
>   became "Ander" (any gebruiker), I9 covers a gebruiker without a klastoewijzing, and I14 is new.

> **Revised a third time on 2026-09-13 (fix round 2),** on the antagonist's second audit and six further rulings
> (statements 26–31).
> - **Both MAJORs are now owner rulings.** Statement 26 was put **with the model's premise stated** (*"Een subdoel is
>   in het model enkel een koppeling aan een doel"*), which is what the first MAJOR asked for. Together with
>   statements 30 and 31 it rules what a leerkracht of that leeftijd may do with shared activiteiten and subdoelen
>   (R23–R26), and I14 is retired. Statement 27 rules that the FR-1 import may write goal links (R27). **The question
>   for statement 27 overstated what the import writes**, and §1.3 records the correction.
> - **Statement 28** makes streefwoordenschat shared content (R28), and **statement 29** gives the whole wizard to
>   themabeheer (R29), which retires I10. The owner chose against the recommended option on both.
> - The ratification rule now counts citations at column level, and every §3 row cites a ruling. A hoofdleerkracht
>   is a gebruiker, not necessarily a leerkracht (I20). R20 is scoped to the shared content, and I21 covers a klas's
>   own planning. Moving an activiteit is no longer called unlinking (I19). I2 is narrowed to the reading of
>   statement 8. New defaults: I15–I21.

> **Revised a fourth time on 2026-09-13 (fix round 3),** on the antagonist's third audit and three further rulings
> (statements 32–34).
> - **The MAJOR:** R24's "only" contradicted the import (R27) and the wizard (R29), which both create subdoelen, and
>   the wizard had no write path of its own. **Statement 32 narrows R29** (R32): themabeheer creates subthema's and
>   subdoelen only inside the wizard, for a thema it builds there from scratch, through separate wizard actions.
>   R24, Art. VI.1 and A.11 now say "by hand", with the import and the wizard on a new thema excepted. How the
>   server tells the two apart (I22) and what counts as a new thema (I23) are defaults.
> - **Statement 33** makes the maker's delete right follow the person (R33). **Statement 34** is the owner's own
>   confirmation of the import ruling after the correction (R34).
> - From here on an R-number equals its statement number, so **R30 and R31 are not used**.

> **Ratified on 2026-09-14,** after a fourth antagonist audit (round 4: 0 MAJOR, 5 MINOR, 2 QUESTION) and three
> further rulings (statements 35–37).
> - **Statement 35** gives the FR-1 import's option to delete human decisions to directie alone (R35). **Statement
>   36** is the ratification itself, with the round-4 corrections. **Statement 37** rules that the build follows the
>   defaults of §2 as written; they remain defaults.
> - **The round-4 corrections:** (e) and I22 now say "apart from the maker's delete right (R33)"; (c) says "by
>   hand"; I18 is limited to the maker assignment; the FR-7.2 pointer limits the wizard to a new thema; the index
>   traceability row is extended.
> - **The owner stopped the audit rounds after round 4**, so the ratification commit, which applies these
>   corrections and R35–R37, was not audited.
> - Round 4's first QUESTION (I23 has no server-visible end and no in-run edit right) got no ruling. E6-05 must
>   choose both, as defaults, before it builds the wizard write actions. *Answered on 2026-09-14:* the owner chose
>   both when session `E6-02` put them, for the combined build that writes those actions. They are I24 and I25 in
>   §2, added to Art. VI.1 by a dedicated amendment.

## Context

The owner asked for authentication "so teachers can log in, edit only their own classes, but still view other
classes". Building that needs an answer to *who owns what*, and the documents gave two answers that no longer fit
together:

- **ADR-0011 §3** says school-scoped content (Thema, Themadoel, kernwoordenschat) is editable by "team/directie"
  and class-scoped content (Subthema, Subdoel, Activiteit, Jaarplan) by "the owning teacher".
- **ADR-0025** (2026-08-30) took the klas out of Subthema, Subdoel and Activiteit: they are scoped by leeftijd, so
  three parallel K3 classes share one subthema. Since then there is **no owning teacher** for that content. Only
  the planning (Jaarplan, its placements, the agenda) still belongs to one klas.

FA §3.2's matrix has a single row "Thema's/activiteiten invoeren", granted to every leerkracht for their own klas.
That row cannot be applied to content that no longer belongs to a klas.

## 1. The rulings

### 1.1 The owner's words, verbatim

Unprompted statements:

1. *"ik wil aan een stukje authenticatie werken zodat leerkrachten kunnen inloggen, enkel hun eigen klassen kunnen
   bewerken maar wel andere klassen kunnen bekijken"* (the opening request)
2. *"enkel een "hoofdleerkracht" van een bepaald jaar zal de subthema's en thema's mogen aanpassen in overeenstemming
   van alle leerkrachten"*
3. *"het model zal indd moeten aangepast worden zodat dit kan werken"*
4. *"de directie kan alles van iedereen zien en aanpassen"*
5. *"ja zij gaan een eigen entra tenant hebben"*

Answers to a first round of direct questions:

6. *Waar leggen we vast wie directie, hoofdleerkracht of leerkracht is?*
   - Chosen: **"In de app zelf"**.
   - Rejected: "In Entra".
7. *Wie mag inloggen?*
   - Chosen: **"Enkel wie de directie toevoegde"**.
   - Rejected: "Iedereen in de schooltenant".
8. *Een thema is schoolbreed. Wie mag een thema zelf aanpassen?* The owner answered in free text:
   *"alleen de directie en een paar leekrachten/zorgcoordinatoren die de directie "*. **The answer is cut off after
   "die de directie"; the verb is missing.**
9. *Wie mag de activiteiten en subdoelen onder een subthema aanpassen?* The owner answered in free text:
   *"een leerkracht mag zelf activiteiten en subdoelen voor zichzelf onder subthema's plaatsen"*.

Answers to a second round, the same day. The option descriptions shown to the owner are quoted because they are
part of what was chosen:

10. *Mag ik de code voor de login schrijven zoals in ADR-0031?* The owner answered in free text: *"ja begin maar maar
    op een worktree"*.
11. *Hoe werkt de aanstelling van een hoofdleerkracht?*
    - Chosen: **"Per schooljaar, meerdere mogelijk"**, described as *"Elk schooljaar kan een jaar één of meer
      hoofdleerkrachten hebben, bijvoorbeeld bij een duobaan."*
    - Rejected: "Per schooljaar, één per jaar" and "Vast, niet per schooljaar".
12. *AI-doelsuggesties hangen aan een thema, en thema's mogen nu alleen directie en aangeduide mensen aanpassen. Wie
    mag doelsuggesties maken en beoordelen?*
    - Chosen: **"Elke leerkracht, zoals nu"**, described as *"Zo staat het in de functionele analyse (§3.2) en zo
      werkt het vandaag: elke leerkracht laat suggesties maken en aanvaardt of weigert ze."*
    - Rejected: "Alleen wie het thema aanpast".
13. *Op 3 augustus besliste je dat een leerkracht thema's mag importeren uit Excel. Een import maakt thema's aan.
    Wat geldt nu?*
    - Chosen: **"Alleen directie en themabeheer"**, described as *"Past bij je nieuwe regel dat alleen zij thema's
      aanpassen. Een leerkracht kan dan niet meer zelf importeren."*
    - Rejected: "Elke leerkracht blijft importeren".

### 1.2 What they decide, read narrowly

- **R1. The app records who holds which right, not Entra** (statement 6). The school gets **its own Entra tenant**
  (statement 5), and Entra's job is to authenticate.
- **R2. Only people directie has added can log in** (statement 7).
- **R3. Directie sees and edits everything** (statement 4).
- **R4. Thema's are edited by directie and by a few leerkrachten or zorgcoördinatoren** (statement 8). The answer
  is cut off before it says how those few are chosen; I2 holds the reading.
- **R5. The subthema's of a jaar are edited by a hoofdleerkracht of that jaar** (statement 2). A hoofdleerkracht is
  appointed **per schooljaar**, and a jaar may have **more than one** (statement 11).
- **R6. A leerkracht may place activiteiten and subdoelen under subthema's for themselves** (statement 9).
- **R7. A leerkracht edits only their own klassen, and can view other klassen** (statement 1).
- ~~**R8. Every leerkracht may have doelsuggesties generated, and may accept or reject them** (statement 12). The
  consequence named in §4 (f) was not part of the question.~~ **Reversed on 2026-09-13 by statement 17: see R14.**
  Struck rather than deleted, so the record keeps what E2-08 was built against and why it changed.
- **R9. The FR-1 import of thema's and activiteiten is for directie and themabeheer only** (statement 13). This
  **reverses the owner ruling of 2026-08-03** that FA §3.2 "stands as written" for the import (E1-13).
- **R10. E6-01 is built as ADR-0031 describes, in a worktree of its own** (statement 10).
- **R11. E6-01 closes without a sign-in against a real school tenant** (statement 14). That round trip stays a
  precondition on **E7-11**, before real deployment.
- **R12. E6-02 and E6-04 are built together and delivered together** (statement 15), so there is never a state in
  which leerkrachten can edit nothing.
- **R13. Part 1 of the amendment is shown to the owner as a draft** (statement 16). The owner approves it before it
  enters the ratification log and before code is written on it.
- **R14. Only directie and themabeheer have doelsuggesties generated, and only they accept or reject them**
  (statement 17), as for editing the thema itself. **This replaces R8** and settles §4 (f).
- **R15. A klas may have several leerkrachten, and a leerkracht several klassen** (statement 18). Each of them edits
  that klas's planning. **This rules I7** as it stood.
- **R16. There is no separate ICT role** (statement 19). Directie can give someone the directie right, and that
  person can then do everything. Otherwise an ICT-coördinator is an ordinary leerkracht. **This settles §4 (g).**
- **R17. The shared activiteiten and subdoelen under a subthema are edited by directie, that jaar's
  hoofdleerkrachten, and every leerkracht with a klas of that leeftijd** (statement 20). The subthema itself stays
  with directie and the hoofdleerkracht (R5). **This rules I5, and differently from its default**, which gave these
  to directie and the hoofdleerkrachten only. *Narrowed since by R19 (goal links), R24 (subdoelen) and R25
  (deleting).*
  - ~~*Read narrowly, by the recording session:* a subdoel is itself a link to a leerplandoel, and an activiteit's goal
    links are part of the activiteit (FR-3.2). So editing those links is part of this right. §4 (h) names what that
    does to the dekking of parallel klassen.~~ *Struck in fix round 1:* the antagonist found this was the wider
    reading filed as the narrow one, and statement 22 then ruled the opposite for goal links (R19).
  - ~~"A klas of that leeftijd" needs a rule for which schooljaar counts, and for a klas that states no jaarfase. The
    rulings give neither. The defaults are I11 and I12.~~ Which schooljaar counts is now R20 and a graadklas R22; a
    klas that states no jaarfase is still default I12.
- **R18. A hoofdleerkracht edits thema's only when directie has also given them themabeheer** (statement 21).
  **This rules I8** as it stood.
- **R19. Only directie and that jaar's hoofdleerkrachten link goals to shared activiteiten and subdoelen by hand, or
  unlink them** (statement 22). Every leerkracht with a klas of that leeftijd still edits their content (R17).
  **This narrows R17 and settles §4 (h).** *"By hand" added in fix round 2:* the FR-1 import and the wizard also
  write links (R27, R29, R32). What "content" covers was I14 and is now R23–R25.
- **R20. A hoofdleerkracht appointment or a klastoewijzing counts, for the shared content, while its schooljaar has
  not yet ended, including a schooljaar that has not started** (statement 23). **This rules I11** as it stood.
  *Scope, stated in fix round 2:* statement 23 asked which schooljaar gives rights *"op de gedeelde inhoud"*, so R20
  governs the "HL" and "LK leeftijd" relations. It does not end a leerkracht's rights on their own klas's planning;
  that is I21, a default. It does not scope the maker's right either (R33).
- **R21. A hoofdleerkracht creates, edits and deletes the subthema's of their jaar** (statement 24). Deleting one
  removes the activiteiten and goal links under it, as it does today. Re-scoping a subthema to another leeftijd is
  not named, so I13 stays a default.
- **R22. Provisionally, the leerkrachten of a graadklas get the rights of the one jaarfase the klas states, and a
  hoofdleerkracht or directie edits the other leeftijd's shared content** (statement 25). Provisional until
  directie decides the Art. XIV graadklas question. *The build requirement that follows, recorded by the session:*
  the klas→leeftijden mapping the rights check uses lives in one place, so that decision changes one place.
- **R23. A leerkracht with a klas of that leeftijd edits the content of shared activiteiten, and creates new
  activiteiten** (statement 26). The option named *"naam, beschrijving, hoek en uitkomsten"*. The model has naam,
  hoek and verwachte uitkomsten, and no `beschrijving` field; whether the fields the option did not name follow is
  I15.
- **R24. By hand, subdoelen are created, changed and deleted by directie and that jaar's hoofdleerkrachten only**
  (statement 26). This narrows R17 for subdoelen: a leerkracht of that leeftijd holds no subdoel right. **The premise
  was put to the owner:** the question said *"Een subdoel is in het model enkel een koppeling aan een doel"*, so the
  owner ruled knowing that "the content of a subdoel" is empty in the model. That premise is the model's
  (`Subdoel.cs`), not the constitution's: Art. IX.2 defines a subdoel as *"a concrete, age-differentiated goal …
  linking to a Leerplandoel"*. *"By hand" added in fix round 3:* the FR-1 import writes subdoelen with their links
  (R27, R34), and the wizard creates them for a thema it builds from scratch (R32). Statement 26 asked what a
  *leerkracht* may do; it did not deny those two routes to themabeheer.
- **R25. An activiteit is deleted by its maker only while no goal is linked to it. An activiteit that carries goal
  links, or that has no maker, is deleted by that jaar's hoofdleerkrachten or directie only** (statements 26, 30,
  31). The owner added to statement 26, in free text: *"en een leerkracht kan EIGEN activiteiten verwijderen. puur
  gedeelde mag enkel hoofdleerkracht"*. Statement 30 defined "eigen" as the activiteit the leerkracht created;
  statement 31 withheld deletion from the maker once goals are linked. Who the maker may be is R33.
- **R26. The app records who created an activiteit, its maker, and the activiteit stays shared** (statement 30).
  Every leerkracht of that leeftijd sees it and edits its content. Activiteiten that exist before this rule, and
  imported ones, have no maker and are "purely shared". **The maker is not the personal content of R6** (E6-10):
  statement 30 rejected that reading.
- **R27. The FR-1 import may write goal links** (statement 27). It is run by directie or themabeheer (R9), although
  by hand only directie and the hoofdleerkrachten link goals to shared content (R19). The import writes `Manueel`
  links on **themadoelen and subdoelen only**, not on activiteiten: `SchoolcontentImportService.cs` says *"Activiteit
  goal links (Doelkoppelingen) are not carried by this import"*. The question overstated this; §1.3 records it, and
  this ruling covers what the import actually writes. **The owner confirmed it after the correction** (R34).
- **R28. The streefwoordenschat of a subthema is shared content** (statement 28). Directie, that jaar's
  hoofdleerkrachten and every leerkracht with a klas of that leeftijd edit it, as they do the content of shared
  activiteiten. The other fields of the subthema stay with directie and the hoofdleerkrachten (R5, R21); that they
  follow the subthema was not asked, and is I16.
- **R29. The thema-opbouw wizard is for themabeheer, through all its steps** (statement 29), and for directie
  (R3). The chosen option said *"ook subthema's en subdoelen"*, so the reach beyond R5, R21 and R24 was ruled
  knowingly. It has the same shape as R27. **This retires I10.** *Narrowed by R32:* the wizard creates subthema's
  and subdoelen only for a thema it builds from scratch.
- *R30 and R31 are not used, so that from statement 32 onward an R-number equals its statement number.*
- **R32. Themabeheer creates subthema's and subdoelen only inside the wizard, for a thema it builds there from
  scratch; changing existing subthema's stays with the hoofdleerkracht; the app gets separate wizard actions for
  it** (statement 32). **This narrows R29.** The separate wizard write path was in the chosen option's text
  (*"De app krijgt daarvoor aparte wizardacties"*), so it is ruled; its exact shape is I22, and what counts as a
  thema built *"van nul"* is I23.
- **R33. The maker's right to delete follows the person** (statement 33). Whoever created an activiteit may delete
  it while no goal is linked to it, without a klas of that leeftijd and after the schooljaar. **So R20 does not scope
  the maker's right.** This rules I18 for the delete right only; who counts as the maker of an activiteit the wizard
  creates stays I18.
- **R34. The owner confirmed R27 after the correction** (statement 34): themabeheer may, through the import, write
  the goal links on themadoelen and subdoelen that are in the file.
- **R35. Only directie may switch on the FR-1 import's option to delete human decisions** (statement 35).
  Themabeheer imports as ruled (R9, R27, R34), but without that option a re-import deletes only what nobody decided.
  The question named subdoelen. The option (`MenselijkeBeslissingenVerwijderen`) is one switch that also governs
  themadoelen (`SchoolcontentImportService.cs:433-453`), so the ruling covers the option as a whole.
- **R36. The owner ratified part 1 of the amendment, with the round-4 corrections** (statement 36), on 2026-09-14.
- **R37. The build follows the defaults of §2 as written** (statement 37). This does **not** ratify them. They stay
  defaults, and the owner can change any one of them later, which changes only that rule.

"Configurable" (Art. VI.1) keeps ADR-0011's reading:

- **Who holds which right is data**, maintained by directie.
- **What each right allows is the one matrix in code** (§3). Changing a row there is a code change.

### 1.3 The rulings of 2026-09-13: the owner's words

Asked in session `E6-02` as multiple-choice questions, in seven sets (the seventh on 2026-09-14). As in §1.1, the questions and every option's
description are quoted in full, because what was chosen includes what the owner was shown. **The option the asking
session recommended carried the suffix "(Aanbevolen)" in its label as the owner saw it.** The suffix is kept,
because it is part of what the owner saw, and where no option carried it, that is said. R11–R37 in §1.2 read these
statements narrowly.

*Restored in full in fix round 1.* The first record elided parts of statements 16, 17 and 21 and left out the
rejected options' descriptions. A later reader could then not check whether a consequence had been put to the owner,
which is the test §4 (f) and (h) apply.

**First set.**

14. *"E6-01 (login) zit al in main, maar staat op [~]: de audit vroeg of het mag sluiten zonder een aanmelding tegen
    een echte schooltenant. Die test staat sowieso als voorwaarde op E7-11 (de uitrol). Mag E6-01 dicht?"*
    - Chosen: **"Ja, sluiten (Aanbevolen)"**, described as *"E6-01 wordt [x]. De test tegen een echte tenant blijft
      een voorwaarde op E7-11, vóór er echt uitgerold wordt."*
    - Rejected: "Nee, eerst echte tenant", described as *"E6-01 blijft [~] tot iemand met de schooltenant één echte
      aanmelding doet. E6-02 kan er wel al op bouwen."*
15. *"Wat bedoel je met rollenbeheer: alleen de handhaving (E6-02), of ook het scherm waarin de directie rollen
    toekent (E6-04)?"*
    - Chosen: **"Samen als één geheel"**, described as *"Beide stories samen bouwen en pas samen afleveren. Groter
      om na te lezen, maar er is nooit een tussenstand waarin leerkrachten niets kunnen bewerken."*
    - Rejected: "E6-02, daarna E6-04 (Aanbevolen)", described as *"E6-02 legt het datamodel (klastoewijzing,
      hoofdleerkracht per schooljaar en jaar, themabeheer) en de regels vast, zonder scherm. Daarna E6-04, het
      scherm. Tussen de twee kan alleen de directie bewerken, want nog geen leerkracht heeft een klas."*
    - Rejected: "Alleen E6-02 nu", described as *"Handhaving en datamodel. Het scherm komt later, en tot dan bewerkt
      alleen de directie."*
    - **The owner chose against the recommended option.**
16. *"De amendering (deel 1) wijzigt de constitutie en de FA: rollen, de matrix, het thema-eigenaarschap en de
    zichtbaarheidsvraag. Die moet jij ratificeren. Hoe wil je dat?"*
    - Chosen: **"Eerst ontwerp tonen (Aanbevolen)"**, described as *"Ik schrijf het ontwerp als eerste taak en jij
      keurt het goed vóór het in de ratificatielog komt en vóór er code geschreven wordt."*
    - Rejected: "Schrijf en ratificeer", described as *"Ik schrijf het en neem het meteen onder jouw naam op in de
      ratificatielog. Enkel wat in ADR-0030 §1 beslist is; de standaarden uit §2 gemarkeerd als standaard."*
17. *"Doelsuggesties hangen aan een schoolbreed thema. Als één leerkracht een suggestie aanvaardt, stijgt de dekking
    van élke klas die dat thema plant, ook bij collega's. Dat cijfer leest de onderwijsinspectie. Dit stond niet in
    de vraag die je op 11/09 beantwoordde. Blijft R8 zo?"*
    - Chosen: **"Alleen themabeheer, alles"**, described as *"Suggesties maken én beoordelen enkel door directie en
      themabeheer, net zoals het thema zelf aanpassen."*
    - Rejected: "Ja, elke leerkracht", described as *"R8 blijft zoals beslist: elke leerkracht maakt en beoordeelt
      suggesties, ook met dat gevolg voor andere klassen."*
    - Rejected: "Alleen themabeheer", described as *"Elke leerkracht mag suggesties laten maken, maar enkel directie
      en themabeheer mogen ze aanvaarden of weigeren."*
    - No option was marked recommended.
    - **This is the question §4 (f) required.** The consequence was put to the owner before E6-02 enforced R8, and
      the owner changed the answer.

**Second set.**

18. *"Mag een klas meer dan één leerkracht hebben (co-teacher, duobaan)? ADR-0030 nam als standaard: ja."*
    - Chosen: **"Ja, meerdere (Aanbevolen)"**, described as *"Een klas kan meerdere leerkrachten hebben en een
      leerkracht meerdere klassen. Elk van hen bewerkt de planning van die klas."*
    - Rejected: "Nee, één per klas", described as *"Elke klas heeft precies één leerkracht. Een duobaan moet dan via
      de directie of een gedeelde aanmelding."*
19. *"Art. VI.1 zet 'directie / ICT-coördinator' samen onder één rol. Krijgt een ICT-coördinator die het beheer doet
    dezelfde rechten als de directie (alles zien en bewerken)?"*
    - Chosen: **"Alleen als directie toekent (Aanbevolen)"**, described as *"Er is geen aparte ICT-rol. De directie
      kan iemand het directierecht geven, en dan kan die persoon alles. Anders is een ICT-coördinator een gewone
      leerkracht."*
    - Rejected: "Aparte beheerrol", described as *"Een ICT-coördinator beheert gebruikers, klassen en schooljaren,
      maar bewerkt geen thema's of planningen van anderen. Dat is een extra rol in de matrix."*
20. *"Wie bewerkt de gedeelde activiteiten en subdoelen onder een subthema? Let op: eigen activiteiten per leerkracht
    (E6-10) bestaan nog niet. Met de standaard kan een gewone leerkracht dus tijdelijk geen enkele activiteit meer
    bewerken, wat vandaag wel kan."*
    - Chosen: **"Ook leerkrachten van dat jaar"**, described as *"Directie, hoofdleerkrachten én elke leerkracht met
      een klas van die leeftijd bewerken de gedeelde activiteiten en subdoelen. Het subthema zelf blijft voor
      directie en hoofdleerkracht."*
    - Rejected: "Directie + hoofdleerkracht", described as *"De standaard uit ADR-0030 (I5): gedeelde activiteiten
      en subdoelen volgen hun subthema. Gewone leerkrachten wachten op E6-10 om eigen inhoud toe te voegen."*
    - No option was marked recommended.
21. *"Mag een hoofdleerkracht ook thema's aanpassen, alleen omdat die hoofdleerkracht is? Je zei op 11/09 zowel
    'enkel een hoofdleerkracht mag subthema's en thema's aanpassen' als 'alleen de directie en een paar aangeduide
    mensen' voor thema's."*
    - Chosen: **"Nee, enkel met themabeheer (Aanbevolen)"**, described as *"De standaard (I8): een hoofdleerkracht
      past subthema's van zijn jaar aan. Thema's alleen als de directie hem ook themabeheer geeft."*
    - Rejected: "Ja, elke hoofdleerkracht", described as *"Elke hoofdleerkracht mag thema's aanpassen. Thema's zijn
      schoolbreed, dus de hoofdleerkracht van K1 kan dan ook een thema wijzigen dat L6 gebruikt."*

**Third set**, asked after the antagonist's first audit of the draft.

22. *"Een doelkoppeling op een gedeelde activiteit of subdoel telt voor de dekking van élke klas van die leeftijd die
    het thema plant. Met je beslissing van vandaag kan de leerkracht van K3 groen dus het dekkingscijfer van K3
    blauw en K3 geel veranderen. Blijft dat zo?"*
    - Chosen: **"Koppelingen enkel directie + HL"**, described as *"Leerkrachten van dat jaar bewerken de inhoud van
      gedeelde activiteiten en subdoelen, maar doelen eraan koppelen of ontkoppelen doen enkel directie en de
      hoofdleerkrachten."*
    - Rejected: "Ja, zo laten", described as *"Elke leerkracht met een klas van die leeftijd bewerkt de gedeelde
      activiteiten en subdoelen, doelkoppelingen inbegrepen, met dat gevolg voor de parallelklassen."*
    - No option was marked recommended.
    - **This is the question §4 (h) required**, put before anything enforced R17.
23. *"Een hoofdleerkracht en een klastoewijzing gelden per schooljaar, maar een subthema hoort bij geen schooljaar.
    Welk schooljaar geeft iemand rechten op de gedeelde inhoud?"*
    - Chosen: **"Tot het schooljaar voorbij is (Aanbevolen)"**, described as *"Een aanstelling of klastoewijzing
      telt zolang het schooljaar niet afgelopen is, ook als het nog moet beginnen. Zo kan een hoofdleerkracht in
      juni het volgende jaar al voorbereiden."*
    - Rejected: "Alleen het lopende schooljaar", described as *"Enkel het schooljaar waarin vandaag valt.
      Voorbereiden voor volgend jaar kan dan pas vanaf de eerste schooldag, of door de directie."*
24. *"Mag een hoofdleerkracht subthema's van zijn jaar ook aanmaken en verwijderen, of alleen aanpassen?"*
    - Chosen: **"Aanmaken, aanpassen, verwijderen (Aanbevolen)"**, described as *"Een hoofdleerkracht beheert de
      subthema's van zijn jaar volledig. Verwijderen neemt de activiteiten en koppelingen eronder mee, zoals
      vandaag."*
    - Rejected: "Alleen aanpassen", described as *"Aanmaken en verwijderen blijft voor de directie. De
      hoofdleerkracht past bestaande subthema's aan."*
25. *"Een klas heeft één jaarfase. De leerkracht van een graadklas L1/L2 krijgt dus alleen rechten op de
    L1-inhoud. Is dat aanvaardbaar tot de directie over graadklassen beslist?"*
    - Chosen: **"Ja, voorlopig (Aanbevolen)"**, described as *"De graadklas bewerkt de gedeelde inhoud van de
      jaarfase die de klas heeft. Een hoofdleerkracht of de directie doet de andere leeftijd."*
    - Rejected: "Nee, eerst oplossen", described as *"Een klas moet meerdere jaarfasen kunnen hebben voor we de
      rechten afdwingen. Dat is een modelwijziging en een extra story."*

**Fourth set**, asked before the antagonist's second verdict arrived, on questions that audit also raised.

26. *"Leerkrachten van een leeftijd bewerken gedeelde activiteiten, maar doelkoppelingen doen alleen directie en
    hoofdleerkracht (je antwoord van net). Een subdoel is in het model enkel een koppeling aan een doel. Wat mag een
    leerkracht dan precies?"*
    - Chosen: **"Activiteit wel, subdoel niet (Aanbevolen)"**, described as *"Een leerkracht past naam,
      beschrijving, hoek en uitkomsten van een gedeelde activiteit aan en maakt nieuwe activiteiten. Een subdoel
      aanmaken of wijzigen, en een activiteit met koppelingen verwijderen, doet de hoofdleerkracht."*
    - **The owner added in free text**, verbatim: *"en een leerkracht kan EIGEN activiteiten verwijderen. puur
      gedeelde mag enkel hoofdleerkracht"*. The answer came back as the chosen option's description followed by that
      addition. Statements 30 and 31 clarify it.
    - Rejected: "Ook verwijderen met koppelingen", described as *"Zoals hierboven, maar een leerkracht mag ook een
      activiteit verwijderen waar doelen aan hangen. Die doelen tellen dan niet meer mee voor de dekking van de
      parallelklassen."*
    - **The premise was disclosed.** The question stated that a subdoel is, in the model, only a link to a goal.
      That is what the antagonist's second audit asked to put to the owner before anything was enforced on
      subdoelen. *Correction of the record:* the premise is the model's (`Subdoel.cs`), not the constitution's
      (Art. IX.2 defines a subdoel as a goal that links to a leerplandoel).
27. *"De Excel-import van thema's (enkel directie en themabeheer) schrijft ook doelkoppelingen op subdoelen en
    activiteiten. Wie themabeheer heeft, kan dus via de import koppelingen leggen die hij met de hand niet mag
    leggen. Is dat de bedoeling?"*
    - Chosen: **"Ja, de import mag dat (Aanbevolen)"**, described as *"De import is een bewuste actie van directie
      of themabeheer die de hele schoolinhoud aanlevert. Wat erin staat, komt erin, koppelingen inbegrepen."*
    - Rejected: "Nee, alleen directie importeert", described as *"Omdat de import koppelingen op alle niveaus
      schrijft, mag enkel de directie importeren. Dat is strenger dan je beslissing van 11/09 (directie en
      themabeheer)."*
    - **The question overstated what the import writes.** It said the import writes links *"op subdoelen en
      activiteiten"*, and the rejected option said *"op alle niveaus"*. The import writes themadoel and subdoel links
      only (`SchoolcontentImportService.cs`: activiteit goal links are not carried). The orchestrating session
      corrected this to the owner in the same session, right after the answer, and said the answer stands because
      the import does less than described. R27 records the ruling as covering what the import actually writes.
    - **The owner then confirmed it himself**, on a question that stated the correction: statement 34.
28. *"De streefwoordenschat per subthema (ADR-0026, nog niet gebouwd) is een veld van het subthema. Met de huidige
    regels past dus alleen de directie of de hoofdleerkracht die aan, niet elke leerkracht van dat jaar. Klopt
    dat?"*
    - Chosen: **"Nee, elke leerkracht van dat jaar"**, described as *"Streefwoordenschat telt als gedeelde inhoud:
      elke leerkracht met een klas van die leeftijd past de lijst aan, net zoals activiteiten."*
    - Rejected: "Ja, volgt het subthema (Aanbevolen)", described as *"Streefwoordenschat is iets wat het jaar samen
      afspreekt, en de hoofdleerkracht legt het vast. Leerkrachten lezen het."*
    - **The owner chose against the recommended option.**
29. *"Door alle regels samen loopt de thema-opbouwwizard (10 stappen) nu over drie rechten: thema en themadoelen
    (themabeheer), subthema's en subdoelen (hoofdleerkracht), activiteiten (leerkracht van die leeftijd). Een gewone
    leerkracht kan de wizard dus niet alleen afwerken. Wat doen we?"*
    - Chosen: **"Wizard alleen voor themabeheer"**, described as *"Wie een thema van nul opbouwt, heeft themabeheer
      nodig en mag in de wizard alle stappen doen, ook subthema's en subdoelen."*
    - Rejected: "Zo laten, elk zijn stap (Aanbevolen)", described as *"De wizard toont elke stap aan wie hem mag
      doen. Stappen waar je geen recht op hebt, zie je als 'door de hoofdleerkracht' of 'door themabeheer', niet
      als knop die niets doet."*
    - **The owner chose against the recommended option.** The chosen description names *"alle stappen, ook
      subthema's en subdoelen"*, so R29's reach beyond R5, R21 and R24 was put to the owner, not inferred.
      Statement 32 then narrowed it.

**Fifth set**, clarifying the free text added to statement 26.

30. *"Je schreef: 'een leerkracht kan EIGEN activiteiten verwijderen. puur gedeelde mag enkel hoofdleerkracht'. Wat
    is voor jou een eigen activiteit?"*
    - Chosen: **"Die hij zelf aanmaakte (Aanbevolen)"**, described as *"De app onthoudt wie een activiteit
      aanmaakte. Ze blijft gedeeld: elke leerkracht van die leeftijd ziet ze en past ze aan. Verwijderen mag wie ze
      maakte, de hoofdleerkracht of de directie. Wat al bestaat of uit de import komt, heeft geen maker en is dus
      puur gedeeld."*
    - Rejected: "Enkel voor zichzelf (E6-10)", described as *"Een eigen activiteit is persoonlijke inhoud die alleen
      die leerkracht heeft (R6). Die bestaat pas na E6-10. Tot dan verwijdert een leerkracht geen enkele
      activiteit."*
31. *"Mag een leerkracht zijn eigen activiteit ook verwijderen als de hoofdleerkracht er al doelen aan koppelde? Die
    doelen tellen dan niet meer mee voor de dekking van de parallelklassen."*
    - Chosen: **"Nee, dan de hoofdleerkracht (Aanbevolen)"**, described as *"Zonder koppelingen verwijdert de maker
      ze zelf. Hangen er doelen aan, dan doet de hoofdleerkracht het, zoals je eerder koos voor koppelingen."*
    - Rejected: "Ja, eigen is eigen", described as *"De maker verwijdert zijn eigen activiteit altijd, ook met doelen
      eraan. De dekking van de parallelklassen kan dan dalen."*

**Sixth set**, asked after the antagonist's third audit. All three chose the recommended option.

32. *"De wizard is voor themabeheer en maakt ook subthema's en subdoelen aan (je antwoord van eerder). Met de hand
    zijn subthema's en subdoelen voor directie en de hoofdleerkracht. Hoe ver reikt dat recht van themabeheer?"*
    - Chosen: **"Alleen in wizard, alleen nieuw (Aanbevolen)"**, described as *"Themabeheer maakt subthema's en
      subdoelen alleen binnen de wizard, voor een thema dat het daar van nul opbouwt. Bestaande subthema's aanpassen
      blijft voor de hoofdleerkracht. De app krijgt daarvoor aparte wizardacties."*
    - Rejected: "In wizard, ook bestaande thema's", described as *"Themabeheer kan met de wizard ook bij een
      bestaand thema subthema's en subdoelen aanmaken en aanpassen. De wizard is dan een tweede weg naast de
      hoofdleerkracht, voor elk jaar."*
    - Rejected: "Themabeheer mag het altijd", described as *"Themabeheer maakt en past subthema's en subdoelen
      overal aan, ook buiten de wizard. Eenvoudiger, maar de hoofdleerkracht is dan niet meer de enige voor zijn
      jaar."*
33. *"Een activiteit die themabeheer via de wizard aanmaakt, heeft die persoon als maker. Mag een maker zijn
    activiteit verwijderen (zolang er geen doelen aan hangen) als hij zelf geen klas van die leeftijd (meer) heeft?"*
    - Chosen: **"Ja, elke maker (Aanbevolen)"**, described as *"Het recht volgt de persoon: wie de activiteit maakte,
      mag ze verwijderen zolang er geen doelen aan hangen, ook zonder klas van die leeftijd en ook na het
      schooljaar."*
    - Rejected: "Alleen met een klas", described as *"De maker mag ze enkel verwijderen zolang hij een klas van die
      leeftijd heeft in een lopend schooljaar. Anders doet de hoofdleerkracht het."*
    - *Its premise, "heeft die persoon als maker", restates default I18; the answer rules the delete right, not that
      assignment.*
34. *"Correctie die ik je eerder gaf: de Excel-import schrijft doelkoppelingen op themadoelen en subdoelen, niet op
    activiteiten, zoals ik ten onrechte in de vraag zette. Blijft je antwoord 'ja, de import mag dat' staan?"*
    - Chosen: **"Ja, blijft staan (Aanbevolen)"**, described as *"Themabeheer mag via de import de koppelingen op
      themadoelen en subdoelen schrijven die in het bestand staan."*
    - Rejected: "Nee, alleen directie importeert", described as *"Omdat de import subdoelen met koppelingen aanmaakt,
      mag enkel de directie importeren."*

**Seventh set**, on 2026-09-14, after the antagonist's fourth audit. All three chose the recommended option.

35. *"Een nieuwe Excel-import kan subdoelen verwijderen die niet meer in het bestand staan, ook met de hand gemaakte,
    als de importeur uitdrukkelijk 'menselijke beslissingen verwijderen' aanvinkt (met eerst een voorbeeld).
    Themabeheer mag importeren. Zo kan iemand met themabeheer subdoelen van een hoofdleerkracht wissen en de dekking
    van alle klassen van die leeftijd verlagen. Mag dat?"*
    - Chosen: **"Die optie enkel voor directie (Aanbevolen)"**, described as *"Themabeheer importeert zoals beslist,
      maar 'menselijke beslissingen verwijderen' aanvinken mag alleen de directie. Zonder die optie wist de import
      enkel wat nog niemand besliste."*
    - Rejected: "Ja, themabeheer mag het", described as *"Wie importeert, beslist ook over het wissen, met het
      voorbeeld als controle. Zo werkt het vandaag."*
    - This is the round-4 audit's second QUESTION, put to the owner. It named subdoelen; the same switch governs
      themadoelen, so R35 covers the option as a whole.
36. *"Mag het ontwerp van de amendering in de ratificatielog, onder jouw naam?"*
    - Chosen: **"Ja, met de 5 correcties (Aanbevolen)"**, described as *"De 5 kleine tekstcorrecties van de antagonist
      en je antwoord op de importvraag gaan mee in de ratificatiecommit. Die krijgt nog een laatste controle, samen
      met CLAUDE.md en de backlog. Daarna begint de bouw."*
    - Rejected: "Ja, zoals het nu is".
    - Rejected: "Nee, eerst zelf lezen", described as *"Je leest het ontwerp eerst zelf op de branch
      story/E6-02-amendering. Er gebeurt niets tot je terugkomt."*
    - *Recorded as it happened:* the chosen description promised *"nog een laatste controle"*. The owner then said
      *"stop adien met audit rondes en rond het ticket af"*, so no antagonist audit ran on the ratification commit.
37. *"Wat doen we met de 17 standaarden die je niet mee bekrachtigt (bijvoorbeeld: mag een leerkracht de planning van
    vorig schooljaar nog bewerken)?"*
    - Chosen: **"Bouwen op de standaarden (Aanbevolen)"**, described as *"De bouw volgt de standaarden zoals ze
      beschreven zijn. Je kan er later elk moment eentje wijzigen; dan past alleen die ene regel aan."*
    - Rejected: "Eerst samen overlopen".
    - This does not ratify the defaults; see R37.

## 2. Interpretations and design choices: not ruled

Each item below was inferred by the recording session, not said by the owner, and each carries the default the build
follows until the owner confirms or corrects it.

**E6-01 built only D1**, and closed on R11. E6-02, E6-04 and E6-10 must not treat any remaining item as settled.

- Items I3 and I4 of the first revision were **ruled by statement 11** and now sit in R5.
- I5, I7 and I8 were **ruled on 2026-09-13** (R17, R15, R18), and I11 by the third set that day (R20). They are
  struck in the table rather than deleted, so a reader can see which defaults the owner kept and which one they
  changed.
- I10 was retired by statement 29 (R29), and I14 by statements 26, 30 and 31 (R23–R25); I14's move clause survives,
  corrected, as I19. Statement 33 ruled the delete half of I18 (R33).
- I10–I14 were added on 2026-09-13 in the first draft, I15–I21 in fix round 2 and I22–I23 in fix round 3, all by
  session `E6-02`. I24 and I25 were added on 2026-09-14 with the owner's choice of both (the round-4 note above), and I26–I28 the same day, when the three questions of the E6-02 slice 3 audit were put to the owner.
- **Statement 37 (R37):** the build follows these defaults as written. That does not ratify them. Each stays a
  default that the owner can change on its own.
- **A row of the §3 matrix is ratified only as far as the rulings it cites**, counted at column level (§3).
  Whatever it takes from an item of this table, or from a lettered question of §4, is a default and is not ratified
  with Art. VI.1.

| # | Item | Default until confirmed | Where it bites |
| --- | --- | --- | --- |
| I1 | *"In overeenstemming van alle leerkrachten"* (statement 2) is read as an agreement between people. The tool enforces no consensus, approval or voting. | Nothing is enforced. | E6-02 |
| I2 | ~~R4's missing verb is read as *"designates"*: themabeheer is a right directie grants to named people. The words also allow a subject reading ("who [support] the directie"). *2026-09-13:* the description chosen with statement 21 (*"Thema's alleen als de directie hem ook themabeheer geeft"*) presupposes this reading, and FR-12.2 already has the beheerder "rechten toekennen". But the question put was about the hoofdleerkracht, not about how themabeheer is granted, so this stays a default. Art. VI.1 lists it among its defaults.~~ *Narrowed in fix round 2* to **the reading of statement 8's missing verb** alone: "designates", against a subject reading ("who [support] the directie"). *Who* gives themabeheer does not hang on it. FA FR-12.2 has the beheerder "rechten toekennen", and the beheerder is the directie right (R16), so directie gives themabeheer as it links leerkrachten to klassen and appoints hoofdleerkrachten. | The build reads "designates". It changes nothing else. | None |
| I5 | ~~Whether a hoofdleerkracht also edits the **shared** subdoelen and activiteiten under their subthema's. The owner named subthema's and thema's only.~~ | ~~Shared subdoelen and activiteiten follow their subthema: directie and that jaar's hoofdleerkrachten.~~ **Ruled differently by statement 20 (R17):** every leerkracht with a klas of that leeftijd edits them as well. | E6-02 |
| I6 | Whether a **shared** layer of activiteiten and subdoelen remains next to personal content. Statement 9 can also mean that all of them become personal. *2026-09-13:* R17 presupposes that a shared layer exists today. It does not say whether it remains once personal content exists. | Existing content stays as it is, and personal content is additive. Goes with open question (a). | E6-10 |
| I7 | ~~**Several leerkrachten on one klas** (co-teacher, duobaan). Statement 1 says one teacher may have several klassen; the reverse is a design choice. FA §3.1 names the co-teacher, and statement 11's duobaan points the same way.~~ | ~~Allowed: the assignment is many-to-many.~~ **Ruled as defaulted by statement 18 (R15).** | E6-04 |
| I8 | ~~Whether a hoofdleerkracht edits **thema's** by being hoofdleerkracht. Statement 2 says so; statement 8 says *"alleen de directie en een paar …"*.~~ | ~~No: a hoofdleerkracht edits thema's only when they also hold themabeheer.~~ **Ruled as defaulted by statement 21 (R18).** | E6-02 |
| I9 | **How many** other klassen a leerkracht can view. Statement 1 says *"andere klassen"*, without a quantifier. *Extended in fix round 1:* a gebruiker with no klastoewijzing (a zorgcoördinator, an ICT-coördinator or a hoofdleerkracht who teaches no klas) matched no column of §3 and so could not even read. | Every gebruiker, including one without a klastoewijzing, can read and export every klas, read-only, decided in one place behind the E6-09 seam. | E6-08, E6-09 |
| I10 | ~~**Who uses the thema-opbouw wizard's AI assist** (E2-07, `POST /api/thema-opbouw/themadoel-suggesties` and `…/subdoel-suggesties`). Statement 17 names the doelsuggesties of FR-4, the `doelsuggesties[]` of a thema. The wizard's two steps are separate calls that return advice without storing it. Today every gebruiker can call both.~~ | ~~Each step follows the content it proposes for. Step 2 (themadoelen): directie and themabeheer. Step 6 (subdoelen): directie and the hoofdleerkrachten of that leeftijd, because a subdoel is a goal link (R19, I14).~~ **Ruled differently by statement 29 (R29):** the whole wizard, both AI steps included, is for themabeheer and directie. | E6-02 |
| I11 | ~~**Which schooljaar counts.** A hoofdleerkracht is appointed per (schooljaar, jaarfase), and a klas belongs to one schooljaar. But a subthema and its shared content are scoped by leeftijd alone and belong to no schooljaar (ADR-0025).~~ | ~~An appointment or a klastoewijzing counts while its schooljaar **has not yet ended** (today ≤ `Schooljaar.Eind`), including a schooljaar that has not started yet. Reasoning below the table.~~ **Ruled as defaulted by statement 23 (R20)**, for the shared content; a klas's own planning is I21. | E6-02, E6-04 |
| I12 | **A klas without a stated jaarfase.** A row that predates ADR-0025 can have none. For dekking, `Klasleeftijden` then **widens**: every leeftijd, or all three kleuter codes for leerjaar 0. That is the safe direction for a figure and the unsafe one for a right. | Such a klas gives its leerkrachten **no** leeftijd right. The rights check reads the stated `Jaarfase` only and does not reuse the widening. Directie states the jaarfase on the beheerscherm, which already calls those rows out. | E6-02 |
| I13 | **Re-scoping a subthema to another leeftijd** (`PUT /api/subthemas/{subthemaId}`, E1-19). It moves the subthema and all its shared content from one jaarfase to another. | Allowed only to someone who holds the subthema right (R5) at **both** the old and the new leeftijd, and always to directie. Whether the re-scope should exist at all stays E1-19's. *Statement 24 (R21) gave the hoofdleerkracht create and delete, not re-scope, so this stays a default.* | E6-02 |
| I14 | ~~**What "content" means under R19.** An `Activiteit` holds naam, type, hoek, verwachte uitkomsten, onderzoeksvraag, kleur and lengte beside its `Doelkoppelingen`. A `Subdoel` holds only its subthema, its leeftijd and its `Koppeling`: Art. IX.2 calls it a link to a leerplandoel, and the model has nothing else on it.~~ | ~~"Content" is every field of an activiteit except its goal links. **A subdoel has no content beyond its link**, so creating, changing or deleting one is a goal-link action (Directie, HL). Deleting or moving (E4-08) an activiteit that carries goal links counts as unlinking them; one without links is content.~~ **Retired by statements 26, 30 and 31 (R23–R25)**, put to the owner with the premise stated. *Two corrections:* Art. IX.2 does not call a subdoel a link; it defines it as *"a concrete, age-differentiated goal … linking to a Leerplandoel"*, and the pure-link shape is the model's (`Subdoel.cs`). And a move is not an unlinking; see I19. | E6-02 |
| I15 | **The activiteit fields statement 26 did not name.** It named *"naam, beschrijving, hoek en uitkomsten"*. The model has naam, hoek and verwachte uitkomsten, no `beschrijving`, and also type, onderzoeksvraag, kleur and lengte. | Every field of an activiteit except its goal links is content under R23. | E6-02 |
| I16 | **The subthema fields statements 24 and 28 did not name**: naam, duurWeken, probleemstelling and onderzoeksvragen. | They follow the subthema itself (directie, HL; R5, R21). Only streefwoordenschat is shared content (R28). Leeftijd is I13. | E6-02 |
| I17 | **A maker who is removed as a gebruiker.** | Their activiteiten become purely shared: from then on only a hoofdleerkracht or directie deletes them. | E6-02, E6-04 |
| I18 | **An activiteit the wizard creates** (R29, R32). | Its maker is the themabeheer holder who ran the wizard. *The delete half is ruled by statement 33 (R33): that maker may delete it while no goal is linked, with or without a klas at that leeftijd.* | E6-02, E6-05 |
| I19 | **Moving an activiteit to another thema** (E4-08). Art. IX.2: the activiteit keeps its identity and every `DoelKoppeling` on the way. So a move is neither a deletion nor an unlinking. But the links travel with it, and from then on they count for the klassen that plan the other thema. | Moving one **with** goal links needs the goal-link right (directie, HL; R19), because it moves those links into other klassen's dekking. Moving one **without** links is content, so every leerkracht of that leeftijd may. A move is not a deletion for the maker right (R25). | E6-02 |
| I20 | **Whether a hoofdleerkracht must also hold a klastoewijzing.** Statement 11 appoints *"een hoofdleerkracht"* per schooljaar; nothing says they must teach a klas of that jaar. | No. The hoofdleerkracht right comes from the appointment alone, so a hoofdleerkracht is a gebruiker appointed per (schooljaar, jaarfase). | E6-04 |
| I21 | **How long a klastoewijzing gives rights on that klas's own planning.** R20 answers the time question for the shared content only, which is what statement 23 asked. | With no end date. A klas belongs to one schooljaar already, so its planning is scoped by it; a leerkracht keeps editing the planning of a past klas. | E6-02, E6-04 |
| I22 | **How the server tells a wizard write from a hand write.** R32 rules that the app gets separate wizard actions, not their shape. The ordinary routes (`POST api/themas/{id}/subthemas`, `POST api/subthemas/{id}/doelkoppelingen`, `POST api/subthemas/{id}/activiteiten`) are the ones the subthema and subdoel rows deny to themabeheer. | **Wizard-only write actions**, on endpoints of their own, admitting themabeheer and directie only, and only for a thema that counts as new (I23). **Themabeheer gets no right on the ordinary subthema, subdoel and activiteit routes**, apart from the maker's delete right (R33). | E6-02, E6-05 |
| I23 | **What counts as a "new" thema** for R32. Statement 29's option said *"Wie een thema van nul opbouwt"*; statement 32's said *"voor een thema dat het daar van nul opbouwt"*. | A thema the wizard itself created, until that wizard run is finished or closed. From then on the ordinary rights apply: its subthema's and subdoelen are the hoofdleerkracht's. | E6-02, E6-05 |
| I24 | **When a wizard run ends.** Round 4's first QUESTION: nothing in the model marks a run as finished or closed, so the "new" window of I23 had no end the server could see. | A run ends when themabeheer or directie finishes or closes it, or **14 days after the wizard's last write action** in it, whichever comes first. From then on its thema is no longer new and the ordinary rights apply. *Chosen by the owner on 2026-09-14, when session `E6-02` put the two defaults E6-05 owed; the build follows it (R37).* | E6-02, E6-05 |
| I25 | **Whether the wizard may edit what it created earlier in the same run.** R32 and the matrix grant only *aanmaken*. | Yes, narrowly: while its run is open, the wizard's own write actions may also **edit and delete** a subthema, subdoel or activiteit **that the same run created**, and nothing else. *Chosen by the owner on 2026-09-14, with I24.* | E6-02, E6-05 |
| I26 | **Who deletes a thema.** §3 has no delete row, and the delete cascades to subthema's, subdoelen and linked activiteiten that R19, R24 and R25 reserve to directie and the hoofdleerkrachten (slice 3 audit round 1, MAJOR A, Q1). | A themabeheer holder deletes a thema only when it holds no subthema, subdoel or activiteit other than what its own open wizard run created; any other thema only directie deletes. A thema placed in a jaarplan is deleted by nobody, as before. *Chosen by the owner on 2026-09-14 (Q1, option b); the build follows it (R37).* | E6-02 |
| I27 | **The wizard and other people's work.** I25 let the wizard delete a run-created activiteit a hoofdleerkracht had since linked, and re-scope a run-created subthema holding others' content (MAJOR B, Q2). | The wizard's own write actions do not delete an activiteit that carries a goal link, or a subthema whose activiteiten carry one, unless the caller also holds the goal-link right at that leeftijd (R19); and they do not change the leeftijd of a subthema the run created while it holds a subdoel or activiteit the run did not create (I13). **Narrows I25.** *Chosen by the owner on 2026-09-14 (Q2, option a).* | E6-02, E6-05 |
| I28 | **What keeps a wizard run open.** R29 and §3 make the thema and its themadoelen wizard steps, but they are edited on the ordinary routes (Q3). | Only the wizard's own write actions move a run's last-write time (I24); editing the thema or its themadoelen through the ordinary routes does not. E6-05 may revisit this when the wizard screen exists. *Chosen by the owner on 2026-09-14 (Q3, option a, as built).* | E6-02, E6-05 |
| D1 | The first directie account is provisioned from configuration, because nobody exists yet to add it. | As ADR-0031 decision 7. | **E6-01** |
| D2 | The reason offered with question 6, *"Entra cannot express a hoofdleerkracht per jaar per schooljaar without a group per jaar per year"*, is the session's argument. It is not the owner's stated reason. | None: it is a rationale, not a rule. | None |

**I11 in more detail, as it was put to the owner.** Statement 23 ruled the default below (R20). The reasoning stays
because it is what the owner was shown.

- **What the model offers.** It has no "current" or "closed" schooljaar. A `Schooljaar` carries a `Start`, an `Eind`
  and its closures, and nothing else about its state. A `TimeProvider` is registered for the clock.
- **The schooljaar that contains today.** It leaves July and August with no hoofdleerkracht and no leerkracht of any
  leeftijd, which is exactly when subthema's are prepared. Rejected as the default.
- **The schooljaar selected in the UI.** It lets the client choose which appointment counts, so an appointment from
  a past schooljaar would still edit content that this year's klassen use. Rejected: the server would have to honour
  every appointment ever made.
- **Any schooljaar that is not closed.** It needs a closed state, and a directie action to set it, which the model
  does not have. It gives the default's answer when directie closes each year on time, and a worse one when they
  forget.
- **The default**, "has not yet ended", needs no new state.
  - Past appointments lapse on their year's last school day.
  - Next year's appointees can prepare in the summer.
  - In June, once next year's appointments exist, both sets count. R5 already allows several.
- **Graadklassen are not answered by it.** A klas states **one** jaarfase (ADR-0025). The leerkrachten of an L1/L2
  graadklas recorded as L1 get the R17 right for L1 content only, although they teach L2 pupils as well. That case
  stays with the Art. XIV graadklas question. *Statement 25 has since ruled it provisionally (R22).*

## 3. The matrix that follows

**This matrix supersedes FA §3.2's table through part 1 of the amendment (§5), ratified on 2026-09-14.** It binds as
far as the rulings it cites. *Until the ratification this read "drafted 2026-09-13. Under R13 the owner approves that
draft before anything is enforced from it."*

**A row is ratified only as far as the rulings it cites.**

- **Citations count at column level.** Every "Directie" ✓ rests on R3, whatever the row cites, and a "–" grants
  nothing, so it needs no citation.
- Whatever a row takes from an I-item of §2, or from a lettered question of §4, is a default and is not ratified
  with Art. VI.1.
- **Every row cites at least one ruling.** The Op.stap row rests on R3; the Exporteren row on R3 and R7, with I9 for
  its reach beyond one's own klas. *Fix round 1 named only the two wizard rows as uncited, and missed these two;
  fix round 2 replaced the wizard rows with one row under R29, and fix round 3 split it again under R32.*

*Revised 2026-09-13:* the doelsuggestie rows follow R14 and include "aanpassen". The shared-content rows follow R17
as narrowed by R19 and R23–R26, and R28 adds streefwoordenschat. The subthema row follows R21, the import row R27
and R34, and the wizard rows R29 as narrowed by R32. The maker's delete right follows the person (R33). "LK ander"
became "Ander".

Each column is a relation between a gebruiker and the resource a row is about:

- **"Directie"** = holds the directie right (R3, R16).
- **"TB"** = holds themabeheer.
- **"HL"** = a gebruiker appointed hoofdleerkracht for the jaarfase of the resource concerned, in a schooljaar that
  has not ended (R5, R20). They need not hold a klastoewijzing (I20).
- **"LK leeftijd"** = a leerkracht with a klastoewijzing on at least one klas whose **stated** `Jaarfase` equals the
  resource's `Leeftijd`, in a schooljaar that has not ended (R20, R22, I12). It applies only to content scoped by
  leeftijd: a subthema, its subdoelen and its activiteiten.
- **"LK eigen"** = a leerkracht with a klastoewijzing on the klas concerned (R15), with no end date (I21). It applies
  only to what belongs to a klas: the planning.
- **"Ander"** = **any gebruiker** who is none of the above for that resource: a leerkracht of another klas or
  another leeftijd, and also a gebruiker with no klastoewijzing at all. *Until fix round 1 this column was "LK
  ander", "a leerkracht who is none of the above", which left a gebruiker without a klastoewijzing in no column,
  and so without even reading.*

**A gebruiker holds the union of every column that applies to them.** A leerkracht of K3 groen who is also a
hoofdleerkracht of K3 has HL and "LK leeftijd" for K3 content, and "LK eigen" for K3 groen's planning. So "–" means
that this relation alone does not grant the action. It never takes away what another column grants.

| Actie | Directie | TB | HL | LK leeftijd | LK eigen | Ander |
| --- | --- | --- | --- | --- | --- | --- |
| Op.stap-doelen inladen/vernieuwen (R3; ADR-0022) | ✓ | – | – | – | – | – |
| Gebruikers, klassen en schooljaren beheren, leerkrachten aan klassen koppelen, hoofdleerkrachten aanstellen, themabeheer en het directierecht toekennen (R2, R3, R16; FA FR-12.2) | ✓ | – | – | – | – | – |
| Thema, themadoelen, kernwoordenschat aanpassen (R4, R18) | ✓ | ✓ | – | – | – | – |
| Thema's en activiteiten importeren, FR-1, met de doelkoppelingen op themadoelen en subdoelen die erin staan (R9, R27, R34) | ✓ | ✓ | – | – | – | – |
| Bij die import 'menselijke beslissingen verwijderen' aanvinken, voor themadoelen en subdoelen samen (R35) | ✓ | – | – | – | – | – |
| Thema-opbouwwizard doorlopen: thema, themadoelen en de AI-hulp (R29) | ✓ | ✓ | – | – | – | – |
| In de wizard subthema's, subdoelen en activiteiten aanmaken, voor een thema dat de wizard van nul opbouwt (R29, R32; I18, I22–I25) | ✓ | ✓⁵ | – | – | – | – |
| Doelsuggesties laten maken (R14) | ✓ | ✓ | – | – | – | – |
| Doelsuggesties aanvaarden, weigeren of aanpassen (R14) | ✓ | ✓ | – | – | – | – |
| Subthema's van een jaar aanmaken, aanpassen en verwijderen (R5, R21; (c), I13, I16) | ✓ | –⁵ | ✓ | – | – | – |
| Streefwoordenschat van een subthema aanpassen (R28) | ✓ | – | ✓ | ✓ | – | – |
| Gedeelde activiteiten aanmaken en hun inhoud aanpassen (R17, R23; I15) | ✓ | –⁵ | ✓ | ✓ | – | – |
| Een zelf aangemaakte activiteit zonder doelkoppelingen verwijderen (R25, R26, R33; I17) | ✓ | maker² | ✓ | maker² | – | maker² |
| Een activiteit met doelkoppelingen, of zonder maker, verwijderen (R25; (c)) | ✓ | – | ✓ | – | – | – |
| Subdoelen aanmaken, wijzigen en verwijderen (R24; (c)) | ✓ | –⁵ | ✓ | – | – | – |
| Doelen met de hand koppelen aan of ontkoppelen van gedeelde activiteiten (R19; (c)) | ✓ | – | ✓ | – | – | – |
| Een activiteit naar een ander thema verplaatsen (R19, R23; I19) | ✓ | – | ✓ | zonder koppelingen³ | – | – |
| Eigen activiteiten en subdoelen onder een subthema plaatsen (R6; shape: E6-10) | ✓ | ✓¹ | ✓¹ | ✓ | ✓ | ✓¹ |
| Jaarplan bewerken, (her)genereren, agenda, hoeken, algemene fiches (R7, R15; I21) | ✓ | – | – | – | ✓ | – |
| Jaarplan, agenda en dekking bekijken (R3, R7; I9) | ✓ | lezen | lezen | lezen | ✓ | lezen |
| Exporteren (R3, R7; I9) | ✓ | lezen⁴ | lezen⁴ | lezen⁴ | ✓ | lezen⁴ |

¹ R6 names a *leerkracht*. For a gebruiker with no klastoewijzing, including a themabeheer or hoofdleerkracht holder
who teaches no klas (I20), this ✓ is not ruled; E6-10 decides it with (a).

² Any gebruiker who created that activiteit (R26, R33), and only while no goal is linked to it (R25). The right
follows the person: it holds with or without a klas at that leeftijd, and after the schooljaar has ended (R33; R20
does not scope it). A hoofdleerkracht or directie may delete it anyway.

³ A default (I19): moving an activiteit with goal links needs the goal-link right, because the links travel and
start counting for the klassen that plan the other thema.

⁴ "lezen" on Exporteren means exporting what one may read. FA §3.2 gave the leerkracht of another klas "lezen" here.
*Fix round 2 set TB, HL and "LK leeftijd" to the same value:* they had "–" while "Ander" had "lezen", although they
are additive and never read less than an ordinary gebruiker. Its reach beyond one's own klas is I9.

⁵ Themabeheer creates subthema's, subdoelen and activiteiten **only through the wizard's own write actions, and only
for a thema the wizard is building from scratch** (R32). Changing existing subthema's stays with the hoofdleerkracht.
The shape of those actions, when a thema stops being new, and the right to edit and delete what the wizard's own open run created are defaults (I22–I25). **Themabeheer holds no right
on the ordinary subthema, subdoel and activiteit routes** (I22), which is what the "–" in those rows means, apart from the maker's delete right (R33, the maker² row).

TB and HL are **additive** to being a leerkracht, as the union rule above says.

One row grants ✓ to "Ander", and it cites the ruling that does so: **the personal-content row** follows R6.
Personal content belongs to a person, not to a klas, so "ander" has no klas to be other than. Its final shape is
E6-10's (open question (a)). *Until 2026-09-13 the two doelsuggestie rows did too, under R8. R14 removed that.*
"Ander" also reads and exports the plans of other klassen, which is I9, a default, and deletes an activiteit it
made, which is R33.

## 4. Still open, named rather than guessed

E6-01 is closed (R11). Each question is owned by the story that first needs it. Four are open: (a), (c), (d) and
(e). Four are settled: (b), (f), (g) and (h). *Revised twice on 2026-09-13: this read "Six are open; (b) is
settled", then "Five are open".*

- **(a) Who owns personal content, and who sees it?**
  - "Voor zichzelf" can mean the leerkracht (it follows them into next year) or their klas (it stays with the
    planning).
  - It also leaves open whether colleagues can see it, and whose coverage it counts for.
  - *Not the maker of R26.* An activiteit's maker only decides who may delete it; the activiteit stays shared.

  *Owner: E6-10.* Nothing personal is built until this is answered.
- **(b) The FR-1 import.** *Settled by statement 13 (R9).*
  - The import is for directie and themabeheer only. That is also the only route by which it creates subthema's at
    any leeftijd, a power R5 otherwise gives to that jaar's hoofdleerkrachten, and the only route by which it can
    discard teachers' decided links (the `MenselijkeBeslissingenVerwijderen` option of the school-content import).
  - *Fix round 2:* the import also writes `Manueel` goal links on themadoelen and subdoelen, which by hand are the
    hoofdleerkracht's (R19, R24). Statement 27 ruled that it may (R27), and statement 34 confirmed it after the
    correction (R34). The wizard does the same for subthema's and subdoelen, but only for a thema it builds from
    scratch (R29, R32).
  - *Ratified 2026-09-14:* the import's option to delete human decisions (`MenselijkeBeslissingenVerwijderen`),
    which lets a re-import remove decided themadoelen and subdoelen that the file no longer carries, is
    **directie-only** (statement 35, R35).
  - What E6-02 still owes is the gate itself. The 2026-08-03 ruling asked to gate the section rather than the route,
    and the frontend marker it relied on (a `magBeheerder` flag plus a section constant) **no longer exists in
    `frontend/src`**, so E6-02 must recreate that distinction.
- **(c) A jaar with no hoofdleerkracht appointed.** Only directie edits its subthema's until the owner rules
  otherwise. Since R19, R24 and R25 the same holds for the goal links, the subdoelen, and deleting the activiteiten
  only a hoofdleerkracht may delete. The leerkrachten of that leeftijd still edit content and create activiteiten.
  *Owner: E6-02.*
- **(d) Teacher visibility (FR-10.2, Art. XIV "Teacher visibility").**
  - The owner ruled that a leerkracht can view *"andere klassen"* (R7), and that directie sees everything (R3).
  - How many other klassen is I9. Whether directie confirms, narrows or wants it configurable is **directie's** call
    (question 4 in `docs/besluiten-gevraagd.md`). The Art. XIV bullet is therefore narrowed in the amendment, not
    removed.
  - E6-08 builds the read access **behind the E6-09 seam**.

  *Owners: E6-08 and E6-09.*
- **(e) Zorgcoördinator rights.** FA §3.1 marks them *"eventueel beperkte bewerkrechten, ter beslissing"*, which is
  an FA item and not an Art. XIV bullet. R4 lets a zorgcoördinator hold themabeheer, and R7 with I9 gives read
  access. Anything beyond that is still open. The default is that such a gebruiker, or anyone holding none of the
  four rights, does nothing else, apart from the maker's delete right (R33). *Owner: E6-02.*
- **(f) What accepting a doelsuggestie does to other klassen.** *Settled by statement 17 (R14), 2026-09-13.*
  - ~~R8 lets every leerkracht accept a doelsuggestie.~~ A suggestion hangs on a **school-wide thema**, and an
    accepted one counts for dekking in **every klas that plans that thema**. ~~So under R8 one teacher's acceptance
    moves the coverage figure of their colleagues' klassen, and that figure is the one the onderwijsinspectie
    reads.~~
  - The question put on 2026-09-11 described today's behaviour and did not mention this consequence.
  - ~~**Put it to the owner before E6-02 enforces R8.** Until then R8 stands as ruled.~~ It was put to the owner on
    2026-09-13, as this item required, and the owner changed the answer: only directie and themabeheer generate and
    review doelsuggesties. The fact in the first bullet still holds. It is now the reason for R14 rather than a risk
    of R8.
- **(g) The ICT-coördinator.** *Settled by statement 19 (R16), 2026-09-13, as the default had it.* ~~Art. VI.1 puts
  "directie / ICT-coördinator" under one role, `Beheerder`, while R3 speaks of directie only. Whether an
  ICT-coördinator who runs the beheer also gets R3's "edits all content" is open.~~ There is no separate ICT role.
  The right is *"is directie"*, and an ICT-coördinator holds it only if directie grants it. Part 1 of the amendment
  rewrites Art. VI.1 to say so.
- **(h) What R17 does to the dekking of parallel klassen.** *Settled by statement 22 (R19), 2026-09-13.* ~~New
  2026-09-13; not yet put to the owner.~~
  - A shared subdoel counts for dekking in **every klas at that leeftijd that places the thema**, and so does a
    decided goal link on a shared activiteit. These are layers 3 and 4 of
    `EfDekkingOpslag.HaalDekkendeKoppelingenAsync`, scoped to the klas's leeftijden through `Klasleeftijden`.
  - Under R17 every leerkracht with a klas of that leeftijd edits them. So the leerkracht of K3 groen can raise or
    lower the coverage figure of K3 blauw and K3 geel, and that is the figure the onderwijsinspectie reads.
  - It is the same kind of consequence that (f) named for doelsuggesties, only narrower: one leeftijd rather than
    the whole school. The question behind statement 20 did not mention it either.
  - ~~**Put it to the owner before E6-02 enforces R17**, as (f) was. Until then R17 stands as ruled.~~ It was put
    to the owner on 2026-09-13 (statement 22). The leerkrachten of that leeftijd keep the content, and only directie
    and the hoofdleerkrachten link or unlink goals (R19). What "content" covers is now R23–R25.
  - **What R19 does not reach.**
    - A doelsuggestie is a goal link on the **thema** (Art. IX.2 `doelsuggesties[]`), not on a shared activiteit or
      subdoel. It keeps its own rows under R14 (directie and themabeheer). So a hoofdleerkracht, who may link goals
      to a subdoel, may not accept a doelsuggestie.
    - ~~The FR-1 import (R9) is also its own row. It writes `Manueel` links at themadoel, subdoel and activiteit level
      (E1-18; `SchoolcontentImportDiff.KoppelingNiveau`). So a themabeheer holder, who may not link a goal to a
      shared subdoel by hand, can do it wholesale through an import. No row contradicts another, because each is its
      own ruling. Whether that is intended is put to the owner.~~ *Corrected in fix round 2, on two counts.* The
      import writes `Manueel` links on **themadoelen and subdoelen only**: `KoppelingNiveau.Activiteit` exists in
      the diff type but is never emitted, and the service says activiteit goal links are not carried. And the text
      resolved the conflict with R19 silently, in favour of R9. It was put to the owner as statement 27, who ruled
      that the import may (R27), and confirmed it after the correction (statement 34, R34); R19 now says "by hand".

  *Owner: E6-02.*

## 5. The amendment this owes (Art. XI)

It comes in **two parts**, each a dedicated commit that also updates CLAUDE.md and the FA.

**Part 1: roles, ownership and visibility.**

- **When:** owed **before E6-02 or E6-04 build on this ADR**. Both stories carry that gate.
- **Who:** ~~whichever of the two starts first writes it, as its first task.~~ The combined E6-02/E6-04 build (R12)
  writes it as its first task. Drafted 2026-09-13 on `story/E6-02-amendering`, audited in four rounds, and
  **ratified by the owner on 2026-09-14** (R13, R36), with its row in the Art. XI ratification log.
- **What it touches:**
  - **Art. VI.1:** name the rights, and restate "configurable" as in §1.2;
  - **the `Thema` line of Art. IX.2:** "owned by the team/directie" becomes directie plus themabeheer;
  - **the Art. XIV "Teacher visibility" bullet:** narrowed as in §4 (d);
  - **Art. XII:** the glossary gains hoofdleerkracht, themabeheer and gebruiker (Art. II.4). *The 2026-09-13 draft
    also adds directierecht (R16), klastoewijzing (R15) and, in fix round 2, maker (R26).*
  - **FA §3.1:** the roles;
  - **FA §3.2:** the matrix;
  - **FR-3.1:** *"Leerkrachten kunnen thema's, subthema's en activiteiten toevoegen, wijzigen en verwijderen"*;
  - **FR-10.2:** the default and the seam;
  - **FR-12.2**;
  - **ADR-0008:** a status note, since its "owned by team/directie" is superseded here in the same way.
  - *Added 2026-09-13, because R14 and R17 made more sentences false:*
    - the `doelsuggesties[]` line of Art. IX.2 ("awaiting teacher accept/reject");
    - a clarifying note on Art. IV.1 ("teacher confirmation");
    - FR-4.2/FR-4.3, FA §4 and FA §7, each of which says that *de leerkracht* reviews a suggestion;
    - FR-7.2 ("doelkoppelingen");
    - FR-1.1 ("de gebruiker" uploads, which R9 narrowed on 2026-09-11) and FA A.5 ("team/directie");
    - FA §11's visibility question;
    - ADR-0022's status, whose expected `Beheerder` is now the directie right;
    - *fix round 1:* ADR-0026's status (streefwoordenschat) and ADR-0010's status ("the teacher decides" restates
      Art. IV.1);
    - *fix round 2:* the `Activiteit` line of Art. IX.2 (its maker, R26), the Art. XIV graadklas bullet and FA §11's
      graadklas question (R22), and ADR-0026's pointer rewritten for R28;
    - *fix round 3:* a pointer at Art. IV.8 and at FA A.7, since the wizard's user is now a themabeheer holder (R29,
      R32).

    The FA keeps its v0.4 text. It gains **Bijlage A.11**, with a pointer at each clause A.11 refines, as A.10 did.

  Part 1 can only state what §1 rules. Anything from §2 that the owner has not confirmed by then goes in as a default,
  marked as a default.

**Part 2: personal content.** It touches the `Activiteit` and `Subdoel` lines of Art. IX.2. It is owed **with
E6-10**, because it cannot be written before open question (a) is answered. *(Part 1 already adds the maker to the
`Activiteit` line. That is not personal content: R26.)*

**E6-01 needs neither part.** Its `Gebruiker` with *"is directie"* stays inside Art. VI.1's existing `Beheerder`
role, and it builds no per-klas or per-jaar check. *(E6-01 closed on R11. Since part 1 was ratified on 2026-09-14, that role is the
directie right, and "is directie" keeps its meaning.)*

## Alternatives considered

- **Roles as Entra groups or app roles.** Offered to the owner. Rejected by statement 6.
- **Everyone in the tenant may log in, and the first login creates a user without rights.** Offered. Rejected by
  statement 7. ADR-0031 still recommends setting *assignment required* in Entra as a second layer.
- **Any hoofdleerkracht may edit any thema.** Offered. Rejected by statement 8.
- **The hoofdleerkracht of any jaar that uses the thema may edit it.** Offered. Rejected by statement 8.
- **Only the hoofdleerkracht edits activiteiten and subdoelen.** Offered. Rejected by statement 9.
- **One hoofdleerkracht per jaar, or a fixed appointment across schooljaren.** Offered. Rejected by statement 11.
- ~~**Only those who may edit the thema may generate and review its doelsuggesties.** Offered. Rejected by
  statement 12.~~ **Chosen by statement 17 (2026-09-13)**, which reverses statement 12.
- **Every leerkracht keeps importing** (the 2026-08-03 ruling). Offered. Rejected by statement 13.
- **Encode consensus**, so that a hoofdleerkracht's edit waits for the other teachers' approval. Not offered. It is
  recorded under I1 so that nobody builds an approval flow from the words "in overeenstemming" without asking.
- **Keep E6-01 open until a real-tenant sign-in.** Offered. Rejected by statement 14. The sign-in stays a
  precondition on E7-11.
- **Build E6-02 first and E6-04 after it, or only E6-02 now.** Offered. Rejected by statement 15, because either
  leaves a state in which leerkrachten can edit nothing.
- **Write and ratify the amendment in one step.** Offered. Rejected by statement 16.
- **Every leerkracht keeps generating and reviewing doelsuggesties** (R8 as it was). Offered with the dekking
  consequence stated. Rejected by statement 17.
- **Every leerkracht generates doelsuggesties, and only directie and themabeheer accept or reject them.** Offered.
  Rejected by statement 17.
- **One leerkracht per klas.** Offered. Rejected by statement 18.
- **A separate beheer role for the ICT-coördinator.** Offered. Rejected by statement 19.
- **Shared subdoelen and activiteiten for directie and the hoofdleerkracht only** (the I5 default). Offered, with
  the cost stated that an ordinary leerkracht could then edit no activiteit until E6-10. Rejected by statement 20.
- **Every hoofdleerkracht edits thema's.** Offered. Rejected by statement 21.
- **Leave goal links on shared content with every leerkracht of that leeftijd** (R17 as first read). Offered with
  the parallel-klas dekking consequence stated. Rejected by statement 22.
- **Only the current schooljaar counts.** Offered with its cost stated (no preparing for next year before its first
  school day). Rejected by statement 23.
- **A hoofdleerkracht only edits existing subthema's; creating and deleting stays with directie.** Offered.
  Rejected by statement 24.
- **Let a klas state several jaarfasen before rights are enforced.** Offered as a model change and an extra story.
  Rejected for now by statement 25.
- **A leerkracht of that leeftijd may also delete an activiteit that carries goal links.** Offered with the
  parallel-klas dekking consequence stated. Rejected by statement 26.
- **Only directie imports, because the import writes links.** Offered. Rejected by statement 27, and again, after
  the correction, by statement 34. *Its "op alle niveaus" overstated the import; see §1.3.*
- **Streefwoordenschat follows the subthema** (directie and HL only). Offered as the recommendation. Rejected by
  statement 28.
- **The wizard shows each step to whoever may do it.** Offered as the recommendation. Rejected by statement 29.
- **"Eigen" means personal content (E6-10), so no leerkracht deletes an activiteit until then.** Offered. Rejected
  by statement 30.
- **The maker always deletes their own activiteit, links or not.** Offered with the dekking consequence stated.
  Rejected by statement 31.
- **Themabeheer may also use the wizard on an existing thema, to create and change its subthema's and subdoelen.**
  Offered. Rejected by statement 32.
- **Themabeheer creates and changes subthema's and subdoelen everywhere, also outside the wizard.** Offered.
  Rejected by statement 32.
- **A maker may delete only while they have a klas of that leeftijd in a current schooljaar.** Offered. Rejected by
  statement 33.
- **Themabeheer may also switch on the import's option to delete human decisions.** Offered as how it works today.
  Rejected by statement 35.
- **Ratify the draft as it stood, or read the full draft first.** Offered. Rejected by statement 36.
- **Go through the defaults together before building.** Offered. Rejected by statement 37.

## Consequences

**The model gains five things**, built in the stories named, not all at once:

- **a `Gebruiker`**, created by E6-01: the Entra identity (tenant id and object id), naam, sign-in address, and *is
  directie*. E6-04 adds *heeft themabeheer* and maintains both flags. Directie may set *is directie* on someone else
  (R16), and the last directie still cannot be removed or demoted (ADR-0031 decision 7).
- **a klastoewijzing `(Gebruiker × Klas)`**, in E6-04. It is many-to-many, per R15 (this said "per I7" until the
  owner ruled it on 2026-09-13). For the shared content it counts while the klas's schooljaar has not ended (R20);
  for the klas's own planning it has no end date (I21).
- **a hoofdleerkrachtaanstelling `(Gebruiker × Schooljaar × Jaarfase)`**, in E6-04. A jaar may have several in one
  schooljaar (R5), and each counts while its schooljaar has not ended, including before it starts (R20). It needs no
  klastoewijzing beside it (I20).
- **a maker on `Activiteit`**, a nullable reference to the `Gebruiker` who created it, in E6-02 (R26). It is empty
  for activiteiten that exist before E6-02 and for imported ones. It only decides who may delete the activiteit
  (R25), its right follows the person (R33), and it is **not** the owner of the next bullet. What happens to it when
  that gebruiker is removed is I17; the maker of an activiteit the wizard creates is I18.
- **an owner on `Activiteit` and `Subdoel`**, in E6-10, after (a) and I6. Where there is no owner, the content is
  shared.

**Staff personal data enters the system.** Naam, address and two Entra identifiers are allowed under Art. VI.2,
which bans pupil data only. They still need an entry in the processing register and a retention period
(Art. VI.6), which is routed to **E7-06**. *Fix round 2:* the maker links school content to a named staff member, so
it belongs in the same register entry, and I17 is its retention rule when the gebruiker leaves.

**ADR-0022's seam gets its answer.** The `Curriculumbeheer` policy becomes "directie" in E6-02, as ADR-0022
expected. ADR-0031 adds its authentication half first.

**Enforcement stays one matrix.** ADR-0011 §2 stands:

- the rows in §3 become named policies declared in one place;
- a controller names a policy, and never tests a role inline;
- the "LK eigen" and "HL" columns depend on the klas or jaar a request is about, so they are **resource-based**
  ASP.NET Core authorization handlers. Role claims alone cannot express them. Neither can the maker right (R25),
  which depends on the activiteit;
- **the klas→leeftijden mapping the "LK leeftijd" column uses lives in one place** (R22), so directie's graadklas
  decision changes that place and nothing else. It sits beside `Klasleeftijden` without reusing it: that join
  widens when it cannot derive a leeftijd, which is right for a dekking figure, and a right must fail closed
  instead (I12);
- **the wizard writes through actions of its own** (R32). By default they are endpoints that admit themabeheer and
  directie for a thema the wizard is building from scratch (I22, I23), and the ordinary subthema, subdoel and
  activiteit routes stay closed to themabeheer, apart from the maker's delete right (R33);
- **the FR-1 import's option to delete human decisions is directie-only** (R35), one switch for themadoelen and
  subdoelen alike.

**Cost, stated.** Directie carries the setup. Nobody but the configured first account can log in until directie has
added them.

## Compliance trace

- **Constitution:**
  - Art. VI.1 (roles, configurable; amendment part 1 ratified 2026-09-14);
  - Art. VI.2 (the invitation gate keeps pupil accounts out);
  - Art. VI.5 (personal login);
  - Art. VI.6 (staff data, including the activiteit maker, routed to E7-06);
  - Art. IX.2 (the `Thema`, `doelsuggesties[]` and `Activiteit` lines in part 1, personal content in part 2);
  - Art. II.4 and XII (the glossary, in part 1);
  - Art. IV.1/IV.8 (doelsuggesties are generated and reviewed by directie and themabeheer only, R14; IV.1's
    "teacher confirmation" is clarified in part 1; the wizard, its AI steps included, is for themabeheer, R29, and
    creates subthema's and subdoelen only for a thema it builds from scratch, R32; IV.8 gets a pointer in part 1).
    *Until 2026-09-13 this line read "doelsuggesties stay with every teacher under R8".*
  - Art. V.1 (§4 (f), the reason for R14: an acceptance moves the dekking of every klas that plans the thema; §4 (h),
    the same effect within one leeftijd, settled by R19: goal links on shared content for directie and the
    hoofdleerkrachten only, by hand; R25 keeps a maker from deleting an activiteit that carries links);
  - Art. III (school content autonomy);
  - Art. XI (the two-part amendment);
  - Art. XIV (teacher visibility is narrowed, not closed; graadklassen are ruled provisionally by R22, with the
    klas→leeftijden mapping in one place).

  Zorgcoördinator rights are an FA §3.1 "ter beslissing" item, not an Art. XIV one.
- **Backlog:**
  - E6-01 (Gebruiker and login; closed on R11);
  - E6-02 and E6-04, **built and delivered together** (R12):
    - the matrix as policies;
    - (b)'s gate, (c) and (e), and the defaults I1, I2, I9, I12, I13 and I15–I28;
    - R19–R37, including the one-place klas→leeftijden mapping, the activiteit maker and the wizard's own write
      actions;
    - users, assignments, appointments, themabeheer and the directie right (R15, R16);
  - E6-08 (read, behind the E6-09 seam), E6-09 `[!]`, E6-10 (personal content);
  - E10-01 (streefwoordenschat is shared content, R28), E1-19 (re-scoping, I13), E6-05 (the wizard is for
    themabeheer, R29, with its own write actions for a thema built from scratch, R32; I22–I25);
  - E7-06 (processing register, including the maker), E7-11 (the deployment gate these close, and the real-tenant
    sign-in R11 leaves there).
- **FR/NFR:** FR-1, FR-3.1, FR-4, FR-7.2, FR-10.1, FR-10.2, FR-12.2, FA §3.1/§3.2/§4/§7, A.7 and Bijlage A.11; NFR-5,
  NFR-6.
