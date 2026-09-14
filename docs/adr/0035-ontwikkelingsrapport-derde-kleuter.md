# ADR-0035 — The ontwikkelingsrapport for the derde kleuter: pupil data enters scope, for this report only

- **Status:** Accepted for the owner's rulings in §1 (project owner, 2026-09-14).
  - **Everything else in §2 and §3 is the recording session's design**, except where it cites an R. The items numbered
    **D** are the ones a reader is most likely to want changed. None of the session's design is ratified by the owner,
    and the build follows it until he changes it.
  - **This ADR takes effect with the Art. XI amendment commit (§4).** Until that commit is on the same branch, the ADR
    contradicts Art. I.2 and VI.2 as they stand, so **the branch is not merged without it**. That is the failure the
    ratification log records for ADR-0025.
- **Date:** 2026-09-14
- **Deciders:** Siebe De Saedeleir (projecteigenaar), for §1 only. The rulings were given in session `kindrapport`, as
  answers to seven rounds of multiple-choice questions, whose options and stated costs are quoted below, and R32, given
  unprompted after the merge of PR #58 (§1.7).
- **Narrows:** [ADR-0011](0011-authn-authz-rbac-gdpr.md) §4 (*"the model has no schema for pupil PII"*) and the *"no
  pupil PII"* constraint of [ADR-0016](0016-azure-hosting-eu-residency.md). Both still hold everywhere outside the
  ontwikkelingsrapport.
- **Extends:** [ADR-0030](0030-rollen-en-rechten-in-de-app.md) with a fifth right (§3.4) and with rows its §3 matrix does
  not have. Those rows join ADR-0030's §3 matrix in the amendment commit, so that Art. VI.1's *one matrix* stays one
  (§4). *Corrected after audit round 1:* this line said ADR-0030 was held by session E6-02 when this ADR was written. E6-02
  had released it at 11:26, before the drafting began. What remains is E6-02's unpushed change to Art. VI.1 on
  `feature/e6-rollen-rechten`, which the amendment's VI.1 hunks will meet at merge.
- **Relates to:** [ADR-0010](0010-ai-advisory-architecture.md) (AI advisory architecture),
  [ADR-0025](0025-subthema-per-leeftijd.md) (subdoelen per leeftijd), [ADR-0034](0034-demo-omgeving-op-azure.md) (the demo
  holds fictional data only), [ADR-0033](0033-ticketbacklog-en-kanbanbord.md) (tickets carry no pupil data).
- **Backlog:** TB-005 (this decision and the amendment). The build follows as FB tickets (§6). E7-06 widens.

> **Revised after audit round 1** (`backlog/worklogs/TB-005/antagonist-ronde-1.md`: 3 MAJOR, 8 MINOR, 4 QUESTION).
> - **The first version presented session design as owner-accepted.** Among it was a deviation from Art. IV.2 that no
>   ruling covered, since R1 asked to amend Art. I.2 and VI.2 only. The owner has now ruled the AI questions (R23, R24).
>   The status line above says what the rest is.
> - **The first version said the existing gates still protect real data.** They do not cover the processing register,
>   informing the parents, or a DPIA. The owner kept *"meteen"* with that stated (R27), and §3.8 now says what is and
>   is not gated.
> - **The §4 list missed dependent texts**, among them the agent and skill instructions. The owner ruled that the
>   amendment may not block the report (R29).
> - Also fixed: R16 and R18 are now quoted in full, E6-02's release time is corrected, the ADR no longer presumes the
>   amendment has landed, the three Art. XIV bullets it touches are named, rapportdoel membership is specified at its
>   edges, and the kindtekening's claims are narrowed.

> **Revised after audit rounds 2 and 3** (`antagonist-ronde-2.md`, `antagonist-ronde-3.md`):
> - only the teacher's text goes to the AI, without the rapportdoel title or the gradatie (R21);
> - what no ruling covers is marked as a default;
> - the owner ruled that only the K3 leerkrachten edit the K3 set and the scale, and directie views them (R31);
> - R28's reminder is carried everywhere;
> - AVG art. 9 (the free texts) and the conditional AVG position on the order (art. 13(1), 14 and 35(1)) are stated;
> - the owner confirmed, by choosing the offered "Ja, zo is het goed", the rule the agent instructions now carry: pupil
>   data stays rejected outside the report and is checked against VI.7 inside it (R30).

> **Added after PR #58 was merged, on TB-013:** R32, the owner's placement of the report in the sidebar (§1.7), and
> its carrying out in §3.10 with D17 and D18.

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

Two non-goals do **not** conflict, and both stay non-goals:

- a report the school hands to parents on paper or as a file is not *"access for parents or pupils"*;
- names typed by hand are not an *"integration with school-administration / pupil-tracking systems"*.

The session built nothing and opened no ticket for the build. It put the conflict to the owner, who chose to amend.

## 1. The rulings

Each question is quoted as it was put, in Dutch, with the option the owner chose and the options he did not. R32
(§1.7) is a statement he made unprompted, not an answer, and no article of the constitution ratifies it.

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
| R11 | *"Wat ziet de ouder op het rapport bij elk gegroepeerd doel?"* | **"Titel, ster en tekst"**: *"Alleen de titel van de groep (bv. 'Luisteren en spreken'), de ster met zijn label en de tekst. De subdoelen ziet alleen de leerkracht in de app."* | "Ook de subdoelen" |
| R12 | *"Heeft de school al een sjabloon voor dit rapport?"* | **"Nee, nieuw ontwerpen"** | "Ja, er is een Word-sjabloon"; "Er is een voorbeeld op papier" |
| R13 | *"In welk formaat wil je het rapport kunnen downloaden?"* | **"PDF en Word"** | "Alleen PDF"; "Alleen Word" |

### 1.4 Pupil data

| # | Question | Chosen | Not chosen |
| --- | --- | --- | --- |
| R14 | *"Welke naam van een kind wordt ingevoerd?"* | **"Voornaam en achternaam"** | "Alleen voornaam"; "Voornaam + initiaal" |
| R15 | *"Hoe komen de namen van de kinderen in de klas?"* | **"Met de hand, één per één"** | "Lijst plakken"; "Beide" |
| R16 | *"Wie mag de rapporten van een kind inzien, naast de klasleerkracht?"* (several allowed) | **"Directie"**: *"De directie kan de rapporten van alle K3-klassen lezen."* **"Zorgcoördinator"**: *"De zorgcoördinator kan de rapporten lezen."* **"Co-teacher"**: *"Een tweede leerkracht in de klas kan de rapporten lezen en mee invullen."* | "Niemand anders": *"Alleen de klasleerkracht ziet de gegevens van de kinderen."* |
| R17 | *"Leerkrachten mogen vandaag het jaarplan en de dekking van andere klassen inkijken. Geldt dat ook voor de ontwikkelingsrapporten van andere K3-klassen?"* | **"Nee, niet inkijken (Aanbevolen)"** | "Ja, K3-collega's wel" |
| R18 | *"Hoe weet de app wie zorgcoördinator is, om de rapporten te mogen lezen?"* | **"Nieuw recht door directie (Aanbevolen)"**: *"Directie geeft een gebruiker het recht 'Leerlingzorg': alle ontwikkelingsrapporten lezen, niets wijzigen. Zoals directie nu al themabeheer geeft."* | "Via themabeheer": *"Wie themabeheer heeft, mag ook de rapporten lezen. Geen nieuw recht, maar themabeheer krijgt er dan leerlinggegevens bij."* |
| R19 | *"Hoe lang blijven de gegevens van een kind bewaard in de app?"* | **"Tot directie wist"**: *"Blijft bewaard tot de directie het schooljaar handmatig wist. Vraagt wel een vaste afspraak in het verwerkingsregister."* | "Tot einde schooljaar"; "Nog één schooljaar" |
| R20 | *"Mag er echte leerlinggegevens in de app komen voor de directie dit bevestigd heeft en het verwerkingsregister (met bewaartermijn) bestaat?"* | **"Ja, meteen"**: *"Zodra het gebouwd is, mogen leerkrachten echte kinderen invoeren."* | "Nee, eerst bevestiging (Aanbevolen)" |

**R20 was chosen against the recommendation**, and confirmed after the audit (R27).

### 1.5 AI

| # | Question | Chosen | Not chosen |
| --- | --- | --- | --- |
| R21 | *"Mag de tekst over een kind naar de AI (Azure OpenAI, EU) om te herwerken?"* | **"Ja, zonder naam (Aanbevolen)"**: *"Alleen de tekst gaat naar de AI; de naam van het kind wordt nooit meegestuurd. De leerkracht aanvaardt of weigert de herwerking."* | "Ja, met naam"; "Nee, geen AI" |
| R22 | *"Mag de leerkracht ook het algemene besluit per kind met AI laten herwerken?"* | **"Ja, ook het besluit"** | "Nee, alleen per doel" |

### 1.6 After audit round 1

| # | Question | Chosen | Not chosen |
| --- | --- | --- | --- |
| R23 | *"Als een leerkracht een AI-herwerking weigert: wat bewaart de app daarvan? (Art. IV.2 vraagt nu dat elke AI-uitkomst een bewaarde status krijgt.)"* | **"Status bewaren, tekst niet (Aanbevolen)"**: *"De app bewaart alleen dát er een voorstel geweigerd werd, zonder de voorgestelde tekst. Art. IV.2 blijft dan gewoon gelden, zonder extra tekst over het kind."* | "Niets bewaren" |
| R24 | *"Doelsuggesties krijgen een korte uitleg ('waarom past dit doel?'). Moet een AI-herwerking van een tekst ook zo'n uitleg krijgen?"* | **"Nee, voor en na tonen (Aanbevolen)"**: *"De leerkracht ziet de oude en de nieuwe tekst naast elkaar; een uitleg voegt niets toe. Vraagt een kleine uitzondering op Art. IV.3."* | "Ja, één zin uitleg" |
| R25 | *"De app vervangt de namen van alle kinderen van de klas voor een tekst naar de AI gaat. Een bijnaam, een tikfout of de naam van een broer of zus vangt ze niet. Hoe gaan we daarmee om?"* | **"Alleen een melding"**: *"De app vervangt de namen en zegt dat bijnamen en andere namen niet gefilterd worden. Geen extra stap."* | "Leerkracht ziet eerst wat vertrekt (Aanbevolen)" |
| R26 | *"Na het einde van het schooljaar: wat mag de leerkracht nog met de rapporten van die klas, tot de directie het schooljaar wist?"* | **"Alleen nog lezen (Aanbevolen)"**: *"De rapporten zijn afgegeven aan de ouders; ze blijven leesbaar maar niet meer te wijzigen. Directie kan nog alles."* | "Lezen en wijzigen"; "Geen toegang meer" |
| R27 | *"Je koos eerder 'Ja, meteen' voor echte leerlinggegevens. De AVG vraagt voor evaluaties van kinderen waarschijnlijk een effectbeoordeling (DPIA) vóór de verwerking start, plus een ingevuld verwerkingsregister. Houden we 'meteen'?"* | **"'Meteen' blijft"**: *"We leggen vast dat jij bewust afwijkt, met de risico's erbij (AVG art. 13, 30 en 35). De school draagt die verantwoordelijkheid."* | "Eerst register en DPIA (Aanbevolen)" |
| R28 | *"Je koos 'Tot directie wist'. De AVG vraagt een concrete bewaartermijn in het register. Wat doet de app?"* | **"Termijn + herinnering (Aanbevolen)"**: *"De directie legt een termijn vast in het register (bv. tot eind volgend schooljaar). De app toont op de beheerpagina welke schooljaren nog kindgegevens bevatten en herinnert eraan. Wissen blijft een handeling van de directie."* | "Termijn, geen herinnering" |
| R29 | *"Drie agent- en skillbestanden (antagonist, implementer, jaarplan-build) behandelen 'leerlinggegevens' vandaag als harde stop. Na het amendement zouden ze elk bouwticket van het rapport blokkeren. Mag ik ze in het amendement mee aanpassen?"* | The owner chose neither option and answered in his own words: *"wat bedoel je behandelen als harde stop, ik word gefrustreerd van deze verwoordingen, het amendement mag wat ik hier vraag niet tegenhouden of blokkeren"* | "Ja, pas ze mee aan (Aanbevolen)"; "Nee, ik doe het zelf" |
| R30 | *"In drie instructiebestanden voor de controle-agents heb ik één regel aangepast. Leerlinggegevens worden nog altijd afgekeurd, behalve in het ontwikkelingsrapport. Daar controleren de agents alleen of de nieuwe regels gevolgd worden (welke gegevens, wie ze ziet, namen vervangen voor de AI, wissen). Is dat wat je bedoelde?"* | **"Ja, zo is het goed"** | "Nee, anders" |
| R31 | *"De K3-set gegroepeerde doelen en de sterrenschaal: mag de directie die ook aanpassen, of alleen de K3-leerkrachten?"* (asked after audit round 4, because R6 and Art. VI.1's directie right pointed opposite ways) | **"Alleen de K3-leerkrachten"**: *"Alleen de K3-leerkrachten passen de set en de schaal aan. De directie kan ze wel bekijken."* | "Ook de directie" |

- **R25 and R27 were chosen against the recommendation.**
- **R29 is read as consent to change those three texts** so that they do not stop the ontwikkelingsrapport. The
  session first answered his question in the conversation: the three texts say that pupil data is always rejected.
  After the edits, the owner confirmed the rule they carry by choosing the offered "Ja, zo is het goed" (R30): pupil
  data stays rejected outside the report and is checked against VI.7 inside it. *What R30 does not cover, stated:* the
  question spoke of "één regel", while the branch changed eight lines across the three files. The rest are dependent
  text of R23, R24 and Art. IX.4 (Art. XI.1), and one later change to the severity line made it stricter, not looser. Pupil
  data outside the report stays a violation for them, and inside the report they check against Art. VI.7.

### 1.7 Added by the owner after PR #58 was merged (TB-013)

- **R32**, given unprompted rather than as an answer to a question:

  > *"ahja mss dat ik nog niet vermeld had maar wel verwacht, het kindvolgsysteem/rapport moet ook een nieuwe linker
  > sidepane tabje worden ONDERAAN, dus nog veel onder de fiches in een nieuwe sectie"*

- It places the ontwikkelingsrapport in the app's navigation. It does not touch the constitution, and Art. VI.7 does
  not cite it. How it is carried out is §3.10.

## 2. What changes in scope

We will bring **one** pupil-level feature into scope: the **ontwikkelingsrapport** (R2), for children in a klas that
grants K3 (D9).

- It is written three times a year (R8) by the child's leerkrachten.
- It is handed to the parents as a downloaded PDF or Word document (R13).

The rest of Art. I.2 stays out of scope. The amendment says so explicitly, and the bounds below are the session's reading
of the non-goals that remain, not rulings:

- no pupil tracking outside this report, and nothing that follows a child from one schooljaar or klas to the next;
- no points, no numeric scores, no totals, averages or comparisons between children or klassen. A gradatie is an ordered
  label with a star, not a number;
- no access for parents or pupils to the app;
- no integration with Informat, Smartschool or any other pupil administration (R15: names by hand).

**An ontwikkelingsrapport never counts for dekking.** Art. V is unchanged. A rapportdoel groups subdoelen, but rating a
child on it proves nothing about what the klas was taught, and no dekking figure reads it.

## 3. Decision

### 3.1 The model (new Art. IX.4)

Domain names are Dutch (Art. II.1). All of this is **pupil data** except `Rapportdoel` and `Gradatie`.

- **`Leerling`**: `voornaam`, `achternaam` (R14), and the `Klas` it belongs to.
  - A klas already belongs to one schooljaar, so a leerling does too, which is the owner's *"voor dit jaar en mijn
    klas"*.
  - No other field about a child exists: no date of birth, address, parent, or identifier from another system.
  - *The texts are free text.* The rapportbeoordeling texts and the besluit can carry whatever a teacher writes,
    including care or health information (AVG art. 9), and that text goes, pseudonymised, to the AI. Question 15 names
    it for the DPIA.
  - *The kindtekening is where the fields stop protecting.* It is an image the teacher uploads, and it can show the
    child, other children or a written name. The build ticket's copy asks for a photo of the drawing alone, and the app
    cannot check that it is one.
- **`Rapportdoel`**: a `titel`, an order, and a set of **K3 subdoelen** it bundles (R3). One set for all of K3 (R4),
  with no schooljaar (R7).
- **`Gradatie`**: a `label`, a colour chosen from a fixed palette, and an order. One scale for all of K3 (R5), with no
  schooljaar (R7).
- **`Evaluatiemoment`**: 1, 2 or 3 (R8). A value, not an entity.
- **`Ontwikkelingsrapport`**: one per `(Leerling, Evaluatiemoment)`. It holds an **algemeen besluit** (R9), with the
  status of §3.5.
- **`Rapportbeoordeling`**: one per `(Ontwikkelingsrapport, Rapportdoel)`. It holds a `Gradatie` (optional until the
  teacher chooses one) and a text, with the status of §3.5.
- **`Kindtekening`**: at most one per `Ontwikkelingsrapport` (R10), stored apart from it (§3.6).

*Why subdoelen can be grouped at all:* a `Subdoel` is a goal link at `(Subthema × leeftijd)` (ADR-0025; Art. IX.2), so
the K3 subdoelen of every K3 subthema are one school-wide pool, which is what R3 and R4 together need.

### 3.2 What R7 costs, and how the model carries it

A timeless set and scale mean that **a change reaches every report already written**, including those of past
schooljaren that are still stored, and every download made afterwards. The owner chose this with that cost stated. It
follows:

- **D1:** a `Gradatie` or `Rapportdoel` that any rapportbeoordeling uses **cannot be deleted**, only renamed or
  reordered. Deleting it would silently empty ratings and texts on reports already given to parents.
- **D2:** a rapportdoel added later appears on every report from then on, with no gradatie or text for the moments
  before it.
- **D3:** when a subdoel is deleted (its subthema is removed, or a hoofdleerkracht deletes it), it leaves every
  rapportdoel. The rapportdoel keeps its title, its ratings and its texts. Because of R11 a parent never sees subdoelen,
  so a report does not change for them.
- **D11:** only a subdoel whose goal link is decided (`aanvaard` or `manueel`) can be bundled, and one that becomes
  `geweigerd` leaves every rapportdoel. An undecided subdoel is a proposal nobody has accepted, and an FR-1 re-import
  removes undecided subdoelen without asking (`SchoolcontentImportService`), which would otherwise shrink a rapportdoel
  without anyone noticing.
- **D12:** a subdoel whose subthema is re-scoped to another leeftijd (the Art. IX.2 `PUT`; E1-19, still open) leaves
  every rapportdoel, because the set is for K3 only (R4).

### 3.3 Who does what (rows for the ADR-0030 matrix)

A **leerkracht of the klas** is a gebruiker with a klastoewijzing on it (Art. VI.1). A co-teacher is one of those, which
covers R16's *"Co-teacher"* (*"lezen en mee invullen"*) without a right of its own.

| Action | Directie | Leerkracht of the klas, during its schooljaar | Leerkracht of the klas, after it (R26) | Leerlingzorg (R18) | Leerkracht of another K3 klas | Anyone else |
| --- | --- | --- | --- | --- | --- | --- |
| Add, rename or delete a leerling of the klas | ✓ | ✓ | – | – | – | – |
| Fill in a report (gradatie, text, besluit, drawing) and ask the AI for a rewrite | ✓ | ✓ | – | – | – | – |
| Read a report | ✓ | ✓ | ✓ | ✓ | – (R17) | – |
| Download a report as PDF or Word | ✓ | ✓ | ✓ | – (D5) | – | – |
| Edit the K3 rapportdoelen and gradaties | – (R31; views them) | ✓ if the klas is K3 (R6, D4) | – | – | ✓ (R6, D4) | – |
| Wipe a schooljaar's pupil data (§3.7) | ✓ | – | – | – | – | – |

- **R16, R17, R18 and R26 decide the read column.** Art. VI.1's default **I9** (every gebruiker reads every klas's
  jaarplan, agenda and dekking) **does not extend to the ontwikkelingsrapport**. A leerkracht of another klas, a
  hoofdleerkracht, a themabeheer holder and a gebruiker with no right read none of it (R17; R18's *"Via themabeheer"*
  not chosen).
- **Directie** edits reports as well as reads them, because Art. VI.1 gives it every right; after the schooljaar R26
  says so too. **The K3 set and the scale are the one exception:** only the K3 leerkrachten edit them, and directie views
  them (R31). Otherwise, as R26 put it (*"Directie kan nog
  alles"*).
- **D4:** *"K3-leerkracht"* (R6) means a gebruiker with a klastoewijzing on a klas that grants K3, in a schooljaar that
  has not ended. That is the rule Art. VI.1 already applies to shared content. A hoofdleerkracht of K3 without such a
  klastoewijzing does not edit the set.
- **D5:** Leerlingzorg reads in the app and does not download. R18's option said *"lezen, niets wijzigen"*. A download
  puts a copy of a child's report outside the app, and nobody ruled that for this right.
- **R26** replaces the first version's D6: after the schooljaar ends, the klas's leerkrachten keep reading and
  downloading, and no longer edit. Downloading is the session's reading of *"leesbaar"*.
- **Enforced server-side, in the one place where the ADR-0030 policies are declared** (ADR-0011 §2). The build
  therefore follows E6-02's policy layer, which is being built now.

### 3.4 A fifth right: Leerlingzorg (amends Art. VI.1)

R18 creates it.

- Directie gives it to a gebruiker, as it gives themabeheer (FR-12.2).
- It **reads** every ontwikkelingsrapport and does nothing else.
- Art. VI.1's *"There are four rights"* becomes five.
- A zorgcoördinator holds Leerlingzorg because directie gave it, not because of a title, in the same way that there is
  no separate ICT role.

### 3.5 AI rewrites a text (amends Art. IV.1 to IV.5)

The teacher may ask the AI to rewrite the text of a rapportbeoordeling (R21) or the algemeen besluit (R22). It is a
third kind of AI output, next to goal matches and generated plans, and Art. IV applies to it.

- **Who decides (IV.1):** a leerkracht of the klas during its schooljaar, or directie.
- **The human decides, and every decision is kept (IV.2, R23).**
  - The server returns a proposal and **never stores the proposed text**. A proposal nobody has decided on yet exists
    only on the teacher's screen, so `voorgesteld` is not stored for this output. *This is session design:* both of
    R23's options were put on that premise, so R23 did not rule it. It is the one clarification IV.2 gains.
  - The teacher sees both texts and accepts the proposal, edits it, or rejects it. Every decision is stored:
    - `aanvaard`: the proposal was saved unchanged;
    - `manueel`: the teacher typed the text, or edited a proposal before saving;
    - `geweigerd`: a rejection. It is stored as a status only, on the text it was proposed for, without the proposed
      text. The saved text and its own status stay as they were.
  - **D13:** the server signs each proposal (an HMAC over the proposed text and the text it is meant for, valid for a
    short time) and sends the signature along. A save counts as `aanvaard` only when it carries a valid signature over
    an unchanged text. A rejection counts only with a valid signature too. The status is then the server's finding, not
    the browser's word, and still no proposal is stored.
- **No motivation (IV.3, R24).** The teacher sees the old and the new text side by side.
- **Grounded on the teacher's own text only (IV.4, R21).**
  - The prompt carries that text and nothing else: no rapportdoel title, no gradatie, no subdoelen, no other child, no
    earlier report.
  - *Corrected after audit round 2:* the first two versions also sent the rapportdoel's title and the gradatie's label.
    No ruling covered that (R21: *"Alleen de tekst gaat naar de AI"*), and the label is the child's rating.
  - The model is told to keep the meaning and add no facts.
- **Structured and validated (IV.5).** The model returns JSON with one text field. Before the proposal reaches the
  teacher, the server checks that it is non-empty, within a length limit, and carries exactly the placeholders it was
  sent (below).
- **Testable with a faked client (IV.6),** behind the existing AI client interface (ADR-0010).
- **The names of the klas's children are replaced before the text leaves the server (R21, R25).**
  - Before the call, the server replaces the voornaam and the achternaam of **every leerling in that klas**, not only
    the child's own, with a numbered placeholder.
  - After a valid answer it puts back exactly what it replaced.
  - **D14:** the match is on whole words and follows the capitals of the stored name. Many Dutch first names are also
    ordinary words (Roos, Storm, Lente), and in running text those words are written in lower case, so they are left
    alone. A sentence that starts with such a word in capitals is still replaced. That costs a word, not a name.
- **What that does not do, stated so nobody over-reads R21.**
  - A nickname, a misspelling, or the name of a sibling, a parent or a child outside the klas is not caught.
  - **Per R25 the teacher gets a notice** that the names of the children in the klas are replaced and other names are
    not. There is no preview step. The build ticket settles the copy.
  - **Pseudonymised text is still personal data** (AVG recital 26). The AI path is not anonymous, which is why the EU
    data zone, the register and the DPIA question below still apply to it.
- **EU only (VI.3):** Azure OpenAI in the EU data zone (ADR-0016). Azure's abuse monitoring may keep prompts for a
  limited time. The processing register must say so, and whether the school applies to switch it off **is recorded
  under E7-06** by the amendment commit.

### 3.6 The kindtekening

- One image per report (R10): a photo or a scan of the drawing, as JPEG or PNG, with a size limit the build ticket sets.
- **The server re-encodes every upload** before it stores anything. Only a re-encode reliably drops all metadata: EXIF
  (with the GPS position of the phone that took the photo), XMP, IPTC and PNG text chunks. A photo of a drawing taken at
  home can carry the family's address in its metadata.
- **It refuses an image above a pixel limit** that the build ticket sets, read from the header before the image is
  decoded, so a small file that decompresses to gigabytes cannot take the server down.
- **D15:** it is stored **in PostgreSQL, in a table of its own**, so that reading a report does not load images.
  - It is served only through an authorised route, with `Cache-Control: no-store`, never through a public or long-lived
    URL.
  - Blob storage is not used for now: it would be one more service, one more place a deletion has to reach, and
    ADR-0034's environment has none. A later ADR can move the images if their volume asks for it.
- **D16:** any library that decodes or re-encodes images, or writes the PDF or Word files, is **permissively licensed**
  (MIT, Apache or BSD). Art. VIII names only the ClosedXML-over-EPPlus choice; this extends its spirit and is the
  session's rule, not the article's. The build tickets pick the libraries.

### 3.7 Export, retention and deletion

- **Export (R12, R13).**
  - PDF and Word, both made on the server from **one layout model**, so the two show the same report.
  - The design is new, and is made with the `frontend-design` skill.
  - A download is generated on demand, streamed to the teacher, and **never stored** on the server.
  - Each gradatie carries its label next to its coloured star (Art. XII: never colour alone), which also keeps the
    report readable when it is printed in black and white.
  - **R13 settles the ontwikkelingsrapport only.** The Art. XIV question *"Export formats"* for the jaarplan and the
    dekking (FR-11) stays open.
- **Retention (R19, R28).**
  - Directie records **a concrete term in the processing register** (Art. VI.6, E7-06).
  - The app shows, on the beheerpagina, **which schooljaren still hold pupil data, and reminds directie of it**.
  - Deleting stays directie's act. The app never deletes by itself.
- **D7:** directie wipes **one schooljaar** at a time: every leerling of that schooljaar's klassen, with every report,
  rapportbeoordeling and kindtekening. It is a real delete, not a hidden flag, and the confirmation says how many
  children it removes.
- **D8:** a leerkracht of the klas during its schooljaar, or directie, can delete **one leerling** at any time, with all
  their reports. This is for a child who leaves the school, or a parent who asks for erasure (AVG art. 17).
- **Backups:** a deletion reaches a backup only once that backup expires (7 days on the demo, ADR-0034; E7-09 for other
  environments). The register says so.

### 3.8 What protects real data, and what does not

R20 and R27 let real pupil data in as soon as the feature is built. Stated plainly, so nobody reads more protection into
the rules than they give:

- **Gated:**
  - **The demo holds no real pupil data** (ADR-0034, *"alleen fictieve data"*). Fictional children are fine there.
  - **E7-11 stays `[!]` for any environment that holds real school data** until the role matrix is enforced (E6-02).
    Real children therefore reach the app no sooner than real thema's do.
  - **E7-05:** before any environment holds real data, the app gets a database role of its own with DML rights only.
- **Not gated, by the owner's ruling (R20, R27):**
  - the entry in the processing register (Art. VI.6, AVG art. 30);
  - informing the parents, which is owed when the data are collected (AVG art. 13(1)), or within a month if art. 14
    applies;
  - a **DPIA** (AVG art. 35).
  - Evaluations of young children, partly passed through AI, meet at least two of the criteria that make a DPIA very
    likely required before processing starts (evaluation or scoring, and vulnerable data subjects). If it is required,
    processing before it does not meet art. 35(1). **The school carries that
    responsibility** (R27), and the amendment writes the owner's waiver of the order into Art. VI.6 with this cost.
- **Always:**
  - **The repository never holds a real child's name**: not in tests, seed data, fixtures, screenshots, worklogs or
    tickets (Art. VI; ADR-0033). Browser passes use made-up names.
  - **Logs carry no pupil content.** The routes of this feature log ids, never names, texts or images. The AI rewrite
    path logs neither its prompt nor the model's answer. A malformed answer is logged by its kind only, in English (Art.
    II.3). Request-body logging stays off for these routes, as it is off for the whole app today.
  - **Encrypted in transit and at rest** by the platform (Art. VI.5, NFR-5), as for all data. Column-level encryption
    is not added (session choice).

### 3.9 Only for K3

- **D9:** leerlingen can be added only to a klas that grants K3, as decided by **the one place in code that maps a klas to
  its leeftijden** (Art. VI.1).
  - Today that place follows the provisional graadklas rule: a klas states one jaarfase, so a menggroep recorded as K2
    gets no report for its K3 children.
  - Directie's decision on the Art. XIV graadklas question changes that place, and this with it.
  - The other way round, a menggroep recorded as K3 can have K2 children too. The report is for K3 (Art. I.2), so the
    teacher enters only the K3 children. The app stores no age and cannot check it (session default, told to directie
    in question 14).
- **D10:** a child who changes klas during the year is deleted in one klas and added in the other. Moving a leerling with
  their reports is not built; it becomes a ticket if the school asks for it.

### 3.10 Where it lives in the app (R32)

- **R32, as the session reads it** (the owner's words are in §1.7): the ontwikkelingsrapport is a destination of its
  own in the left sidebar, at the bottom, in a new section, well below the fiches.
- **D17:** from `lg`, the report sits in the bottom part of the sidebar, in a section with a rule of its own, above
  Instellingen, which stays last before the sign-in row.
  - The Hoekenfiches and Algemene fiches switches, which show only on the agenda, stay where they are.
  - *Where in the code is build ticket 1's to decide.* Today's `ONDERAAN` array in `frontend/src/app/routes.ts` means
    "setting the school up", gives the push and the rule to its first entry only, and renders every entry as a phone
    tab too. The report can join it, with those three things changed, or become a group of its own.
- **D18:** the tab shows only to a gebruiker who holds a right on some ontwikkelingsrapport:
  - a klastoewijzing on a klas that grants K3;
  - directie;
  - Leerlingzorg.

  For anyone else it would lead to a screen with nothing they may see, and the app never ships a control that does
  nothing (the E3-06 rule). For the same reason the tab ships with the first screen behind it, in build ticket 1.
  A gebruiker whose only right is Leerlingzorg can read reports and nothing else, so for them the tab appears once
  reports can be read (build ticket 3) and the right exists (build ticket 8), not before.
- **Open for the build ticket.**
  - The phone's bottom bar holds five tabs today, and the navigation's own comment says five is what fits.
  - Whether the report becomes a sixth tab there, or is reached another way on a phone, is decided in that ticket's
    `frontend-design` pass and shown to the owner.
  - So is whether the owner's *"ONDERAAN"* means the very bottom, below Instellingen, rather than D17's place above it.

## 4. The amendment this ADR requires

One dedicated commit (Art. XI.1). **Art. VI.7 marks every D-item, and every other part of the session's design it
carries, as a default and not ratified**, in the way Art. VI.1 marks the defaults of ADR-0030.

**In the constitution:**

- **Art. I.1:** a ninth mission item, the K3 ontwikkelingsrapport.
- **Art. I.2:** *"Pupil-level tracking or reporting"* and *"Evaluation / grading / points management"* keep their place,
  with the ontwikkelingsrapport excepted and bounded as in §2. The other three non-goals are unchanged.
- **Art. IV.1:** who decides a rewrite (§3.5).
- **Art. IV.2:** every decision on a rewrite is stored (R23). That a pending proposal is not stored is session design,
  the premise R23 was asked on.
- **Art. IV.3:** a rewrite carries no motivation (R24).
- **Art. IV.4:** only the teacher's text goes to the AI (R21).
- **Art. IV.5:** a rewrite's JSON shape, one rewritten text.
- **Art. VI.1:**
  - *"four rights"* becomes five, with a **Leerlingzorg** bullet (§3.4);
  - the sentence *"A zorgcoördinator is a gebruiker who may hold themabeheer"*, and default **(e)**, name Leerlingzorg
    as well;
  - the ontwikkelingsrapport is stated as outside I9;
  - its rows join ADR-0030's §3 matrix, so the *"one matrix"* stays one;
  - directie does not edit the K3 set and the scale (R31), the one exception to *directie sees and edits everything*.
- **Art. VI.2:** *"No pupil personal data"*, except the ontwikkelingsrapport under a new **Art. VI.7**, which carries §3.3
  to §3.8.
- **Art. VI.6:** for the ontwikkelingsrapport, the register entry and a concrete term are owed, and the owner's waiver of
  their order (R20, R27) is recorded with its cost.
- **Art. IX.4 (new):** the entities of §3.1.
- **Art. XII:** glossary entries for Ontwikkelingsrapport, Leerling, Rapportdoel, Gradatie, Evaluatiemoment,
  Rapportbeoordeling, Algemeen besluit, Kindtekening and Leerlingzorg.
- **Art. XIV:** the bullets on graadklassen (D9), teacher visibility (R17) and export formats (R13), annotated. None is
  added.
- **The ratification log.**

**In step, in the same commit:**

- **The functional analysis:**
  - §2.3 *Binnen scope* and *Buiten scope*;
  - §3.1's zorgcoördinator line;
  - a new FR-13;
  - NFR-6;
  - §7 *Transparantie* and *Brongegevens*;
  - §10 *Aannames*;
  - A.11's *"vier rechten"* and (e).
- **`CLAUDE.md`:**
  - the working agreement *"No pupil personal data in the MVP"*;
  - the working agreement *"AI is advisory"*;
  - the *AI conventions* lines on `voorgesteld` and the motivation;
  - the data model and the glossary;
  - the ADR count.
- **ADRs:**
  - the ADR-0030 §3 matrix rows and a pointer to this ADR;
  - the ADR index;
  - the status lines of ADR-0010, ADR-0011 and ADR-0016, and ADR-0030's header and item (e).
- **The backlog:**
  - E7-06 (the register covers this report, its term and the AI processor);
  - the E8 note on what is out of scope.
  - *Not the E6 epic:* its *"Personal login for staff accounts only (no pupil data)"* on E6-01 is about who can sign in,
    and no pupil ever signs in, so it stays true.
- **A question for directie** in `docs/besluiten-gevraagd.md`: confirmation of the rulings, a concrete term, informing
  the parents, and a DPIA, which is probably required before real data.
- **The agent and skill instructions (R29):**
  - `.claude/agents/antagonist.md`;
  - `.claude/agents/implementer.md`;
  - `.claude/skills/jaarplan-build/SKILL.md`.

  Pupil data outside the ontwikkelingsrapport stays a violation for them, and inside it they check against Art. VI.7.

**Not in the amendment:** code comments that the build will make false, such as `IAiClient.cs` (*"built only from school
+ Op.stap data"*) and `JaarplanGeneratiePromptBuilder.cs` (*"no pupil data exists"*). The build ticket that adds the
rewrite path changes them.

*Directie has not confirmed these rulings.* The school is the verwerkingsverantwoordelijke for its pupils' data, so the
question to directie is more than a formality. By R20 and R27 the build does not wait for it.

## 5. Alternatives considered

- **Leave it out of scope.** The owner chose to amend (R1).
- **Keep the report in the school's existing pupil administration.** That is an integration, which stays a non-goal,
  and the owner asked for it in this tool.
- **Store AI proposals as `voorgesteld`, as for goal matches.** Not offered to the owner. Both of R23's options assumed
  the proposal is not stored, because storing it keeps texts about a child that nobody chose to keep.
- **Store nothing of a rejected proposal.** Offered and not chosen (R23). It would need an exception to IV.2, while a
  bare status costs no text about the child.
- **Show the teacher the text as it leaves, before sending.** Offered as recommended and not chosen (R25).
- **A set and a scale per klas, or per schooljaar.** Ruled against (R4, R5, R7).
- **Send the name to the AI.** Ruled against (R21).
- **Images in Azure Blob Storage.** Deferred (D15).
- **Give Leerlingzorg's read to themabeheer.** Ruled against (R18): it would hand pupil data to a right that exists for
  thema's.
- **Wait for the register and a DPIA before real data.** Offered as recommended, twice, and not chosen (R20, R27).

## 6. Consequences

**Positive**

- The K3 teachers write the report where their subdoelen already are. The three momenten and the download replace work
  that is done by hand today.
- The privacy rules are written down before the first line of code, not reconstructed after it.

**Negative / trade-offs**

- **The app now holds data about children.** A breach or a wrong right costs more than before, so E6-02's enforcement
  and E7-11's gate carry more weight.
- **R7:** renaming a gradatie changes the meaning of reports already given to parents, and D1 blocks deleting anything in
  use.
- **R19 and R28:** nothing is deleted until directie acts. The reminder makes the data visible; it does not remove it.
- **R20 and R27:** real data can arrive before the register entry, before the parents are informed, and before a DPIA.
  The school carries that.
- **R25:** the name filter is best-effort, and the teacher sees a notice rather than what leaves.
- **A fifth right** has to fit into E6-02's policy layer while E6-02 is still being built.
- **Whoever holds the directie right reads and edits every report**, including an ICT-coördinator to whom directie gave
  that right (Art. VI.1). Question 15 tells directie so, for data minimisation (AVG art. 5(1)(c)).

**Follow-ups**

Build tickets, to be created as FB tickets by the functional architect, or by a session at the owner's request, each as
`nieuw`:

1. Leerlingen van een K3-klas beheren: toevoegen met de hand, wijzigen, verwijderen (R14, R15, D8, D9). Dit ticket
   brengt ook de nieuwe sectie onderaan de linkerzijbalk, als ingang van het ontwikkelingsrapport (R32, D17, D18).
2. De K3-rapportdoelen en de sterrenschaal beheren (R3 to R7, D1 to D4, D11, D12).
3. Een ontwikkelingsrapport invullen per evaluatiemoment: gradatie en tekst per rapportdoel, algemeen besluit (R8, R9,
   R26).
4. Een tekst of het besluit laten herwerken door AI, zonder de namen van de klas, met een melding (R21 to R25, D13, D14).
5. Een kindtekening toevoegen per evaluatiemoment (R10, D15, D16).
6. Het rapport downloaden als PDF en Word, in een nieuw ontwerp (R11 to R13, D16).
7. Directie wist de leerlinggegevens van een schooljaar, en de beheerpagina toont welke schooljaren er nog bevatten en
   herinnert de directie eraan (R19, R28, D7).
8. Directie geeft het recht Leerlingzorg (R18), next to E6-04's beheer of rights.

Also:

- **E7-06** widens: the register covers the ontwikkelingsrapport, its term, and the AI processor.
- **Tickets 1 to 8 are built after E6-02 lands**, because the rights of §3.3 are declared in its policy layer.

## Compliance trace

- **Constitution:**
  - Art. I.1/I.2: amended in TB-005's amendment commit (§2, §4). Parent access and pupil-administration integration stay non-goals.
  - Art. II.1/II.3: Dutch domain names; operator messages in English, with no pupil content (§3.8).
  - Art. IV.1 to IV.5: amended in TB-005's amendment commit for the text rewrite (R23, R24; §3.5). IV.6 and IV.7 unchanged.
  - Art. V.1: unchanged, because a rapportbeoordeling never counts for dekking (§2).
  - Art. VI.1: amended in TB-005's amendment commit with a fifth right; the I9 default does not reach the report (§3.3, §3.4).
  - Art. VI.2: amended in TB-005's amendment commit, with the new VI.7 (§3.3 to §3.8).
  - Art. VI.3: the EU AI data zone.
  - Art. VI.5: encryption in transit and at rest.
  - Art. VI.6: amended in TB-005's amendment commit with the owner's waiver of order (R20, R27); the register and a term are owed under E7-06.
  - Art. VIII: the licence rule D16 is the session's.
  - Art. IX.4: new, added in the same commit (§3.1).
  - Art. XI.1: followed; the amendment is a dedicated commit (§4).
  - Art. XII: glossary; never colour alone.
  - Art. XIV, three existing bullets touched and none added:
    - *"Ordering & graadklassen"*: D9 runs through the one klas-to-leeftijden mapping, so directie's decision changes
      one place.
    - *"Teacher visibility"*: R17 narrows it for the ontwikkelingsrapport only. The rest stays directie's.
    - *"Export formats"*: R13 settles the report only, not FR-11.
    - Directie's confirmation of this ADR is outstanding.
- **Backlog:** TB-005; the FB build tickets of §6; E7-05, E7-06, E7-09, E7-11; E6-02 and E6-04 (the policy layer and
  the beheer of rights); the E8 note.
- **FR/NFR:** FR-13 (new, in the functional analysis, with FR-13.10 for the sidebar section); FR-10, FR-11 (untouched), FR-12.2; NFR-5, NFR-6.
