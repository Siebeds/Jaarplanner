# ADR-0030 — Roles and rights live in the app: directie, themabeheer, a hoofdleerkracht per jaar, and personal content

- **Status:** Accepted for the rulings in §1. Everything in §2 is **not ruled**: each item carries a default and
  awaits the owner's confirmation, and §2 says which.
- **Date:** 2026-09-11
- **Deciders:** Project owner (Siebe De Saedeleir), for §1 only. The rulings were given in session on 2026-09-11,
  partly in reply to direct questions with the options and their costs stated. Recorded the same day by session
  `E6-01`, before any code depends on them.
- **Amends:** [ADR-0011](0011-authn-authz-rbac-gdpr.md). **Supersedes its decision §3** ("ownership-aware
  rules"), which assigned class-scoped content to "the owning teacher" at a time when a subthema still named a
  klas. ADR-0011 §1 (personal login over Microsoft Entra ID), §2 (server-side enforcement driven by one
  configurable matrix, no scattered role checks) and §4 (no pupil PII) stand unchanged.
- **Relates to:** [ADR-0022](0022-curriculum-administration-authorisation-seam.md) (the `Curriculumbeheer`
  seam), [ADR-0025](0025-subthema-per-leeftijd.md) (content per leeftijd), [ADR-0031](0031-sessielogin-via-de-api.md)
  (the login mechanism).
- **Realises:** FR-10, FR-12.2, FA §3.1/§3.2. **Backlog:** E6-01, E6-02, E6-04, E6-08, E6-09, E6-10.

> **Revised the same day on its antagonist's findings.** The first version (`30b7031`) presented several of the
> recording session's own design choices as numbered owner rulings, among them "at most one hoofdleerkracht per
> jaar per schooljaar", and it let a matrix row take doelsuggesties away from ordinary teachers without anyone
> ruling that. §1 now quotes the owner verbatim and §2 holds everything that was inferred.

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

Answers to direct questions:

6. *Waar leggen we vast wie directie, hoofdleerkracht of leerkracht is?* The owner chose the offered option **"In
   de app zelf"**. The rejected option was "In Entra".
7. *Wie mag inloggen?* The owner chose **"Enkel wie de directie toevoegde"**. The rejected option was "Iedereen
   in de schooltenant".
8. *Een thema is schoolbreed. Wie mag een thema zelf aanpassen?* The owner wrote in free text:
   *"alleen de directie en een paar leekrachten/zorgcoordinatoren die de directie "*. **The answer is cut off
   after "die de directie"; the verb is missing.**
9. *Wie mag de activiteiten en subdoelen onder een subthema aanpassen?* The owner wrote in free text:
   *"een leerkracht mag zelf activiteiten en subdoelen voor zichzelf onder subthema's plaatsen"*.

### 1.2 What they decide, read narrowly

- **R1. The app records who holds which right, not Entra** (statement 6). The school gets **its own Entra tenant**
  (statement 5), and Entra's job is to authenticate.
- **R2. Only people directie has added can log in** (statement 7).
- **R3. Directie sees and edits everything** (statement 4).
- **R4. Thema's are edited by directie and by a few leerkrachten or zorgcoördinatoren** whom directie in some way
  selects (statement 8, truncated). **This narrows statement 2 for thema's.** Statement 2 named the hoofdleerkracht
  for "subthema's en thema's", and the answer to the direct question put thema's with directie plus a few people.
- **R5. The subthema's of a jaar are edited by "a hoofdleerkracht" of that jaar** (statement 2).
- **R6. A leerkracht may place activiteiten and subdoelen under subthema's for themselves** (statement 9).
- **R7. A leerkracht edits only their own klassen, and can view other klassen** (statement 1).

"Configurable" (Art. VI.1) keeps ADR-0011's reading. **Who holds which right is data** that directie maintains.
**What each right allows is the one matrix in code** (§3), and changing a row there is a code change.

## 2. Interpretations and design choices: not ruled

Each item below was inferred by the recording session, not said by the owner. Each carries the default the build
follows until the owner confirms or corrects it. **None of them affects E6-01.** E6-02, E6-04 and E6-10 must not
treat any of them as settled.

| # | Item | Default until confirmed | Where it bites |
| --- | --- | --- | --- |
| I1 | *"In overeenstemming van alle leerkrachten"* (statement 2) is read as an agreement between people. The tool enforces no consensus, approval or voting. | Nothing is enforced. | E6-02 |
| I2 | R4's missing verb is read as *"designates"*: themabeheer is a right directie grants to named people. | Until E6-04 can grant it, only directie edits thema's. | E6-02, E6-04 |
| I3 | A hoofdleerkracht is appointed **per schooljaar**, because a klas exists per schooljaar. | Per schooljaar. | E6-04 |
| I4 | **How many** hoofdleerkrachten a jaar may have. "Enkel een" in statement 2 reads as "only a hoofdleerkracht, rather than every teacher", **not** as a uniqueness rule. | The model assumes no limit. | E6-04 |
| I5 | Whether the hoofdleerkracht also edits the **shared** subdoelen and activiteiten under their subthema's. The owner named subthema's and thema's only. | Shared subdoelen and activiteiten follow their subthema: directie and that jaar's hoofdleerkracht. | E6-02 |
| I6 | Whether a **shared** layer of activiteiten and subdoelen remains next to personal content. Statement 9 can also mean that all of them become personal. | Existing content stays as it is, and personal content is additive. Goes with open question (a). | E6-10 |
| I7 | **Several leerkrachten on one klas** (co-teacher, duobaan). Statement 1 says one teacher may have several klassen; the reverse is a design choice. FA §3.1 names the co-teacher. | Allowed: the assignment is many-to-many. | E6-04 |
| D1 | The first directie account is provisioned from configuration, because nobody exists yet to add it. | As ADR-0031 decision 7. | E6-01 |
| D2 | The reason offered with question 6, *"Entra cannot express a hoofdleerkracht per jaar per schooljaar without a group per jaar per year"*, is the session's argument. It is not the owner's stated reason. | None: it is a rationale, not a rule. | None |

## 3. The matrix that follows

This matrix supersedes FA §3.2's table for the purpose of the build. The FA itself changes only through the Art. XI
amendment (§5). Abbreviations:

- "TB" = holds themabeheer;
- "HL" = hoofdleerkracht of the jaar concerned;
- "LK eigen" = leerkracht of the klas concerned;
- "LK ander" = leerkracht of another klas.

| Actie | Directie | TB | HL | LK eigen | LK ander |
| --- | --- | --- | --- | --- | --- |
| Op.stap-doelen inladen/vernieuwen | ✓ | – | – | – | – |
| Gebruikers, klassen, schooljaren en rechten beheren | ✓ | – | – | – | – |
| Thema, themadoelen, kernwoordenschat aanpassen (R4) | ✓ | ✓ | – | – | – |
| Subthema van een jaar aanpassen (R5) | ✓ | – | ✓ | – | – |
| Gedeelde subdoelen en activiteiten onder dat subthema (I5, default) | ✓ | – | ✓ | – | – |
| Eigen activiteiten en subdoelen onder een subthema plaatsen (R6) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Doelsuggesties genereren en beoordelen (open (f): FA §3.2 stands) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Thema's en activiteiten importeren, FR-1 (open (b): the 2026-08-03 ruling stands) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Jaarplan bewerken, (her)genereren, agenda, hoeken, algemene fiches (R7) | ✓ | – | – | ✓ | – |
| Jaarplan, agenda en dekking bekijken (R3, R7) | ✓ | lezen | lezen | ✓ | lezen |
| Exporteren | ✓ | – | – | ✓ | lezen |

TB and HL are **additive** to being a leerkracht. A hoofdleerkracht of K3 who teaches K3 groen has both the HL
column and "LK eigen" for K3 groen.

The rows for personal content, doelsuggesties and the import attach to a person, not to a klas. They are therefore
✓ for every leerkracht, and E6-10 and open questions (b) and (f) decide their final shape.

## 4. Still open, named rather than guessed

None of these blocks E6-01. Each is owned by the story that first needs it.

- **(a) Who owns personal content, and who sees it?** "Voor zichzelf" can mean the leerkracht (it follows them into
  next year) or their klas (it stays with the planning). It also leaves open whether colleagues can see it, and
  whose coverage it counts for. *Owner: E6-10.* Nothing personal is built until this is answered.
- **(b) The FR-1 Excel import creates thema's.**
  - On 2026-08-03 the owner ruled that FA §3.2 **stands as written**, so a leerkracht may import thema's and
    activiteiten (E1-13).
  - With that ruling came an instruction: **gate the Op.stap section, not the `/import` route**. R4 now reserves
    editing a thema to directie and themabeheer, and the two conflict for an import that creates a thema.
  - **The 2026-08-03 ruling stays in force until the owner re-rules.** No default here may reverse a standing
    ruling.
  - The frontend marker that ruling relied on (a `magBeheerder` flag plus a section constant) **no longer exists
    in `frontend/src`**. It was lost in the ADR-0024 rebuild, so E6-02 must recreate the section distinction.

  *Owner: E6-02.*
- **(c) A jaar with no hoofdleerkracht appointed.** Only directie edits its subthema's until the owner rules
  otherwise. *Owner: E6-02.*
- **(d) Teacher visibility (FR-10.2, Art. XIV "Teacher visibility").**
  - The owner has ruled the **default**: every klas is readable (R7), and directie sees everything (R3). That
    answers the owner's half of question 4 in `docs/besluiten-gevraagd.md`.
  - Whether directie confirms that default, narrows it, or wants it configurable is still **directie's** call.
    The Art. XIV bullet is therefore narrowed in the amendment, not removed.
  - E6-08 builds the read access **behind the E6-09 seam**, so a narrower answer is a change in one place.

  *Owners: E6-08 and E6-09.*
- **(e) Zorgcoördinator rights.** FA §3.1 marks them *"eventueel beperkte bewerkrechten, ter beslissing"*, which is
  an FA item and not an Art. XIV bullet. R4 lets a zorgcoördinator hold themabeheer. Read access to every klas
  already follows from R7. Anything beyond that is still open. *Owner: E6-02.*
- **(f) Doelsuggesties.**
  - FA §3.2 grants *"AI-suggesties genereren"* to every leerkracht for their own klas.
  - Art. IX.2 hangs `doelsuggesties[]` on the **Thema**, which R4 restricts. So "the right follows the content"
    would take away the E2-08 flow that restored M2 ("a teacher generates doelsuggesties from `/themas`"), and
    with it the wizard's AI assist that Art. IV.8 commits to the MVP.
  - Nobody ruled that. **Until the owner does, FA §3.2 stands:** every leerkracht may generate and review
    doelsuggesties.

  *Owner: E6-02.*
- **(g) The ICT-coördinator.** Art. VI.1 puts "directie / ICT-coördinator" under one role, `Beheerder`, while R3
  speaks of directie only. Whether an ICT-coördinator who runs the beheer also gets R3's "edits all content" is
  open. Until ruled, the right is *"is directie"*, and an ICT-coördinator holds it only if directie grants it.
  *Owner: E6-04.*

## 5. The amendment this owes (Art. XI)

It comes in **two parts**, each a dedicated commit that also updates CLAUDE.md and the FA.

**Part 1: roles, ownership and visibility.** It is owed **before E6-02 or E6-04 build on this ADR**. It touches:

- **Art. VI.1:** name the rights and restate "configurable" as in §1.2;
- **the `Thema` line of Art. IX.2:** "owned by the team/directie" becomes directie plus themabeheer;
- **the Art. XIV "Teacher visibility" bullet:** narrowed as in (d);
- **FA §3.1:** the roles;
- **FA §3.2:** the matrix;
- **FR-3.1:** *"Leerkrachten kunnen thema's, subthema's en activiteiten toevoegen, wijzigen en verwijderen"*;
- **FR-12.2**;
- **ADR-0008:** a status note, since its "owned by team/directie" is superseded here in the same way.

Part 1 can only state what §1 rules. Anything from §2 that the owner has not confirmed by then goes in as a default,
marked as a default.

**Part 2: personal content.** It touches the `Activiteit` and `Subdoel` lines of Art. IX.2. It is owed **with
E6-10**, because it cannot be written before open question (a) is answered.

**E6-01 needs neither part.** Its `Gebruiker` with *"is directie"* stays inside Art. VI.1's existing `Beheerder`
role, and it builds no per-klas or per-jaar check.

## Alternatives considered

- **Roles as Entra groups or app roles.** Offered to the owner. Rejected by statement 6.
- **Everyone in the tenant may log in, and the first login creates a user without rights.** Offered. Rejected by
  statement 7. ADR-0031 still recommends setting *assignment required* in Entra as a second layer.
- **Any hoofdleerkracht may edit any thema.** Offered. Rejected by statement 8.
- **The hoofdleerkracht of any jaar that uses the thema may edit it.** Offered. Rejected by statement 8.
- **Only the hoofdleerkracht edits activiteiten and subdoelen.** Offered. Rejected by statement 9.
- **Encode consensus**, so that a hoofdleerkracht's edit waits for the other teachers' approval. Not offered. It is
  recorded under I1 so that nobody builds an approval flow from the words "in overeenstemming" without asking.

## Consequences

**The model gains four things**, built in the stories named, not all at once:

- **a `Gebruiker`**, created by E6-01: the Entra identity (tenant id and object id), naam, e-mail, and *is
  directie*. E6-04 adds *heeft themabeheer* and maintains both flags.
- **a klastoewijzing `(Gebruiker × Klas)`**, in E6-04. It is many-to-many, per I7.
- **a hoofdleerkrachtaanstelling**, in E6-04. Its scope follows I3 and its cardinality follows I4, both pending.
- **an owner on `Activiteit` and `Subdoel`**, in E6-10, after (a) and I6. Where there is no owner, the content is
  shared.

**Staff personal data enters the system.** Naam, e-mail and two Entra identifiers are allowed under Art. VI.2,
which bans pupil data only. They still need an entry in the processing register and a retention period
(Art. VI.6), which is routed to **E7-06**.

**ADR-0022's seam gets its answer.** The `Curriculumbeheer` policy becomes "directie" in E6-02, as ADR-0022
expected. ADR-0031 adds its authentication half first.

**Enforcement stays one matrix.** ADR-0011 §2 stands:

- the rows in §3 become named policies declared in one place;
- a controller names a policy, and never tests a role inline;
- the "LK eigen" and "HL" columns depend on the klas or jaar a request is about, so they are **resource-based**
  ASP.NET Core authorization handlers. Role claims alone cannot express them.

**Cost, stated.** Directie carries the setup. Nobody but the configured first account can log in until directie has
added them.

## Compliance trace

- **Constitution:**
  - Art. VI.1 (roles, configurable; amendment part 1 owed);
  - Art. VI.2 (the invitation gate keeps pupil accounts out);
  - Art. VI.5 (personal login);
  - Art. VI.6 (staff data, routed to E7-06);
  - Art. IX.2 (the `Thema` line in part 1, personal content in part 2);
  - Art. IV.1/IV.8 (doelsuggesties and the wizard assist stay with teachers under (f));
  - Art. III (school content autonomy);
  - Art. XI (the two-part amendment);
  - Art. XIV (teacher visibility is narrowed, not closed).

  Zorgcoördinator rights are an FA §3.1 "ter beslissing" item, not an Art. XIV one.
- **Backlog:** E6-01 (Gebruiker and login), E6-02 (the matrix as policies, and open questions (b), (c), (e), (f)),
  E6-04 (users, assignments, appointments, themabeheer, and (g)), E6-08 (read, behind the E6-09 seam), E6-09
  `[!]`, E6-10 (personal content), E7-06 (processing register), E7-11 (the deployment gate these close).
- **FR/NFR:** FR-3.1, FR-4, FR-10.1, FR-10.2, FR-12.2, FA §3.1/§3.2; NFR-5, NFR-6.
