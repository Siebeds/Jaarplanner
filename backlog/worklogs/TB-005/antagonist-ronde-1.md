# Antagonist Review: TB-005 / ADR-0035, round 1 (ontwikkelingsrapport K3)

*Saved verbatim by session `kindrapport` on 2026-09-14. The audited commits are `9fbfcac` and `8729a15`. How each
finding was handled is recorded in ADR-0035's "Revised after audit round 1" note and in the TB-005 werklog.*

**Verdict:** VIOLATIONS FOUND. 3 MAJOR, 8 MINOR, 4 QUESTION, no CRITICAL. TB-005 is not done until the MAJORs are fixed
or the owner explicitly waives them.

**Scope audited:** `git diff origin/main...HEAD` (commits `9fbfcac`, `8729a15`):
- `backlog/technische-backlog/TB-005-ontwikkelingsrapport-voor-de-derde-kleuter-binnen.md`
- `docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md`
- two rows in `docs/adr/README.md`

Every claim was checked against the texts on this branch, which already includes PR #55 (the Art. VI.1 amendment).

**Mapping of the 22 rulings:** all 22 map correctly.
- Brief 1→R1, 2→R2, 3→R3, 4→R4, 5→R5, 13→R6, 20→R7, 14→R8, 15→R9, 9→R10, 22→R11, 10→R12, 11→R13, 8→R14, 16→R15,
  6→R16, 17→R17, 18→R18, 7→R19, 19→R20, 12→R21, 21→R22.
- Every chosen option is correct, and "against the recommendation" is correctly stated for R7 and R20.
- Fidelity defects are in MINOR 1.

## Findings

### [MAJOR] 1. The session's own decisions sit under an owner-accepted status, and §4 would write them into the constitution as ratified
- **Article:** Art. XI.1. Art. VI.1 (CONSTITUTION.md:129, which says defaults are not ratified), Art. IV.2 and IV.3.
- **Where:**
  - ADR-0035:3-7. Only the "**D**"-marked items are exempted, and the deciders are "the owner, for §1 only".
  - ADR-0035:201-204, the IV.2 deviation.
  - ADR-0035:204, the IV.3 deviation.
  - ADR-0035:283-284: "a new Art. VI.7, which carries the rules of §3.3 to §3.8".
  - ADR-0035:304-305: "Rejected (§3.5)", rejected by nobody named.
- **Problem:**
  - Several §2 and §3 decisions carry neither an R nor a D label: the IV.2 and IV.3 deviations, the §2 bounds (no
    following a child across years, no numeric scores or comparisons), the name-filter design, image storage in
    Postgres, no column-level encryption, the logging rules, and the new "MIT/Apache/BSD only" licence rule (Art. VIII
    names only ClosedXML vs EPPlus). The status line leaves them looking accepted by the owner.
  - **R1 asked to amend "Art. I.2 en VI.2" only.** No ruling touches Art. IV. R21's option text ("De leerkracht
    aanvaardt of weigert de herwerking") is consistent with the current IV.2 and does not decide whether a rejection is
    persisted.
  - So an amendment to a core article (AI is advisory) comes from the session. §4 would then import D4–D8 and these
    items into VI.7 as ratified text. That breaks the rule the 2026-09-14 log entry (CONSTITUTION.md:295) set for
    exactly this situation.
- **Soundness of the IV deviation, for when it is put to the owner:**
  - The data-minimisation motive is right.
  - But the reasoning mixes up two things: storing a *status* and storing a *text*. IV.2 can be met by persisting a
    `geweigerd` decision with no text at all. The ADR does not consider this option.
  - The server "stores nothing" when it returns a proposal. So whether a saved text is `aanvaard` or `manueel` is
    whatever the client says; the server cannot verify it. The ADR presents it as provenance without saying so.
- **Required fix:**
  - Rewrite the status line: §2 and §3 are the session's design except where an R is cited.
  - Put the IV.2 and IV.3 deviation to the owner as an explicit question, or label it D and keep it out of the ratified
    text.
  - State in §4 that VI.7 lists D-items (and any other session choice) as defaults, not ratified, as VI.1 does.

### [MAJOR] 2. R20 against Art. VI.6 is not routed, and §3.8 overstates the protection that remains
- **Article:** Art. VI.6, Art. VI.2, Art. XI.1.
- **Where:** ADR-0035:92-93 ("it does not remove the gates that already exist"), :252 ("they are the ones that matter"),
  :255-256 (E7-11), :264-265, and §4 :274-297.
- **Problem:**
  - The only existing gates on real data are:
    - **E7-11**, which waits on E6-02 only (backlog/E7-niet-functioneel.md:99-105);
    - **E7-05**'s database role (:57).
  - Neither gates the processing register, informing parents, or a DPIA.
  - E7-06 (:59-63) is an ordinary open story, not a gate. So once E6-02 lands, pupil data can enter a real environment
    while Art. VI.6 ("A processing register and retention periods are provided") is unmet.
  - §4 does not amend VI.6 and does not say how it applies to this report.
  - The data concerns children and evaluates them, and partly passes through AI. That meets at least two EDPB WP248 DPIA
    criteria ("evaluation or scoring", "vulnerable data subjects"), so a DPIA is very likely required *before* processing
    starts (AVG art. 35(1)). The negatives list (:327) names the register and the parents but not the DPIA.
- **Required fix:**
  - Add VI.6 to §4. Either (a) gate real-data environments on the register and retention entry, or (b) record the
    owner's waiver of that order with its cost stated (art. 13, 30 and 35).
  - Strike the "gates that already exist" overclaim.
  - Make the directie question say that a DPIA is probably required and must come before real data, not only "whether a
    DPIA is needed".

### [MAJOR] 3. The §4 list of amendments and dependent texts is incomplete, and the ticket's AC4 inherits the gap
- **Article:** Art. XI.1 (dependent text in the same change), Art. XIII.
- **Where:** ADR-0035:274-294; TB-005:42-50 and :57.
- **Missing:**
  - **Art. VI.1:**
    - "four rights" also appears at CONSTITUTION.md:125 and :152 (default **(e)**, which today limits a zorgcoördinator
      to themabeheer plus reading);
    - :131, "A zorgcoördinator is a gebruiker who may hold themabeheer";
    - :127, "What each right allows is **one matrix**, ADR-0030 §3". ADR-0035 §3.3 is a second matrix, and a pointer in
      ADR-0030 (§6, :348) does not make it one.
  - **Art. IV.1**'s clarification (:86) lists who decides each kind of AI output. A third kind needs a line. §4 lists
    only IV.2–IV.5.
  - **Art. VI.6** (see MAJOR 2).
  - **Art. XII:** Rapportbeoordeling and Algemeen besluit are missing from the glossary list (:286-287).
  - **FA:** §3.1:105 (zorgcoördinator "leesrechten over meerdere klassen"), and A.11:425 and :449 ("vier rechten",
    (e)).
  - **CLAUDE.md:** the "AI conventions" lines "Return suggestions as `voorgesteld` … Surface the motivation" and the
    "persist the status" working agreement. Both contradict §3.5, and "`CLAUDE.md`" alone in the list does not point
    anyone at them.
  - **Agent and skill texts that enforce the old rule:**
    - `.claude/agents/antagonist.md:44`, :50, :55, and checklist item 3 ("status … and a `motivatie`");
    - `.claude/agents/implementer.md:39`;
    - `.claude/skills/jaarplan-build/SKILL.md:88` ("no pupil data … CRITICAL; an antagonist CRITICAL is a hard stop").
    - After the amendment these would stop every FB build ticket, or teach sessions to ignore a CRITICAL. They are agent
      configuration: the owner has to change them himself. An agent message is not his consent.
  - **Lesser:** `backlog/E6-beheer-rollen-samenwerking.md:38` ("(no pupil data)"). Code comments that become false with
    the build: `IAiClient.cs:19` ("built only from school + Op.stap data") and `JaarplanGeneratiePromptBuilder.cs:129`
    ("no pupil data exists").
- **Required fix:** add these to §4 and to TB-005 "Voorgestelde wijziging", and widen AC4 to match.

### [MINOR] 1. Ruling quotes are not fully verbatim, which fails TB-005 AC1 ("letterlijk")
- **Where:** ADR-0035:88, :86.
- **Problem:**
  - R18's option text is cut off without an ellipsis. It drops "Zoals directie nu al themabeheer geeft."
  - R16 omits the option descriptions. One of them, Co-teacher "kan de rapporten lezen **en mee invullen**", is the basis
    for the fill-in ✓ in the "Leerkracht of the klas" column. Directie's "van alle K3-klassen lezen" is also left out.
  - Not verifiable against the brief: R8's and R20's quoted descriptions, and the not-chosen options of R9, R12, R13
    and R22. The brief gave none of them.
- **Required fix:** quote in full, then confirm the unverifiable items against the session transcript.

### [MINOR] 2. "No name ever leaves the server" overclaims, and one §3.5 sentence assumes an edit that hasn't happened
- **Article:** Art. VI.2 and VI.3; Art. XI.1.
- **Where:** ADR-0035:212-219.
- **Problem:**
  - The heading promises more than the "limit" sentence under it, and more than R21 promised ("de naam … wordt nooit
    meegestuurd"), which a best-effort filter cannot keep.
  - Pseudonymised text is still personal data (AVG recital 26). The ADR should say so, so no reader treats the AI path
    as anonymous.
  - Many Dutch first names are ordinary words (Roos, Storm, Lente), so whole-word replacement will also blank common
    nouns.
  - "is recorded under E7-06" (:217-218) is false today. E7-06 (:59-63) says nothing about abuse monitoring. The
    sentence assumes the in-step edit has already landed.
- **Required fix:** rename the heading to what it does ("names of the klas's children are replaced"), and write "will be
  recorded".

### [MINOR] 3. The coordination claims in the ADR, the ticket and the commit are false
- **Where:**
  - ADR-0035:13-14: ADR-0030 "was held by session E6-02 when this was written";
  - ADR-0035:348: "once session E6-02 releases it";
  - TB-005:75: werklog 11:36, "die sessie E6-02 nog vasthoudt";
  - the commit message of `8729a15`.
- **Problem:**
  - `groepschat.md` records E6-02 releasing CONSTITUTION.md, the FA and ADR-0030 at **11:26**. That was before ADR-0035
    was drafted (11:27–11:36). No claim file exists for them now.
  - The brief repeats this claim.
  - The real obstacle is E6-02's **unpushed** I24/I25 amendment to Art. VI.1 on `feature/e6-rollen-rechten`. It will
    conflict with this branch's VI.1 hunks.
- **Required fix:** correct the ADR. Add a new werklog line; the old line cannot be edited.

### [MINOR] 4. Parts of the ADR read as if the amendment has already landed
- **Article:** Art. XI.3; ADRs are subordinate to the constitution.
- **Where:** compliance trace ADR-0035:354, :356 and :360 ("amended"); :366 ("Art. XI: amended in a dedicated commit").
  Index status "Accepted" (README row 0035).
- **Problem:**
  - Art. XI is not amended at all; it is the process being followed.
  - Until the amendment commit exists, an "Accepted" ADR contradicts Art. I.2 and VI.2 as they stand. This is the
    ADR-0025 failure the log records (CONSTITUTION.md:288).
- **Required fix:** write "to be amended". Mark the status as pending the amendment. Do not merge this branch without
  the amendment commit.

### [MINOR] 5. D6 is a privacy default resting on another default
- **Where:** ADR-0035:180-181.
- **Problem:**
  - I21 (CONSTITUTION.md:148) is an unratified default about the klas's *planning*. D6 extends it to indefinite access
    to children's reports in past schooljaren, until directie wipes them.
  - It does not say whether that access is read-only or also edit.
  - It is the most permissive reading, while R17 shows the owner leaning restrictive.
- **Required fix:** read-only after the schooljaar ends, or ask the owner (QUESTION 3).

### [MINOR] 6. The ADR touches existing Art. XIV decisions but says it touches none
- **Where:** ADR-0035:368 ("no new open decision"); D9 :269-270; R13; R17.
- **Problem:**
  - **D9** touches "Ordering & graadklassen" (CONSTITUTION.md:355). A menggroep recorded as K2 gets no report for its
    K3 children. Eligibility should go through VI.1's one-place klas→leeftijden mapping (:123), and D9 does not say it
    does.
  - **R13** (PDF and Word) does not settle "Export formats" (:363) for FR-11. The ADR should say so.
  - **R17** narrows "Teacher visibility" (:360), which is directie's decision.
- **Required fix:** name these three bullets and state the effect on each.

### [MINOR] 7. Rapportdoel membership is not specified at the edges
- **Where:** ADR-0035:128, :139-140, :151-153.
- **Problem:**
  - A `Subdoel` owns a `DoelKoppeling` with a status (`Subdoel.cs:37`). The ADR does not say whether a `voorgesteld` or
    `geweigerd` subdoel may be bundled into a rapportdoel.
  - An FR-1 re-import removes undecided subdoelen without any option (`SchoolcontentImportService.cs:660-662`), so
    rapportdoelen shrink silently.
  - A subthema re-scope (Art. IX.2 `PUT`, E1-19, still open) moves K3 subdoelen into another leeftijd while they remain
    in a K3 rapportdoel.
- **Required fix:** decide which statuses may be bundled (D-level), and name the re-scope case.

### [MINOR] 8. Kindtekening: the text overclaims, and metadata stripping is under-specified
- **Where:** ADR-0035:126-127 and :224-225.
- **Problem:**
  - "Nothing else about a child is stored: no … photo" cannot hold when the upload is a photo. It may show the child,
    other children, or the child's written name.
  - Stripping "all metadata" is only reliable if the image is re-encoded (EXIF, XMP, IPTC, PNG text chunks).
  - There is no pixel limit against decompression bombs.
- **Required fix:** narrow the sentence, and require re-encoding plus a dimension limit.

### [QUESTION] 1. Art. IV deviation
Does the owner rule that AI rewrite proposals are never persisted, and that rewrites carry no motivation (MAJOR 1)? Or
does he prefer that a `geweigerd` decision is persisted without its text?

### [QUESTION] 2. R21 best-effort
Does a filter that misses nicknames, misspellings and names from outside the klas satisfy R21's "nooit"?

### [QUESTION] 3. D6
After the schooljaar ends, read-only or read-write? And should access end at some point short of the wipe?

### [QUESTION] 4. R19 retention term
AVG art. 5(1)(e) requires a concrete term in the register, and "until directie wipes" is not one. Should the directie
question ask for a term, and should the app at least remind directie that it is due?

## Checks run (proof of thoroughness)
- **Art. I.2 / FA §2.3:** read CONSTITUTION.md:40-47 and FA:71-77. The claim that parent access and integration stay
  non-goals is correct.
- **Art. II:** Dutch entity names confirmed. The ticket is Dutch. The commit messages and the ADR are English, as II.6
  requires.
- **Art. III:** no Op.stap content is mutated. Rapportdoelen bundle school content only.
- **Art. IV:**
  - `IAiClient` exists (`backend/src/Jaarplanner.Application/Ai/IAiClient.cs:15`), as ADR-0010:16/21 says, and supports
    a fake.
  - The deviations are declared openly but come from no ruling (MAJOR 1). The IV.1 gap is in MAJOR 3.
- **Art. V:** "never counts for dekking" is consistent with V.1.
- **Art. VI.1:**
  - Checked the I9 text (:139), the I21 text (:148), the "which schooljaar counts" rule (:121, which D4 matches), (e)
    (:152), "one matrix" (:127) and the ratification scope (:129).
  - No overreach into ADR-0030: it is not edited, and the build is sequenced after E6-02.
- **Art. VI.2, VI.3, VI.5, VI.6:**
  - The ADR-0011 §4 quote (:18) is verbatim. ADR-0011 §2 (:16) matches. ADR-0016's "no pupil PII" (:21) is verbatim.
  - ADR-0034: "alleen fictieve data" (:37, :44), 7-day backups (:65), no AI (:47), no blob storage. All confirmed.
  - E7-11 is `[!]` and waits on E6-02 only. E7-06 has no abuse-monitoring note. E7-09 (:76) confirmed.
  - No `UseHttpLogging`, `EnableSensitiveDataLogging` or logger in `AzureAiFoundryClient`, so "request-body logging
    stays off" is true today.
- **Art. VIII:** no dependency is added now. The licence rule is new and conservative (MAJOR 1).
- **Art. IX:** the entities are consistent with the leeftijd scoping in IX.2 and ADR-0025. The Subdoel/DoelKoppeling
  claim was checked against `Subdoel.cs`.
- **Art. X / XI:** docs only. There is no amendment commit yet. The "presumes landed" language is in MINOR 4.
- **Art. XII:** glossary gaps are in MAJOR 3. "Never colour alone" is honoured (:237).
- **Art. XIV:** see MINOR 6.
- **Dependent texts:** grepped the whole repo (worklogs excluded) for pupil, PII, leerlinggegevens, persoonsgegevens and
  fictional. Results are in MAJOR 3.
- **Ticket:** `tickets.mjs check` passes. The keys and the TB section order match TICKETS.md:84-105. The ticket holds no
  pupil data. The ACs are checkable, but AC1 and AC4 fail as things stand (MINOR 1, MAJOR 3).
- **Coordination:** read the claims folder and the `groepschat.md` tail (MINOR 3).

## Open questions surfaced
- **Art. XIV "Ordering & graadklassen":** D9.
- **Art. XIV "Teacher visibility":** R17 narrows it for reports.
- **Art. XIV "Export formats":** R13 does not settle FR-11.
- **For directie in `docs/besluiten-gevraagd.md`:** confirmation of the rulings, a concrete retention term, informing
  the parents, and a DPIA that is likely required before real data.
