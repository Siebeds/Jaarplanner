# ADR-0035 — The ontwikkelingsrapport for the derde kleuter: pupil data enters scope, for this report only

- **Status:** Accepted for the rulings in §1 (project owner, 2026-09-14). Everything in §3 marked **D** is the recording
  session's default, not a ruling; the build follows it until the owner changes it. The constitution amendment this ADR
  asks for (§4) is a dedicated commit of its own (Art. XI.1).
- **Date:** 2026-09-14
- **Deciders:** Siebe De Saedeleir (projecteigenaar), for §1 only. The rulings were given in session `kindrapport`, as
  answers to four rounds of multiple-choice questions whose options and stated costs are quoted below.
- **Narrows:** [ADR-0011](0011-authn-authz-rbac-gdpr.md) §4 (*"the model has no schema for pupil PII"*) and the *"no
  pupil PII"* constraint of [ADR-0016](0016-azure-hosting-eu-residency.md). Both still hold everywhere outside the
  ontwikkelingsrapport.
- **Extends:** [ADR-0030](0030-rollen-en-rechten-in-de-app.md) with a fifth right (§3.4) and with rows its §3 matrix does
  not have. ADR-0030 itself is not edited here: it was held by session E6-02 when this was written, and gains a pointer
  when it is released.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (AI advisory architecture),
  [ADR-0025](0025-subthema-per-leeftijd.md) (subdoelen per leeftijd), [ADR-0034](0034-demo-omgeving-op-azure.md) (the demo
  holds fictional data only), [ADR-0033](0033-ticketbacklog-en-kanbanbord.md) (tickets carry no pupil data).
- **Backlog:** TB-005 (this decision and the amendment). The build follows as FB tickets (§6). E7-06 widens.

## Context

The owner asked, on 2026-09-14, to start building a report per child:

> *"Kindvolgsysteem/rapport/groeiboekje voor elk kind (naam voor dit rapport nog beslissen): Dit rapport wordt enkel aan
> ouder gegeven in 3de kleuter. Dit rapport wordt 3 keer in het jaar gedaan: voor elk kind kan men aangeven hoe goed men
> is voor een bepaalde gegroepeerde subdoel (meerdere subdoelen bij elkaar) + bij elk gegroepeerd doel een tekstje kunnen
> indienen (en kunnen herwerken met AI) + een algemeen besluit ingeven per kind + kunnen downloaden in een word/pdf
> template. Dus: kinderen namen kunnen indienen voor dit jaar en mijn klas én gradaties kunnen bepalen (sterren met
> kleuren e.g. een groene ster is volledig voltooid, oranje ster is niet volledig voldoen aan dit doel,…) én welke
> gegroepeerde doelen wil ik beoordelen voor deze klas. Een kindtekening kunnen ingeven in dit rapport"*

The constitution forbids it as written, three times:

- **Art. I.2** lists *"Pupil-level tracking or reporting"* and *"Evaluation / grading / points management"* as non-goals
  that *"must not be built without an amendment"*.
- **Art. VI.2:** *"No pupil personal data in the MVP (GDPR/AVG). Staff accounts only."*
- **The functional analysis** says the same in §2 (*Buiten scope*), NFR-6 and §10 (*Aannames*).

Two non-goals do **not** conflict: a report the school hands to parents on paper or as a file is not *"access for parents
or pupils"*, and names typed by hand are not an *"integration with school-administration / pupil-tracking systems"*.
Both stay non-goals.

The session did not build and did not open a ticket for the build. It put the conflict to the owner, who chose to amend.

## 1. The rulings

Each question is quoted as it was put, in Dutch, with the option the owner chose and the options he did not.

### 1.1 Scope and naming

| # | Question | Chosen | Not chosen |
| --- | --- | --- | --- |
| R1 | *"Wil je de grondwet wijzigen zodat dit kindrapport binnen de scope valt (Art. I.2 en VI.2)?"* | **"Ja, wijzigen (Aanbevolen)"** | "Eerst uitwerken, nog niet wijzigen"; "Nee, parkeren" |
| R2 | *"Welke naam krijgt het rapport in de app?"* | **"Ontwikkelingsrapport"** | "Groeiboekje"; "Kindrapport"; "Later beslissen" |

### 1.2 What is assessed, and on which scale

| # | Question | Chosen | Not chosen |
| --- | --- | --- | --- |
| R3 | *"Wat is een 'gegroepeerd doel' waarop je een kind beoordeelt?"* | **"Groep eigen subdoelen"**: *"De leerkracht bundelt subdoelen uit de eigen thema's van de school onder een zelfgekozen titel."* | "Groep leerplandoelen"; "Vrije titel, geen koppeling" |
| R4 | *"Voor wie gelden de gegroepeerde doelen die je beoordeelt?"* | **"Voor heel K3"**: *"Eén set voor alle K3-klassen van de school, zodat de rapporten gelijk zijn."* | "Per klas"; "Schoolset, klas past aan" |
| R5 | *"Wie bepaalt de sterrenschaal (bv. groene ster = volledig bereikt, oranje ster = nog niet volledig)?"* | **"Eén schaal voor heel K3"** | "Elke klas zelf"; "Standaard, klas past aan" |
| R6 | *"Wie beheert de K3-set van gegroepeerde doelen en de sterrenschaal?"* | **"Elke K3-leerkracht"**: *"Elke K3-leerkracht mag de gedeelde set en schaal wijzigen; de wijziging geldt voor alle K3-klassen."* | "Directie (beheerder)"; "Directie en K3-leerkrachten" |
| R7 | *"De K3-set rapportdoelen en de sterrenschaal: gelden die per schooljaar, of altijd dezelfde tot iemand ze wijzigt?"* | **"Altijd dezelfde"**: *"Eén set en schaal die blijft gelden. Een wijziging werkt ook door op oude rapporten."* | "Per schooljaar (Aanbevolen)" |

*R4 settles the owner's opening words "welke gegroepeerde doelen wil ik beoordelen voor deze klas":* the set is chosen
for all of K3, not per klas. **R7 was chosen against the recommendation**, with its cost stated in the option.

### 1.3 The report itself

| # | Question | Chosen | Not chosen |
| --- | --- | --- | --- |
| R8 | *"Hoe liggen de drie evaluatiemomenten vast?"* | **"Vast: drie per schooljaar"**: *"Altijd drie momenten (bv. 'Rapport 1, 2, 3'), zonder datums in te stellen."* | "Drie, met naam en datum"; "Aantal instelbaar" |
| R9 | *"Is het algemene besluit per evaluatiemoment of één keer per jaar?"* | **"Per evaluatiemoment"** | "Eén keer per jaar" |
| R10 | *"Hoe vaak komt er een kindtekening in het rapport?"* | **"Eén per evaluatiemoment"**: *"Drie tekeningen per jaar, telkens bij het rapport van dat moment (foto of scan uploaden)."* | "Eén per jaar"; "Optioneel per moment" |
| R11 | *"Wat ziet de ouder op het rapport bij elk gegroepeerd doel?"* | **"Titel, ster en tekst"**: *"De subdoelen ziet alleen de leerkracht in de app."* | "Ook de subdoelen" |
| R12 | *"Heeft de school al een sjabloon voor dit rapport?"* | **"Nee, nieuw ontwerpen"** | "Ja, er is een Word-sjabloon"; "Er is een voorbeeld op papier" |
| R13 | *"In welk formaat wil je het rapport kunnen downloaden?"* | **"PDF en Word"** | "Alleen PDF"; "Alleen Word" |

### 1.4 Pupil data

| # | Question | Chosen | Not chosen |
| --- | --- | --- | --- |
| R14 | *"Welke naam van een kind wordt ingevoerd?"* | **"Voornaam en achternaam"** | "Alleen voornaam"; "Voornaam + initiaal" |
| R15 | *"Hoe komen de namen van de kinderen in de klas?"* | **"Met de hand, één per één"** | "Lijst plakken"; "Beide" |
| R16 | *"Wie mag de rapporten van een kind inzien, naast de klasleerkracht?"* (several allowed) | **"Directie", "Zorgcoördinator", "Co-teacher"** | "Niemand anders" |
| R17 | *"Leerkrachten mogen vandaag het jaarplan en de dekking van andere klassen inkijken. Geldt dat ook voor de ontwikkelingsrapporten van andere K3-klassen?"* | **"Nee, niet inkijken (Aanbevolen)"** | "Ja, K3-collega's wel" |
| R18 | *"Hoe weet de app wie zorgcoördinator is, om de rapporten te mogen lezen?"* | **"Nieuw recht door directie (Aanbevolen)"**: *"Directie geeft een gebruiker het recht 'Leerlingzorg': alle ontwikkelingsrapporten lezen, niets wijzigen."* | "Via themabeheer" |
| R19 | *"Hoe lang blijven de gegevens van een kind bewaard in de app?"* | **"Tot directie wist"**: *"Blijft bewaard tot de directie het schooljaar handmatig wist. Vraagt wel een vaste afspraak in het verwerkingsregister."* | "Tot einde schooljaar"; "Nog één schooljaar" |
| R20 | *"Mag er echte leerlinggegevens in de app komen voor de directie dit bevestigd heeft en het verwerkingsregister (met bewaartermijn) bestaat?"* | **"Ja, meteen"**: *"Zodra het gebouwd is, mogen leerkrachten echte kinderen invoeren."* | "Nee, eerst bevestiging (Aanbevolen)" |

**R20 was chosen against the recommendation.** It removes a gate the session proposed; it does not remove the gates
that already exist (§3.8).

### 1.5 AI

| # | Question | Chosen | Not chosen |
| --- | --- | --- | --- |
| R21 | *"Mag de tekst over een kind naar de AI (Azure OpenAI, EU) om te herwerken?"* | **"Ja, zonder naam (Aanbevolen)"**: *"Alleen de tekst gaat naar de AI; de naam van het kind wordt nooit meegestuurd. De leerkracht aanvaardt of weigert de herwerking."* | "Ja, met naam"; "Nee, geen AI" |
| R22 | *"Mag de leerkracht ook het algemene besluit per kind met AI laten herwerken?"* | **"Ja, ook het besluit"** | "Nee, alleen per doel" |

## 2. What changes in scope

We will bring **one** pupil-level feature into scope: the **ontwikkelingsrapport** (R2) for children in a klas whose
jaarfase is **K3**. It is written three times a year (R8) by the child's leerkrachten and handed to the parents as a
downloaded PDF or Word document (R13).

The rest of Art. I.2 stays out of scope, and the amendment says so explicitly:

- no pupil tracking outside this report, and nothing that follows a child from one schooljaar or klas to the next;
- no points, no numeric scores, no totals, averages or comparisons between children or klassen. A gradatie is an ordered
  label with a star, not a number;
- no access for parents or pupils to the app;
- no integration with Informat, Smartschool or any other pupil administration (R15: names by hand).

**An ontwikkelingsrapport never counts for dekking.** Art. V is unchanged: a rapportdoel groups subdoelen, but rating a
child on it proves nothing about what the klas was taught, and no dekking figure reads it.

## 3. Decision

### 3.1 The model (new Art. IX.4)

Domain names are Dutch (Art. II.1). All of this is **pupil data** except `Rapportdoel` and `Gradatie`.

- **`Leerling`**: `voornaam`, `achternaam` (R14), and the `Klas` it belongs to. A klas already belongs to one schooljaar,
  so a leerling does too, which is the owner's *"voor dit jaar en mijn klas"*. Nothing else about a child is stored: no
  date of birth, address, photo, parent, or identifier from another system.
- **`Rapportdoel`**: a `titel`, an order, and a set of **K3 subdoelen** it bundles (R3). One set for all of K3 (R4),
  with no schooljaar (R7).
- **`Gradatie`**: a `label`, a colour chosen from a fixed palette, and an order. One scale for all of K3 (R5), with no
  schooljaar (R7).
- **`Evaluatiemoment`**: 1, 2 or 3 (R8). A value, not an entity.
- **`Ontwikkelingsrapport`**: one per `(Leerling, Evaluatiemoment)`. It holds an `algemeenBesluit` (R9) and its source
  (§3.5).
- **`Rapportbeoordeling`**: one per `(Ontwikkelingsrapport, Rapportdoel)`. It holds a `Gradatie` (optional until the
  teacher chooses one) and a text with its source (§3.5).
- **`Kindtekening`**: at most one per `Ontwikkelingsrapport` (R10), stored apart from it (§3.6).

*Why subdoelen can be grouped at all:* a `Subdoel` is a goal link at `(Subthema × leeftijd)` (ADR-0025; Art. IX.2), so
the K3 subdoelen of every K3 subthema are one school-wide pool, which is what R3 and R4 together need.

### 3.2 What R7 costs, and how the model carries it

A timeless set and scale mean that **a change reaches every report already written**, including those of past
schooljaren still stored, and every download made afterwards. The owner chose this with that cost stated. It follows:

- **D1:** a `Gradatie` or `Rapportdoel` that any rapportbeoordeling uses **cannot be deleted**, only renamed or
  reordered. Deleting it would silently empty ratings and texts on reports already given to parents.
- **D2:** a rapportdoel added later appears on every report from then on, with no gradatie or text for the moments that
  came before it.
- **D3:** when a subdoel is deleted (its subthema is removed, or a hoofdleerkracht deletes it), it leaves every
  rapportdoel. The rapportdoel keeps its title, its ratings and its texts. Because of R11 a parent never sees subdoelen,
  so a report does not change for them.

### 3.3 Who does what (extends the ADR-0030 matrix)

A **leerkracht of the klas** is a gebruiker with a klastoewijzing on it (Art. VI.1). A co-teacher is one of those, which
covers R16's *"Co-teacher"* without a right of its own.

| Action | Directie | Leerkracht of the klas | Leerlingzorg (R18) | Leerkracht of another K3 klas | Anyone else |
| --- | --- | --- | --- | --- | --- |
| Add, rename or delete a leerling of the klas | ✓ | ✓ | – | – | – |
| Fill in a report (gradatie, text, besluit, drawing) and ask the AI for a rewrite | ✓ | ✓ | – | – | – |
| Read a report | ✓ | ✓ | ✓ | – (R17) | – |
| Download a report as PDF or Word | ✓ | ✓ | – (D5) | – | – |
| Edit the K3 rapportdoelen and gradaties | ✓ | ✓ if the klas is K3 (R6) | – | ✓ (R6) | – |
| Wipe a schooljaar's pupil data (§3.7) | ✓ | – | – | – | – |

- **R16, R17 and R18** decide the read column. **Art. VI.1's default I9**, that every gebruiker reads every klas's
  jaarplan, agenda and dekking, **does not extend to the ontwikkelingsrapport**: a leerkracht of another klas, a
  hoofdleerkracht, a themabeheer holder and a gebruiker with no right read none of it (R17, R18's *"Via themabeheer"*
  not chosen).
- **Directie** edits as well as reads, because Art. VI.1 gives it every right. R16 named reading; editing follows from
  VI.1, not from R16.
- **D4:** *"K3-leerkracht"* (R6) means a gebruiker with a klastoewijzing on a klas whose jaarfase is K3, in a schooljaar
  that has not ended. That is the rule Art. VI.1 already applies to shared content. A hoofdleerkracht of K3 without such
  a klastoewijzing does not edit the set.
- **D5:** Leerlingzorg reads in the app and does not download. R18's option said *"lezen, niets wijzigen"*; a download
  puts a copy of a child's report outside the app, and nobody ruled that for this right.
- **D6:** a leerkracht keeps access to the reports of a klas after its schooljaar ends, as Art. VI.1's I21 gives for the
  klas's planning, until directie wipes that schooljaar.
- **Enforced server-side, in the one place where the ADR-0030 policies are declared** (ADR-0011 §2). The build
  therefore follows E6-02's policy layer, which is being built now.

### 3.4 A fifth right: Leerlingzorg (amends Art. VI.1)

R18 creates it. Directie gives it to a gebruiker, as it gives themabeheer (FR-12.2). It **reads** every
ontwikkelingsrapport and does nothing else. Art. VI.1's *"There are four rights"* becomes five. A zorgcoördinator holds
Leerlingzorg because directie gave it, not because of a title, in the same way that there is no separate ICT role.

### 3.5 AI rewrites a text, and never sees a name (amends Art. IV.2 to IV.5)

The teacher may ask the AI to rewrite the text of a rapportbeoordeling (R21) or the algemeen besluit (R22). It is a
third kind of AI output next to goal matches and generated plans, and Art. IV applies to it:

- **The human decides (IV.1, IV.2).** The server returns a proposal and stores nothing. The teacher sees both texts and
  accepts the proposal, edits it, or discards it. Only what the teacher saves is stored, with its source:
  - `aanvaard` when an AI proposal was saved unchanged;
  - `manueel` when the teacher typed the text, or edited a proposal before saving.

  `voorgesteld` and `geweigerd` are never stored for this output. **This deviates from IV.2 on purpose, and the
  amendment says so.** Storing a pending or rejected proposal would keep a second text about a child that nobody chose
  to keep.
- **No motivation (IV.3).** A rewrite is judged by reading it next to the original. A "waarom" line would add nothing.
- **Grounded on the teacher's own text only (IV.4).** The prompt carries that text, plus the rapportdoel's title and the
  gradatie's label for a rapportbeoordeling. Nothing else goes in: no subdoelen, no other child, no earlier report. The
  model is told to keep the meaning and add no facts.
- **Structured and validated (IV.5).** The model returns JSON with one text field. The server checks that it is
  non-empty, within a length limit, and carries exactly the placeholders it was sent (below), before the proposal
  reaches the teacher.
- **Testable with a faked client (IV.6),** behind the existing AI client interface (ADR-0010).
- **No name ever leaves the server (R21).** Before the call, the server replaces every whole-word occurrence of the
  voornaam or achternaam of **every leerling in that klas**, not only the child's own, with a placeholder. After a valid
  answer it puts the names back. *The limit, stated so nobody over-reads R21:* a nickname, a misspelling, or the name of a
  sibling, a parent or a child outside the klas is not caught. The teacher is told, in the rewrite control, that the
  text goes to the AI without the names of the children in the klas. The build ticket settles the copy.
- **EU only (VI.3):** Azure OpenAI in the EU data zone (ADR-0016). Whether Azure's abuse monitoring may keep prompts for
  a limited time, and whether the school should apply to switch it off, is recorded under E7-06 for the processing
  register. It is not settled here.

### 3.6 The kindtekening

- One image per report (R10): a photo or a scan of the drawing, as JPEG or PNG, with a size limit the build ticket sets.
- **The server strips all metadata** (EXIF, including the GPS position of the phone that took the photo) before it
  stores anything. A photo of a drawing on a kitchen table can carry the family's address in its metadata.
- It is stored **in PostgreSQL, in a table of its own**, so that reading a report does not load images. It is served
  only through an authorised route, with `Cache-Control: no-store`, and never through a public or long-lived URL.
- **Blob storage is not used for now.** It would be one more service, one more place a deletion has to reach, and
  ADR-0034's environment has none. A later ADR can move the images if their volume asks for it.
- Any library that decodes or re-encodes images is **permissively licensed** (MIT, Apache or BSD), the rule that chose
  ClosedXML over EPPlus (Art. VIII). The build ticket picks it.

### 3.7 Export, retention and deletion

- **Export (R12, R13):** PDF and Word, both made on the server from **one layout model**, so the two show the same
  report. The design is new and is made with the `frontend-design` skill. A download is generated on demand, streamed to
  the teacher, and **never stored** on the server. Each gradatie carries its label next to its coloured star (Art. XII:
  never colour alone), which also keeps the report readable when it is printed in black and white. Libraries are
  permissively licensed (§3.6): the build ticket picks them.
- **Retention (R19): until directie wipes it.** There is no automatic term in the app. That makes the term the school's
  commitment, and **the processing register must state it** (Art. VI.6, E7-06).
- **D7:** directie wipes **one schooljaar** at a time: every leerling of that schooljaar's klassen, with every report,
  rapportbeoordeling and kindtekening. It is a real delete, not a hidden flag, and the confirmation says how many
  children it removes.
- **D8:** a leerkracht of the klas or directie can delete **one leerling** at any time, with all their reports, for a
  child who leaves the school or a parent who asks for erasure (AVG art. 17).
- **Backups:** a deletion reaches a backup only once that backup expires (7 days on the demo, ADR-0034; E7-09 for other
  environments). The register says so.

### 3.8 What stays true for every environment

R20 lets real pupil data in as soon as the feature is built. These rules still hold, and they are the ones that matter:

- **No real pupil data in the demo** (ADR-0034, *"alleen fictieve data"*). Fictional children are fine there.
- **E7-11 stays `[!]` for any environment that holds real school data** until the role matrix is enforced (E6-02). Real
  children therefore reach the app no sooner than real thema's do.
- **The repository never holds a real child's name**: not in tests, seed data, fixtures, screenshots, worklogs or tickets
  (Art. VI; ADR-0033). Browser passes use made-up names.
- **Logs carry no pupil content.** The routes of this feature log ids, never names, texts or images. The AI rewrite path
  logs neither its prompt nor the model's answer, and a malformed answer is logged by its kind only, in English (Art.
  II.3). Request-body logging stays off for these routes.
- **Encrypted in transit and at rest** by the platform (Art. VI.5, NFR-5), as for all data. Column-level encryption is
  not added.
- **The school's own duties are not the app's to discharge:** the entry in the processing register, informing the
  parents, and whether a DPIA is needed. They go to directie as a question (§4). R20 means they do not block the build.

### 3.9 Only for K3

- **D9:** leerlingen can be added only to a klas whose jaarfase is K3. A graadklas follows Art. VI.1's provisional rule:
  a klas states one jaarfase, and only a klas stating K3 gets the ontwikkelingsrapport.
- **D10:** a child who changes klas during the year is deleted in one klas and added in the other. Moving a leerling with
  their reports is not built; it becomes a ticket if the school asks for it.

## 4. The amendment this ADR requires

One dedicated commit (Art. XI.1) that changes:

- **Art. I.1:** a ninth mission item, the K3 ontwikkelingsrapport.
- **Art. I.2:** *"Pupil-level tracking or reporting"* and *"Evaluation / grading / points management"* keep their place
  with the ontwikkelingsrapport excepted and bounded as in §2. The other three non-goals are unchanged.
- **Art. IV.2 to IV.5:** the text rewrite as a third AI output, with the §3.5 deviations stated.
- **Art. VI.1:** the fifth right, Leerlingzorg, and the ontwikkelingsrapport as an exception to I9.
- **Art. VI.2:** *"No pupil personal data"*, except the ontwikkelingsrapport under a new **Art. VI.7**, which carries the
  rules of §3.3 to §3.8.
- **Art. IX.4 (new):** the entities of §3.1.
- **Art. XII:** the glossary entries (Ontwikkelingsrapport, Leerling, Rapportdoel, Gradatie, Evaluatiemoment,
  Kindtekening, Leerlingzorg).
- **The ratification log.**
- **In step:**
  - the functional analysis: §2 *Buiten scope*, a new FR-13, NFR-6 and §10 *Aannames*;
  - `CLAUDE.md`;
  - the ADR index, and the status lines of ADR-0011 and ADR-0016;
  - E7-06 and the E8 note on what is out of scope;
  - a question for directie in `docs/besluiten-gevraagd.md`.

*Directie has not confirmed these rulings.* The school is the verwerkingsverantwoordelijke for its pupils' data, so the
question to directie is more than a formality. R20 means the build does not wait for it.

## 5. Alternatives considered

- **Leave it out of scope.** The owner chose to amend (R1).
- **Keep the report in the school's existing pupil administration.** That is an integration, which stays a non-goal,
  and the owner asked for it in this tool.
- **Store AI proposals as `voorgesteld`, as for goal matches.** Rejected (§3.5): it keeps texts about a child that
  nobody chose to keep.
- **A set and a scale per klas, or per schooljaar.** Ruled against (R4, R5, R7).
- **Send the name to the AI.** Ruled against (R21).
- **Images in Azure Blob Storage.** Deferred (§3.6).
- **Give Leerlingzorg's read to themabeheer.** Ruled against (R18): it would hand pupil data to a right that exists for
  thema's.

## 6. Consequences

**Positive**

- The K3 teachers write the report where their subdoelen already are, and the three momenten and the download replace
  work that is done by hand today.
- The privacy rules are written down before the first line of code, not reconstructed after it.

**Negative / trade-offs**

- **The app now holds data about children.** A breach or a wrong right costs more than before, so E6-02's enforcement
  and E7-11's gate carry more weight.
- **R7:** renaming a gradatie changes the meaning of reports already given to parents, and D1 blocks deleting anything in
  use.
- **R19:** nothing is deleted until directie acts. Data can pile up for years if nobody does.
- **R20:** real data can arrive before the school has its register entry and has informed parents.
- **The name filter is best-effort** (§3.5).
- **A fifth right** has to fit into E6-02's policy layer while E6-02 is still being built.

**Follow-ups**

Build tickets, to be created as FB tickets by the functional architect, or by a session at the owner's request, each as
`nieuw`:

1. Leerlingen van een K3-klas beheren: toevoegen met de hand, wijzigen, verwijderen (R14, R15, D8, D9).
2. De K3-rapportdoelen en de sterrenschaal beheren (R3 to R7, D1 to D4).
3. Een ontwikkelingsrapport invullen per evaluatiemoment: gradatie en tekst per rapportdoel, algemeen besluit (R8, R9).
4. Een tekst of het besluit laten herwerken door AI, zonder namen (R21, R22).
5. Een kindtekening toevoegen per evaluatiemoment (R10).
6. Het rapport downloaden als PDF en Word, in een nieuw ontwerp (R11 to R13).
7. Directie wist de leerlinggegevens van een schooljaar (R19, D7).
8. Directie geeft het recht Leerlingzorg (R18), next to E6-04's beheer of rights.

Also:

- **E7-06** widens: the register covers the ontwikkelingsrapport, its retention term, and the AI processor.
- **ADR-0030** gets a pointer to §3.3 and §3.4 once session E6-02 releases it.
- **Tickets 1 to 8 are built after E6-02 lands**, because the rights of §3.3 are declared in its policy layer.

## Compliance trace

- **Constitution:**
  - Art. I.1/I.2: amended (§2, §4). Parent access and pupil-administration integration stay non-goals.
  - Art. II.1/II.3: Dutch domain names; operator messages in English, with no pupil content (§3.8).
  - Art. IV: amended for the text rewrite (§3.5). The human decides, the output is validated JSON, the client is faked in
    tests, and the prompt is grounded on the teacher's own text only.
  - Art. V.1: unchanged, because a rapportbeoordeling never counts for dekking (§2).
  - Art. VI.1: a fifth right; the I9 default does not reach the report (§3.3, §3.4).
  - Art. VI.2: amended, with the new VI.7 (§3.3 to §3.8).
  - Art. VI.3: the EU AI data zone.
  - Art. VI.5: encryption in transit and at rest.
  - Art. VI.6: the register and the retention term are owed under E7-06.
  - Art. VIII: permissive licences only.
  - Art. IX.4: new (§3.1).
  - Art. XI: amended in a dedicated commit (§4).
  - Art. XII: glossary; never colour alone.
  - Art. XIV: no new open decision. Directie's confirmation is outstanding.
- **Backlog:** TB-005; the FB build tickets of §6; E7-06, E7-09, E7-11; E6-02 and E6-04 (policy layer and the beheer of
  rights); the E8 note.
- **FR/NFR:** FR-13 (new, in the functional analysis); FR-10, FR-12.2; NFR-5, NFR-6.
