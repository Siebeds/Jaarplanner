# E6-02 — Role-based authorization (built with E6-04)

> **Which proposals are current.** The current proposals are in **"Fix round 3"** at the end of this file: the
> ratification row, the backlog edits, the checklist and the owner questions. The CLAUDE.md edits are the ones in
> fix round 2's "After the merge with main", with edit (d) as revised in fix round 3. Every earlier proposal heading
> is kept as the audited record, and is superseded.

## Build round 1 — Art. XI amendment, part 1 (DRAFT for the owner's approval)

- **FR / Article:** FR-1.1, FR-3.1, FR-4, FR-7.2, FR-10.2, FR-12.2, FA §3.1/§3.2/§4/§7/§11; Art. IV.1, VI.1, IX.2,
  XI, XII, XIV; ADR-0030 §5 part 1.
- **Status of this round: a draft.** The owner ruled on 2026-09-13 (statement 16, R13) that part 1 is shown to him
  first and approved **before** it enters the Art. XI ratification log and **before** code is written on it. No
  source code was touched. No ratification-log row was added: its proposed text is below.
- **Branch:** `story/E6-02-amendering`, from `main` `309cc29`. Not pushed, not merged.
- **Gates:** no source, config or test file changed, so `dotnet build/test/format` and `pnpm lint/test/build` do not
  apply and were **not run**. Documentation only.
- **Tests added:** none (no code).

### Files changed, and where

| File | Section | What changed |
| --- | --- | --- |
| `CONSTITUTION.md` | Art. IV.1 | Clarifying note: "teacher confirmation" means the person who holds the right to decide that output (a leerkracht of the klas or directie for a plan; directie or themabeheer for doelsuggesties). Principle unchanged. |
| `CONSTITUTION.md` | Art. VI.1 | Rewritten. Four rights (directie, themabeheer, hoofdleerkracht per (schooljaar, jaarfase), leerkracht via a many-to-many klastoewijzing); no separate ICT role; "configurable" restated as ADR-0030 §1.2 does; old wording quoted as replaced; R6 marked ruled-but-unshaped (part 2, E6-10); seven defaults listed and marked as defaults (who gives themabeheer, visibility, which schooljaar counts, a klas without jaarfase, a jaarfase without hoofdleerkracht, the zorgcoördinator, no consensus). |
| `CONSTITUTION.md` | Art. IX.2, `Thema` line | "Owned by the team/directie" became "edited by directie and by whoever directie gives themabeheer", with an amendment note quoting the old words. |
| `CONSTITUTION.md` | Art. IX.2, `doelsuggesties[]` sub-bullet | "awaiting teacher accept/reject" became "awaiting accept/reject … only directie and themabeheer generate and review them", with the reversal and its reason. |
| `CONSTITUTION.md` | Art. XII | Five entries: Gebruiker, Directierecht, Themabeheer, Hoofdleerkracht, Klastoewijzing. |
| `CONSTITUTION.md` | Art. XIV "Teacher visibility" | Narrowed, not removed: what the owner ruled (R3, R7), and what stays directie's (question 4). |
| `CONSTITUTION.md` | Art. XI ratification log | **Not touched** (R13). Proposed row below. |
| `docs/adr/0030-rollen-en-rechten-in-de-app.md` | header, revision note | Revised-date, deciders for the third round, a second revision note in the style of the first. |
| same | §1.2 | R8 struck and pointed to R14; R11–R18 added; R17 carries the recording session's narrow reading (goal links are part of the content) and points to I11/I12. |
| same | §1.3 (new) | Statements 14–21 verbatim, with chosen and rejected options and their descriptions. Statement 17 notes that it is the question §4 (f) required. |
| same | §2 | Intro rewritten; I5, I7, I8 struck and pointed to R17/R15/R18; I2 and I6 annotated; I10–I13 added; an "I11 in more detail" block with the rejected alternatives and the graadklas case. |
| same | §3 | Intro (supersedes FA §3.2 through part 1, enforced only after R13 approval); column definitions including the new **"LK leeftijd"**; a union rule; doelsuggestie rows → Directie + TB; shared-content row → Directie, HL, LK leeftijd; two wizard rows (I10, default); planning row cites R15. |
| same | §4 | Count sentence; (f) settled by R14 (struck sentences kept); (g) settled by R16; **(h) new**: R17's dekking twin. |
| same | §5 | "Who" struck and replaced (combined build, drafted 2026-09-13, R13); "what it touches" extended with every additional clause this draft changed; "E6-01 needs neither part" annotated. |
| same | Alternatives, Consequences, Compliance trace | Statement-12 alternative struck ("chosen by statement 17"); nine rejected options of statements 14–21 added; klastoewijzing now "per R15"; directie may give the directie right; the Art. IV.1/IV.8 and V.1 trace lines rewritten, old text quoted. |
| `docs/adr/0008-themalaag-level-scoping.md` | Status | Both ownership statements superseded (per-class scoping by ADR-0025; "owned by team/directie" by ADR-0030 and this amendment); the per-level principle stands. |
| `docs/adr/0022-curriculum-administration-authorisation-seam.md` | Status | Pointer: the expected `Beheerder` role is now the directie right. |
| `docs/adr/README.md` | index row 0030, traceability row 0030 | R8's "every leerkracht" summary replaced by the 2026-09-13 rulings; "six open questions" became five; the trace lists the extra clauses. |
| `docs/Functionele_Analyse_Jaarplanner.md` | header, §1 version table | v0.7, row describing A.11 and every pointer. |
| same | §3.1, §3.2 | Leading blockquote: refined / superseded by ADR-0030 §3 and A.11; v0.4 text kept. |
| same | §4, FR-1.1, FR-3.1, FR-4.3, FR-7.2, FR-10.2, FR-12.2, §7, §11, A.5 | Inline *(Verfijnd op 13-09-2026, zie A.11: …)* pointers, v0.4 text kept, as A.10 did. |
| same | Bijlage A.11 (new) | The rights in Dutch prose, why doelsuggesties moved, what "configureerbaar" means, "beheerder" = directierecht, the defaults (marked "voorlopig"), the new terms, directie's confirmation outstanding. |

**Deliberate choice: one matrix.** The FA does not get a second copy of the table. FA §3.2 and A.11 point at
ADR-0030 §3, and Art. VI.1 names that table as the one that supersedes FA §3.2. Two copies of a rights table drift.
The ADR's table already uses Dutch action labels, so directie can read it. If the owner wants a Dutch copy in the FA
for directie's review, it should be generated from the ADR table rather than maintained by hand.

### Each owner ruling mapped to the text it changed

| Statement | Ruling | Text changed |
| --- | --- | --- |
| 14 | R11: E6-01 closes; real-tenant sign-in stays on E7-11 | ADR-0030 §1.2 R11, §1.3, §2 intro, §4 intro, §5 "E6-01 needs neither part", Alternatives. Backlog: proposed below (E7-11 already lists the round trip, `backlog/E7-niet-functioneel.md` ~line 103). |
| 15 | R12: E6-02 + E6-04 built and delivered together | ADR-0030 R12, §5 "Who", I2's default annotation, Alternatives, Compliance trace. Backlog: proposed. |
| 16 | R13: draft first, owner approves before log and code | ADR-0030 R13, §3 intro, §5 "Who"; no ratification row added; this worklog's status line. |
| 17 | R14: doelsuggesties generated and reviewed by directie + themabeheer only; reverses R8; settles (f) | ADR-0030 R8 struck, R14, §1.3, §3 rows, §4 (f), Alternatives, trace; Art. VI.1 (themabeheer bullet), Art. IX.2 `doelsuggesties[]`, Art. IV.1 note, Art. XII Themabeheer; FA §3.2 note, §4, FR-4.3 (+FR-4.2), §7, A.11; ADR index. |
| 18 | R15: several leerkrachten per klas, several klassen per leerkracht; I7 ruled | ADR-0030 R15, I7 struck, §3 "LK eigen" + planning row, Consequences; Art. VI.1 (leerkracht bullet), Art. XII Klastoewijzing; FA §3.1 note, FR-12.2, A.11. |
| 19 | R16: no separate ICT role; directie can give the directie right; settles (g) | ADR-0030 R16, §4 (g), §3 "beheren" row, Consequences; Art. VI.1 (directie bullet, "This replaces"), Art. XII Directierecht; ADR-0022 pointer; FA §3.1 note, FR-12.2, A.11 ("beheerder" = directierecht). |
| 20 | R17: shared activiteiten/subdoelen also for every leerkracht with a klas of that leeftijd; subthema stays directie + HL; I5 ruled differently | ADR-0030 R17, I5 struck, §3 "LK leeftijd" column and row, §4 (h) (new), Alternatives; Art. VI.1 (leerkracht bullet); ADR-0008 status; FA FR-3.1, FR-7.2, A.11. |
| 21 | R18: hoofdleerkracht edits thema's only with themabeheer; I8 ruled | ADR-0030 R18, I8 struck, §3 thema row (R4, R18); Art. VI.1 (hoofdleerkracht bullet), Art. XII Hoofdleerkracht; FA A.11. |

Still **not** ruled, and written as defaults everywhere they appear: I1 (no consensus), I9 (every other klas
readable, behind E6-09; Art. XIV visibility stays directie's), (c) (jaar without hoofdleerkracht: directie only),
(e) (zorgcoördinator: themabeheer if given, plus read). I6 and (a) stay with E6-10. **I2 was not in the
orchestrator's list either way**: I left it a default and annotated it (see open question 6).

### Grep sweep: every other "who may" sentence

Searched `CONSTITUTION.md` and the FA (and `docs/` for `Beheerder`, `elke leerkracht`, `owning teacher`,
`team/directie`) for leerkracht / teacher / directie / Beheerder / eigen klas / iedereen / zorgcoördinator /
co-teacher.

**Changed** (the rulings made them false or misleading):

- Art. IV.1 "without teacher confirmation": clarifying note (a directie or themabeheer holder decides doelsuggesties).
- Art. VI.1: rewritten.
- Art. IX.2 `Thema` "owned by the team/directie": amended.
- Art. IX.2 `doelsuggesties[]` "awaiting teacher accept/reject": amended.
- Art. XIV "Teacher visibility": narrowed.
- FA §3.1, §3.2: pointer and superseded note.
- FA §4 "door de leerkracht bevestigd": pointer.
- FA FR-1.1 "De gebruiker kan … opladen": pointer (R9, already ruled 2026-09-11 but never carried into the FA).
- FA FR-3 intro and FR-3.1: pointer (the FR-3.1 note says it covers the intro too).
- FA FR-4.2 and FR-4.3: pointer on FR-4.3 covering both.
- FA FR-7.2 "doelkoppelingen": pointer (which links depends on what they hang on).
- FA FR-10.2, FR-12.2: pointers.
- FA §7 "de leerkracht beslist": pointer.
- FA §11 visibility question: annotated as partly decided.
- FA A.5 "Eigendom … (team/directie …)": pointer. **Found by the sweep; not in ADR-0030 §5's list.**
- ADR-0022 "expected `Beheerder`" (lines 13, 42, 106): status pointer, text left as written.
- ADR-0030 "E6-01 needs neither part … existing `Beheerder` role": annotated.

**Left unchanged, and why:**

- Preamble "The users are teachers (per class) and directie": still true; hoofdleerkracht and themabeheer are rights
  a teacher holds.
- Art. II.3 "a teacher or directie can act on": about the language of a message, not rights.
- Art. III.2 "Teachers may add internal labels and ordering only": about *what* may change on read-only goals, not
  *who*. No labelling feature exists; if one is built, who may label is unruled.
- Art. IV.7, IV.8 ("the teacher and directie", "AI never skips ahead of the teacher"): still true. Who uses the
  wizard's assist is I10 (default) in ADR-0030.
- Art. V.5, FR-9.4, FR-12.1, FR-12.3 "directie / beheerder": covered by A.11's single statement that "beheerder" means
  whoever holds the directie right, rather than one pointer per clause.
- Art. IX.2 `Subthema` "a teacher plans in", IX.3 `Jaarplan` "a placement the teacher has decided on", IX.3
  `Generatieparameters` "a teacher supplies", XII `Startthema`/`Vast moment`: all about the klas's planning, which a
  leerkracht of the klas still owns (R7, R15).
- Art. XIV "Number of classes & teachers", "Multilingual": not rights.
- Ratification-log rows: historical, never edited.
- FA §2.1, §2.2 bullets, FR-5.4, FR-6.2, FR-8.x, FR-10.1, §9.1, NFR-5: planning of the own klas, or still true.
- ADR-0011 §3, Context: already marked superseded by ADR-0030 on 2026-09-11.
- `docs/besluiten-gevraagd.md` line 136 ("elke leerkracht een eigen lijst"): about streefwoordenschat, not rights.
- *Noticed, out of scope:* FA §11 still lists "Zijn thema's gedeeld … of strikt per klas?" although A.5 settled it on
  2026-06-29; CLAUDE.md's open-decisions list has the same stale line (see proposed CLAUDE.md edit (f)).

### The schooljaar design gap (surfaced, not decided)

- **The gap.** A hoofdleerkracht is appointed per `(Schooljaar, jaarfase)` (R5), and a klastoewijzing ties a
  leerkracht to a `Klas`, which belongs to exactly one `Schooljaar` (`Klas.SchooljaarId`, required and immutable).
  But a `Subthema` (and its `Subdoel`s and `Activiteit`en) is scoped by `Leeftijd` alone and carries no schooljaar
  (`Domain/Schoolcontent/Subthema.cs`, ADR-0025). So "HL of that jaar" (R5) and "leerkracht with a klas of that
  leeftijd" (R17) do not say **which schooljaar's** appointment or klas counts.
- **What the model offers.** `Schooljaar` (`Domain/Planning/Schooljaar.cs`) has `Naam`, `Start`, `Eind`, closures
  and klassen, and **no state**: nothing marks a year current, active or closed. A `TimeProvider` is registered in
  DI (`Infrastructure/DependencyInjection.cs`). Class names are unique school-wide rather than per schooljaar
  (`Klas.cs` remarks), so today "L3" cannot exist in two schooljaren at once. That limits how often several years
  hold klassen side by side, but does not remove the question.
- **Proposed default (I11, marked as a default in Art. VI.1, ADR-0030 §2 and FA A.11):** an appointment or a
  klastoewijzing counts while its schooljaar **has not yet ended** (today ≤ `Schooljaar.Eind`), including a year
  that has not started. Rejected alternatives and why: in ADR-0030 below the §2 table (today's year leaves the
  summer with nobody; the UI-selected year lets a past appointment edit this year's content; a "closed" flag needs
  new state and a directie action). Implementation note for the build: "today" should come from `TimeProvider` in the
  school's time zone, not UTC, or the switch happens at 02:00 on the last school day. That is harmless but visible.
- **Graadklassen.** A `Klas` has one required `Jaarfase` (ADR-0025). An L1/L2 graadklas recorded as L1 gives its
  leerkrachten the R17 right for L1 content only, though they teach L2 pupils. **This leaves a case open**; it
  belongs to the Art. XIV graadklas question and is named in ADR-0030 and FA A.11, not answered.
- **A klas with no stated jaarfase (I12).** Only legacy rows. `Klasleeftijden.VoorKlasAsync` falls back to the
  leerjaar ordinal and **widens** when it cannot derive (leerjaar 0 yields JK+K2+K3; a graadklas ordinal yields
  "every leeftijd"). That is right for a dekking figure and wrong for a right. Proposed default: the rights check
  reads the **stated** `Jaarfase` only and must not reuse `Klasleeftijden`' widening. **Build note:** ADR-0025
  decision 4 says the klas↔leeftijd join lives in exactly one place. The rights check therefore needs a documented
  sibling with the opposite failure direction (fail closed), not a copy and not a reuse.

### Proposed ratification-log entry

> **Superseded by the revised row in "Fix round 1" below.** Kept as the audited text.

*Not added (R13). For the orchestrator to add, as a new last row of the Art. XI ratification log, once the owner
has approved the draft. Adjust if the owner changes anything.*

```markdown
| 2026-09-13 | Siebe De Saedeleir (projecteigenaar) | Amended **Art. VI.1** to name the rights the owner ruled on 2026-09-11 and 2026-09-13 ([ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) §1): **directie** (everything, and it may give the directie right to someone else; there is no separate ICT-coördinator role), **themabeheer** (thema's, the FR-1 import, and, with directie, the only right that generates and reviews doelsuggesties), **hoofdleerkracht** per `(schooljaar, jaarfase)`, several allowed (that jaarfase's subthema's; thema's only with themabeheer), and **leerkracht** through a many-to-many klastoewijzing (the klas's planning, and the shared subdoelen and activiteiten at that klas's leeftijd). "Configurable" now says what it always meant: who holds a right is data, and what a right allows is one matrix, ADR-0030 §3, which supersedes FA §3.2's table. *Amended in step (Art. XI.1):* the `Thema` and `doelsuggesties[]` lines of **Art. IX.2**, a clarifying note on **Art. IV.1**, five **Art. XII** entries, the **Art. XIV** "Teacher visibility" bullet (narrowed, not removed), FA Bijlage **A.11** with pointers at §3.1, §3.2, §4, FR-1.1, FR-3.1, FR-4.3, FR-7.2, FR-10.2, FR-12.2, §7, §11 and A.5, and the status of ADR-0008 and ADR-0022. *Why:* Art. VI.1 named three roles that no longer described the school. A subthema has had no owning klas since ADR-0025, so the "owning teacher" of ADR-0011 §3 pointed at nobody, and FA §3.2's table gave every leerkracht rights the owner has since withdrawn. *The reversal, stated:* on 2026-09-11 the owner ruled that every leerkracht generates and reviews doelsuggesties (ADR-0030 R8). ADR-0030 §4 (f) required that its consequence be put to him before anything enforced it, since one teacher's acceptance moves the dekking of every klas that plans the thema, the figure the onderwijsinspectie reads. It was put on 2026-09-13 and he changed the answer. *Scope of the ratification:* the four rights and what they allow are the **owner's** rulings. The seven defaults Art. VI.1 lists (who gives themabeheer, visibility, which schooljaar counts, a klas without jaarfase, a jaarfase without hoofdleerkracht, the zorgcoördinator, no consensus) are **not** ratified by this entry, and nor is the shape of personal content (part 2, owed with E6-10). ADR-0030 §4 (h), what R17 does to parallel klassen' dekking, was open when this was ratified. *Directie's confirmation is outstanding:* visibility is directie's to decide (question 4 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)); on the rest of the role model no question has been put to them yet. *Shown to the owner as a draft first*, at his request (ADR-0030 R13). |
```

*(If (h) is answered before ratification, replace the sentence about (h) with the answer.)*

### Proposed CLAUDE.md edits

> **Superseded by the revised edits in "Fix round 1" below.** Kept as the audited text.

*CLAUDE.md is held by another session. Art. XI.1 requires these in the same change as the amendment. Exact old →
new text.*

**(a) Working agreements, "AI is advisory" bullet.**

- Old: ``- **AI is advisory (human-in-the-loop).** Every AI suggestion (goal match, generated plan) must be reviewable and accept/reject-able; persist the status. Nothing is "final" without teacher confirmation.``
- New: ``- **AI is advisory (human-in-the-loop).** Every AI suggestion (goal match, generated plan) must be reviewable and accept/reject-able; persist the status. Nothing is "final" without confirmation by the person who holds the right to decide it: a leerkracht of the klas (or directie) for a generated plan, directie or themabeheer for a thema's doelsuggesties ([`CONSTITUTION.md` Art. IV.1 and VI.1](CONSTITUTION.md#article-vi--roles-privacy--security), amended 2026-09-13).``

**(b) Architecture, "AI flow" bullet, last sentence.**

- Old: ``returns suggestions with a short motivation and `status = voorgesteld`. Teacher accepts/rejects in the UI.``
- New: ``returns suggestions with a short motivation and `status = voorgesteld`. Whoever holds the right accepts/rejects in the UI: directie or themabeheer for a thema's doelsuggesties, a leerkracht of the klas for plan placements (Art. VI.1).``

**(c) Data model, `Thema` bullet, and one new bullet after `AlgemeneFiche`.**

- Old: ``- **Thema** — id, naam, subthema's[], activiteiten[].``
- New: ``- **Thema** — id, naam, subthema's[], activiteiten[]. Edited by directie and themabeheer only (Art. IX.2, VI.1).``
- Add after the `AlgemeneFiche` bullet:
  ``- **Gebruiker and rights** — only a gebruiker directie added logs in, and the app (not Entra) records its rights: **directie** (everything; may give the directie right to someone else, e.g. an ICT-coördinator), **themabeheer** (thema's, the FR-1 import, doelsuggesties), **hoofdleerkracht** per (schooljaar, jaarfase), several allowed (that jaarfase's subthema's), and a **klastoewijzing** per klas, many-to-many (that klas's planning, plus the shared subdoelen and activiteiten at its leeftijd). What each right allows is one matrix, [ADR-0030 §3](docs/adr/0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows); see [`CONSTITUTION.md` Art. VI.1](CONSTITUTION.md#article-vi--roles-privacy--security), which marks its defaults as defaults.``

**(d) Domain glossary: add after `Graadklas / menggroep`.**

```markdown
- **Hoofdleerkracht** — a leerkracht appointed per (schooljaar, jaarfase), several allowed, who edits that jaarfase's subthema's.
- **Themabeheer** — the right directie gives to edit thema's, run the FR-1 import, and generate and review doelsuggesties.
- **Directierecht** — see and edit everything and maintain gebruikers and rights; directie may give it to someone else. There is no separate ICT role.
- **Klastoewijzing** — the many-to-many link between a gebruiker and a klas they teach.
```

**(e) Status, first paragraph: annotate rather than rewrite** (it records what E2-08 delivered).

- Old: ``a teacher generates doelsuggesties from `/themas` and reviews them, verified in a browser against a real API and PostgreSQL.``
- New: ``a teacher generates doelsuggesties from `/themas` and reviews them, verified in a browser against a real API and PostgreSQL. *(Since the owner's ruling of 2026-09-13 only directie and themabeheer may do this (Art. VI.1); E6-02 gates that control.)*``

**(f) Optional, not required by this amendment:** the open-decisions line "Whether a leerplandoel/thema is shared
school-wide or per class." has been resolved since 2026-06-29 (Art. XIV resolved list); and the "ADR-0001…0026"
range in the header is stale (0032 exists).

### Proposed backlog edits

*`backlog/E6-beheer-rollen-samenwerking.md` and `backlog/README.md` are the orchestrator's.*

1. **E6 "Auth & roles" ruling block:** strike the R8 bullet (`~~**R8:** every leerkracht may generate and review
   doelsuggesties.~~ Reversed 2026-09-13, see R14`) and add:
   - **R11:** E6-01 closes; the real-tenant sign-in stays a precondition on E7-11.
   - **R12:** E6-02 and E6-04 are built and delivered together.
   - **R13:** amendment part 1 is approved by the owner as a draft before it is logged or built on.
   - **R14:** only directie and themabeheer generate and review doelsuggesties.
   - **R15:** a klas may have several leerkrachten, a leerkracht several klassen.
   - **R16:** no separate ICT role; directie may give the directie right.
   - **R17:** the shared subdoelen and activiteiten are edited by directie, the jaar's hoofdleerkrachten and every
     leerkracht with a klas of that leeftijd.
   - **R18:** a hoofdleerkracht edits thema's only with themabeheer.

   And change "Everything else in that ADR is a default" to name I1, I2, I6, I9–I13, (c), (e) and (h).
2. **E6-01:** `[~]` → `[x]`, *"closed 2026-09-13 by owner ruling (ADR-0030 R11, statement 14). The real-tenant round
   trip is a precondition on E7-11 and is already listed there."* No change to E7-11 is needed.
3. **E6-02:**
   - Title annotation: *"built and delivered together with E6-04 on `feature/e6-rollen-rechten` (ADR-0030 R12)"*.
   - Body: replace "their shared subdoelen and activiteiten only under default I5" with "the shared subdoelen and
     activiteiten, edited also by every leerkracht with a klas of that leeftijd (R17)". Add "doelsuggesties:
     directie and themabeheer only (R14)".
   - *Waits on part 1* → *"part 1 drafted 2026-09-13 on `story/E6-02-amendering`; enforce nothing from it until the
     owner has approved it (R13)"*.
   - *Treat nothing in ADR-0030 §2 as ruled* → name I1, I2, I6, I9, I10–I13 (I5, I7 and I8 were ruled on
     2026-09-13).
   - Open questions: **(f)** → *"settled by R14"*. **Add (h):** *"put R17's dekking effect on parallel klassen to the
     owner before enforcing R17"*. Add I10–I13 as the defaults it builds on.
   - **New done-when bullet (the E3-06 rule, "never ship a control that does nothing"):** *"E2-08's doelsuggestie
     controls on the themadetail screen (`frontend/src/features/themas/ThemadetailScherm.tsx`:
     `useGenereerDoelsuggesties`, and the accept/reject/aanpassen controls) are shown only to directie and
     themabeheer. So are the thema form, the subthema form, the shared subdoel/activiteit controls and the FR-1 import
     section, per the matrix. The client therefore needs the caller's rights, so `GET /api/ik` carries them. The
     server still enforces; the client only hides."*
   - **Correct the E2 carry-forward:** it names `/api/doelsuggesties/*`, but the live routes are
     `api/themas/{themaId}/doelsuggesties`, `…/genereer` (POST), `…/{suggestieId}/status` (PUT) and
     `…/{suggestieId}/leerplandoel` (PUT) in `DoelsuggestiesController`. All three writes fall under R14.
4. **E6-04:**
   - Title annotation: built with E6-02 (R12).
   - Replace "*Not ruled, confirm with the owner before building:* … (I7 …) … (open (g))" with *"Ruled 2026-09-13:
     several leerkrachten per klas and several klassen per leerkracht (R15); no separate ICT role, and directie may
     give the directie right to someone else (R16). The last directie still cannot be removed or demoted."*
   - Add: *"Show whether an appointment or klastoewijzing currently counts (I11: its schooljaar has not ended), and
     name klassen without a stated jaarfase, which grant no leeftijd right (I12)."*
5. **E6-10:** note that R17 presupposes a shared layer editable by every leerkracht of that leeftijd, so the story's
   "without going through the hoofdleerkracht" rationale is weaker than when it was filed. I6 is still open.
6. **E2-08 (optional):** one line pointing to E6-02 for the gating of its trigger.
7. **`backlog/README.md`:** E6 progress count (E6-01 closed), and a note that E6-02/E6-04 are one delivery.

### Open questions for the owner

1. **§4 (h), must be asked before E6-02 enforces R17.** A decided link on a shared subdoel or activiteit counts for
   the dekking of every klas at that leeftijd that places the thema. Under R17 the leerkracht of K3 groen can
   therefore change K3 blauw's and K3 geel's coverage figure. Keep R17 as ruled, or narrow who may edit the **goal
   links** (as opposed to the activiteit's other fields)?
2. **I11, which schooljaar counts:** keep "an appointment or klastoewijzing counts while its schooljaar has not
   ended"?
3. **I12:** a klas without a stated jaarfase grants no leeftijd right (fail closed). Agree?
4. **I13:** re-scoping a subthema to another leeftijd requires the subthema right at both leeftijden. Agree? (E1-19
   still owns whether the re-scope should exist.)
5. **I10:** the wizard's AI assist follows the content it proposes for (step 2 = themabeheer; step 6 = the R17
   right). Agree, or should all AI goal suggestions sit with themabeheer as statement 17 does for doelsuggesties?
6. **I2:** statement 21's chosen description ("als de directie hem ook themabeheer geeft") presupposes that directie
   grants themabeheer, and FR-12.2 has the beheerder "rechten toekennen". Confirm, so I2 becomes a ruling? Until
   then the draft writes "given by directie" in Art. VI.1, Art. XII and FA A.11, and lists it as a default in both
   of the first and in A.11's "nog niet beslist". *(Found in the proofread: the first draft of Art. VI.1 stated it as
   a fact with no default line.)*
7. **Graadklassen:** a graadklas states one jaarfase, so its leerkrachten edit shared content of one of their two
   ages only. Acceptable until the Art. XIV graadklas decision?
8. **R5's scope:** does a hoofdleerkracht also **create and delete** subthema's at their jaarfase, or only edit
   existing ones? The matrix row says "aanpassen", as the rulings do. The build will read it as the full lifecycle
   unless told otherwise.
9. **Directie:** should a question about the role model go into `docs/besluiten-gevraagd.md`? Today only visibility
   (question 4) is there, so the ratification row can only say directie "has not been asked".
10. **One matrix or two:** is a pointer from FA §3.2 to ADR-0030 §3 enough for directie's review, or does the owner
    want a Dutch copy in the FA (see "Deliberate choice" above)?

### Self-check against the task

- ADR-0030: statements 14–21 in a dated §1.3 ✓; §1.2 updated, R8 struck and replaced ✓; I5/I7/I8/(f)/(g)
  strike-and-point ✓; §3 matrix updated with the doelsuggestie rows, the shared-content row and a defined "LK
  leeftijd" column; subthema row still Directie + HL ✓; compliance trace ✓; revision note ✓.
- Amendment text: Art. VI.1 ✓ (rights, "configurable", ICT-coördinator per statement 19); Art. IX.2 `Thema` ✓;
  Art. XIV visibility narrowed ✓; Art. XII ✓; FA §3.1 ✓, §3.2 ✓, FR-3.1 ✓, FR-4 ✓, FR-10.2 ✓, FR-12.2 ✓; ADR-0008 ✓;
  grep sweep listed above ✓. Defaults are marked as defaults in every file ✓.
- Schooljaar gap: default proposed and marked, listed as open question 2; graadklassen checked (open case named) ✓.
- Ratification row: not added; proposed text above ✓.
- CLAUDE.md, backlog files, ADR-0032, nl.json, Migrations: not touched ✓.

### For the test-runner

Nothing to run: documentation only. What should verify it is the **antagonist** pass (Art. XIII), which ADR-0030's
history shows is where these drafts get corrected, followed by the owner's review (R13). Checks worth pointing it
at:

- Does any text state a right the rulings do not name? Watch R17's "goal links" reading, I10–I13, and "LK
  leeftijd" in the matrix.
- Does any default read as a ruling?
- Do Art. VI.1, ADR-0030 §3 and FA A.11 agree row for row?

## Fix round 1 — antagonist round 1 (1 MAJOR, 7 MINOR, 3 QUESTION) and owner statements 22–25

- **Input:** `backlog/worklogs/E6-02/antagonist.md` (written by the orchestrator, included in this commit
  unedited), and four owner rulings asked on 2026-09-13 after that audit (statements 22–25).
- **Branch:** `story/E6-02-amendering`, committed on top of `49e29b6`. No amend, no push, no merge.
- **Still a draft (R13):** no ratification-log row, no CLAUDE.md edit, and no backlog edit. Each stays a proposal
  below. No source code. Gates are not applicable and were not run.

### Per finding

| # | Finding | Disposition | Where |
| --- | --- | --- | --- |
| 1 | **MAJOR:** ratifying Art. VI.1 would ratify I10, I13 and the R17 goal-link reading | **Fixed, with one deliberate deviation.** Art. VI.1 now says: *a row of the matrix is ratified only as far as the rulings (R-items) it cites; whatever it takes from an I-item or a lettered §4 question is a default and is not ratified, and a row citing no ruling is a default entirely.* The same rule is in ADR-0030 §2 intro and §3 intro, FA A.11 ("Configureerbaar"), and the revised ratification row, which no longer counts. The full default set is listed identically in Art. VI.1, FA A.11 and the row (below). *Deviation from the guidance, for the orchestrator to adjudicate:* the literal wording "any row citing an I-item is a default" would also un-ratify the viewing row, which cites R3 and R7 (ruled) beside I9 (not ruled). "Ratified only as far as the R-items it cites" keeps R7 ratified and I9 not. | CONSTITUTION Art. VI.1; ADR-0030 §2, §3; FA A.11 |
| 2 | **MINOR:** R17 goal-link reading filed as narrow | **Settled by statement 22 (R19).** The R17 reading is struck with a note, and the matrix row is split: *content* of shared activiteiten/subdoelen (Directie, HL, LK leeftijd) and *goal links* on them (Directie, HL). What "content" means is **I14**, marked as the session's reading, not the owner's. From the model: `Subdoel` holds only `SubthemaId`, `Leeftijd` and its `Koppeling` (`Domain/Schoolcontent/Subdoel.cs`), so **a subdoel has no content beyond its link**; creating, changing or deleting one is a goal-link action. `Activiteit` holds naam, type, hoek, verwachte uitkomsten, onderzoeksvraag, kleur and lengte beside `Doelkoppelingen`, and all but the links are content. I14 also treats deleting or moving (E4-08) an activiteit that carries links as unlinking. FR-7.2 now states R19 flat, since it is ruled. Wizard step 6 (I10) moves to Directie and HL. | ADR-0030 R17, R19, §2 I10/I14, §3; Art. VI.1; FA FR-3.1, FR-7.2, A.11 |
| 3 | **MINOR:** I2 stated as fact in three places | **Fixed.** Art. XII Themabeheer now reads "held by a few named …; that directie is the one who gives it is a default (I2)". Art. IX.2 `Thema` no longer says "whoever directie gives". FA FR-12.2 marks themabeheer-granting *voorlopig*, and A.11's bullet says *voorlopig kent de directie het toe*. CLAUDE.md edit (d) is revised below. | CONSTITUTION IX.2, XII; FA FR-12.2, A.11 |
| 4 | **MINOR:** a gebruiker with none of the four rights has no column | **Fixed.** "LK ander" became **"Ander" = any gebruiker who is none of the other relations**, including one with no klastoewijzing. I9 now covers such a gebruiker (a default). Art. VI.1 and A.11 say what a gebruiker with none of the four rights may do: log in and, by default, read every klas; nothing else. The personal-content row's "Ander" cell is footnoted: R6 names a *leerkracht*, so for a gebruiker who is no leerkracht that cell is not ruled (E6-10). | Art. VI.1; ADR-0030 §2 I9, §3; FA A.11 |
| 5 | **MINOR:** doelsuggestie "aanpassen" missing | **Fixed.** Row "Doelsuggesties aanvaarden, weigeren of aanpassen (R14)"; Art. VI.1 "accepts, rejects or adjusts"; Art. XII "generate, review and adjust"; A.11 "aanvaardt, weigert of aanpast". It covers `PUT …/doelsuggesties/{id}/leerplandoel`. | Art. VI.1, XII; ADR-0030 §3; FA A.11 |
| 6 | **MINOR:** sweep missed ADR-0026 and ADR-0010; A.11 misreports FR-4.2; I1 missing from A.11 | **Fixed.** ADR-0026 status pointer: streefwoordenschat is a `Subthema` field and follows the subthema row (Directie, HL: R5, R21); its Consequences line "A K3-groen teacher edits K3-blauw's list" no longer holds for an ordinary leerkracht, and E10-01's done-when would need the HL right; the choice to treat it as shared content instead is put to the owner (question 6 below). The other subthema fields (naam, duurWeken, onderzoeksvragen, probleemstelling; leeftijd is I13) follow the same row. ADR-0010 status pointer on "the teacher decides". A.11 now says it refines FR-4.3 "en daarmee FR-4.2", with no pointer at FR-4.2. I1 is in A.11's list. An E10-01 note is proposed below. | ADR-0026, ADR-0010 status; FA A.11 |
| 7 | **MINOR:** "verbatim" record elided | **Fixed.** §1.3 is rewritten with the full questions and every option's description, from the orchestrator's text, including the "(Aanbevolen)" label as the owner saw it. It records that the owner chose against the recommendation on statement 15, and which statements had no recommended option (17, 20, 22). Statements 22–25 are added as a third set. The block was spliced in by heading (awk) because it was too long to match reliably; the file was renormalised to CRLF after. | ADR-0030 §1.3 |
| 8 | **MINOR:** dated markers assume ratification on 2026-09-13 | **Fixed.** Reworded as "owner rulings of 2026-09-13" or "beslissingen van 13-09-2026", never "amended on" a date. That covers Art. IV.1, VI.1, IX.2 and XIV; every FA "Verfijnd op" / "Vervangen op" marker plus A.5's; ADR-0008 and ADR-0022; and the proposed row, whose date is now `<ratification date>`, and CLAUDE.md edit (a). *Left as is, on purpose:* the FA version row 0.7 is dated 13-09-2026 because a version records when text was written, and ADR-0030's "drafted 2026-09-13" is the drafting date. | CONSTITUTION; FA; ADR-0008, ADR-0022 |
| 9 | **QUESTION:** Art. XIV visibility, directie has not confirmed | **Adopted.** The bullet now says "Directie has not confirmed the owner's part, and it removes 'no other klas at all' from directie's choice." | CONSTITUTION XIV |
| 10 | **QUESTION:** graadklas case missing from Art. VI.1 | **Now a provisional ruling (statement 25, R22)**, recorded in Art. VI.1 as "Graadklassen, provisionally, until directie decides the Art. XIV graadklas question", with the **requirement that the rights-side klas→leeftijden mapping lives in one place**. That requirement is justified by Art. XIV's seam rule and is not a new right. Also in ADR-0030 R22 and Consequences, and FA A.11. | Art. VI.1; ADR-0030 R22, Consequences; FA A.11 |
| 11 | **QUESTION:** the MVP wizard now spans three rights | **Put to the owner** as a consequence, not a new rule (question 7 below). No text asserts a wizard rule. | worklog only |

### New rulings 22–25 and the text they changed

| Statement | Ruling | Text changed |
| --- | --- | --- |
| 22 | **R19:** goal links on shared activiteiten/subdoelen are for Directie and HL only; LK leeftijd edits content. Narrows R17 and settles §4 (h). | ADR-0030 R17 (reading struck), R19, §1.3, §2 I10/I14, §3 split rows, §4 (c)/(h), Alternatives, trace; Art. VI.1 (hoofdleerkracht and leerkracht bullets, I14, (c)); Art. XII Hoofdleerkracht; ADR-0008 status; FA FR-3.1, FR-7.2, A.11 |
| 23 | **R20:** an appointment or klastoewijzing counts until its schooljaar ends, including a year not yet started. Rules I11. | ADR-0030 R20, I11 struck, "I11 in more detail" relabelled, §3 column definitions; Art. VI.1 "Which schooljaar counts" is moved from the defaults to the ruled text; FA A.11 |
| 24 | **R21:** a hoofdleerkracht creates, edits and deletes their jaar's subthema's; deleting takes the activiteiten and links along. | ADR-0030 R21, §3 subthema row; Art. VI.1, Art. XII; ADR-0008, ADR-0026 status; FA FR-3.1, A.11 |
| 25 | **R22 (provisional):** a graadklas's leerkrachten get the rights of its one jaarfase; HL or directie do the other leeftijd; pending directie's Art. XIV decision. | ADR-0030 R22, §2 graadklas bullet, Consequences; Art. VI.1; FA A.11 (and its directie-confirmation line) |

**How statement 22 interacts with the rest:**

- **Doelsuggesties (statement 17).** A doelsuggestie is a `DoelKoppeling` on the **thema** (Art. IX.2
  `doelsuggesties[]`), not on a shared activiteit or subdoel. It is therefore not a goal link in statement 22's
  sense; it has its own rows under R14 (Directie, TB). Consequence: a hoofdleerkracht, who may link goals to a
  subdoel, may not accept a doelsuggestie. Stated in ADR-0030 §4 (h).
- **The FR-1 import (R9, E1-18).** The import writes `Manueel` links at themadoel, subdoel **and** activiteit level
  (`SchoolcontentImportDiff.KoppelingNiveau`: Themadoel, Subdoel, Activiteit). The import is its own row (Directie,
  TB), so no row contradicts another. But a themabeheer holder, who may not link a goal to a shared subdoel by
  hand, can do so wholesale through an import. That is consistent as two rulings, and it may not be intended. Stated
  in ADR-0030 §4 (h) and put to the owner (question 5).

### Recounted default set (identical in Art. VI.1, FA A.11 and the proposed row)

Ten entries, none ruled: **I1** (no consensus); **I2** (directie gives themabeheer); **I6 with (a)** (shared layer
stays; personal content's owner and visibility open); **I9 with (d)** (every gebruiker reads every klas, behind
E6-09; directie's to narrow); **I10** (wizard AI assist follows the content); **I12** (klas without a stated jaarfase
grants no leeftijd right); **I13** (re-scoping a subthema needs the HL right at both leeftijden); **I14** (what
"content" means beside goal links; session's reading); **(c)** (jaar without a hoofdleerkracht: directie only, for
subthema's and goal links); **(e)** (zorgcoördinator: themabeheer if given, plus reading).

*Left the set this round:* I11 (R20), the graadklas case (R22, provisional), §4 (h) (R19), and the create/delete
question about R5 (R21). *Still open with no default:* (a) sits with I6, and (d) with I9.

### Revised proposed ratification-log entry

*Not added (R13). The orchestrator adds it as the last row once the owner approves the draft, with the actual date.*

```markdown
| <ratification date> | Siebe De Saedeleir (projecteigenaar) | Amended **Art. VI.1** to name the rights the owner ruled on 2026-09-11 and 2026-09-13 ([ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) §1, statements 1–25): **directie** (everything; it may give the directie right to someone else; there is no separate ICT-coördinator role), **themabeheer** (thema's, the FR-1 import, and, with directie, the only right that generates, reviews and adjusts doelsuggesties), **hoofdleerkracht** per `(schooljaar, jaarfase)`, several allowed (creates, edits and deletes that jaarfase's subthema's and links goals to its shared activiteiten and subdoelen; thema's only with themabeheer), and **leerkracht** through a many-to-many klastoewijzing (the klas's planning, and the *content* but not the goal links of the shared activiteiten and subdoelen at that klas's leeftijd). It also states which schooljaar counts (one that has not ended), rules graadklassen provisionally (the klas's one jaarfase, pending directie's Art. XIV decision, with the klas→leeftijden mapping in one place), and says what a gebruiker with none of the four rights may do. "Configurable" now says what it always meant: who holds a right is data, and what a right allows is one matrix, ADR-0030 §3, which supersedes FA §3.2's table. *Amended in step (Art. XI.1):* the `Thema` and `doelsuggesties[]` lines of **Art. IX.2**, a clarifying note on **Art. IV.1**, five **Art. XII** entries, the **Art. XIV** "Teacher visibility" bullet (narrowed, not removed), FA Bijlage **A.11** with pointers at §3.1, §3.2, §4, FR-1.1, FR-3.1, FR-4.3, FR-7.2, FR-10.2, FR-12.2, §7, §11 and A.5, the status of ADR-0008, ADR-0010, ADR-0022 and ADR-0026, and CLAUDE.md. *Why:* Art. VI.1 named three roles that no longer described the school. A subthema has had no owning klas since ADR-0025, so the "owning teacher" of ADR-0011 §3 pointed at nobody, and FA §3.2's table gave every leerkracht rights the owner has since withdrawn. *The two reversals, stated:* on 2026-09-11 the owner ruled that every leerkracht generates and reviews doelsuggesties (R8), and on 2026-09-13, when shown that one acceptance moves the dekking of every klas that plans the thema, changed it to directie and themabeheer (R14). Later the same day, shown that a goal link on a shared activiteit or subdoel moves the dekking of every parallel klas, he kept the content with the leerkrachten of that leeftijd and gave the links to directie and the hoofdleerkrachten (R19). *Scope of the ratification:* this entry ratifies the rulings (R-items) only. **A row of the ADR-0030 §3 matrix is ratified only as far as the R-items it cites**; whatever a row takes from an I-item or a lettered §4 question is a default and is not ratified here. The defaults Art. VI.1 lists (I1, I2, I6 with (a), I9 with (d), I10, I12, I13, I14, (c) and (e)) are **not** ratified, and nor is the shape of personal content (part 2, owed with E6-10). *Directie's confirmation is outstanding:* visibility is directie's to decide (question 4 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)), the graadklas rule waits on their Art. XIV decision, and on the rest of the role model no question has been put to them yet. *Shown to the owner as a draft first*, at his request (ADR-0030 R13). |
```

### Revised proposed CLAUDE.md edits

*Replaces (a)–(f) above. (b) and (f) are unchanged; (a), (c), (d) and (e) are revised.*

**(a) Working agreements, "AI is advisory" bullet.**

- Old: ``- **AI is advisory (human-in-the-loop).** Every AI suggestion (goal match, generated plan) must be reviewable and accept/reject-able; persist the status. Nothing is "final" without teacher confirmation.``
- New: ``- **AI is advisory (human-in-the-loop).** Every AI suggestion (goal match, generated plan) must be reviewable and accept/reject-able; persist the status. Nothing is "final" without confirmation by the person who holds the right to decide it: a leerkracht of the klas (or directie) for a generated plan, directie or themabeheer for a thema's doelsuggesties ([`CONSTITUTION.md` Art. IV.1 and VI.1](CONSTITUTION.md#article-vi--roles-privacy--security), on the owner's rulings of 2026-09-13).``

**(b) Architecture, "AI flow":** unchanged from round 1.

**(c) Data model.**

- Old: ``- **Thema** — id, naam, subthema's[], activiteiten[].``
- New: ``- **Thema** — id, naam, subthema's[], activiteiten[]. Edited by directie and themabeheer only (Art. IX.2, VI.1).``
- Add after the `AlgemeneFiche` bullet:
  ``- **Gebruiker and rights** — only a gebruiker directie added logs in, and the app (not Entra) records its rights: **directie** (everything; may give the directie right to someone else, e.g. an ICT-coördinator), **themabeheer** (thema's, the FR-1 import, doelsuggesties; that directie grants it is a default), **hoofdleerkracht** per (schooljaar, jaarfase), several allowed (creates, edits and deletes that jaarfase's subthema's, and alone with directie links goals to its shared activiteiten and subdoelen), and a **klastoewijzing** per klas, many-to-many (that klas's planning, plus the content, not the goal links, of the shared activiteiten and subdoelen at its leeftijd). An appointment or klastoewijzing counts until its schooljaar ends; a graadklas provisionally grants its one jaarfase. What each right allows is one matrix, [ADR-0030 §3](docs/adr/0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows), ratified only as far as the rulings each row cites; see [`CONSTITUTION.md` Art. VI.1](CONSTITUTION.md#article-vi--roles-privacy--security) for the defaults.``

**(d) Domain glossary:** add after `Graadklas / menggroep`:

```markdown
- **Hoofdleerkracht** — a leerkracht appointed per (schooljaar, jaarfase), several allowed, who creates, edits and deletes that jaarfase's subthema's and links goals to its shared activiteiten and subdoelen.
- **Themabeheer** — the right, held by a few named people, to edit thema's, run the FR-1 import, and generate and review doelsuggesties. That directie gives it is a default (ADR-0030 I2).
- **Directierecht** — see and edit everything and maintain gebruikers and rights; directie may give it to someone else. There is no separate ICT role.
- **Klastoewijzing** — the many-to-many link between a gebruiker and a klas they teach.
```

**(e) Status, first paragraph:** annotate rather than rewrite.

- Old: ``a teacher generates doelsuggesties from `/themas` and reviews them, verified in a browser against a real API and PostgreSQL.``
- New: ``a teacher generates doelsuggesties from `/themas` and reviews them, verified in a browser against a real API and PostgreSQL. *(Since the owner's rulings of 2026-09-13 only directie and themabeheer may do this (Art. VI.1); E6-02 gates that control.)*``

**(f)** Optional, unchanged from round 1.

### Revised proposed backlog edits (delta on round 1)

1. **E6 ruling block:** also add R19 (goal links on shared content for directie and HL only), R20 (schooljaar counts
   until it ends), R21 (HL creates and deletes the jaar's subthema's), and R22 (graadklas: its one jaarfase,
   provisionally). The "everything else is a default" line becomes: I1, I2, I6 with (a), I9 with (d), I10, I12, I13,
   I14, (c), (e). *This corrects round 1's list, which still named (h) and I11.*
2. **E6-02 open questions:** (h) → *"settled by R19"*. Add I14 as a default it builds on. Add the build requirement
   from R22: *"one place maps a klas to the leeftijden it grants rights for; it fails closed (I12) and does not reuse
   `Klasleeftijden`' widening."*
3. **E6-02 done-when, E3-06 rule, extended:** the goal-link controls on shared activiteiten and subdoelen
   (`POST/DELETE /api/activiteiten/{id}/doelkoppelingen` and the subdoel controls) are shown only to directie and
   that jaar's hoofdleerkrachten. So are the wizard's step-6 assist (I10) and its step-2 assist (Directie, TB).
4. **E10-01 (new note):** *"Since the ADR-0030 rulings of 2026-09-13, streefwoordenschat is a `Subthema` field and
   follows the subthema row (directie and that jaar's hoofdleerkrachten, R5, R21). The done-when's 'a teacher
   standing in the agenda … add and remove words' therefore needs the hoofdleerkracht right, unless the owner rules
   streefwoordenschat to be shared content (question 6 in the E6-02 worklog). See ADR-0026's status pointer."*
5. **E1-19 (new note):** re-scoping a subthema's leeftijd is gated by default I13 (the HL right at both leeftijden)
   once E6-02 lands; E1-19 still owns whether the re-scope exists at all.
6. **E6-05 (new note):** the wizard spans three rights under R4, R5/R21 and R17/R19 (see question 7).

### Remaining open questions for the owner

*Dropped because statements 22–25 answered them:* round 1's questions 1 ((h), statement 22), 2 (I11, statement 23),
7 (graadklassen, statement 25) and 8 (R5's lifecycle, statement 24).

1. **I14:** "content" is every field of an activiteit except its goal links. A subdoel has no content beyond its link,
   so a leerkracht of that leeftijd cannot create, change or delete a subdoel. Deleting or moving an activiteit that
   carries goal links counts as unlinking, so it needs the hoofdleerkracht. Agree?
2. **I10:** the wizard's AI assist. Step 2 (themadoelen) goes to Directie and TB; step 6 (subdoelen) to Directie and
   HL. Agree? Today every gebruiker can call both.
3. **I12:** a klas without a stated jaarfase grants no leeftijd right (fail closed). Agree?
4. **I13:** re-scoping a subthema to another leeftijd needs the hoofdleerkracht right at both leeftijden. Agree?
5. **The import and R19:** the FR-1 import (Directie, TB) writes `Manueel` goal links on subdoelen and activiteiten.
   So a themabeheer holder can link goals wholesale that they may not link by hand. Intended?
6. **Streefwoordenschat (ADR-0026, E10-01):** as a subthema field it now follows the subthema row (Directie, HL).
   ADR-0026 designed it for every K3 teacher to edit from the agenda. Keep it with the subthema, or rule it shared
   content (every leerkracht of that leeftijd)?
7. **The wizard spans three rights (Art. IV.8, FA A.7).** This is a consequence of the rulings, not a new rule.
   Steps 1–2 (thema, themadoelen) need themabeheer; the subthema steps and subdoelen (4–6) need the hoofdleerkracht;
   activiteit content (7) needs a leerkracht of that leeftijd. No ordinary leerkracht can finish the ten steps alone.
   The owner should know this before the wizard UI (E6-05) is designed.
8. **I2:** confirm that directie grants themabeheer.
9. **Directie:** add a role-model question to `docs/besluiten-gevraagd.md`?
10. **One matrix or two:** is a pointer from FA §3.2 to ADR-0030 §3 enough for directie's review?

Unchanged defaults the owner may also confirm: I1, I6, I9, (c), (e).

### Files touched this round

The seven of round 1 (`CONSTITUTION.md`, the FA, ADR-0008, ADR-0022, ADR-0030, `docs/adr/README.md`, this worklog),
**plus** `docs/adr/0026-streefwoordenschat-op-subthema.md` and `docs/adr/0010-ai-advisory-architecture.md` (status
pointers only), plus `backlog/worklogs/E6-02/antagonist.md` (the orchestrator's, included unedited).

## Fix round 2 — antagonist round 2 (2 MAJOR, 9 MINOR, 1 QUESTION) and owner statements 26–31

- **Input:** round 2 of `backlog/worklogs/E6-02/antagonist.md` (the orchestrator's, committed unedited), and six
  owner rulings asked on 2026-09-13 (statements 26–29, then 30–31 to clarify statement 26's free text).
- **Branch:** `story/E6-02-amendering`, committed on top of `e9f32d1`; then `origin/main` (`f04f131`, PR #53) merged
  in as the orchestrator asked. No amend, no push, no other merge.
- **Still a draft (R13):** no ratification-log row, no CLAUDE.md edit, no backlog edit; each is a proposal below. No
  source code. Gates not applicable, not run.
- **ADR-0030 was rewritten as a whole file** this round (`Write`), because the changes touched every section. Its
  untouched text was carried over verbatim; `git diff` shows the real changes.

### Per finding

| # | Finding | Disposition | Where |
| --- | --- | --- | --- |
| 1 | **MAJOR:** I14 empties the subdoel half of statement 22; misquotes Art. IX.2 | **Ruled by statements 26, 30 and 31 (R23–R26).** The question for statement 26 **stated the premise**: *"Een subdoel is in het model enkel een koppeling aan een doel"*. That disclosure is recorded in §1.3 and in R24. I14 is struck and points to R23–R25; its move clause survives, corrected, as I19. The Art. IX.2 paraphrase is corrected in the I14 row, R24 and §1.3: the constitution defines a subdoel as *"a concrete, age-differentiated goal … linking to a Leerplandoel"*, and the pure-link shape is the model's (`Subdoel.cs`). | ADR-0030 R23–R26, §1.3, §2; Art. VI.1; FA A.11 |
| 2 | **MAJOR:** Art. VI.1's "only" contradicts the import; "activiteit level" is false | **Ruled by statement 27 (R27)**, in favour of R9. Art. VI.1's themabeheer bullet now includes *"the goal links that import writes on themadoelen and subdoelen"*; the leerkracht bullet says *"goal links by hand"*; R19 says "by hand". "Activiteit level" is removed and struck in ADR-0030 §4 (h), with the correction: the import writes themadoel and subdoel links only (`SchoolcontentImportService.cs:394-396`, and `KoppelingNiveau.Activiteit` is never emitted). **§1.3 records that the question for statement 27 overstated this** ("op subdoelen en activiteiten", "op alle niveaus"), and that the orchestrating session corrected it to the owner in the same session right after the answer, saying the answer stands because the import does less than described. R27 covers what the import actually writes. | ADR-0030 R19, R27, §1.3, §4 (b), (h); Art. VI.1; FA FR-7.2, A.11 |
| 3 | **MINOR:** uncited rows, A.11 rule differs, Exporteren anomaly | **Fixed.** The rule now says **citations count at column level** (every Directie ✓ rests on R3; a "–" grants nothing), in Art. VI.1, ADR-0030 §2 and §3, and A.11. Every row now cites a ruling: Op.stap (R3; ADR-0022), Exporteren (R3, R7; I9), the two wizard rows replaced by one R29 row. The Exporteren TB, HL and LK leeftijd cells are now "lezen" like "Ander", with footnote ⁴. | Art. VI.1; ADR-0030 §2, §3; FA A.11 |
| 4 | **MINOR:** "Nothing else." ratified; footnote ¹ on one cell | **Fixed.** "Nothing else" is now "by default … ((e) below); whether they may add personal content is E6-10's". Default (e) covers any gebruiker with none of the four rights. Footnote ¹ now sits on the TB, HL and Ander cells. | Art. VI.1; ADR-0030 §3, §4 (e); FA A.11 |
| 5 | **MINOR:** hoofdleerkracht defined inconsistently; R17 content right missing | **Fixed.** A hoofdleerkracht is **a gebruiker appointed per (schooljaar, jaarfase)**. Must they hold a klastoewijzing? Default **I20: no**. The HL bullet now carries shared-activiteit content, create, delete (with or without links), subdoelen and goal links by hand (R17, R19, R23–R25). | Art. VI.1, XII; ADR-0030 §2 I20, §3 HL column; FA A.11 |
| 6 | **MINOR:** R20 broader than statement 23 | **Fixed.** R20 is scoped to the shared content ("HL" and "LK leeftijd"), which is what statement 23 asked (*"rechten op de gedeelde inhoud"*). A klastoewijzing's rights on the klas's own planning are **I21: no end date** (a default). | ADR-0030 R20, §2 I11/I21, §3, Consequences; Art. VI.1; FA A.11 |
| 7 | **MINOR:** move called "unlinking" | **Fixed.** **I19**: a move is neither deletion nor unlinking, because Art. IX.2 has the activiteit keep its links; the links then count for the klassen that plan the other thema. So moving one with links needs the goal-link right (directie, HL); without links, any leerkracht of that leeftijd may move it; a move is not a deletion for the maker right. | ADR-0030 §2 I19, §3 move row (footnote ³); Art. VI.1; FA A.11 |
| 8 | **MINOR:** Art. XIV and FA §11 graadklas not annotated | **Fixed.** Both are annotated as partly answered for rights, provisionally (R22), with directie not yet asked. Owner question 10 below proposes adding graadklassen to `docs/besluiten-gevraagd.md`. | CONSTITUTION Art. XIV; FA §11 |
| 9 | **MINOR:** ratification-day phrases not listed | **Fixed.** See "Ratification checklist" below. | worklog |
| 10 | **MINOR:** backlog edits stale in combination | **Fixed.** One consolidated set below, which supersedes every earlier set. | worklog |
| 11 | **MINOR:** I2 residual | **Fixed.** **I2 is narrowed** to the reading of statement 8's missing verb, and it changes nothing in the build. Who grants themabeheer rests on FA FR-12.2 (the beheerder "rechten toekennen") and R16 (the beheerder is the directie right), exactly as for klastoewijzingen and hoofdleerkracht appointments. The directie bullet in Art. VI.1 and A.11 says so. The matrix row "Gebruikers, klassen … beheren" now cites **R2, R3, R16; FA FR-12.2**, so it rests on rulings. The Art. XII Themabeheer entry and the FA FR-12.2 pointer drop "voorlopig" and cite FR-12.2 instead. | Art. VI.1, XII; ADR-0030 §2 I2, §3; FA FR-12.2, A.11 |
| 12 | **QUESTION:** wizard step 6 against Art. IV.8 | **Ruled by statement 29 (R29):** the whole wizard, both AI steps included, is for themabeheer (and directie). I10 is struck. This agrees with Art. IV.8's "step 6, the matching of FR-4", since the FR-4 doelsuggesties are themabeheer's too (R14). R29 lets themabeheer create subthema's and subdoelen at any leeftijd through the wizard; the chosen option said so. | ADR-0030 R29, §2 I10, §3; Art. VI.1; FA A.11 |

### Statements 26–31: the rulings and what they changed

| Statement | R-item | Text changed |
| --- | --- | --- |
| 26 (with the free-text addition) | **R23** leerkracht of that leeftijd edits shared activiteit content and creates activiteiten; **R24** subdoelen: directie and HL only; part of **R25** | ADR-0030 R17 note, R19, R23, R24, §1.3, §2 I14/I15, §3 rows; Art. VI.1; ADR-0008; FA FR-3.1, A.11 |
| 27 | **R27** the FR-1 import may write goal links (themadoel and subdoel level) | ADR-0030 R19 ("by hand"), R27, §1.3 (the overstatement and its correction), §4 (b), (h); Art. VI.1; FA FR-7.2, A.11 |
| 28 | **R28** streefwoordenschat is shared content (Directie, HL, LK leeftijd) | ADR-0030 R28, §3 row; Art. VI.1; ADR-0026 pointer (rewritten: it now agrees with ADR-0026's original promise); ADR-0008; FA A.11 |
| 29 | **R29** the wizard is for themabeheer, all steps; retires I10 | ADR-0030 R29, §2 I10, §3 row; Art. VI.1, XII; FA FR-7.2, A.11 |
| 30 | **R25**, **R26** "eigen" = created by that leerkracht; the app records the maker; the activiteit stays shared; not personal content | ADR-0030 R25, R26, §4 (a), Consequences (the model gains a maker on `Activiteit`), §5 part 2 note; Art. VI.1, IX.2 `Activiteit`, XII "Maker"; FA A.11 |
| 31 | **R25** the maker deletes only while no goal is linked | ADR-0030 R25, §3 rows (footnote ²); Art. VI.1; FA FR-3.1, A.11 |

- **Recorded as consequences:**
  - *The maker is new data.* It is on `Activiteit` as a nullable reference to `Gebruiker`, empty for existing and
    imported activiteiten, in the ADR-0030 Consequences and Art. IX.2.
  - *It is staff data.* It links content to a named staff member, so it is routed to **E7-06**, with I17 as its
    retention rule.
  - *It is not R6/E6-10 personal content.* Statement 30 rejected that reading. This is stated in R26, Art. VI.1,
    Art. IX.2, Art. XII, §4 (a) and A.11.
- **Model detail:** statement 26's option named *"beschrijving"*, a field `Activiteit` does not have. R23 says so,
  and I15 covers the fields it did not name.

### The default set, recounted (identical in Art. VI.1, FA A.11 and the proposed row)

Fifteen entries, none ruled:

- I1
- I2 (the reading of statement 8 only)
- I6 with (a)
- I9 with (d)
- I12
- I13
- I15
- I16
- I17
- I18
- I19
- I20
- I21
- (c)
- (e)

*Left the set this round:* I10 (R29), and I14 (R23–R25; its move clause lives on as I19).

### Ratification checklist (what the orchestrator does on the day the owner approves)

1. Add the ratification-log row below as the **last** row of Art. XI, with the real date. Main added a row on
   2026-09-13 (PR #53), so check the order after the merge.
2. Apply the CLAUDE.md edits in the **same** commit (Art. XI.1), re-pointed at CLAUDE.md on main (see "After the
   merge with main" below).
3. Apply the consolidated backlog edits below.
4. Change these phrases, which become false on that day. File and line are as of the fix-round-2 commit; they were
   re-checked after the merge.
   - `docs/adr/0030-rollen-en-rechten-in-de-app.md:480-481`, §3 intro: *"drafted 2026-09-13. Under R13 the owner
     approves that draft before anything is enforced from it."* Change to "ratified on <date>".
   - `docs/adr/0030-…:647-648`, §5 "Who": *"Drafted 2026-09-13 … Under R13 the owner approves the draft before it is
     logged in Art. XI"*. Change to "ratified on <date>".
   - `docs/adr/0030-…:684`: *"Once part 1 lands, that role is the directie right"*. Change to "Since part 1 (<date>)".
   - `docs/adr/0030-…:3`, Status: add "Part 1 of the amendment ratified on <date>".
   - `docs/adr/README.md:43`: *"the matrix binds once amendment part 1 lands, drafted 2026-09-13 for the owner's
     approval"*. Change to "binds since part 1 was ratified on <date>".
   - `docs/adr/README.md:79` (it was :78 before the merge with main): *"part 1 drafted 2026-09-13 for the owner's
     approval"*. Change to "part 1 ratified on
     <date>".
   - `docs/adr/0022-curriculum-administration-authorisation-seam.md:4`: *"once the Art. VI.1 amendment on those
     rulings lands"*. Change to "since the Art. VI.1 amendment of <date>".
   - `docs/adr/0026-streefwoordenschat-op-subthema.md:12`: *"Neither version was ratified."* Change to "The second
     was ratified with Art. VI.1 on <date>."
   - **Not** changed on the day, because they stay true: every "(owner) rulings of 2026-09-13" / "beslissingen van
     13-09-2026" marker in the constitution and the FA, the FA version row 0.7 (a version records when it was
     written), and ADR-0008's status.

### Proposed ratification-log entry (current; supersedes both earlier versions)

```markdown
| <ratification date> | Siebe De Saedeleir (projecteigenaar) | Amended **Art. VI.1** to name the rights the owner ruled on 2026-09-11 and 2026-09-13 ([ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) §1, statements 1–31). **Directie** sees and edits everything and maintains gebruikers, klassen, schooljaren and rights (FA FR-12.2, the beheerder now being the directie right; there is no separate ICT-coördinator role). **Themabeheer** edits thema's, runs the FR-1 import including the goal links it writes on themadoelen and subdoelen, works the whole thema-opbouw wizard, and is with directie the only right that generates, reviews and adjusts doelsuggesties. The **hoofdleerkracht**, a gebruiker appointed per `(schooljaar, jaarfase)`, several allowed, creates, edits and deletes that jaarfase's subthema's and subdoelen, links goals to its shared activiteiten by hand, and deletes any of them; thema's only with themabeheer. The **leerkracht**, through a many-to-many klastoewijzing, edits the klas's planning, and at that klas's leeftijd edits and creates shared activiteiten, edits streefwoordenschat, and deletes an activiteit they created while no goal is linked to it; the app records that maker, and the activiteit stays shared. It also states which schooljaar counts for the shared content (one that has not ended), rules graadklassen provisionally (the klas's one jaarfase, pending directie's Art. XIV decision, with the klas→leeftijden mapping in one place), and says what a gebruiker with none of the four rights may do. "Configurable" now says what it always meant: who holds a right is data, and what a right allows is one matrix, ADR-0030 §3, which supersedes FA §3.2's table. *Amended in step (Art. XI.1):* the `Thema`, `doelsuggesties[]` and `Activiteit` lines of **Art. IX.2**, a clarifying note on **Art. IV.1**, six **Art. XII** entries, the **Art. XIV** "Teacher visibility" bullet (narrowed, not removed) and graadklas bullet (partly answered for rights), FA Bijlage **A.11** with pointers at §3.1, §3.2, §4, FR-1.1, FR-3.1, FR-4.3, FR-7.2, FR-10.2, FR-12.2, §7, §11 and A.5, the status of ADR-0008, ADR-0010, ADR-0022 and ADR-0026, and CLAUDE.md. *Why:* Art. VI.1 named three roles that no longer described the school. A subthema has had no owning klas since ADR-0025, so the "owning teacher" of ADR-0011 §3 pointed at nobody, and FA §3.2's table gave every leerkracht rights the owner has since withdrawn. *The reversals and the premises, stated:* on 2026-09-11 the owner ruled that every leerkracht generates and reviews doelsuggesties (R8), and on 2026-09-13, shown that one acceptance moves the dekking of every klas that plans the thema, gave it to directie and themabeheer (R14). Shown that a goal link on shared content moves the dekking of every parallel klas, he gave those links to directie and the hoofdleerkrachten (R19). Told that a subdoel is, in the model, only a link to a goal, he kept subdoelen with them too (R24). The question on the import overstated what it writes; it was corrected in the same session and the answer stands (R27). *Scope of the ratification:* this entry ratifies the rulings (R-items) only. **A row of the ADR-0030 §3 matrix is ratified only as far as the rulings it cites, counted at column level**; whatever a row takes from an I-item or a lettered §4 question is a default and is not ratified here. The defaults Art. VI.1 lists (I1, I2, I6 with (a), I9 with (d), I12, I13, I15–I21, (c) and (e)) are **not** ratified, and nor is the shape of personal content (part 2, owed with E6-10). *Directie's confirmation is outstanding:* visibility is directie's to decide (question 4 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)), the graadklas rule waits on their Art. XIV decision, and on the rest of the role model no question has been put to them yet. *Shown to the owner as a draft first*, at his request (ADR-0030 R13). |
```

### Consolidated backlog edits (supersede every earlier set)

*For `backlog/E6-beheer-rollen-samenwerking.md` and `backlog/README.md`, as on main after PR #53, which changed one
line of the E6 file. Apply against that file.*

1. **"Auth & roles" ruling block.** Replace the R1–R9 list with a pointer and a short list. The pointer: *"Owner
   rulings of 2026-09-11 and 2026-09-13 ([ADR-0030 §1](../docs/adr/0030-rollen-en-rechten-in-de-app.md)), ratified
   into Art. VI.1 on <date>"*. The list:
   - R1–R3: rights in the app; only invited people log in; directie sees and edits everything.
   - R4: themabeheer edits thema's.
   - R5, R21: hoofdleerkrachten per (schooljaar, jaarfase) create, edit and delete that jaar's subthema's.
   - R6: personal content (E6-10).
   - R7, R15: a leerkracht edits their own klassen' planning (many-to-many) and views others.
   - ~~R8~~ → R14: doelsuggesties for directie and themabeheer only.
   - R9, R27: the FR-1 import for directie and themabeheer, links included.
   - R16: no ICT role.
   - R17, R19, R23–R26: shared activiteiten content and creation for every leerkracht of that leeftijd; subdoelen and
     goal links by hand for directie and HL; deletion by the maker without links, otherwise HL.
   - R20: an appointment counts until its schooljaar ends.
   - R22: graadklas, provisionally.
   - R28: streefwoordenschat is shared.
   - R29: the wizard is for themabeheer.

   Then: *"Everything else in that ADR is a default, not a ruling: I1, I2, I6 with (a), I9 with (d), I12, I13,
   I15–I21, (c), (e)."*
2. **E6-01:** `[~]` → `[x]`, *"closed 2026-09-13 by owner ruling (ADR-0030 R11). The real-tenant round trip is a
   precondition on E7-11 and already listed there."*
3. **E6-02** (title: *"built and delivered together with E6-04 (ADR-0030 R12)"*). Replace the body with:
   - *What:* enforce the ADR-0030 §3 matrix server-side, as named policies declared in one place. The "HL", "LK
     leeftijd", "LK eigen" and maker relations are resource-based handlers. Bind `Curriculumbeheer` to the directie
     right.
   - *Model:*
     - a nullable maker on `Activiteit` (R26), set on create by a leerkracht, a hoofdleerkracht or the wizard (I18);
       null for existing rows and for the FR-1 import;
     - one place maps a klas to the leeftijden it grants rights for (R22), reading the stated `Jaarfase` only and
       failing closed (I12), and not reusing `Klasleeftijden`' widening;
     - appointments and klastoewijzingen count for shared content until their schooljaar ends (R20), and for the
       klas's planning without an end date (I21).
   - *Done when:* each action in the matrix is allowed or denied per relation and per resource, server-side, with a
     test per row. **No control that does nothing (the E3-06 rule).**
     - The doelsuggestie controls on the themadetail screen (`frontend/src/features/themas/ThemadetailScherm.tsx`,
       `useGenereerDoelsuggesties` and the accept/reject/adjust controls) are shown only to directie and themabeheer.
     - So are, each per its row: the thema form, the FR-1 import section, the wizard, the subthema form, the subdoel
       controls, the goal-link controls on activiteiten, the activiteit delete (maker or HL), the move, and the
       streefwoordenschat editor.
     - `GET /api/ik` carries the caller's rights; the server still enforces.
   - *Routes to cover:*
     - `api/themas/{themaId}/doelsuggesties` with `…/genereer`, `…/{id}/status`, `…/{id}/leerplandoel`. The old
       carry-forward named `/api/doelsuggesties/*`, which does not exist.
     - `api/thema-opbouw/*`.
     - The activiteit and subdoel routes, including `POST/DELETE /api/activiteiten/{id}/doelkoppelingen` and the
       move.
     - `PUT /api/subthemas/{id}` (a re-scope follows I13).
     - The five jaarplan write routes, and `POST /api/schooljaren`.
   - *Open questions it owns:* (b)'s gate, (c), (e). (f) and (h) are settled (R14, R19).
   - *Defaults it builds on:* I1, I2, I9, I12, I13, I15–I21.
4. **E6-04** (title: *"built and delivered together with E6-02 (R12)"*).
   - Replace the "Not ruled, confirm with the owner" line with *"Ruled 2026-09-13: several leerkrachten per klas and
     several klassen per leerkracht (R15); no separate ICT role, and directie may give the directie right (R16)."*
   - Add: *"A hoofdleerkracht needs no klastoewijzing (I20). Show whether an appointment or klastoewijzing currently
     counts for shared content (R20), and name klassen without a stated jaarfase, which grant no leeftijd right
     (I12). The last directie cannot be removed or demoted; removing a gebruiker leaves their activiteiten purely
     shared (I17)."*
5. **E6-05:** *"The wizard is for themabeheer and directie, all steps, including subthema's and subdoelen at any
   leeftijd (ADR-0030 R29). The maker of an activiteit it creates is the themabeheer holder (I18)."*
6. **E6-10:** *"The activiteit maker (R26) is not personal content: the activiteit stays shared. The shared layer
   exists and is edited by every leerkracht of that leeftijd (R17, R23); whether it remains next to personal content
   is I6. Open question (a) is unchanged."*
7. **E10-01:** *"Streefwoordenschat is shared content (ADR-0030 R28): directie, that jaar's hoofdleerkrachten and
   every leerkracht with a klas of that leeftijd edit it, so the done-when stands. See ADR-0026's status pointer."*
8. **E1-19:** *"Once E6-02 lands, re-scoping a subthema to another leeftijd needs the hoofdleerkracht right at both
   leeftijden, or directie (default ADR-0030 I13). This story still owns whether the re-scope exists at all."*
9. **E7-06:** *"The processing register also covers the activiteit maker (ADR-0030 R26): it links school content to
   a named staff member. Retention when the gebruiker leaves: the activiteit becomes purely shared (I17)."*
10. **E2-08 (optional):** *"Since the owner's rulings of 2026-09-13 its trigger and review controls are for directie
    and themabeheer only (R14); E6-02 gates them."*
11. **`backlog/README.md`:** E6 progress (E6-01 closed); a note that E6-02 and E6-04 are one delivery.

### Remaining open questions for the owner

*Answered by statements 26–31 and dropped:* fix round 1's question 1 (I14), 2 (I10), 5 (the import), 6
(streefwoordenschat) and 7 (the wizard).

1. **I15:** are the activiteit fields you did not name (type, onderzoeksvraag, kleur, lengte) content, which every
   leerkracht of that leeftijd edits?
2. **I16:** do the other subthema fields (naam, duur, probleemstelling, onderzoeksvragen) stay with directie and the
   hoofdleerkracht, like the subthema itself?
3. **I17:** when a maker is removed as a gebruiker, do their activiteiten become purely shared?
4. **I18:** is the themabeheer holder the maker of an activiteit the wizard creates?
5. **I19:** may a leerkracht of that leeftijd move an activiteit without goal links to another thema, and only a
   hoofdleerkracht or directie one with links?
6. **I20:** may a hoofdleerkracht be appointed who teaches no klas of that jaar?
7. **I21:** does a leerkracht keep editing the planning of a klas from a past schooljaar?
8. **I12:** does a klas without a stated jaarfase grant no leeftijd right?
9. **I13:** does moving a subthema to another leeftijd need the hoofdleerkracht right at both leeftijden?
10. **Directie:** add two questions to `docs/besluiten-gevraagd.md`: the role model as a whole, and **graadklassen**
    (R22 is provisional, and directie has never been asked).
11. **One matrix or two:** is the pointer from FA §3.2 to ADR-0030 §3 enough for directie's review?

Unchanged defaults the owner may also confirm: I1, I2 (a reading only), I6, I9, (c), (e).

### After the merge with main

- **Merged `origin/main` at `0fcb700` into `story/E6-02-amendering` as `55f6a75`**, on top of the fix-round commit
  `c5b8f69`.
  - The orchestrator named `f04f131` (PR #53, E1-21/E1-22). By the time of the fetch, `origin/main` also carried
    PR #52 (`0fcb700`, azure-demo, ADR-0034), so the merge brought in both.
  - Nothing else was merged, and nothing was pushed.
- **One conflict:** `docs/adr/README.md`, the index rows for 0030 and 0031. Both sides were kept: this branch's 0030
  row and main's 0031 row, which adds *"Decision 2 amended by 0034"*. `CONSTITUTION.md`, the FA and `CLAUDE.md`
  merged without conflict.
- **What main changed in the files this draft cites, and why no reference moved:**
  - *CONSTITUTION.md.* Art. VII.2's text, the Art. XIV "Op.stap import" resolution, and a new ratification-log row
    dated 2026-09-13 (Art. VII.2), now **line 289 and the last row**. The draft cites articles and anchors, never
    constitution line numbers, and every one of them (IV.1, VI.1, IX.2, XII, XIV, and the `#article-…` anchors)
    still resolves. **The proposed E6-02 row goes after line 289.**
  - *FA.* Only §8 ("Koppeling leerplandoelen"). A.11 is intact at line 408, and its anchor `#a11-rollen-en-rechten`
    and every pointer to it still resolve.
  - *Ratification checklist.* ADR-0030:480, :647 and :684, ADR-0022:4, ADR-0026:12 and README:43 are unchanged. The
    README traceability row for 0030 moved from **:78 to :79** (main added a 0034 row); the checklist is corrected.
- **The CLAUDE.md edits, re-pointed at `CLAUDE.md` on main.** PR #53 rewrote the E1 Status paragraph (line 21) and
  touched nothing these edits target. Each "old" text below was verified present on main after the merge, at the
  line given. *These supersede every earlier CLAUDE.md proposal in this file.*

  **(a) Working agreements, line 36.**
  - Old: ``- **AI is advisory (human-in-the-loop).** Every AI suggestion (goal match, generated plan) must be reviewable and accept/reject-able; persist the status. Nothing is "final" without teacher confirmation.``
  - New: ``- **AI is advisory (human-in-the-loop).** Every AI suggestion (goal match, generated plan) must be reviewable and accept/reject-able; persist the status. Nothing is "final" without confirmation by the person who holds the right to decide it: a leerkracht of the klas (or directie) for a generated plan, directie or themabeheer for a thema's doelsuggesties ([`CONSTITUTION.md` Art. IV.1 and VI.1](CONSTITUTION.md#article-vi--roles-privacy--security), on the owner's rulings of 2026-09-13).``

  **(b) Architecture, "AI flow", line 120, last sentence.**
  - Old: ``returns suggestions with a short motivation and `status = voorgesteld`. Teacher accepts/rejects in the UI.``
  - New: ``returns suggestions with a short motivation and `status = voorgesteld`. Whoever holds the right accepts/rejects in the UI: directie or themabeheer for a thema's doelsuggesties, a leerkracht of the klas for plan placements (Art. VI.1).``

  **(c) Data model, line 129, plus one new bullet after the `AlgemeneFiche` bullet (line 134).**
  - Old: ``- **Thema** — id, naam, subthema's[], activiteiten[].``
  - New: ``- **Thema** — id, naam, subthema's[], activiteiten[]. Edited by directie and themabeheer only (Art. IX.2, VI.1).``
  - Add: ``- **Gebruiker and rights** — only a gebruiker directie added logs in, and the app (not Entra) records its rights. **Directie** sees and edits everything and maintains gebruikers, klassen, schooljaren and rights; it may give the directie right to someone else, e.g. an ICT-coördinator. **Themabeheer** edits thema's, runs the FR-1 import (goal links included) and the whole thema-opbouw wizard, and generates and reviews doelsuggesties. A **hoofdleerkracht**, a gebruiker appointed per (schooljaar, jaarfase), several allowed, creates, edits and deletes that jaarfase's subthema's and subdoelen, links goals to its shared activiteiten by hand, and deletes any of them. A **klastoewijzing** per klas, many-to-many, gives that klas's planning plus, at its leeftijd, the content and creation of shared activiteiten, the streefwoordenschat, and deleting an activiteit one created while no goal is linked to it (the activiteit records its **maker** and stays shared). Appointments and klastoewijzingen count for shared content until their schooljaar ends; a graadklas provisionally grants its one jaarfase. What each right allows is one matrix, [ADR-0030 §3](docs/adr/0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows), ratified only as far as the rulings each row cites; see [`CONSTITUTION.md` Art. VI.1](CONSTITUTION.md#article-vi--roles-privacy--security) for the defaults.``

  **(d) Domain glossary: add after `Graadklas / menggroep` (line 172).**

  ```markdown
  - **Hoofdleerkracht** — a gebruiker appointed per (schooljaar, jaarfase), several allowed, who creates, edits and deletes that jaarfase's subthema's and subdoelen and links goals to its shared activiteiten.
  - **Themabeheer** — the right directie gives (FA FR-12.2) to edit thema's, run the FR-1 import and the thema-opbouw wizard, and generate and review doelsuggesties.
  - **Directierecht** — see and edit everything and maintain gebruikers and rights; directie may give it to someone else. There is no separate ICT role.
  - **Klastoewijzing** — the many-to-many link between a gebruiker and a klas they teach.
  - **Maker (of an activiteit)** — the gebruiker who created it; they may delete it while no goal is linked to it. The activiteit stays shared.
  ```

  **(e) Status, line 19: annotate rather than rewrite.** The E2-08 sentence is unchanged on main.
  - Old: ``a teacher generates doelsuggesties from `/themas` and reviews them, verified in a browser against a real API and PostgreSQL.``
  - New: ``a teacher generates doelsuggesties from `/themas` and reviews them, verified in a browser against a real API and PostgreSQL. *(Since the owner's rulings of 2026-09-13 only directie and themabeheer may do this (Art. VI.1); E6-02 gates that control.)*``

  **(f) Optional, not required by this amendment.** The open-decisions line at 196, *"Whether a leerplandoel/thema is
  shared school-wide or per class."*, has been resolved since 2026-06-29. The header's "ADR-0001…0026" range (line 9)
  is staler still, now that 0034 exists.

## Fix round 3 — antagonist round 3 (1 MAJOR, 5 MINOR, 1 QUESTION) and owner statements 32–34

- **Input:** round 3 of `backlog/worklogs/E6-02/antagonist.md` (the orchestrator's, committed unedited), and three
  owner rulings asked on 2026-09-13 after it (statements 32–34, all on the recommended option).
- **Branch:** committed on top of `31e059e`. `origin/main` was fetched and is still `0fcb700`, so there was no second
  merge. No amend, no push.
- **Still a draft (R13):** no ratification-log row, no CLAUDE.md edit, no backlog edit. No source code. Gates not
  applicable, not run.

### Per finding

| # | Finding | Disposition | Where |
| --- | --- | --- | --- |
| 1 | **MAJOR:** R24's "only" contradicts the import and the wizard; the wizard has no write path of its own | **Ruled by statement 32 (R32)**, which narrows R29. Themabeheer creates subthema's, subdoelen and activiteiten only inside the wizard, for a thema it builds there from scratch, through separate wizard actions; changing existing subthema's stays with the hoofdleerkracht. R24 now says **"by hand"**, noting that statement 26 was about a leerkracht. The Art. VI.1 themabeheer bullet and leerkracht sentence (*"By hand, … only … The only exceptions are themabeheer's: the FR-1 import, and the wizard for a thema it builds from scratch"*) and A.11 say the same. Two new defaults: **I22** (wizard-only write actions for themabeheer and directie; **themabeheer gets no right on the ordinary subthema, subdoel and activiteit routes**) and **I23** (a new thema is one the wizard itself created, until that wizard run is finished or closed). Both are in all three lists. The wizard row is split, with footnote ⁵ on it and on the "–" of the ordinary subthema, subdoel and activiteit rows. Routed to E6-02 and E6-05 below. | ADR-0030 R24, R29, R32, §2 I22/I23, §3, §4 (b), Consequences; Art. VI.1; FA A.11 |
| 2 | **MINOR:** maker right limited to the LK leeftijd column | **Ruled by statement 33 (R33):** the right follows the person. "maker²" is now in the TB, LK leeftijd and Ander cells (HL keeps ✓). Footnote ²: any gebruiker who created it, while no goal is linked, with or without a klas at that leeftijd, and after the schooljaar. R20 states that it does not scope the maker right. I18 keeps only the wizard-maker assignment as a default. CLAUDE.md edit (d) and backlog edit 4 (directie as a possible maker) are revised below. | ADR-0030 R20, R25, R33, §2 I18, §3; Art. VI.1; FA A.11 |
| 3 | **MINOR:** backlog edits miss README :39/:42, E6 :24-25 and E6-04 :71 | **Fixed**, against the files on `feature/e6-rollen-rechten` (`016474e`), as asked; each edit below names the lines it replaces. | worklog |
| 4 | **MINOR:** checklist misses the compliance-trace phrase | **Fixed:** ADR-0030:862 is added, together with the backlog lines. | worklog |
| 5 | **MINOR:** ADR index row 0030 contradicts itself on subdoelen | **Fixed:** *"the shared activiteiten (their content; not subdoelen)"*. The same row now narrows the wizard and says the maker right follows the person. | `docs/adr/README.md:43` |
| 6 | **MINOR:** Art. IV.8 and FA A.7 not carried for R29 | **Fixed.** Pointers at Art. IV.8 (*"the wizard's user is now a themabeheer holder, or directie"*) and at FA A.7. A.7 joins A.11's list and the FA version row; IV.8 and A.7 join the ratification row. | CONSTITUTION IV.8; FA A.7, A.11, §1 |
| 7 | **QUESTION:** did the owner respond to the statement-27 correction? | **Yes, statement 34 (R34):** the answer stands. Recorded in §1.3 (statement 27's entry and the sixth set), R27, §4 (b) and (h), Alternatives, and the FA "Waarom" paragraph. | ADR-0030; FA A.11 |

### Statements 32–34 as R-items

*R30 and R31 are not used: from statement 32 on, an R-number equals its statement number.*

| Statement | R-item | What it rules |
| --- | --- | --- |
| 32 | **R32** | Themabeheer creates subthema's and subdoelen only in the wizard, for a thema it builds there from scratch. Existing subthema's stay with the hoofdleerkracht, and the app gets separate wizard actions (ruled; their shape is I22, and "new" is I23). Narrows R29. |
| 33 | **R33** | The maker's delete right follows the person: while no goal is linked, without a klas at that leeftijd, and after the schooljaar. R20 does not scope it. Rules the delete half of I18. |
| 34 | **R34** | After the correction, the owner confirmed R27: through the import, themabeheer writes the goal links on themadoelen and subdoelen that are in the file. |

### The unratified set (identical in Art. VI.1, FA A.11 and the proposed row)

Seventeen entries: **I1**; **I2** (the reading of statement 8 only); **I6 with (a)**; **I9 with (d)**; **I12**; **I13**;
**I15**; **I16**; **I17**; **I18** (the wizard-maker assignment only); **I19**; **I20**; **I21**; **I22**; **I23**;
**(c)**; **(e)**.

### Ratification checklist (current; supersedes fix round 2's)

1. Add the ratification-log row below as the **last** row of Art. XI, with the real date. The row before it will be
   main's 2026-09-13 Art. VII.2 row (PR #53).
2. Apply the CLAUDE.md edits in the same commit (Art. XI.1). Those are fix round 2's "After the merge with main",
   with (c) and (d) replaced as below.
3. Apply the backlog edits below.
4. Change these phrases, which become false on that day. File and line are as of the fix-round-3 commit:
   - `docs/adr/0030-rollen-en-rechten-in-de-app.md:3`, Status: add "Part 1 of the amendment ratified on <date>".
   - `docs/adr/0030-…:539`, §3 intro: *"drafted 2026-09-13. Under R13 the owner approves that draft before anything is
     enforced from it."* Change to "ratified on <date>".
   - `docs/adr/0030-…:717`, §5 "Who": *"Drafted 2026-09-13 … Under R13 the owner approves the draft before it is
     logged in Art. XI"*. Change to "ratified on <date>".
   - `docs/adr/0030-…:756`: *"Once part 1 lands, that role is the directie right"*. Change to "Since part 1 (<date>)".
   - `docs/adr/0030-…:862`, compliance trace: *"Art. VI.1 (roles, configurable; amendment part 1 owed)"*. Change to
     "amendment part 1 ratified on <date>".
   - `docs/adr/README.md:43`: *"drafted 2026-09-13 for the owner's approval"*. Change to "ratified on <date>".
   - `docs/adr/README.md:79`: *"part 1 drafted 2026-09-13 for the owner's approval"*. Change to "part 1 ratified on
     <date>".
   - `docs/adr/0022-curriculum-administration-authorisation-seam.md:4`: *"once the Art. VI.1 amendment on those
     rulings lands"*. Change to "since the Art. VI.1 amendment of <date>".
   - `docs/adr/0026-streefwoordenschat-op-subthema.md:12`: *"Neither version was ratified."* Change to "The second
     was ratified with Art. VI.1 on <date>."
   - **Backlog, on `feature/e6-rollen-rechten`** (all covered by the edits below):
     - `backlog/README.md:39` (*"binding once part 1 of the amendment is ratified"*);
     - `backlog/README.md:42` (*"part 1 … is drafted on `story/E6-02-amendering`; no code is written until the owner
       ratifies it"*, *"statements 14–31"*, *"A two-part Art. XI amendment is owed"*);
     - `backlog/E6-beheer-rollen-samenwerking.md:24-25` (*"Its matrix only binds once part 1 of the amendment
       lands"*);
     - `:43` (E6-02 status line, *"goes to the owner for ratification"*) and `:46` (*"Waits on part 1 …"*);
     - `:71` (E6-04, *"Waits on part 1 of the Art. XI amendment"*).
   - **Not** changed on the day, because they stay true: every "(owner) rulings of 2026-09-13" / "beslissingen van
     13-09-2026" marker, the FA version row 0.7, and ADR-0008's status.

### Proposed ratification-log entry (current; supersedes every earlier version)

```markdown
| <ratification date> | Siebe De Saedeleir (projecteigenaar) | Amended **Art. VI.1** to name the rights the owner ruled on 2026-09-11 and 2026-09-13 ([ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) §1, statements 1–34). **Directie** sees and edits everything and maintains gebruikers, klassen, schooljaren and rights (FA FR-12.2, the beheerder now being the directie right; there is no separate ICT-coördinator role). **Themabeheer** edits thema's, runs the FR-1 import including the goal links it writes on themadoelen and subdoelen, works the thema-opbouw wizard, and is with directie the only right that generates, reviews and adjusts doelsuggesties. For a thema it builds in the wizard from scratch, and only through the wizard's own write actions, themabeheer also creates that thema's subthema's, subdoelen and activiteiten. The **hoofdleerkracht**, a gebruiker appointed per `(schooljaar, jaarfase)`, several allowed, creates, edits and deletes that jaarfase's subthema's and subdoelen, links goals to its shared activiteiten by hand, and deletes any of them; thema's only with themabeheer. The **leerkracht**, through a many-to-many klastoewijzing, edits the klas's planning, and at that klas's leeftijd edits and creates shared activiteiten and edits streefwoordenschat. The app records who made an activiteit, and that maker may delete it while no goal is linked to it, with or without a klas at that leeftijd; the activiteit stays shared. It also states which schooljaar counts for the shared content (one that has not ended), rules graadklassen provisionally (the klas's one jaarfase, pending directie's Art. XIV decision, with the klas→leeftijden mapping in one place), and says what a gebruiker with none of the four rights may do. "Configurable" now says what it always meant: who holds a right is data, and what a right allows is one matrix, ADR-0030 §3, which supersedes FA §3.2's table. *Amended in step (Art. XI.1):* the `Thema`, `doelsuggesties[]` and `Activiteit` lines of **Art. IX.2**, a clarifying note on **Art. IV.1** and a pointer on **Art. IV.8** (the wizard's user), six **Art. XII** entries, the **Art. XIV** "Teacher visibility" bullet (narrowed, not removed) and graadklas bullet (partly answered for rights), FA Bijlage **A.11** with pointers at §3.1, §3.2, §4, FR-1.1, FR-3.1, FR-4.3, FR-7.2, FR-10.2, FR-12.2, §7, §11, A.5 and A.7, the status of ADR-0008, ADR-0010, ADR-0022 and ADR-0026, and CLAUDE.md. *Why:* Art. VI.1 named three roles that no longer described the school. A subthema has had no owning klas since ADR-0025, so the "owning teacher" of ADR-0011 §3 pointed at nobody, and FA §3.2's table gave every leerkracht rights the owner has since withdrawn. *The reversals and the premises, stated:* on 2026-09-11 the owner ruled that every leerkracht generates and reviews doelsuggesties (R8), and on 2026-09-13, shown that one acceptance moves the dekking of every klas that plans the thema, gave it to directie and themabeheer (R14). Shown that a goal link on shared content moves the dekking of every parallel klas, he gave those links to directie and the hoofdleerkrachten (R19). Told that a subdoel is, in the model, only a link to a goal, he kept subdoelen with them too (R24). The question on the import overstated what it writes; after the correction the owner confirmed his answer (R27, R34). He then limited the wizard's subthema's and subdoelen to a thema built from scratch (R32). *Scope of the ratification:* this entry ratifies the rulings (R-items) only. **A row of the ADR-0030 §3 matrix is ratified only as far as the rulings it cites, counted at column level**; whatever a row takes from an I-item or a lettered §4 question is a default and is not ratified here. The defaults Art. VI.1 lists (I1, I2, I6 with (a), I9 with (d), I12, I13, I15–I23, (c) and (e)) are **not** ratified, and nor is the shape of personal content (part 2, owed with E6-10). *Directie's confirmation is outstanding:* visibility is directie's to decide (question 4 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)), the graadklas rule waits on their Art. XIV decision, and on the rest of the role model no question has been put to them yet. *Shown to the owner as a draft first*, at his request (ADR-0030 R13). |
```

### Revised CLAUDE.md edits (c) and (d) (replace fix round 2's; (a), (b), (e), (f) unchanged)

**(c) Data model** (CLAUDE.md on main, line 129 and after line 134). The Thema line is unchanged from fix round 2. The
added bullet becomes:

``- **Gebruiker and rights** — only a gebruiker directie added logs in, and the app (not Entra) records its rights. **Directie** sees and edits everything and maintains gebruikers, klassen, schooljaren and rights; it may give the directie right to someone else, e.g. an ICT-coördinator. **Themabeheer** edits thema's, runs the FR-1 import (goal links included) and the thema-opbouw wizard, and generates and reviews doelsuggesties; through the wizard's own actions it creates subthema's, subdoelen and activiteiten only for a thema it builds from scratch. A **hoofdleerkracht**, a gebruiker appointed per (schooljaar, jaarfase), several allowed, creates, edits and deletes that jaarfase's subthema's and subdoelen, links goals to its shared activiteiten by hand, and deletes any of them. A **klastoewijzing** per klas, many-to-many, gives that klas's planning plus, at its leeftijd, the content and creation of shared activiteiten and the streefwoordenschat. An activiteit records its **maker**, who may delete it while no goal is linked to it, with or without a klas at that leeftijd; it stays shared. Appointments and klastoewijzingen count for shared content until their schooljaar ends; a graadklas provisionally grants its one jaarfase. What each right allows is one matrix, [ADR-0030 §3](docs/adr/0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows), ratified only as far as the rulings each row cites; see [`CONSTITUTION.md` Art. VI.1](CONSTITUTION.md#article-vi--roles-privacy--security) for the defaults.``

**(d) Domain glossary** (add after line 172):

```markdown
- **Hoofdleerkracht** — a gebruiker appointed per (schooljaar, jaarfase), several allowed, who creates, edits and deletes that jaarfase's subthema's and subdoelen and links goals to its shared activiteiten.
- **Themabeheer** — the right directie gives (FA FR-12.2) to edit thema's, run the FR-1 import and the thema-opbouw wizard, and generate and review doelsuggesties. The wizard creates subthema's and subdoelen only for a thema it builds from scratch.
- **Directierecht** — see and edit everything and maintain gebruikers and rights; directie may give it to someone else. There is no separate ICT role.
- **Klastoewijzing** — the many-to-many link between a gebruiker and a klas they teach.
- **Maker (of an activiteit)** — whoever created it: a leerkracht, a hoofdleerkracht, a themabeheer holder through the wizard, or directie. They may delete it while no goal is linked to it, with or without a klas at that leeftijd and after the schooljaar. The activiteit stays shared.
```

### Consolidated backlog edits (supersede every earlier set)

*Written against `feature/e6-rollen-rechten` at `016474e`, the orchestrator's branch. Line numbers refer to
`git show feature/e6-rollen-rechten:<file>`. Apply on the day of ratification.*

1. **`backlog/README.md:33-40`**, the E6 row's opening and its bullet list. Replace with:
   > 🚧 **Started 2026-09-11.** The owner's role model ([ADR-0030 §1](../docs/adr/0030-rollen-en-rechten-in-de-app.md),
   > superseding ADR-0011 §3) is **ratified into Art. VI.1 since <date>**. In short:
   > - rights live in the app, and only invited people log in;
   > - directie sees and edits everything;
   > - thema's, the import, the wizard and doelsuggesties are for directie and themabeheer;
   > - a jaar's subthema's and subdoelen are for its hoofdleerkrachten;
   > - a leerkracht edits their own klassen and, at their leeftijd, the shared activiteiten, and can view other klassen.

   This drops `:39`, the struck doelsuggestie bullet. It is now in the list in its ratified form.
2. **`backlog/README.md:42`.**
   - Replace *"Their first task, part 1 of the Art. XI amendment, is drafted on `story/E6-02-amendering`; no code is
     written until the owner ratifies it. The owner answered eighteen further questions that day (statements 14–31 in
     the draft of ADR-0030), which turn several of §2's defaults into rulings."* with *"Part 1 of the Art. XI
     amendment was ratified on <date> (ADR-0030 statements 14–34), so the code can start."*
   - Replace *"A **two-part** Art. XI amendment is owed (ADR-0030 §5): roles, ownership and visibility before E6-02,
     personal content with E6-10."* with *"Part 2 of the amendment (personal content) is owed with E6-10."*
   - Keep the E6-01 `[x]` sentence and the E6-10 sentence as they are.
3. **`backlog/E6-beheer-rollen-samenwerking.md:12-25`**, the ruling block. Replace with:
   > **The owner's rulings of 2026-09-11 and 2026-09-13 reshape this section**
   > ([ADR-0030 §1](../docs/adr/0030-rollen-en-rechten-in-de-app.md), ratified into Art. VI.1 on <date>; it supersedes
   > ADR-0011 §3):
   > - R1–R3: rights in the app; only invited people log in; directie sees and edits everything.
   > - R4, R18: themabeheer edits thema's, and a hoofdleerkracht only with themabeheer.
   > - R5, R21, R24: hoofdleerkrachten per (schooljaar, jaarfase) create, edit and delete that jaar's subthema's and
   >   subdoelen.
   > - R6: personal content (E6-10).
   > - R7, R15: a leerkracht edits their own klassen' planning (many-to-many) and views others.
   > - ~~R8~~ → R14: doelsuggesties for directie and themabeheer only.
   > - R9, R27, R34: the FR-1 import for directie and themabeheer, links on themadoelen and subdoelen included.
   > - R16: no ICT role.
   > - R17, R19, R23–R26, R33: every leerkracht of that leeftijd edits and creates shared activiteiten; goal links by
   >   hand for directie and HL; a maker deletes their own activiteit while no goal is linked to it; otherwise HL
   >   deletes.
   > - R20: appointments count for shared content until their schooljaar ends.
   > - R22: graadklas, provisionally.
   > - R28: streefwoordenschat is shared.
   > - R29, R32: the wizard is for themabeheer; it creates subthema's and subdoelen only for a thema built from
   >   scratch, through its own actions.
   >
   > **Everything else in that ADR is a default, not a ruling:** I1, I2, I6 with (a), I9 with (d), I12, I13, I15–I23,
   > (c), (e). The matrix is ratified only as far as the rulings each row cites.
4. **E6-02, `:43-52`** (status line, body, done-when, "Waits on part 1", "Treat nothing", open questions). Replace with:
   - *Status:* `[~]` since 2026-09-13 on `feature/e6-rollen-rechten`, **built and delivered together with E6-04**
     (R12). Part 1 of the Art. XI amendment was ratified on <date>.
   - *What:* enforce the ADR-0030 §3 matrix server-side, as named policies declared in one place. The "HL", "LK
     leeftijd", "LK eigen" and maker relations are resource-based handlers. Bind `Curriculumbeheer` to the directie
     right.
   - *Model:*
     - a nullable maker on `Activiteit` (R26). It is set on create by whoever creates the activiteit: a leerkracht, a
       hoofdleerkracht, **directie**, or a themabeheer holder through the wizard (I18). It is null for existing rows
       and for the FR-1 import. Its delete right follows the person (R33).
     - one place maps a klas to the leeftijden it grants rights for (R22). It reads the stated `Jaarfase` only and
       fails closed (I12), and does not reuse `Klasleeftijden`' widening.
     - appointments and klastoewijzingen count for shared content until their schooljaar ends (R20), and for the
       klas's planning without an end date (I21).
     - **wizard-only write actions** (R32; shape I22) admit themabeheer and directie, and only for a thema the wizard
       itself created, until that run is finished or closed (I23). Themabeheer gets no right on the ordinary
       subthema, subdoel and activiteit routes.
   - *Done when:* each action in the matrix is allowed or denied per relation and per resource, server-side, with a
     test per row. **No control that does nothing (the E3-06 rule).**
     - The doelsuggestie controls on the themadetail screen (`frontend/src/features/themas/ThemadetailScherm.tsx`,
       `useGenereerDoelsuggesties` and the accept/reject/adjust controls) are shown only to directie and themabeheer.
     - So are, each per its row: the thema form, the FR-1 import section (and the E1-22 carry-forward's
       `Laadlink`s), the wizard, the subthema form, the subdoel controls, the goal-link controls, the activiteit
       delete (maker or HL), the move, and the streefwoordenschat editor.
     - `GET /api/ik` carries the caller's rights; the server still enforces.
   - *Routes to cover:* `api/themas/{themaId}/doelsuggesties` with `…/genereer`, `…/{id}/status` and
     `…/{id}/leerplandoel`; `api/thema-opbouw/*` and the new wizard write actions; the activiteit and subdoel routes,
     including `POST/DELETE /api/activiteiten/{id}/doelkoppelingen` and the move; `PUT /api/subthemas/{id}` (a
     re-scope follows I13); the five jaarplan write routes; and `POST /api/schooljaren`.
   - *Open questions it owns:* (b)'s gate, (c), (e). (f) and (h) are settled (R14, R19).
   - *Defaults it builds on:* I1, I2, I9, I12, I13, I15–I23.

   Keep the E1-22 carry-forward at `:53` and the carry-forwards at `:54-57`, but correct `:55`. It names
   `/api/doelsuggesties/*`, which does not exist; the live routes are the ones above.
5. **E6-04.**
   - `:68`: replace the sentence after the status with *"The owner's rulings of 2026-09-13 are ratified: several
     leerkrachten per klas and several klassen per leerkracht (R15); no separate ICT role, and directie may give the
     directie right (R16)."*
   - **Delete `:71`** (*"Waits on part 1 of the Art. XI amendment"*).
   - Replace `:72` (*"Not ruled, confirm with the owner …"*) with *"A hoofdleerkracht needs no klastoewijzing (I20).
     Show whether an appointment or klastoewijzing currently counts for shared content (R20), and name klassen
     without a stated jaarfase, which grant no leeftijd right (I12). The last directie cannot be removed or demoted;
     removing a gebruiker leaves their activiteiten purely shared (I17)."*
6. **E6-05, `:75-77`.** Add *"The wizard is for themabeheer and directie (ADR-0030 R29). It creates subthema's,
   subdoelen and activiteiten only for a thema it builds from scratch, through **its own write actions** (R32);
   their shape and when a thema stops being new are defaults I22 and I23, and E6-02 builds the authorisation for
   them. The maker of an activiteit it creates is the themabeheer holder (I18)."*
7. **E6-10, `:101-104`.** Add *"The activiteit maker (R26, R33) is not personal content: the activiteit stays shared.
   The shared layer exists and is edited by every leerkracht of that leeftijd (R17, R23); whether it remains next to
   personal content is I6. Open question (a) is unchanged."*
8. **E10-01** (`backlog/E10-eigenaarsvergadering.md`). Add *"Streefwoordenschat is shared content (ADR-0030 R28):
   directie, that jaar's hoofdleerkrachten and every leerkracht with a klas of that leeftijd edit it, so the
   done-when stands. See ADR-0026's status pointer."*
9. **E1-19** (`backlog/E1-curriculum-content.md`). Add *"Once E6-02 lands, re-scoping a subthema to another leeftijd
   needs the hoofdleerkracht right at both leeftijden, or directie (default ADR-0030 I13). This story still owns
   whether the re-scope exists at all."*
10. **E7-06** (`backlog/E7-niet-functioneel.md`). Add *"The processing register also covers the activiteit maker
    (ADR-0030 R26): it links school content to a named staff member, and the right follows the person (R33).
    Retention when the gebruiker leaves: the activiteit becomes purely shared (I17)."*
11. **E2-08** (optional). Add *"Since the owner's rulings of 2026-09-13 its trigger and review controls are for
    directie and themabeheer only (R14); E6-02 gates them."*

### Remaining open questions for the owner

*Answered this round:* the reach of themabeheer's wizard right (statement 32), the maker without a klas
(statement 33), and the import after the correction (statement 34).

1. **I22:** the wizard writes through actions of its own, and themabeheer gets no right on the ordinary subthema,
   subdoel and activiteit routes. Agree?
2. **I23:** a thema counts as "new" from the moment the wizard creates it until that wizard run is finished or
   closed. After that, its subthema's belong to the hoofdleerkracht. Agree?
3. **I18:** is the themabeheer holder the maker of an activiteit the wizard creates? (Their delete right is ruled.)
4. **I15:** are the activiteit fields you did not name (type, onderzoeksvraag, kleur, lengte) content too?
5. **I16:** do the other subthema fields (naam, duur, probleemstelling, onderzoeksvragen) stay with directie and the
   hoofdleerkracht?
6. **I17:** when a maker is removed as a gebruiker, do their activiteiten become purely shared?
7. **I19:** may a leerkracht move an activiteit without links to another thema, and only a hoofdleerkracht or
   directie one with links?
8. **I20:** may a hoofdleerkracht be appointed who teaches no klas of that jaar?
9. **I21:** does a leerkracht keep editing the planning of a past schooljaar's klas?
10. **I12:** does a klas without a stated jaarfase grant no leeftijd right?
11. **I13:** does moving a subthema to another leeftijd need the hoofdleerkracht right at both leeftijden?
12. **Directie:** add two questions to `docs/besluiten-gevraagd.md`: the role model as a whole, and graadklassen.
13. **One matrix:** is the pointer from FA §3.2 to ADR-0030 §3 enough for directie's review?

## Ratification (2026-09-14)

- **The owner ratified part 1** in session, on the orchestrator's Dutch summary, with the five round-4 corrections
  (statement 36). He declined the offered option to read the full draft first. He then stopped the audit rounds:
  *"stop adien met audit rondes en rond het ticket af"*. **No antagonist audit ran on this commit, by the owner's
  decision.** Four rounds ran on the draft before it.
- **Merged first, both without conflicts:**
  - `origin/main` at `9f7f30d` (PR #54, the ticket backlog), as `3c3a9a3`;
  - `feature/e6-rollen-rechten` at `016474e`, as `85b53ec`.

  The edits below were written against the merged text.
- **Applied in the ratification commit:**
  - **The ratification-log row**, as the last row of Art. XI, dated 2026-09-14. It states the rulings, how they were
    ratified (the Dutch summary; the full read declined), the four audit rounds, that this commit was not audited,
    the excluded unratified set, and directie's three outstanding points.
  - **ADR-0030.** Status: Accepted, with part 1 ratified. R35–R37 in §1.2 and the seventh set in §1.3. The round-4
    corrections. The S35 matrix row. Every "drafted … for the owner's approval" phrase from the checklist, now in its
    ratified form.
  - **The five round-4 MINORs:**
    - (e) and I22 now say "apart from the maker's delete right (R33)", in the constitution, FA A.11 and ADR-0030;
    - (c) says "by hand";
    - I18 is limited to "the maker assignment only; its delete right is R33";
    - CLAUDE.md (d) marks the wizard maker as "(by default, ADR-0030 I18)";
    - the FR-7.2 pointer limits the wizard to a thema built from scratch;
    - the index traceability row is extended with IX.2 `Activiteit`, IV.8, A.7, E6-05, E10-01 and E1-19.
  - **Statement 35 (R35).** The import's `MenselijkeBeslissingenVerwijderen` option is directie-only. It is in
    Art. VI.1, the matrix, ADR §4 (b), FA A.11, and E6-02. The ruling covers the option as a whole, for themadoelen
    as well as subdoelen.
  - **Statement 37 (R37).** The build follows the defaults, and they stay unratified. Stated in the log row, ADR §2
    and the E6 backlog.
  - **Round-4 QUESTION 1.** E6-05 now owes two defaults before it builds the wizard write actions: an expiry for an
    abandoned run, and whether in-run edits are allowed.
  - **CLAUDE.md edits (a)–(f),** at the lines of the merged file.
  - **The backlog:**
    - the README E6 row;
    - in the E6 file: the ruling block, E6-02 (rewritten; gate struck), E6-04 (gate struck), E6-05, E6-10, and the
      route names at line 55;
    - notes on E10-01, E1-19, E7-06 and E2-08.
  - **Two questions for directie** in `docs/besluiten-gevraagd.md`: 13 (the role model as a whole) and 14
    (graadklassen).
  - The status pointers in ADR-0022 and ADR-0026, and both ADR-0030 rows in the index.
- **Checkboxes:** none changed. E6-02 and E6-04 stay `[~]`. `Totaal` is 65 of 119, recounted with `grep -c` from the
  epic checkboxes.

Unchanged defaults the owner may also confirm: I1, I2 (a reading only), I6, I9, (c), (e).

## Code slice 1 — rights model, rights service, named policies, /api/ik

- **FR / Article:** FR-10, FR-12.2; Art. VI.1 (ratified 2026-09-14), Art. IX.2 (`Activiteit` maker), Art. XII,
  Art. XIV (graadklas seam); ADR-0030 §2 (I12, I17, I20, I21), §3, §4 (c), (e); ADR-0011 §2; ADR-0022; ADR-0031
  decision 7.
- **Branch:** `story/E6-02-fundament`, from `feature/e6-rollen-rechten` at `60020b9`. Not pushed, no PR.
- **Scope held to slice 1.** No route other than the Op.stap import routes is gated yet (slice 3), no beheer API or
  screen (slice 2), no wizard write actions (slice 3/E6-05), no frontend gating and no `nl.json` change (slice 4).

### Files changed

| File | Why |
| --- | --- |
| `Domain/Toegang/Gebruiker.cs` | `HeeftThemabeheer`; `GeefThemabeheer`/`NeemThemabeheerAf`; `GeefDirectierecht`; `NeemDirectierechtAf(int aantalAndereDirectieleden)` and `BevestigVerwijderbaar(int)`, which throw for the last directie. |
| `Domain/Toegang/Klastoewijzing.cs` (new) | Gebruiker ↔ klas link row (R15). |
| `Domain/Toegang/Hoofdleerkrachtaanstelling.cs` (new) | (gebruiker, schooljaar, jaarfase); jaarfase validated with `Jaarfasen.WatIsErMisMet` (R5, I20). |
| `Domain/Toegang/Leeftijdsrechten.cs` (new) | **The one klas → leeftijden mapping for rights** (R22): the stated jaarfase or nothing (I12). Documented as the opposite-direction sibling of `Klasleeftijden`, not a reuse. |
| `Domain/Schoolcontent/Activiteit.cs`, `Subthema.cs` | `MakerId` (R26), set only at creation through `VoegActiviteitToe(…, makerId)`. The import passes none. |
| `Application/Toegang/Rechten.cs` (new) | The result type: raw relations per §3 column. |
| `Application/Toegang/Rechtenberekening.cs` (new) | Pure computation from facts + `vandaag` (R20, I21, union). |
| `Application/Toegang/Rechtenmatrix.cs` (new) | §3 as data: `Beleid` name constants, one `Matrixrij` per row, `Kolom` flags, and `StaatToe`, the only evaluator. |
| `Application/Toegang/Rechtenbronnen.cs` (new) | `IRechtenService`, `IRechtenbronnen`, resource records `Leeftijdsinhoud`, `Klasplanning`, `Activiteitbron`. |
| `Application/Schoolcontent/Beheer/ISchoolcontentBeheerService.cs`, `SchoolcontentBeheerDtos.cs` | `MaakActiviteitAsync(subthemaId, makerId, creatie)` (maker required, so no hand-create path forgets it); `ActiviteitWeergave.MakerId`. |
| `Infrastructure/Toegang/RechtenService.cs` (new) | Three reads, then `Rechtenberekening`; per-request memo. |
| `Infrastructure/Toegang/EfRechtenbronnen.cs` (new) | Projections that build the resources from a route id. |
| `Infrastructure/Schoolklok.cs` (new) | Today/now on the Brussels wall clock (worklog note from the amendment: not UTC). |
| `Infrastructure/Dekking/ClosedXmlDekkingExport.cs` | Uses `Schoolklok.Zone` instead of its private copy of the same zone lookup, so the school's zone is resolved in one place. Behaviour unchanged. |
| `Infrastructure/Persistence/Configurations/{Klastoewijzing,Hoofdleerkrachtaanstelling}Configuration.cs` (new), `GebruikerConfiguration.cs`, `ActiviteitConfiguration.cs`, `AppDbContext.cs` | Tables, FKs, unique indexes (below). |
| `Infrastructure/Persistence/Migrations/20260914093928_RechtenModel*` + snapshot | The one migration. |
| `Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs` | Stores the maker; a maker id with no gebruiker row is stored as null. |
| `Infrastructure/DependencyInjection.cs` | Registers `IRechtenService`, `IRechtenbronnen`. |
| `Api/Infrastructure/Autorisatie/Rechtenbeleid.cs` (new) | `AddRechtenbeleid()` registers one policy per row (each `RequireAuthenticatedUser()` + `MatrixVereiste`); `MatrixHandler`; `MagAsync` extension. |
| `Api/Infrastructure/CurriculumbeheerAutorisatie.cs` | Keeps the constant (now `= Rechtenmatrix.Beleid.Curriculumbeheer`); its registration moved into the matrix, so it is now directie-only. |
| `Api/Program.cs` | `AddRechtenbeleid()` replaces `AddCurriculumbeheerAutorisatie()`. |
| `Api/Controllers/AanmeldController.cs` | `GET /api/ik` returns `IkWeergave` with the rights. |
| `Api/Controllers/SubthemasController.cs` | Passes the signed-in gebruiker as maker on `POST api/subthemas/{id}/activiteiten`. |
| `frontend/src/lib/aanmelding.ts` + two test fixtures | `Ik` type extended (types only). |
| Tests (below), `TestAuthenticatie.cs`, `CurriculumbeheerAutorisatieTests.cs`, three unit-test files (new `MaakActiviteitAsync` argument) | |

### The public contract slices 2–4 build on

**Rights service** (`Jaarplanner.Application.Toegang`):

```csharp
public interface IRechtenService
{
    Task<Rechten> HaalRechtenOpAsync(Guid gebruikerId, CancellationToken cancellationToken = default);
}

public sealed class Rechten
{
    Guid GebruikerId; bool IsDirectie; bool HeeftThemabeheer;
    IReadOnlyList<string> HoofdleerkrachtLeeftijden;   // HL: appointed, schooljaar not ended (today <= Eind, Brussels)
    IReadOnlyList<string> LeerkrachtLeeftijden;        // LK leeftijd: stated jaarfase of own klassen, schooljaar not ended
    IReadOnlyList<Guid>   EigenKlasIds;                // LK eigen: every klastoewijzing, no end date
    bool IsHoofdleerkrachtVan(string leeftijd); bool IsLeerkrachtVanLeeftijd(string leeftijd); bool IsLeerkrachtVanKlas(Guid klasId);
    static Rechten Geen(Guid gebruikerId);
}
```

Relations are raw and not directie-aware; `Rechtenmatrix.StaatToe` adds directie (R3) and the union rule. Leeftijd
lists hold only the nine codes, in `Jaarfasen.Alle` order.

**Resources and resolver:** `Leeftijdsinhoud(string Leeftijd)`, `Klasplanning(Guid KlasId)`,
`Activiteitbron(Guid ActiviteitId, string Leeftijd, Guid? MakerId, bool HeeftDoelkoppelingen)`;
`IRechtenbronnen.VoorSubthemaAsync(subthemaId)` → `Leeftijdsinhoud?`, `VoorActiviteitAsync(activiteitId)` →
`Activiteitbron?` (null = not found).

**Policies** (`Rechtenmatrix.Beleid.*`, each also requires an authenticated user; directie passes all):

| Policy | §3 row | Columns besides directie | Resource |
| --- | --- | --- | --- |
| `Curriculumbeheer` | Op.stap inladen (R3) | none | none (**enforced now**) |
| `Beheer` | gebruikers/klassen/schooljaren/rechten (R2, R3, R16) | none | none |
| `ThemaBewerken` | thema, themadoelen, kernwoordenschat (R4, R18) | TB | none |
| `SchoolcontentImporteren` | FR-1 import (R9, R27, R34) | TB | none |
| `MenselijkeBeslissingenVerwijderen` | the import option (R35) | none | none (check imperatively when the option is set) |
| `ThemaOpbouw` | wizard: thema, themadoelen, AI (R29) | TB | none |
| `DoelsuggestiesMaken` / `DoelsuggestiesBeoordelen` | R14 | TB | none |
| `SubthemaBeheren` | subthema's (R5, R21; I13: ask at both leeftijden on a re-scope) | HL | `Leeftijdsinhoud` |
| `StreefwoordenschatAanpassen` | R28 | HL, LK leeftijd | `Leeftijdsinhoud` |
| `GedeeldeActiviteitBewerken` | create + content (R17, R23) | HL, LK leeftijd | `Leeftijdsinhoud` (create) / `Activiteitbron` (edit) |
| `ActiviteitVerwijderen` | **both** delete rows (R25, R26, R33) | HL; maker while no goal linked | `Activiteitbron` |
| `SubdoelenBeheren` | R24 | HL | `Leeftijdsinhoud` |
| `DoelenKoppelen` | goal links on shared activiteiten (R19) | HL | `Activiteitbron` / `Leeftijdsinhoud` |
| `ActiviteitVerplaatsen` | move (R19, R23; I19) | HL; LK leeftijd only without links | `Activiteitbron` |
| `KlasplanningBewerken` | jaarplan, agenda, hoeken, fiches (R7, R15; I21) | LK eigen | `Klasplanning` |

**How a controller applies them.** A resource-free row is `[Authorize(Policy = Rechtenmatrix.Beleid.ThemaBewerken)]`.
For a resource row:

```csharp
var bron = await _bronnen.VoorActiviteitAsync(activiteitId, ct);            // IRechtenbronnen
if (bron is null) return NotFound();                                          // or the service's own 404
if (!await _autorisatie.MagAsync(User, bron, Rechtenmatrix.Beleid.ActiviteitVerwijderen)) return Forbid();
```

A resource row in an attribute fails closed: the resource is then the `HttpContext`, and only directie passes.

**`GET /api/ik`:**
`{ "id", "naam", "email", "isDirectie", "heeftThemabeheer", "hoofdleerkrachtLeeftijden": ["K3"], "leerkrachtLeeftijden": ["K3"], "eigenKlasIds": ["<guid>"] }`.
Pinned by name in `RechtenEndpointsTests`.

**New tables:**

- `klastoewijzingen` (Id, GebruikerId → gebruikers CASCADE, KlasId → klassen CASCADE; unique (GebruikerId, KlasId)).
- `hoofdleerkrachtaanstellingen` (Id, GebruikerId → gebruikers CASCADE, SchooljaarId → schooljaren CASCADE,
  Jaarfase varchar(8); unique (GebruikerId, SchooljaarId, Jaarfase); index (SchooljaarId, Jaarfase)).
- `gebruikers.HeeftThemabeheer` (bool, default false).
- `activiteiten.MakerId` (uuid null → gebruikers SET NULL).

**Last-directie guard (for slice 2).** `NeemDirectierechtAf(n)` and `BevestigVerwijderbaar(n)` take the number of
*other* directieleden and throw at 0. The count must be read in the same transaction as the write (serializable, or
lock the directie rows), or two directieleden demoting each other at once both succeed.

### Key decisions

- **The matrix is data in Application, the policies are generated from it.** One `Matrixrij` per §3 row, one
  requirement type, one handler, one evaluator. Changing a row is changing one line, and `RechtenmatrixTests` fails
  if a row is added without an expectation.
- **Rows 13 and 14 of §3 are one policy (`ActiviteitVerwijderen`).** They are one action on one route; the resource's
  maker and link flag tell them apart. The matrix still reads as §3 columns: HL, or the maker while no goal is linked.
- **"Has goal links" counts every link, whatever its status** (`Activiteitbron.HeeftDoelkoppelingen`). That is the
  fail-closed reading of R25. It means a `geweigerd` link also blocks the maker's delete. See open question 1.
- **A maker id with no gebruiker row is stored as null**, not refused: the same state I17 leaves, and the safe
  direction. It also keeps the default test identity, which has no row, working.
- **"Today" is the Brussels date** (`Schoolklok`). A Postgres test pins the case where a UTC date would still count:
  30 June 22:30 UTC.
- **Rights are memoised per request** in `RechtenService` (scoped). Slice 2 should not read rights through the same
  instance after writing them in one request.
- **The test identity is directie.** `TestAuthenticatie` wraps `IRechtenService` so `StandaardGebruikerId` (no row) is
  directie. Every other id goes to the real service. Existing tests keep testing what they tested, and rights tests use
  seeded gebruikers.
- **Development sign-in unchanged.** The rights come from the database for whoever signs in there. The first directie
  from configuration is directie.

### Tests added

- `UnitTests/Toegang/RechtenberekeningTests` (19): HL in a running year, in a year not yet started, lapsed, and on
  `Eind` vs. `Eind + 1`; HL without a klastoewijzing; LK leeftijd, including the same four time cases; a lapsed klas
  still counts as LK eigen (I21); a klas without, or with an unknown, stated jaarfase grants nothing (six cases); a
  graadklas grants only its stated jaarfase; the union rule; ordering; `Rechten.Geen`; the mapping trims and never
  widens (contrasted with `Jaarfasen.VoorKlas(0, null)`).
- `UnitTests/Toegang/RechtenmatrixTests`: every non-activiteit row × 8 relations (112 cases, including HL and LK at
  another leeftijd, and LK eigen vs. another klas); every row has an expectation; policy names map one-to-one to rows;
  directie passes every row with any resource or none; a missing or foreign resource fails closed; the union rule;
  delete (maker with/without links, HL, no maker); move (LK without links, HL with links, maker gets nothing).
- `UnitTests/Toegang/GebruikerTests` (+7), `KlastoewijzingEnAanstellingTests` (5 facts + theory),
  `Schoolcontent/ActiviteitMakerTests` (3), and an import assertion that an FR-1 activiteit has no maker.
- `IntegrationTests/Autorisatie/RechtenbeleidTests` (8): every row is a registered policy that also denies anonymous
  callers; Curriculumbeheer is the Op.stap row; the handler: no gebruiker claim → no, directie via attribute → yes for
  every row, leeftijd passthrough, a resource row in an attribute → no for HL, maker, klasplanning; `MagAsync`
  through the real `IAuthorizationService`.
- `IntegrationTests/Postgres/RechtenEndpointsTests` (14): `/api/ik` rights and exact JSON names; directie's `/api/ik`;
  **Curriculumbeheer: TB + HL + klastoewijzing in one gebruiker → 403** on `POST /api/opstap-import` and
  `GET /api/opstap-import/stand`; a directie row → 400 (reaches the controller); anonymous → 401; maker set on a hand
  create, null with no gebruiker row; removing a gebruiker sets `MakerId` to null and cascades their toewijzingen and
  aanstellingen; removing a klas cascades its toewijzingen; both unique indexes (and two HL per jaarfase allowed); the
  Brussels midnight boundary; a legacy klas with no jaarfase in the database; an unknown gebruiker; `EfRechtenbronnen`.
  Every Postgres test migrates a fresh database, so the migration applies.
- `CurriculumbeheerAutorisatieTests`: the "reaches the controller" test is renamed to what it now pins (directie).

### Gates

- `cd backend && dotnet build`: ✓, 0 warnings.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` pointed at the local `jaarplanner-db` (port 5433):
  - UnitTests: 1301 passed, 4 skipped (the opt-in live KOV contract tests).
  - IntegrationTests: 381 passed, 1 skipped (the opt-in live Op.stap import).
- `dotnet format`: applied (it swapped one `Assert.Equal` argument order); `--verify-no-changes`: clean.
- `dotnet dotnet-ef migrations has-pending-model-changes`: "No changes have been made to the model since the last
  migration."
- `cd frontend && pnpm lint`: ✓. `pnpm test`: 33 files, 233 tests passed. `pnpm build`: ✓ (the >500 kB chunk warning
  predates this change).

### Self-check against slice 1

- Model and one migration: ✓, as above.
- Rights service with HL / LK leeftijd / LK eigen, R20 via `TimeProvider` in the school's zone, one klas → leeftijden
  mapping that fails closed, union: ✓, unit and Postgres tests.
- Named policies in one place, each requiring authentication; resource handlers for HL, LK leeftijd, LK eigen and
  maker; directie passes all; (c) and (e) fall out (a jaarfase with no HL leaves only directie; a gebruiker with no
  relation matches no column): ✓.
- `Curriculumbeheer` bound to directie and enforced: ✓, 403/400/401 pinned.
- `/api/ik` carries the rights, `Ik` type updated: ✓.
- Development sign-in and tenant-free integration tests: ✓, both suites green.

### For the test-runner

Backend only; no UI change to look at. Run `dotnet test` with `JAARPLANNER_TEST_POSTGRES` set. By hand, in
Development:

1. Sign in through `/api/aanmelden/ontwikkeling` as a non-directie gebruiker. The row has to be inserted in the database
   (slice 2 builds the beheer UI).
2. `GET /api/ik` shows the rights.
3. `POST /api/opstap-import` answers 403. Signed in as directie, the same request reaches the controller.

### Open questions / Art. XIV touched

1. **R25, "while no goal is linked":** does a `geweigerd` (or `voorgesteld`) link count as linked? The build counts
   every link, the fail-closed reading. Activiteit links today are `manueel`, so in practice it does not bite yet.
2. **§3 rows not expressed in slice 1.**
   - Row 7, the wizard's own write actions for a thema it builds from scratch: it needs a "new thema" / open-run state
     (I22, I23, and the I24/I25 defaults the chat says were ratified on `feature/e6-rollen-rechten` after `60020b9`),
     which the model does not have. Slice 3 / E6-05 adds a resource type and a column for it.
   - Personal content (R6): E6-10.
   - Bekijken/exporteren (I9): every signed-in gebruiker today, which the fallback policy gives; narrowing it is the
     E6-09 seam.
3. **Docs the orchestrator owns** (not edited here):
   - ADR-0022 decision 1 still says the policy is registered by `AddCurriculumbeheerAutorisatie()` in its own file;
     it is now a matrix row registered by `AddRechtenbeleid()`. A status pointer would do.
   - E7-11's authorisation half is now partly met (the Op.stap routes only).
   - ADR-0030 §3 could note that the two delete rows are one policy.
4. **`ActiviteitWeergave.makerId` is in the JSON now**, but the frontend `ActiviteitWeergave` type was not extended.
   Slice 4 adds it when it gates the delete.

### Fix round 1

- **Input:**
  - the test-runner, PASS: `backlog/worklogs/E6-02/test-report.md`, recorded by the orchestrator and committed here
    unedited;
  - the antagonist, 0 CRITICAL, 0 MAJOR, 5 MINOR, 1 QUESTION: "Code slice 1 — audit round 1" in
    `backlog/worklogs/E6-02/antagonist.md`, also committed unedited.
- **Branch:** `story/E6-02-fundament`, on top of `d6460ef`.

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | MINOR: E7-11 says every signed-in person can still run the curriculum import | **Fixed in place.** In `backlog/E7-niet-functioneel.md` the false clause is struck, not deleted, with a dated annotation (2026-09-14, E6-02 slice 1, `d6460ef`): the Op.stap routes are directie-only and pinned 403/400/401, and every other matrix row reaches its routes in slice 3. The entry stays `[!]`. |
| 2 | MINOR: ADR-0022 describes `AddCurriculumbeheerAutorisatie()` and a policy body that no longer exist | **Fixed by a status pointer.** `docs/adr/0022-…` now says: `Curriculumbeheer` is the ADR-0030 §3 Op.stap row, directie only, declared as `Rechtenmatrix.Curriculumbeheer` and registered by `Rechtenbeleid.AddRechtenbeleid()`. The method and body described in decision 1 are gone, the constant's name and value are unchanged, and decision 1's rule stands. Decision 1's text is left as written. |
| 3 | MINOR: the E7-06 processing register misses the new staff data | **Fixed.** New E6-02 slice 1 carry-forward on E7-06 for `gebruikers.HeeftThemabeheer`, `klastoewijzingen` and `hoofdleerkrachtaanstellingen`. Retention as coded: removed with the gebruiker (all three), with the klas (toewijzing) or with the schooljaar (aanstelling); nothing ends them earlier. A past year's appointment stops granting rights (R20) but stays stored. |
| 4 | MINOR: `Schoolklok` claimed its callers "say so" on the UTC fallback, but `RechtenService` did not | **Fixed where the fallback happens.** `Schoolklok.Nu` and `Vandaag` now take the caller's `ILogger` (required) and log one warning per process when the zone is missing. `RechtenService` injects `ILogger<RechtenService>`. The export takes an optional `ILogger<ClosedXmlDekkingExport>` (DI supplies it) and now converts through `Schoolklok.Nu`, not its own copy. The class comment states what happens: UTC plus one warning, the export also labels "(UTC)", and the rights path does **not** fail closed. The fallback is testable through an internal overload that takes the zone and the once-only state. |
| 5 | MINOR: nothing turns a body leeftijd into a `Leeftijdsinhoud` (slice 3's subthema create and I13 re-scope) | **Fixed.** `Leeftijdsinhoud.UitInvoer(string?)` trims and validates with `Jaarfasen.WatIsErMisMet`. It returns the canonical code, or `null` for what the write would refuse; the caller answers null with the service's 400 and never skips the check on it. The record's doc says which way in is for which source. Slice 3 must use it for every body leeftijd, including both ends of an I13 re-scope (the old end comes from `IRechtenbronnen`). |
| 6 | Test-runner gap: no automated test that removing a schooljaar removes its aanstellingen | **Fixed.** `Een_schooljaar_verwijderen_ruimt_zijn_hoofdleerkrachtaanstellingen_op` in `RechtenEndpointsTests`, next to the klas test. It uses a tracked removal so the owned closures go as in a real delete, and checks that another year's aanstelling and the gebruiker survive. |
| Q | R25: do `geweigerd` and `voorgesteld` links block the maker's delete? | **Unchanged, as instructed.** The strict reading stays. The orchestrator carries it forward in the E6 epic file and puts it to the owner. |

**Tests added this round:**
- `UnitTests/Toegang/LeeftijdsinhoudTests` (11 cases): four padded and canonical inputs are accepted and trimmed,
  agreeing with `WatIsErMisMet`; seven are refused (null, blank, `L7`, `3K`, `k3`, `F1`), also agreeing; and a K3
  hoofdleerkracht passes `SubthemaBeheren` on a `" K3"` body.
- `UnitTests/Toegang/SchoolklokTests` (2): with the zone, 30 June 22:30 UTC is 1 July and nothing is logged; without the
  zone, UTC with exactly one warning over two calls.
- The Postgres schooljaar-cascade test above.

**Gates:**
- `dotnet build`: ✓, 0 warnings.
- `dotnet format`, then `--verify-no-changes`: clean.
- `has-pending-model-changes`: none.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (local `jaarplanner-db`):
  - UnitTests: 1315 passed, 4 skipped (live KOV opt-in).
  - IntegrationTests: 382 passed, 1 skipped (live Op.stap opt-in).
- No frontend file changed, so the pnpm gates did not apply.

### Fix round 2

- **Input:**
  - "Code slice 1 — audit round 2" in `antagonist.md`: 0 CRITICAL, 0 MAJOR, 5 MINOR, all about the wording of round-1
    fixes;
  - "Round 2" of `test-report.md`: PASS.

  Both are the orchestrator's and are committed unedited.
- **Branch:** `story/E6-02-fundament`, on top of `138a605`.
- **Split of work (orchestrator's instruction):** `backlog/E7-niet-functioneel.md` and `docs/adr/README.md` are
  claimed by another session (kindrapport, TB-005) and were **not** edited. The E7-06 half of MINOR 2, the E7-11
  wording half of MINOR 4, and all of MINOR 3 (the ADR index) are the orchestrator's.

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | `UitInvoer`'s doc named `Jaarfasen.WatIsErMisMet`, while the subthema write validates with `VereisLeeftijd`; the tests checked `UitInvoer` only against itself | **One rule now.** New `Jaarfasen.LeesLeeftijd(string?)` (trim, then exactly one of the nine codes, or null). Three callers share it: `VereisLeeftijd` (subthema create and re-scope), `Leeftijdsinhoud.UitInvoer`, and the accept branch of `WatIsErMisMet`. The accept set was already identical, so no Dutch sentence and no HTTP status changed. Both docs now name the real rule. **New `UnitTests/Schoolcontent/SubthemaLeeftijdInvoerTests`:** it runs 12 inputs through the real `MaakSubthemaAsync` and `WijzigSubthemaAsync` and asserts each is accepted iff `UitInvoer` is non-null, in the same stored form; a third test pins the write's refusal sentence. `LeeftijdsinhoudTests` now asserts fixed expected values instead of comparing with the function it is built from. |
| 2 | The schooljaar cascade test said "the way a real delete would take them", but no route deletes a schooljaar | **Code half fixed.** The comment now says no route deletes a schooljaar yet, and that a tracked removal is how a future delete (E6-03) will take the owned closures. The E7-06 half is the orchestrator's. |
| 3 | The ADR index still presents the ADR-0022 seam as a no-op | **Not mine:** `docs/adr/README.md` is claimed; the orchestrator does it. |
| 4 | E7-11 says `RechtenEndpointsTests` covers every Op.stap route | **Code half fixed.** New reflection test `Elke_controller_onder_de_opstap_importroute_noemt_het_curriculumbeheerbeleid` in `CurriculumbeheerAutorisatieTests`. It finds every controller whose `[Route]` is under `api/opstap-import`, requires exactly the four (named), and requires each to carry `[Authorize(Policy = Curriculumbeheer)]`, with no `[AllowAnonymous]` on the class or any action. With the existing endpoint-metadata test, which already enumerates the seven endpoints, all seven are now pinned from both sides. The E7-11 wording is the orchestrator's. |
| 5 | The R25 carry-forward sits under a story that will close, and nothing points to it from where the question becomes live | **Fixed.** `backlog/E8-fast-follow.md`, E8-07, now has a pointer: the owner's answer on R25 link status is owed before it lands, because it creates the first non-`Manueel` activiteit links. The `Activiteitbron.HeeftDoelkoppelingen` doc now points at the R25 carry-forward under E6-02 in `backlog/E6-beheer-rollen-samenwerking.md`, not the worklog. *That carry-forward is `ef6468b` on `feature/e6-rollen-rechten`; it reaches this branch at the merge.* |
| nit | `LeeftijdsinhoudTests` has 12 cases, not 11 | **Noted here:** fix round 1's "(11 cases)" should read 12 (four accepted, seven refused, one rights check). The round-1 text is kept as the audited record. |

**Gates:**
- `dotnet build`: ✓, 0 warnings.
- `dotnet format`, then `--verify-no-changes`: clean.
- `has-pending-model-changes`: none.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (local `jaarplanner-db`):
  - UnitTests: 1340 passed, 4 skipped (live KOV opt-in).
  - IntegrationTests: 383 passed, 1 skipped (live Op.stap opt-in).
- No frontend file changed.

### Fix round 3

- **Input:** "Code slice 1 — audit round 3" in `antagonist.md`: 0 CRITICAL, 0 MAJOR, 4 MINOR, all wording, plus nits.
  The test-runner passed round 3; the orchestrator committed both in `5245dbe`.
- **Branch:** `story/E6-02-fundament`, on top of `5245dbe`.
- **Scope, per the orchestrator:** slice 1 is already merged into `feature/e6-rollen-rechten` (`0073bd7`), and slices
  2 and 3 run from there. So this round changes doc comments, test comments and docs only, kept local to the blocks
  named. **No executable line changed:** a diff filter over every changed `.cs` line found none that is not a comment
  or blank. The FR-1 import is deliberately **not** routed through `LeesLeeftijd`; B took the "narrow the headline"
  option instead.

| # | Finding | Resolution |
| --- | --- | --- |
| A | `UitInvoer` offered "let the write refuse it" without saying why that is safe, and the test named the wrong consequence of a drift | The `<returns>` of `Leeftijdsinhoud.UitInvoer` now says deferring to the write is safe **only because the write refuses exactly these inputs**: it uses the same function (`Jaarfasen.LeesLeeftijd`), pinned by `SubthemaLeeftijdInvoerTests`. Otherwise a null could send an input the write accepts past the rights check. The test summary now states the stakes: if the rights check refused what the write accepts, a caller deferring to the write would let the write through with no rights check at all; the other drift refuses a hoofdleerkracht on their own leeftijd. It also calls itself a tripwire, not a proof over every input. |
| B | `LeesLeeftijd` called itself "the one rule" for a leeftijd from outside the database | The headline is narrowed to "the rule for a leeftijd in a request body, and for `WatIsErMisMet`". The doc lists `WatIsErMisMet`'s callers, including the hoofdleerkracht appointment (`Hoofdleerkrachtaanstelling`). It names the FR-1 import's own inline copy (`IsBekend` on the trimmed value, in `SchoolcontentImportService`'s subthema leeftijd check and in `LeeftijdVoor`): same set today, not reached by a change here, and no rights check depends on it (R27). |
| C | The ADR index said the ADR-0022 seam was a no-op until 2026-09-14, and still listed it as depending on an open Art. XIV decision | Both places in `docs/adr/README.md` now give the two steps: a no-op until E6-01 made it require a session (ADR-0031, 2026-09-11), then bound to the directie row by E6-02 slice 1 (2026-09-14). The open-decisions paragraph says the question was settled by the Art. VI.1 ratification of 2026-09-14, and keeps ADR-0022 as the example of what a seam does not buy you. |
| D | E8-07 said a `geweigerd`/`voorgesteld` link blocks the maker's delete "today", though no route applies that row yet | `backlog/E8-fast-follow.md` now describes the declared rule: `ActiviteitVerwijderen`, as declared in slice 1, counts every link (`EfRechtenbronnen`), whatever its status. So once slice 3 applies it to `DELETE api/activiteiten/{id}`, such a link withholds the maker's delete. |
| nit | `VereisLeeftijd` had two stacked `<summary>` blocks and a stale, unattached "Verifies the klas exists" one | Merged into one summary (the rule, then the "what replaced the foreign key" paragraph, with "is new" dropped). The stale klas summary is removed: no method verifies a klas there, and a subthema has had no klas scope since ADR-0025. |
| nit | `WatIsErMisMet`'s doc block sat above `LeerjaarVoor`, separated by a blank line | Moved onto `WatIsErMisMet`, text unchanged, with a one-line note saying it was reattached. |
| nit | E7-11 claimed 403/400/401 on both Op.stap routes | `backlog/E7-niet-functioneel.md` now says exactly what is pinned: 403 on both `POST /api/opstap-import` and `GET /api/opstap-import/stand`, and 400 and 401 on the `POST` only. |
| nit | "will" for E6-03's future delete | Changed to "may" in the schooljaar cascade test comment. |

**Gates:**
- `dotnet build`: ✓, 0 warnings.
- `dotnet format --verify-no-changes`: clean.
- UnitTests, full suite: 1340 passed, 4 skipped (live KOV opt-in).
- IntegrationTests, filtered to the two touched suites (`RechtenEndpointsTests`, `CurriculumbeheerAutorisatieTests`)
  against the local `jaarplanner-db`: 21 passed.
- No migration or frontend file changed.
## Code slice 3 — enforcement on every route, wizard write actions

- **FR / Article:** FR-3.1, FR-4.3, FR-7.2, FR-10, FR-12.1/12.2; Art. VI.1 (ratified 2026-09-14) with defaults I9, I13,
  I15–I25; Art. IX.2 (`Activiteit` maker; a move keeps its links and stays at its leeftijd); Art. IV.1, IV.8;
  ADR-0030 §2, §3 (footnotes ¹–⁵), §4 (b), (c), (e); ADR-0011 §2.
- **Branch:** `story/E6-02-afdwingen`, from `feature/e6-rollen-rechten` at `0073bd7`. Not pushed, no PR.
- **Scope held:** no file under `frontend/`, no `nl.json`, no gebruikers/klastoewijzing/aanstelling endpoints (slice 2),
  nothing personal (R6, E6-10). One EF migration, `20260914114237_Wizardrun`.

### How a route names its row

- **Resource-free row** (directie, themabeheer): `[Authorize(Policy = Rechtenmatrix.Beleid.X)]`, as slice 1 set out.
- **Resource row**: `[RechtOp(Rechtenmatrix.Beleid.X, Rechtbron.Y, "routeId")]`
  (`Api/Infrastructure/Autorisatie/RechtOpAttribute.cs`). It is slice 1's `IRechtenbronnen` + `MagAsync` + `Forbid()`,
  run as an MVC authorisation filter instead of inside the action.
  - **Why, a deliberate deviation from the brief's wording:** MVC binds and validates a body before an action runs.
    A check inside the action therefore answers a caller without the right with a 400 for a malformed body, and the
    validation result is what they learn. As a filter it runs before binding, like the `[Authorize]` rows. It also
    puts each route's row on the route, where the sweep and a reader can see it.
- **A resource taken from the body** is checked inside the action, after binding. There are three:
  - the body leeftijd of a subthema create;
  - the new leeftijd of a re-scope;
  - the goal codes of an activiteit create.
- **A body leeftijd** goes through `Leeftijdsinhoud.UitInvoer`. A `null` is refused before the check, with the write's
  own 400 and sentence: `SchoolcontentValidatieFout.OngeldigeLeeftijd`, the one sentence that `VereisLeeftijd` now
  throws too. It never reaches the write unchecked, and it never skips the check (slice-1 audit round 3, finding A;
  round 4 note). The wizard's two leeftijd inputs do the same before the run is read.

### 404 vs 403 (documented choice)

- **Resource row: 404 before 403.** Resource lookup first, then authorisation (slice 1's pattern). The answer depends
  on the resource, so it cannot be given for one that does not exist. `RechtOp` throws the service's own
  `SchoolcontentNietGevondenFout` with the service's own sentence, so the shape and wording match.
- **Resource-free row: 403 before any lookup,** because its answer does not depend on the resource. A non-TB caller
  deleting a thema id that does not exist gets 403.
- **Body-derived resource:** the body's 400 comes first when the resource cannot be built, then 403. A missing parent
  (the thema of a subthema create) is the service's 404 after that, because that row's answer does not depend on it.
- **Wizard:** 403 for a caller outside the row, then a body leeftijd's 400, then:
  - 404 for a run that does not exist;
  - 403 for a run that has ended;
  - 404 for an item that does not exist;
  - 403 for an item the run did not create.
- Anonymous callers still get 401 from the fallback policy before any of this (`ElkeRouteVraagtEenSessieTests`
  unchanged and green).

### Route → row table (every endpoint in the endpoint data source)

**Writes.** "Attr" = `[Authorize(Policy)]`; "RechtOp(kind)" = resource filter on that kind; "in action" = checked after
binding.

| Route | §3 row (policy) | How |
| --- | --- | --- |
| `POST api/schooljaren` | Beheer (R2, R3, R16) | Attr |
| `POST api/schooljaren/{schooljaarId}/klassen` | Beheer | Attr |
| `PUT api/klassen/{klasId}` (the klaskiezer's jaarfase travels here) | Beheer | Attr |
| `DELETE api/klassen/{klasId}` | Beheer | Attr |
| `POST api/opstap-import`, `…/voorbeeld`, `…/minimumdoelen(/voorbeeld)`, `…/leerplandoelen(/voorbeeld)`; `GET api/opstap-import/stand` | Curriculumbeheer (R3; ADR-0022) | Attr, slice 1, unchanged |
| `POST api/themas`; `PUT`, `DELETE api/themas/{themaId}` | ThemaBewerken (R4, R18) | Attr (delete: see "not clean" 1) |
| `POST api/themas/{themaId}/themadoelen`; `DELETE …/themadoelen/{themadoelId}` | ThemaBewerken | Attr |
| `POST api/schoolcontent-import/voorbeeld`, `POST api/schoolcontent-import` | SchoolcontentImporteren (R9, R27, R34), plus MenselijkeBeslissingenVerwijderen (R35) when the form option is true | Attr + in action, before the file is read |
| `POST api/themas/{themaId}/doelsuggesties/genereer` | DoelsuggestiesMaken (R14) | Attr |
| `PUT api/themas/{themaId}/doelsuggesties/{id}/status`, `…/{id}/leerplandoel` | DoelsuggestiesBeoordelen (R14) | Attr |
| `POST api/thema-opbouw/themadoel-suggesties`, `…/subdoel-suggesties` | ThemaOpbouw (R29) | Attr |
| `POST api/thema-opbouw/wizardruns`; `POST …/{runId}/afronden`, `…/{runId}/sluiten` | ThemaOpbouw (R29) | Attr + run state (service) |
| `POST …/wizardruns/{runId}/subthemas`; `PUT`, `DELETE …/{runId}/subthemas/{subthemaId}`; `POST …/subthemas/{subthemaId}/subdoelen`; `DELETE …/subdoelen/{subdoelId}`; `POST …/subthemas/{subthemaId}/activiteiten`; `PUT`, `DELETE …/{runId}/activiteiten/{activiteitId}` | **Wizardinhoud** (new row: R29, R32; I18, I22–I25) | Attr + run state (service); activiteit create with goal codes also DoelenKoppelen, in action |
| `POST api/themas/{themaId}/subthemas` | SubthemaBeheren (R5, R21) at the body leeftijd | in action (UitInvoer, then MagAsync) |
| `PUT api/subthemas/{subthemaId}` | SubthemaBeheren at the stored and at the new leeftijd (I13); every field of the payload is this row (I16) | RechtOp(Subthema) + in action |
| `DELETE api/subthemas/{subthemaId}` | SubthemaBeheren | RechtOp(Subthema) |
| `POST api/subthemas/{subthemaId}/onderzoeksvragen`; `PUT`, `DELETE …/onderzoeksvragen/{ovId}` | SubthemaBeheren (I16) | RechtOp(Subthema) |
| `POST api/subthemas/{subthemaId}/doelkoppelingen` (creates a subdoel); `DELETE …/subdoelen/{subdoelId}` | SubdoelenBeheren (R24) | RechtOp(Subthema) |
| `POST api/subthemas/{subthemaId}/activiteiten` | GedeeldeActiviteitBewerken (R17, R23); plus DoelenKoppelen (R19) when the create carries goal codes | RechtOp(Subthema) + in action |
| `PUT api/activiteiten/{activiteitId}`; `PUT …/{activiteitId}/onderzoeksvraag` | GedeeldeActiviteitBewerken (I15) | RechtOp(Activiteit) |
| `DELETE api/activiteiten/{activiteitId}` | ActiviteitVerwijderen (R25, R26, R33) | RechtOp(Activiteit) |
| `PUT api/activiteiten/{activiteitId}/subthema` (move) | ActiviteitVerplaatsen (R19, R23; I19); same leeftijd kept by the domain | RechtOp(Activiteit) |
| `POST api/activiteiten/{activiteitId}/doelkoppelingen`; `DELETE …/doelkoppelingen/{koppelingId}` | DoelenKoppelen (R19) | RechtOp(Activiteit) |
| `POST api/klassen/{klasId}/jaarplan/generatie`, `…/periodes/{blokStart}/generatie`, `…/plaatsingen`; `PUT …/plaatsingen/{id}/status`, `…/vergrendeling`, `…/blok`; `DELETE …/plaatsingen/{id}` (the five E3-07 routes as one unit, plus period regeneration and hand placement). Generatieparameters are saved through `POST …/generatie`: there is no route of their own. | KlasplanningBewerken (R7, R15; I21) | RechtOp(Klas) |
| `POST api/klassen/{klasId}/jaarplan/weekplanning`; `PUT …/weekplanning/{plaatsingId}/dag`; `DELETE …/weekplanning/{plaatsingId}`; `POST api/klassen/{klasId}/jaarplan/subthemaperiodes` | KlasplanningBewerken | RechtOp(Klas) |
| `POST api/klassen/{klasId}/hoeken`, `…/hoeken/overnemen` | KlasplanningBewerken | RechtOp(Klas) (overnemen writes into the route's klas only) |
| `PUT`, `DELETE api/hoeken/{hoekId}` | KlasplanningBewerken | RechtOp(Hoek → its klas) |
| `POST api/klassen/{klasId}/hoekplaatsingen` | KlasplanningBewerken | RechtOp(Klas) |
| `DELETE api/hoekplaatsingen/{plaatsingId}`; `PUT …/momenten/{momentId}`, `…/uren`; `POST …/verrijkingen`; `PUT`, `DELETE …/verrijkingen/{verrijkingId}` | KlasplanningBewerken | RechtOp(Hoekplaatsing → its klas) |
| `POST api/klassen/{klasId}/algemene-fiches` | KlasplanningBewerken | RechtOp(Klas) |
| `PUT`, `DELETE api/algemene-fiches/{ficheId}`; `POST …/doelkoppelingen`; `DELETE …/doelkoppelingen/{koppelingId}` | KlasplanningBewerken (the fiche and its links are one klas's; see "not clean" 3) | RechtOp(AlgemeneFiche → its klas) |
| `POST api/klassen/{klasId}/algemene-ficheplaatsingen` | KlasplanningBewerken | RechtOp(Klas) |
| `DELETE api/algemene-ficheplaatsingen/{plaatsingId}`; `PUT …/momenten/{momentId}` | KlasplanningBewerken | RechtOp(AlgemeneFicheplaatsing → its klas) |
| `POST api/afmelden` | anonymous (ADR-0031) | pinned by the session sweep |

**Every child id under a klas route is scoped to that klas by its service**, so authorising on the route's klas is
sound. Checked in the code:

- `JaarplanGeneratieService` and `WeekplanningService` find a plaatsing only in `LaadJaarplanAsync(klasId)`.
- `HoekplaatsingService` and `AlgemeneFicheplaatsingService` refuse a hoek or fiche of another klas.

**Reads**, open to every signed-in gebruiker (I9 for plans, agenda, dekking and exports; school content, goals and
reference data stay readable):

- `GET api/ik`, `api/jaarfasen`;
- `api/klassen(/{id})`, `api/schooljaren(/{id}, /{id}/rooster)`;
- `api/themas(/{id}, /bibliotheek, /{id}/voor-klas/{klasId})`, `api/themas/{id}/doelsuggesties`,
  `api/subthemas/voor-klas/{klasId}`;
- `api/klassen/{id}/jaarplan(/parameters, /weekplanning)`, `…/dekking(/voortgang, /export)`, `…/hoeken`,
  `…/hoekplaatsingen`, `…/algemene-fiches`, `…/algemene-ficheplaatsingen`;
- `api/leerplandoelen(/facetten, /{code})`, `api/minimumdoelen(/facetten)`, the ongekoppelde-doelen list;
- `api/schoolcontent-import/sjabloon` (a blank template);
- `api/thema-opbouw/wizardruns/{runId}`.

**Rows without a route.** `StreefwoordenschatAanpassen` (R28) has none: the streefwoordenschat is not yet a field of a
subthema (E10-01 adds it). So no subthema update is "only the streefwoordenschat", and every `PUT api/subthemas/{id}`
is the subthema row (I16).

**Deliberately open writes: none.** §3 opens no write to every gebruiker. The one row that grants "Ander" a write is
personal content (R6, unbuilt). The sweep's `OpenVoorIedereen` list is therefore empty, with that reason.

### The wizard's write actions (R29, R32; I18, I22–I25) — contract

- **Entity** `Domain/Schoolcontent/Wizardrun.cs`, stored in the tables `wizardruns` and `wizardrunitems`. Fields:
  - `ThemaId`: unique, cascades with the thema;
  - `GestartDoorId`: null when there is no row; SetNull when the gebruiker is removed;
  - `GestartOp` and `LaatsteSchrijfactieOp`;
  - `AfgerondOp` and `GeslotenOp`;
  - `Aangemaakt`: an owned list of `(Soort: Subthema|Subdoel|Activiteit, ItemId)`, unique per run and id, with no FK
    to the items (one column names three tables; a stale id can never match again).
- **Open** = not finished, not closed, and `now < LaatsteSchrijfactieOp + 14 days`, read from `TimeProvider` on each
  request. No background job. The fourteen days are a span between instants, so the school's zone does not enter it.
  Every successful create, edit or delete moves `LaatsteSchrijfactieOp`.
- **Routes** (`Api/Controllers/WizardrunsController.cs`, base `api/thema-opbouw/wizardruns`):

  | Method + route | Body | Answer |
  | --- | --- | --- |
  | `POST /` | `ThemaCreatie` | 201 `WizardrunWeergave`; creates the thema and the run; starter = caller |
  | `GET /{runId}` | – | 200 `WizardrunWeergave` (read) |
  | `POST /{runId}/subthemas` | `SubthemaCreatie` (any leeftijd) | 201 `SubthemaWeergave` |
  | `PUT /{runId}/subthemas/{subthemaId}` | `SubthemaWijzigingInvoer` | 200; only an item this run created (I25), re-scope included |
  | `DELETE /{runId}/subthemas/{subthemaId}` | – | 204; refused (403) while the subthema holds a subdoel or activiteit the run did not create |
  | `POST /{runId}/subthemas/{subthemaId}/subdoelen` | `{ leerplandoelCode }` | 200 `SubdoelWeergave`; subthema must be under the run's thema |
  | `DELETE /{runId}/subthemas/{subthemaId}/subdoelen/{subdoelId}` | – | 204; own item only |
  | `POST /{runId}/subthemas/{subthemaId}/activiteiten` | `ActiviteitCreatie` | 201 `ActiviteitWeergave`, maker = caller (I18); with goal codes also DoelenKoppelen |
  | `PUT /{runId}/activiteiten/{activiteitId}` | `ActiviteitWijzigingInvoer` | 200; own item only |
  | `DELETE /{runId}/activiteiten/{activiteitId}` | – | 204; own item only |
  | `POST /{runId}/afronden`, `POST /{runId}/sluiten` | – | 200 `WizardrunWeergave` (`isOpen: false`) |

  `WizardrunWeergave` = `{ id, themaId, gestartDoorId, gestartOp, laatsteSchrijfactieOp, sluitUiterlijkOp, afgerondOp,
  geslotenOp, isOpen, aangemaakt: [{ soort, id }] }`.
- **Refusals** are a `WizardrunWeigering`, answered 403 by `WizardrunExceptionHandler` with the title "Geen toegang"
  and these Dutch details:
  - "Deze wizard is afgelopen." (finished, closed and fourteen silent days share it; the sentence says only what all
    three guarantee);
  - "Dit subthema hoort niet bij het thema van deze wizard.";
  - "Dit is niet in deze wizard aangemaakt.";
  - the subthema-with-foreign-content sentence.

  These refusals hold for directie too: the wizard action does not exist outside an open run, and directie does the
  same on the ordinary routes.
- **Writes go through `ISchoolcontentBeheerService`**, so every rule and sentence of a hand write applies. Each write
  and the run's bookkeeping share one transaction (`WizardrunService`).
- **Themabeheer on the ordinary subthema, subdoel and activiteit routes: 403** (I22), pinned. The maker's delete
  right (R33) is not wizard-specific: `ActiviteitVerwijderen` admits the maker, themabeheer or not.
- **No screen calls these yet.** E6-05 builds the wizard UI.
## Code slice 2 — E6-04 beheer

- **FR / Article:** FA FR-12.2, FR-10; Art. VI.1 (ratified 2026-09-14: directie maintains gebruikers and rights, may
  give the directie right to someone else), Art. VI.2 (staff data only), Art. II.3/II.5 (Dutch in `nl.json`, server
  Dutch only where directie acts on it, no em dash); ADR-0030 §2 I12, I17, I20, I21 and §3 row "Gebruikers, klassen en
  schooljaren beheren …" (directie only); ADR-0031 decision 3 (invite by UPN, the unbound state) and decision 7 (the
  last directie cannot be removed or demoted); ADR-0024 (Inkt en Signaal), ADR-0017 (WCAG 2.2 AA).
- **Branch:** `story/E6-04-beheer`, from `feature/e6-rollen-rechten` at `0073bd7`. Not pushed, no PR.
- **Scope held to slice 2.** No existing controller's authorisation changed (slice 3), no migration (none needed: the
  slice 1 tables carry everything), DI in one separate block.

### Files changed

| File | Why |
| --- | --- |
| `Domain/Schoolcontent/Wizardrun.cs` (new) | The run, its items, `Wizarditemsoort`. |
| `Application/Schoolcontent/Wizard/IWizardrunService.cs` (new) | Service contract, `WizardrunWeergave`, `WizardrunWeigering`. |
| `Application/Schoolcontent/Beheer/SchoolcontentBeheerExceptions.cs` | `SchoolcontentValidatieFout.OngeldigeLeeftijd`, the one leeftijd refusal sentence. |
| `Application/Toegang/Rechtenbronnen.cs` | `IRechtenbronnen` gains `VoorKlasAsync`, `VoorHoekAsync`, `VoorHoekplaatsingAsync`, `VoorAlgemeneFicheAsync`, `VoorAlgemeneFicheplaatsingAsync`. The `UitInvoer` doc block is untouched. |
| `Application/Toegang/Rechtenmatrix.cs` | Row `Wizardinhoud`; "not expressed" paragraph updated (row 7 is now split into rights row + run state). |
| `Infrastructure/Toegang/EfRechtenbronnen.cs` | The five klas resolvers (read-only projections). |
| `Infrastructure/SchoolcontentBeheer/WizardrunService.cs` (new) | The wizard's writes. |
| `Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs` | `VereisLeeftijd` body throws the shared sentence (doc blocks untouched). |
| `Infrastructure/Persistence/Configurations/WizardrunConfiguration.cs` (new), `AppDbContext.cs` | Mapping, `DbSet<Wizardrun>`. |
| `Infrastructure/Persistence/Migrations/20260914114237_Wizardrun*` + snapshot | The one migration. |
| `Infrastructure/DependencyInjection.cs` | `IWizardrunService`, in its own marked block beside the wizard's AI assist. |
| `Api/Infrastructure/Autorisatie/RechtOpAttribute.cs` (new) | The resource-row filter and `Rechtbron`. |
| `Api/Infrastructure/WizardrunExceptionHandler.cs` (new), `Api/Program.cs` | 403 mapping; stale "next slice" comment updated. |
| `Api/Controllers/*` | Themas, Subthemas, Activiteiten, Doelsuggesties, ThemaOpbouw, SchoolcontentImport, Schooljaren, Klassen, Jaarplan, Weekplanning, Hoeken, Hoekplaatsingen, AlgemeneFiches, AlgemeneFicheplaatsingen: each write names its row. `WizardrunsController` (new). The weekplanning "unauthenticated" paragraph is struck and replaced. |
| Tests | See below. |

### Tests added

- **`IntegrationTests/Postgres/ElkeWijzigendeRouteVraagtEenRechtTests`: the sweep.**
  - Enumerates every non-anonymous POST/PUT/PATCH/DELETE from the endpoint data source and fills every route id with a
    seeded resource: klas, schooljaar, thema, subthema, activiteit, hoek, hoekplaatsing, fiche, ficheplaatsing and
    wizard run.
  - Calls each as a seeded gebruiker with no right and expects 403.
  - `OpenVoorIedereen` is empty, with its reason. `Lichamen` holds the one body-derived route.
  - A stale entry in either list fails the test, and it requires at least 70 requests.
  - The failure message names the route, both declarations, the planning row for agenda-like routes, and what a 404
    means.
  - **Proved to fail:** with `[RechtOp]` removed from `DELETE …/weekplanning/{plaatsingId}` it failed and named that
    route. Restored after.
- **`IntegrationTests/Postgres/RechtenAfdwingingTests`** (17): per §3 row, the allowed relation through and the nearest
  denied one 403.
  - Beheer: every non-directie relation at once, including the klaskiezer's jaarfase PUT.
  - Thema: themabeheer vs hoofdleerkracht.
  - Import: themabeheer 400 (reached) vs hoofdleerkracht 403; R35 as themabeheer 403 on preview and on apply;
    directie reaches both.
  - Doelsuggesties and the wizard AI: hoofdleerkracht 403 on all five; themabeheer reaches the service (404).
  - Subthema create: HL K3 201, HL K2, LK K3 and themabeheer 403.
  - A leeftijd that is no leeftijd: the write's 400 and sentence, for HL and for a no-rights caller; a padded
    `" K3 "` accepted.
  - I13 re-scope: HL of K3 alone 403, of K2 alone 403, of both 200.
  - Onderzoeksvragen and subthema delete follow the subthema row.
  - Subdoelen: LK 403, HL 200/204.
  - Shared activiteit: LK K3 creates (maker set) and edits; LK K2 and themabeheer 403.
  - Goal codes on create: LK 403, HL 201.
  - Maker delete: a colleague of the same leeftijd 403; the maker 204 without a link and 403 with one; HL 204.
  - Goal links on an activiteit: LK 403, HL 200/204.
  - Move: LK without links 200, with links 403, HL 200.
  - Planning: the LK of K3 blauw edits K3 shared content 200 and plans in blauw (201, and a 404 from the service),
    but gets 403 on groen's hoeken, fiches, generation and plaatsing, and on groen's hoek by hoek id. HL of K3 plans
    in no klas (403).
  - 404 before 403 for resource rows; 403 first for the thema row.
  - Reads of another klas: 200.
- **`IntegrationTests/Postgres/WizardrunEndpointsTests`** (10):
  - the full build flow (create, edit, delete; maker = themabeheer; the item list);
  - themabeheer 403 on the ordinary routes but 201 in its open run;
  - hoofdleerkracht 403 on the wizard;
  - 13 days still open and the write moves the window; 14 days + 1 minute gives 403 "Deze wizard is afgelopen.",
    for directie too;
  - I25: another run's item 403, another thema's subthema 403, an HL's subthema under the run's thema 403, a missing
    item 404;
  - a subthema holding an LK's activiteit is not deleted (403, still in the database);
  - finish and close end it for directie too; afterwards themabeheer 403 and HL 200 on the ordinary route (I23);
  - a leeftijd that is no leeftijd gives the write's 400;
  - goal codes on a wizard activiteit: themabeheer 403, themabeheer + HL 201;
  - a missing run gives 404.
- **`UnitTests/Schoolcontent/WizardrunTests`** (7): open/closed boundary at exactly 14 days, the window moving,
  finish/close, no write after the end, items per kind, forgetting, guards.
- **`UnitTests/Toegang/RechtenmatrixTests`:** a `Wizardinhoud` expectation (Directie, TB) × 8 relations.
- **`IntegrationTests/Postgres/RechtenEndpointsTests`:** two slice-1 tests created content as a gebruiker with no right,
  which slice 3 now refuses. They seed a builder (themabeheer + HL of the leeftijd) through a new `BewaarBouwerAsync`.
  Their assertions and comments are unchanged.
- **Shared seeding:** `IntegrationTests/Postgres/RechtenTestOpzet.cs`.

### Gates

- `cd backend && dotnet build`: ✓, 0 warnings.
- `dotnet format --verify-no-changes`: ✓ (no output).
- `dotnet dotnet-ef migrations has-pending-model-changes` (with a build): "No changes have been made to the model since
  the last migration."
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` on the local `jaarplanner-db` (port 5433):
  - UnitTests: 1355 passed, 4 skipped (live KOV opt-in).
  - IntegrationTests: 411 passed, 1 skipped (live Op.stap opt-in).
  - The ~150 tests on the default directie identity pass unchanged.
- No frontend file changed.

### Self-check against slice 3

- Every endpoint enumerated from the endpoint data source and mapped (table above) ✓; enforced server-side ✓.
- Doelsuggesties R14, the thema-opbouw routes R29, and the import with R35 on preview and apply ✓.
- Subthema create via `UitInvoer`; re-scope at both leeftijden; I16 ✓.
- Subdoelen, activiteit content/create/delete/move, and goal links ✓.
- The five jaarplan writes as one unit, plus period regeneration, hand placement, weekplanning, hoeken, fiches and
  their placements ✓.
- Schooljaar and klas routes directie-only ✓.
- (c) and (e) fall out of the rules with no special case: a jaar with no HL leaves the HL rows to directie; a gebruiker
  with no relation matches no column.
- 404-vs-403 chosen and documented ✓.
- Wizard entity, one migration, endpoints, I22–I25 ✓. No screen calls them yet.
- Sweep ✓, per-row tests ✓, existing tests green ✓.

### For the test-runner

- Backend only. Run `dotnet test` with `JAARPLANNER_TEST_POSTGRES` set. The three new Postgres classes are the evidence.
- By hand, in Development:
  1. Insert gebruikers with rights (slice 2 builds the beheer screen).
  2. Sign in through `/api/aanmelden/ontwikkeling`.
  3. As a leerkracht of one klas, `POST /api/klassen/{otherKlas}/hoeken` gives 403 with "Geen toegang".
  4. As themabeheer, `POST /api/thema-opbouw/wizardruns` gives 201, then `POST /api/thema-opbouw/wizardruns/{id}/subthemas`
     gives 201, while `POST /api/themas/{themaId}/subthemas` gives 403.
- No Playwright pass is meaningful yet: slice 4 hides the controls. Until then a teacher's screen will show controls
  that now answer 403.

### Routes that did not map cleanly, and open questions

1. **`DELETE api/themas/{id}` → ThemaBewerken.**
   - §3 has no thema-delete row, and the delete takes its subthema's, subdoelen and activiteiten at every leeftijd
     along. By hand those are the hoofdleerkrachten's (R21).
   - I read "Thema … aanpassen" as covering the thema's lifecycle, as R21 does for subthema's. The service already
     refuses a thema that any klas has planned.
   - The owner may want directie only, or the HL right at every leeftijd it holds.
2. **An activiteit create that carries goal codes also needs DoelenKoppelen (R19)**, on the ordinary and the wizard
   route. The alternative, letting a leerkracht link goals by creating, would empty R19. The create form offers the
   goal picker today, so slice 4 must hide it for anyone who is not directie or HL.
3. **Algemene fiche goal links → KlasplanningBewerken.** §3's planning row names algemene fiches. A fiche is one klas's
   and its links count only for that klas's dekking, so R19 (goal links on *shared* activiteiten) does not reach them.
   A leerkracht therefore links goals to their own klas's fiche but not to a shared activiteit. Consistent, but worth
   the owner knowing.
4. **The wizard's run state binds directie too** (403 on an ended run or a foreign item). Directie does the same on the
   ordinary routes. Read as: the wizard action does not exist outside an open run.
5. **I25 "and nothing else" read strictly for a subthema delete.** It is refused while the subthema holds content the
   run did not create, which the delete would take along.
6. **I25 read literally for an activiteit** the run created that an HL later linked a goal to: the wizard may delete it,
   and the link goes with it. Owner to confirm, or the wizard delete could also require "no links".
7. **Thema, themadoel and kernwoordenschat edits during a run** go through the ordinary `ThemaBewerken` routes, which
   themabeheer holds. They do not count as the run's write actions and do not move its fourteen days. E6-05 may want
   wizard-flavoured routes for them (a default to choose with the wizard UI).
8. **Any themabeheer holder may continue a run, not only its starter.** I22–I25 do not limit it; the starter is
   recorded.
9. **A subdoel has no edit** in the model (it is a link), so I25's "edit" reaches subthema's and activiteiten only.
10. **Ordering nuance:** in the wizard a body leeftijd's 400 comes before the run's 404/403, because it is checked
    before the run is read. Harmless: the request is refused either way.
11. **`GET api/schoolcontent-import/sjabloon` stays open to every gebruiker** (a blank template, a read).
12. **Stale code comment, not edited:** `DekkingController`'s class doc still calls the read routes unauthenticated
    debt blocked on E6-01/E6-02. Reads are open by I9, so the sentence is now wrong in fact rather than in rule.
    Offered for the next touch of that file.

### Docs the orchestrator owns (not edited here)

- **ADR-0030 §3** could note two things:
  - row 7 is enforced as a rights row (`Wizardinhoud`) plus run state in `IWizardrunService`;
  - the activiteit create with goal codes needs R19's row too.
- **E6-02 backlog:** the E2, E3-01 and E3-07 carry-forwards are now met (every route; the five jaarplan writes as one
  unit, pinned by the sweep).
- **E7-11:** its authorisation half is now enforced on every write route, not only the Op.stap ones.

### What the frontend (slice 4) must now hide

The server enforces all of this; without slice 4 these controls answer 403.

- **Directie only:**
  - schooljaar create;
  - klas create, edit and delete, including the **klaskiezer's jaarfase field** (`PUT /api/klassen/{id}`);
  - the import's "menselijke beslissingen verwijderen" option;
  - the E1-22 Op.stap `Laadlink`s (Curriculumbeheer).
- **Directie + themabeheer:**
  - the thema form, themadoelen and kernwoordenschat;
  - the FR-1 import section;
  - doelsuggestie generate, accept, reject and adjust (`frontend/src/features/themas/ThemadetailScherm.tsx`);
  - the thema-opbouw AI assist and the wizard (E6-05).
- **Directie + HL of that leeftijd:**
  - the subthema form (create, edit, delete, onderzoeksvragen; a re-scope needs HL at both leeftijden);
  - subdoel controls;
  - goal-link controls on activiteiten, including the goal picker on the activiteit create form;
  - moving an activiteit that has links.
- **Directie + HL + leerkracht of that leeftijd:**
  - activiteit create (without goals) and content edit;
  - moving one without links.
- **Delete an activiteit:** HL, or its maker while no goal is linked. `ActiviteitWeergave.makerId` is in the JSON; the
  frontend type still lacks it.
- **Directie + leerkracht of that klas:** every planning control. That is:
  - generation and period regeneration, hand placement, status, lock, drag and delete of plaatsingen;
  - the weekplanning and subthemaperiodes;
  - hoeken and taking them over;
  - hoekplaatsingen and their moments, hours and verrijkingen;
  - algemene fiches with their goal links and plaatsingen.

  A hoofdleerkracht alone plans no klas.
- **A 403 from the server** now carries the ProblemDetails title "Geen toegang". For wizard refusals a Dutch detail
  comes with it.

### Fix round 1

- **Input:** "# E6-02 slice 3 — Test report (round 1)" in `test-report.md` (FAIL: D1 MAJOR, D2 MINOR) and "## Code
  slice 3 — audit round 1" in `antagonist.md` (VIOLATIONS FOUND: 2 MAJOR, 5 MINOR, 3 QUESTION). Both are the
  orchestrator's and are committed unedited.
- **Owner rulings of 2026-09-14 on the three questions**, which the orchestrator records as defaults I26–I28 on
  `feature/e6-rollen-rechten`. The constitution, the ADR and the E6 epic file were **not** edited here.
- **Branch:** `story/E6-02-afdwingen`, on top of `d85c0a5`. **No new migration:** no entity or mapping changed, and
  `has-pending-model-changes` is clean.

| # | Finding | Resolution |
| --- | --- | --- |
| A (MAJOR) | `DELETE api/themas/{id}` let themabeheer delete content made by hand | **I26.** New row `ThemaVerwijderen`, a resource row. Column `ThemabeheerZonderAndermansInhoud`; resource `Themabron(ThemaId, HeeftAndermansInhoud)` from `IRechtenbronnen.VoorThemaAsync`; `[RechtOp(…, Rechtbron.Thema, "themaId")]`. Directie always. Themabeheer only while every subthema, subdoel and activiteit under the thema was created by the thema's own run **and that run is open** (after the run its items are ordinary content, I23). The planned/scheduled refusal stays in the service, for everyone. "Its own open wizard run" is read as the run that built the thema (one per thema), not as a run of the caller; see open question 1. Tests: themabeheer on a thema holding an HL's subthema 403 (full detail), directie 204; themabeheer on an empty thema 204; themabeheer on a thema holding only its open run's subthema, subdoel and activiteit 204; the same after the run is finished: themabeheer 403, directie 204. The matrix unit test covers the column for all eight relations, and the resource-less case fails closed. |
| B (MAJOR) | The wizard's edit and delete reached content its run did not create | **I27, three paths, in `WizardrunService`:** (1) a leeftijd change of a run-created subthema is refused while it holds a subdoel or activiteit the run did not create; the same edit at the same leeftijd is still allowed. (2) A wizard delete of an activiteit a goal is linked to needs `DoelenKoppelen` at its leeftijd. (3) A wizard delete of a subthema whose activiteiten carry any link needs the same. The rights question is asked inside the transaction, through `IRechtenService` and `Rechtenmatrix.StaatToe` (the one evaluator), with the caller's id passed by the controller. It is not a controller-side `MagAsync` like `MaakActiviteit`'s, because it depends on state the delete itself reads. Tests, allowed and refused on each path: re-scope 403 / same-leeftijd edit 200; linked activiteit themabeheer 403, themabeheer+HL 204; subthema with a linked activiteit themabeheer 403, themabeheer+HL 204. The build-flow test keeps the allowed re-scope with only the run's own items. |
| C (MINOR) | A moved activiteit stayed editable and deletable through the wizard | The wizard's activiteit edit and delete check that its **current** subthema is under the run's thema. The refusal is "Deze activiteit staat niet meer onder het thema van deze wizard." Test: directie moves it to another thema; the wizard's PUT and DELETE get 403 with that sentence. |
| D1 / D (MAJOR / MINOR) | The sweep accepted any 403 | (1) `Aanmelding.SchrijfGeenToegangAsync` now writes the authorisation 403 (title "Geen toegang", detail "Je hebt geen toegang tot deze actie."), and the test scheme's `HandleForbiddenAsync` calls the same writer. The sweep asserts that detail, so a 403 from a run's state or from the anti-forgery check no longer counts. (2) The sweep seeds a subthema, subdoel and activiteit **through the seeded run** and sends the wizard item routes those ids. **Proved:** with `Wizardinhoud` removed from each wizard DELETE route in turn (`…/subthemas/{subthemaId}`, `…/subdoelen/{subdoelId}`, `…/activiteiten/{activiteitId}`), the sweep failed and named that route each time ("answered 204"). The file was restored from a copy, diffed identical, and rebuilt. |
| D2 (MINOR) | A null leeftijd got ASP.NET Core's English 400 | `SubthemaCreatie.Leeftijd` and `SubthemaWijzigingInvoer.Leeftijd` are `string?`; the wizard uses the same DTOs. The service passes `?? string.Empty` to `VereisLeeftijd`, whose signature and doc blocks are untouched. `OngeldigeLeeftijd` has a sentence of its own for blank or null: "Een subthema heeft een leeftijd nodig. Kies er een uit: JK, K2, K3, L1, L2, L3, L4, L5, L6." (the probe had shown `'' is geen geldige leeftijd`). Tests send `null` and an omitted leeftijd. An HL gets that Dutch 400 on create and edit; so does themabeheer on both wizard routes. A caller without the right gets 403 wherever the right is asked before binding: the ordinary edit (stored leeftijd) and both wizard routes (resource-free rows). **One exception, by design:** on the ordinary create the resource *is* the body leeftijd, so without one there is nothing to ask a right about. A no-rights caller therefore gets the write's Dutch 400 there, before the check and never instead of it. Pinned in `Een_ontbrekende_leeftijd_…`. |
| E (MINOR) | Wizard sentences unguarded; "bestaat niet meer" for an id that never existed | Reworded to "Deze wizard is niet gevonden.". Every wizard sentence is asserted in full over HTTP, with an em-dash check, through `RechtenTestOpzet.VerwachtAsync`, and a plain fact checks the list has no em dash. Covered: not found, afgelopen, not this thema, the moved activiteit, not in this wizard, the foreign-content delete and re-scope, the two goal-link refusals, and the blank-leeftijd sentence. The item 404s ("Dit subthema bestaat niet meer. …") are the ordinary routes' sentences, shared on purpose, and were left as they are. |
| F (MINOR) | The run's starter was missing from the processing register | E7-06 carry-forward in `backlog/E7-niet-functioneel.md`: `wizardruns.GestartDoorId`, returned by `GET …/wizardruns/{runId}`; retention SetNull on gebruiker removal, and the row goes with its thema. Only that carry-forward was added. |
| G (MINOR, code half) | `DekkingController` called its reads unauthenticated | Both paragraphs rewritten: a session since E6-01, reach by default I9, narrowing behind E6-09 must cover the export too. The old wording is kept in a dated note. The doc halves (E6 epic, ADR-0030 §3, E7-11) are the orchestrator's. |
| Q1–Q3 | Questions | Ruled I26 and I27, handled above. **I28 (the 14-day window):** kept as built; only the wizard's own routes move `LaatsteSchrijfactieOp`. |

**Files changed this round:**

- Api:
  - `ThemasController` (delete → `ThemaVerwijderen` + doc), `WizardrunsController` (caller passed to both deletes);
  - `RechtOpAttribute` (`Rechtbron.Thema`);
  - `Aanmelding` (`SchrijfGeenToegangAsync`, `GeenToegangDetail`);
  - `DekkingController` (docs).
- Application:
  - `Rechtenmatrix` (row, column, `StaatToe` branch);
  - `Rechtenbronnen` (`VoorThemaAsync`, `Themabron`);
  - `IWizardrunService` (signatures, docs);
  - `SchoolcontentBeheerDtos` (nullable leeftijd);
  - `SchoolcontentBeheerExceptions` (blank sentence).
- Infrastructure:
  - `EfRechtenbronnen` (now takes a `TimeProvider`, and `VoorThemaAsync`);
  - `WizardrunService` (I27, C, sentences, `IRechtenService`);
  - `SchoolcontentBeheerService` (the two leeftijd call sites only).
- Tests:
  - `TestAuthenticatie` (forbid answers like the cookie);
  - `RechtenTestOpzet` (wizard start, `IdAsync`, `DetailAsync`, `VerwachtAsync`, sentence constants);
  - the sweep; `WizardrunEndpointsTests`; `RechtenAfdwingingTests` (+4, and the 404 test now uses the thema edit for the resource-free case);
  - `RechtenmatrixTests` (+I26);
  - `RechtenEndpointsTests` (the `EfRechtenbronnen` constructor line only).
- Backlog: the E7-06 carry-forward.

**Gates:**

- `dotnet build`: ✓, 0 warnings.
- `dotnet format --verify-no-changes`: exit 0.
- `has-pending-model-changes`: none.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (local `jaarplanner-db`, port 5433):
  - UnitTests: 1364 passed, 4 skipped (live KOV opt-in).
  - IntegrationTests: 419 passed, 1 skipped (live Op.stap opt-in).
- Guard-removal probes: three failures, each naming its route; the file restored and rebuilt afterwards.
- No frontend file changed.

**Open questions:**

1. **I26, "its own open wizard run".** I read it as the run that built the thema, which any themabeheer holder may
   continue (the slice-3 reading the audit judged compliant). If the owner meant the caller's own run, the column needs
   the starter as well.
2. **Slice 4 must hide more:**
   - the thema delete control for themabeheer on a thema holding someone else's content;
   - the wizard's leeftijd select for a subthema holding someone else's content;
   - the wizard delete of a linked activiteit, or of a subthema with linked activiteiten, for a caller without the
     goal-link right.
| `Application/Toegang/IGebruikerBeheerService.cs` (new) | The use cases, the DTOs (`GebruikersOverzicht`, `GebruikerBeheerWeergave`, `KlastoewijzingBeheerWeergave`, `AanstellingBeheerWeergave`, `GebruikerUitnodiging`) and the faults (404 / 400 / 409, the 409s being `GebruikerBestaatAlFout` and `LaatsteDirectieFout`). |
| `Infrastructure/Toegang/GebruikerBeheerService.cs` (new) | EF implementation. The last-directie guard locks the directie rows (`SELECT … FOR UPDATE`, id order) inside the writing transaction. "Counts for shared content" uses `Rechtenberekening.TeltNog` on `Schoolklok` and `Leeftijdsrechten.VoorKlas`, the rights' own rules. |
| `Infrastructure/DependencyInjection.cs` | One registration, in its own commented block after the first-directie bootstrap. |
| `Api/Controllers/GebruikersController.cs` (new) | Thin; `[Authorize(Policy = Rechtenmatrix.Beleid.Beheer)]` on the class. |
| `Api/Infrastructure/GebruikerbeheerExceptionHandler.cs` (new), `Program.cs`, `Probleemtitels.cs` | Faults to ProblemDetails (404, 400, 409 "Niet doorgevoerd"); one registration line in `Program.cs`. |
| `IntegrationTests/Postgres/GebruikerbeheerEndpointsTests.cs` (new) | 27 cases, below. |
| `frontend/src/features/instellingen/gebruikerbeheer.ts` (new) | Types, the overview query (enabled only for directie), the invite, one rights mutation (PUT gives, DELETE takes), removal; writes go into the cache before the refetch and invalidate `ik`. |
| `…/instellingen/GebruikersScherm.tsx` (new) | The part: schooljaar picker, "Gebruiker uitnodigen", the per-jaarfase hoofdleerkracht block, the ended-year notice, one row per person, removal behind `Bevestiging`. |
| `…/instellingen/Rechtenblad.tsx` (new) | The one "Rechten" sheet: directie and themabeheer, klassen of the chosen year, hoofdleerkracht jaarfasen of the chosen year; every tick saves at once; the server's refusal shown above the boxes. |
| `…/instellingen/Uitnodigingsblad.tsx` (new) | Microsoft sign-in name + naam; on success the new person's Rechten sheet opens. |
| `…/instellingen/Onderdeelpoort.tsx` (new), `onderdelen.ts`, `Instellingenindeling.tsx`, `App.tsx` | Gebruikers is `alleenDirectie`; `useZichtbareOnderdelen` feeds the column and the phone switch; the gate sends a non-directie direct visit to the first visible part. `Record<Deel, ComponentType>` kept. |
| `…/instellingen/KlassenScherm.tsx` | Read-only for non-directie (no add/edit/delete); directie sees each klas's leerkrachten by name; the missing-leeftijd callout also says the klas gives its leerkrachten no rights on shared activiteiten (I12), in the same callout. |
| `frontend/src/i18n/nl.json` | `instellingen.gebruikers`, a `gebruikers` group, four `klasbeheer` keys. |
| Tests: `GebruikersScherm.test.tsx`, `KlassenScherm.test.tsx` (new), `Instellingenindeling.test.tsx`, `App.test.tsx` | Below. `App.test` now controls `useIk` with a hoisted mock: its one query client would otherwise cache the first `/api/ik` answer for every later test. |

### The API contract (all under the `Beheer` policy: directie only; 401 without a session, 403 for anyone else)

| Route | Body | Answer |
| --- | --- | --- |
| `GET /api/gebruikers` | | `{ gebruikers: GebruikerBeheerWeergave[], voorbijeSchooljaarIds: guid[] }` |
| `GET /api/gebruikers/{id}` | | `GebruikerBeheerWeergave`; 404 |
| `POST /api/gebruikers` | `{ email, naam, isDirectie?, heeftThemabeheer? }` | 201 + `GebruikerBeheerWeergave`; 400 no single UPN; 409 duplicate |
| `DELETE /api/gebruikers/{id}` | | 204; 409 last directie; 404 |
| `PUT` / `DELETE /api/gebruikers/{id}/directierecht` | | 200 + gebruiker; DELETE 409 last directie |
| `PUT` / `DELETE /api/gebruikers/{id}/themabeheer` | | 200 + gebruiker |
| `PUT` / `DELETE /api/gebruikers/{id}/klassen/{klasId}` | | 200 + gebruiker; PUT 404 unknown klas |
| `PUT` / `DELETE /api/gebruikers/{id}/hoofdleerkracht/{schooljaarId}/{jaarfase}` | | 200 + gebruiker; 400 unknown jaarfase; PUT 404 unknown schooljaar |

`GebruikerBeheerWeergave` = `{ id, naam, email, isDirectie, heeftThemabeheer, isAangemeld, klastoewijzingen:
[{ klasId, klasNaam, jaarfase (nullable), schooljaarId, teltVoorGedeeldeInhoud }], hoofdleerkrachtaanstellingen:
[{ schooljaarId, jaarfase, teltVoorGedeeldeInhoud }] }`. Every write is idempotent and answers the gebruiker as they are
afterwards. Refusals carry Dutch `detail` sentences for directie (Art. II.3), pinned by value in the tests.

### Key decisions

- **The guard's transaction boundary is a row lock, not SERIALIZABLE.** Both writes that can take the directie right
  away lock every directie row in id order, then read the gebruiker, then write, then commit. A concurrent demotion
  waits, and re-reads the locked set after the first commits, so it counts what is true then. Deterministic (no 40001
  retry to map) and deadlock-free, because every caller locks in the same order. **Shown to be necessary:** with
  `FOR UPDATE` removed, the race test fails (200 where 409 belongs); with it, the test passes.
- **`teltVoorGedeeldeInhoud` is exactly what the rights service grants today.** For an appointment: its year has not
  ended (R20). For a klastoewijzing: its year has not ended **and** the klas states a jaarfase (R22, I12); `jaarfase:
  null` in the payload tells the screen which reason applies. `voorbijeSchooljaarIds` covers every schooljaar, so the
  screen can say a year has ended before anything in it is ticked, and never compares dates in the browser.
- **Every tick saves at once, one request each.** A save button over a dozen boxes would send a dozen requests that
  can half fail, and the last-directie refusal belongs beside the box that caused it. The sheet says so once.
- **The (c) sentence is conditioned on what it claims (the E5-03 rule).** An appointment counts until its year ends,
  next year's included, so a jaarfase with nobody *this* year may still have a hoofdleerkracht today. That line says
  "Niemand in dit schooljaar"; only a jaarfase with no appointment that counts anywhere says "Geen hoofdleerkracht",
  and only then does "Zonder hoofdleerkracht past alleen de directie de subthema's van die leeftijd aan." appear.
- **The invitation asks for "Microsoft-aanmeldnaam"**, with one line saying it can differ from the e-mail address
  (ADR-0031 decision 3). Rights are set in the Rechten sheet, which opens straight after the invite.
- **"Nog niet aangemeld" is text in the row and in the sheet.** The sheet adds the one sentence that states the
  residual risk as a fact: "Wie zich als eerste met deze aanmeldnaam aanmeldt, krijgt deze rechten."
- **Checkboxes are ink (`accent-inkt`), not the accent.** Accent uses on these screens: the primary action
  ("Gebruiker uitnodigen", "Uitnodigen"), the active destination, the focus ring. No new hue.
- **Removal from the sheet closes the sheet and opens `Bevestiging`**; a refusal lands under the list, as the klas
  delete already does.

### Tests added

- **Backend, `GebruikerbeheerEndpointsTests` (27, Postgres):**
  - 403 on all twelve routes for themabeheer, hoofdleerkracht, leerkracht, all three at once, and no right (theory ×5),
    with nothing changed afterwards; 401 on all twelve without a session; a directie row is allowed.
  - The overview: JSON names, order, `isAangemeld`, the R20 and I12 flags per item (running, ended and not-yet-started
    year; a klas without jaarfase) and `voorbijeSchooljaarIds`.
  - Invite: normalises the UPN and applies the flags; a duplicate differing only in case and spaces is 409 with its
    exact Dutch sentence; four bad UPNs are 400 with their exact sentence (theory ×4).
  - Themabeheer and directie granted and revoked, idempotent; revoking from a non-holder is a no-op.
  - **Last directie:** demote → 409 and remove → 409, each with its exact Dutch value and no em dash. A directie may
    remove themselves while another remains.
  - **The race:** a second transaction holds the lock and has demoted Bert without committing. An's demotion must still
    be waiting after one second, and after that commit it answers 409, with exactly one directie left.
  - Klastoewijzing: link (idempotent, co-teacher allowed) and unlink (idempotent); the new link shows in that person's
    `/api/ik` on the next request; 404 for an unknown klas or gebruiker.
  - Hoofdleerkracht: two on one (year, K3), no klas needed (I20, visible in `/api/ik`), withdrawal; `K7`, `k3`, `3K`
    refused with `Jaarfasen.WatIsErMisMet`'s sentence (theory ×3); an unknown schooljaar → 404.
  - **Removal** leaves the activiteit they made with `MakerId` null and removes their klastoewijzingen and aanstellingen
    (I17, cascade).
- **Frontend (Vitest, 19 new cases, plus the per-part `App.test` case the new part gets automatically: 233 → 253):**
  - `GebruikersScherm.test` (10): "nog niet aangemeld" only on the unbound row; rights as words with only the chosen
    year's klassen and jaarfasen; ticking a klas sends one PUT on that link and stays ticked; ticking a jaarfase
    appoints; **the last-directie refusal is shown in the server's words and the box stays ticked**; the removal
    refusal is shown and the row stays; "Geen hoofdleerkracht" vs "Niemand in dit schooljaar", with the (c) sentence
    only when earned; the ended-year notice once; after an invite the new person's Rechten sheet opens, and the body
    was trimmed.
  - `KlassenScherm.test` (3): read-only for a non-directie, with no `/api/gebruikers` request; the I12 sentence in the
    same callout; directie sees the buttons and the leerkrachten.
  - `Instellingenindeling.test` (+5): **the part is hidden for a non-directie** (even with TB, HL and a klas), shown to
    directie in both shapes, hidden while `ik` is pending; the gate redirects a non-directie and keeps directie.
  - `App.test` (+1): a non-directie opening `/instellingen/gebruikers` through the real route table lands on
    `/instellingen/klassen`.

### Gates

- `cd backend && dotnet build`: ✓, 0 warnings. `dotnet format`: nothing to change; `--verify-no-changes` exit 0.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` on the local `jaarplanner-db` (port 5433): UnitTests 1340 passed,
  4 skipped; IntegrationTests 410 passed, 1 skipped (383 before, plus 27 new).
- `cd frontend && pnpm lint`: ✓ (oxlint exit 0, `tsc` exit 0). `pnpm test`: 35 files, 253 tests passed.
  `pnpm build`: ✓ (the >500 kB chunk warning predates this change).

### Browser pass (headless Chrome over the DevTools protocol, 1440×1000 and 390×844, dark and light)

The API ran in Development on **port 5395** against a throwaway database, **`jp_spotcheck_e604`**, created and dropped on
the local server (port 5433). Vite ran on **port 5185**, proxying to it. Seeded over the API:
- schooljaren: 2026-2027 (running) and 2025-2026 (ended);
- klassen: K3 groen, L1 blauw, L2 rood (jaarfase set to null by SQL, as on a legacy row), K3 vorig jaar;
- gebruikers: An (themabeheer, K3 groen, HL K3; bound by SQL), Bert (K3 groen, L1 blauw, K3 vorig jaar), Carla (HL K3
  and L1 in the ended year), Dirk (a long name, L2 rood), plus the configured first directie.

What the pass showed:
- **Directie, list:** Gebruikers is in the column and the phone switch; the rows read as intended; "Nog niet aangemeld"
  is on every unbound row and not on An's; the hoofdleerkracht block shows K3 An Peeters, and L1 "Geen hoofdleerkracht"
  with the (c) sentence.
- **Directie, sheet:** ticking L1 blauw for An saved and the row updated. Unticking Directie on the only directie showed
  "directie@jaarplanner.local is de enige met het directierecht. Geef het directierecht eerst aan iemand anders." and the
  box stayed ticked.
- **The ended year (2025-2026):** the notice, Carla as hoofdleerkracht of K3 and L1, and Bert's past klas.
- **Invite:** "Eva.Janssens@School.be" was stored as `eva.janssens@school.be` and "Rechten van Eva Janssens" opened.
- **Klassen as directie:** "Leerkrachten: An Peeters, Bert Claes"; L2 rood's callout carries the I12 line.
- **Bert (not directie):** no Gebruikers link, no klas buttons, no leerkracht names; a direct visit to
  `/instellingen/gebruikers` lands on `/instellingen/klassen`.
- **390:** no horizontal overflow on the list or the invite sheet; the Rechten sheet is a bottom sheet with Klaar and
  Gebruiker verwijderen in the footer; the long name wraps.
- **Contrast**, measured in the browser with alpha composited:
  - light: row meta, uitleg, dd, the (c) sentence and the stil "Gebruiker verwijderen" 6.51:1; "Nog niet aangemeld"
    17.78:1; white on the accent button 6.10:1; the ended-year notice on `vlak-diep` 5.51:1, the lowest;
  - dark: meta 7.58:1; the refusal alert and the I12 callout 8.00:1; the notice 8.97:1.
- **A false alarm:** a full-page capture of the desktop sheet looked clipped on the right. The dialog's bounding box at
  1440 is x=1024, width 416 (26rem), and a viewport-only capture shows it whole, so the clip was the capture mode, not
  the layout.

### Self-check against the brief

- **Invite, rights, links, removal:** ✓, in the API, the UI and the tests.
  - Directie invites by UPN (`NormaliseerEmail`; a duplicate is refused in Dutch).
  - It grants and revokes themabeheer and the directie right.
  - It links and unlinks klassen, unique per pair.
  - It appoints and withdraws hoofdleerkrachten per (year, jaarfase), several allowed, validated by the one leeftijd
    rule.
  - It removes a gebruiker, with I17 and the cascades.
- **The last directie** can be neither demoted nor removed. The count is read under a lock in the writing transaction,
  and the race is tested and shown to need that lock: ✓.
- **The list** shows naam, UPN, rights as words, whether the invitation is bound, klassen and appointments, and whether
  each counts (R20): ✓. The per-jaarfase hoofdleerkracht line says it in words when a jaarfase has none: ✓.
- **Gebruikers is for directie only:** the link is hidden, the address is redirected, and `Record<Deel, ComponentType>`
  is kept: ✓.
- **Klassen** is read-only for a non-directie, shows the leerkrachten by name to directie, and puts I12 in the same
  callout: ✓.
- **Copy and design:** every string is in `nl.json` with no em dash (the catalogue guards are green), the accent is
  used only for its uses, and the screens work at 390 and from `lg`: ✓.
- **Not claimed:** the *Done when* of E6-04 as a whole also needs slice 3 (the server refusing the klas routes to a
  non-directie) and slice 4. This slice does not claim the story.

### For the test-runner

- **Automated:** `dotnet test` with `JAARPLANNER_TEST_POSTGRES`, filtered on `GebruikerbeheerEndpointsTests` for this
  slice; `pnpm test` in `frontend`.
- **By hand, setup:** run the API in Development against a throwaway database; the development sign-in is
  `/api/aanmelden/ontwikkeling`. Seed a running and an ended schooljaar with klassen (one with its `Jaarfase` set to
  null by SQL), and invite three or four people over the screen or the API.
- **As the configured first directie, at `/instellingen/gebruikers`:**
  1. Invite someone, then open their Rechten.
  2. Tick a klas and a jaarfase.
  3. Untick Directie on the only directie: the refusal appears.
  4. Switch to the ended year: the notice appears.
  5. Remove someone who made an activiteit: it stays, with maker null.
- **As a non-directie:** Gebruikers is in neither the column nor the phone switch, `/instellingen/gebruikers` lands on
  `/instellingen/klassen`, and there are no buttons there.
- Check at 1440 and 390.

### Open questions / Art. XIV touched

1. **The Klassen part is read-only for a non-directie in the UI only.** The klas routes still admit any session until
   slice 3 puts the `Beheer` policy on them. That follows from the split; it is noted so the merge order is clear.
2. **No UI edits a gebruiker's name or UPN.** Neither the brief nor E6-04 asks for it. A typo in a UPN means remove and
   invite again, which is safe only before the first login. If directie wants an edit, it needs a rule for a bound row,
   because the UPN no longer identifies the person once the invitation is bound.
3. **Removing yourself** (allowed while another directie remains) ends your session on the next request. The screen
   warns no further than the `Bevestiging` text; a sentence could be added if the owner wants one.
4. **Graadklas (Art. XIV):** untouched. A klas still grants its one stated jaarfase, through `Leeftijdsrechten`.

### Fix round 1

- **Input:** "Code slice 2 — audit round 1" in `backlog/worklogs/E6-02/antagonist.md` (0 CRITICAL, 1 MAJOR, 5 MINOR,
  1 QUESTION) and "E6-04 slice 2 — Test report (round 1)" in `test-report.md` (PASS, with four notes). Both are the
  orchestrator's, committed unedited with this fix. QUESTION 7 was decided by the orchestrator (confirm before giving up
  your own directie right; name the consequence of removing yourself).
- **Branch:** `story/E6-04-beheer`, on top of `224815f`.

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | MAJOR: the last-directie guard counted unbound invitations | **Fixed.** `LeesAndereDirectieOnderSlotAsync` still locks every directie row (`FOR UPDATE`, id order) in the writing transaction, and now reads whether each is bound (`"EntraObjectId" IS NOT NULL`). Only another directie who can sign in counts. When other directieleden exist but none has signed in, the refusal says so: "{naam} is de enige met het directierecht die zich al heeft aangemeld. De anderen met het directierecht hebben zich nog niet aangemeld, dus het directierecht kan nog niet weg." For removal: "… die zich al heeft aangemeld, en kan niet verwijderd worden. De anderen met het directierecht hebben zich nog niet aangemeld." Both are pinned by value. **Development:** the development sign-in binds nobody, so under it no directie is ever bound and the production rule would make every directie undemotable. `GebruikerbeheerOpties.OngekoppeldeDirectieKanAanmelden` (Application) is `false` by default, which is the production rule. `Program.cs` sets it to `true` only when `Authenticatie:Modus` is `Ontwikkeling`, a mode the Api refuses to start with outside Development, and nothing else sets it. The reasoning is that in that mode an unbound directie really can sign in, by being picked, so the rule's meaning ("another directie who can sign in") is unchanged. **Integration tests:** the test host starts in Development with the development sign-in, so `GebruikerbeheerEndpointsTests` runs every request through a host that sets the flag back to `false` (`_productie`), and seeds directieleden bound by default. One test runs the development rule on purpose, and a `[Fact]` pins the mapping (Entra → false, Ontwikkeling → true, default false). |
| 2 | MINOR: the E7-06 register said no route removes a gebruiker | **Fixed** in `backlog/E7-niet-functioneel.md`, the E6-02 slice 1 carry-forward's retention paragraph only. The false clause is struck with a dated note. A list now says: removal is by directie, by hand, only while another directie who can sign in remains, never automatic; it erases the row (naam, UPN, Entra tenant and object id, themabeheer and directie flags; the session stops on the next request); it cascades to klastoewijzingen and aanstellingen; it nulls `Activiteit.MakerId` (I17); the schooljaar delete is still E6-03's; `GET /api/gebruikers` is read by directie only, and anyone else sees only their own rights through `/api/ik`. |
| 3 | MINOR: the (c) sentence claimed more than its condition, and "die leeftijd" had no referent | **Fixed.** Now "Bij een leeftijd zonder hoofdleerkracht beheert alleen de directie de subthema's en subdoelen.": it says less, and its referent is inside the sentence. New catalogue case in `catalogus.test.ts` ("het gebruikersbeheer (E6-04)"): the sentence names "leeftijd zonder hoofdleerkracht", and mentions neither "die leeftijd" nor activiteiten. |
| 4 | MINOR: two length sentences unpinned; a dead copy of the jaarfase sentence | **Fixed.** `Een_te_lange_naam_of_aanmeldnaam_wordt_in_het_Nederlands_geweigerd` pins "Een naam is hoogstens 256 tekens lang." and "Een aanmeldnaam is hoogstens 320 tekens lang." and checks nothing was stored. `LeesJaarfase` throws `Jaarfasen.WatIsErMisMet(jaarfase)!`, which is non-null for exactly the inputs `LeesLeeftijd` refuses, so the sentence exists once, in the domain. |
| 5 | MINOR (suspicion): disabling every box during a save throws focus out | **Confirmed and fixed.** Boxes now wait as `aria-disabled` and ignore input, and stay focusable. Browser keyboard pass (CDP key events): Space on "L1 blauw" kept focus on it during the save (`aria-disabled=true`, `activeElement` the box) and after it; a second Space unticked it, focus still there. New Vitest: during a held save the box is `aria-disabled`, not disabled, keeps focus and shows the requested state; a second tick is ignored (one write); after the save it still has focus. |
| 6 | MINOR: a delete racing a link gave 500 | **Fixed.** `BewaarIdempotentAsync` maps 23503 to `GebruikerbeheerNietGevondenFout` with a Dutch sentence ("De gebruiker of de klas bestaat niet meer.", or "… het schooljaar …"). New Postgres test, deterministic: another transaction deletes the klas without committing, and the link's foreign-key check waits on it. After the commit the answer is 404 with that sentence. |
| 7 | QUESTION, decided: self-demotion and self-removal | **Built.** Unticking your **own** Directie box opens `Bevestiging` over the sheet: "Je eigen directierecht afgeven?", with "Je ziet het scherm Gebruikers dan niet meer, en je kunt het directierecht niet zelf terugzetten." and "Directierecht afgeven". The consequence says nothing about who else can restore it, because the dialog shows before the server knows whether another directie exists. Someone else's box saves at once, as before. Removing yourself shows "Je wordt meteen afgemeld en kunt je daarna niet meer aanmelden. …". **No false error flash:** after your own demotion or removal only `ik` is refetched, not the overview, and the list's failure branch shows only when there is no data. Browser: after confirming, the page went to `/instellingen/klassen` with the error text never seen in 60 polls, and no Gebruikers link. Vitest covers cancel (no request), confirm (one DELETE, `ik` refetched, the overview not, no error text), someone else's right (no dialog), and the self-removal text. |
| TR | Notes: removal race untested; five parts past the edge at 390 | **Race:** `Een_directie_verwijderen_terwijl_een_andere_wordt_afgezet_laat_er_een_over` holds the lock with Bert demoted and uncommitted, and removing An waits, then answers 409; exactly one directie is left. **Phone switch (design judgement):** it keeps scrolling, since five labels cannot fit at 390 without shrinking type or wrapping the segment into two rows. The edge where parts are hidden now fades into the row's own background (`vlak-diep`, no new hue), and the active part is scrolled into view when the row appears. Measured: on Gebruikers only the right edge fades, on Weergave only the left (the part fully visible), and with four parts (a leerkracht, 6px over) none. The tolerance is the row's padding, so a fade never dims a part that is fully in view. |
| + | Audit summary: `KlassenScherm`'s comment said "the server refuses them" | **Fixed.** The comment now says the matrix gives those buttons to directie alone and the server refuses them once slice 3 puts the row on the klas routes; until then the routes admit any session. |

**Tests added this round:**
- **Backend** (`GebruikerbeheerEndpointsTests`, 27 → 36): unbound-only directie → both refusals by value; allowed after the second directie is bound (demote; remove); an unbound directie invitation may itself be demoted and removed while a bound one remains; the development rule counts an unbound directie; the option's mapping; the removal race; the FK race; the length sentences.
- **Frontend** (253 → 258): focus during a save; self-demotion confirm, cancel and no error flash; someone else's directie right without a dialog; the self-removal text; the catalogue case.

**Gates:**
- `dotnet build`: 0 warnings, 0 errors. `dotnet format --verify-no-changes`: exit 0.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (local `jaarplanner-db`, port 5433): UnitTests 1340 passed, 4 skipped; IntegrationTests 419 passed, 1 skipped (410 + 9 new).
- `pnpm lint`: exit 0. `pnpm test`: 35 files, 258 passed. `pnpm build`: exit 0 (the >500 kB chunk warning predates this).

**Browser pass:** API in Development on port 5395 against throwaway `jp_spotcheck_e604b` (created, migrated, seeded over the API, then dropped); Vite on 5185; headless Chrome at 1440 and 390, light. It covered the keyboard pass, self-demotion with its confirmation and redirect, the new (c) sentence, and the switch fades above.

### Fix round 2

- **Input:**
  - "# E6-02 slice 3 — Test report (round 2)": PASS, with notes on one flaky Entra test and two small test gaps;
  - "## Code slice 3 — audit round 2": 0 CRITICAL, 0 MAJOR, 3 MINOR, 1 QUESTION.

  Both are the orchestrator's and are committed unedited.
- **Owner ruling on Q4, 2026-09-14: option (a), a goal link protects.** The orchestrator records it in the I26/I27
  text on `feature/e6-rollen-rechten`. The constitution, the ADR and the E6 epic were not edited here.
- **Branch:** `story/E6-02-afdwingen`, on top of `afe46bc`. No new migration: `Themabron` is not an entity, and no
  mapping changed.

| # | Finding | Resolution |
| --- | --- | --- |
| Q4 (a) | An HL's goal link on a run-created activiteit left with a themabeheer thema delete (I26) or a wizard re-scope (I27) | **Thema delete:** `Themabron` gains `GekoppeldeLeeftijden`, the leeftijden of the open run's own activiteiten that carry a goal link, computed in `EfRechtenbronnen.VoorThemaAsync`. The resolver knows no caller, so it reports rather than decides. The `ThemaVerwijderen` branch of `StaatToe` then requires, for each of those leeftijden, `StaatToe(rechten, DoelenKoppelen, new Leeftijdsinhoud(leeftijd))`: the one goal-link rule, called, not copied. Directie passes as always. **Wizard re-scope:** when a run-created subthema's leeftijd changes and any activiteit under it carries a goal link, the caller needs `DoelenKoppelen` at **both** the old and the new leeftijd. The ruling says "its leeftijd", but a re-scope gives the link a second one: it moves into the new leeftijd's dekking. Asking at both ends is I13's logic applied to R19, and I chose the stricter reading. The caller's id now travels to `WijzigSubthemaAsync`. Its refusal has a sentence of its own, "Aan activiteiten onder dit subthema zijn doelen gekoppeld. Die mag je niet naar een andere leeftijd meenemen, dus de wizard verandert de leeftijd niet.", because "niet in deze wizard aangemaakt" would be false for the run's own activiteit (the E5-03 rule). **Tests:** the thema delete (themabeheer 403, themabeheer+HL of K3 204, directie 204), and the matrix unit test (the Q4 cases, two leeftijden, HL without themabeheer). The re-scope: themabeheer 403; themabeheer+HL of K3 only 403; themabeheer+HL of K3 and K2 200. The same-leeftijd edit is allowed, and the database shows K3 before and K2 after. |
| MINOR 1 | `ThemaVerwijderen` cited R4 | Doc and label now cite "(R3; I26)". The doc says the directie column rests on R3 and the themabeheer column is a default (I26, followed under R37), and it records the old citation. |
| MINOR 2 | Docs made incomplete by I27 and C | `Rechtenmatrix`: the class doc now defines a resource row as any row with a column that needs a resource (including I26's), names `Themabron`, and says the Api asks through `[RechtOp]` or in the action. The wizard paragraph says a run's rules are state plus one relation (I27 with Q4, `DoelenKoppelen` through `StaatToe`). The `Wizardinhoud` doc and label cite I22–I27 and say I27 narrows it. `WizardrunsController`: "Rights" lists all four conditions, and "Order of answers" adds the two 403s (activiteit no longer under the thema; I27). The re-scope, subthema-delete and activiteit-delete summaries cite I27 (and Q4), and the activiteit edit summary names the thema check. |
| MINOR 3 | "verwijdert ze niet" read as the goals | "… dus de wizard verwijdert deze activiteit niet." in the service and in the test constant. |
| Test gaps | Test-runner and antagonist notes | **Planned thema:** an empty thema placed in K3 blauw's jaarplan (by hand, at the rooster's first block) is refused to themabeheer with the service's 400 ("staat nog 1 keer in een jaarplan"). **Subthema with links:** after themabeheer's refused delete, the subthema and its activiteit are still in the database. **I28:** an ordinary thema PUT and a themadoel POST by themabeheer leave the run's stored `LaatsteSchrijfactieOp` exactly unchanged. |
| Nit | `WizardrunService` overstated what READ COMMITTED guarantees | The summary now says the rights question reads the rows as committed just before the write and takes no lock. A link another request adds in between is not seen: the same narrow window the filter-side checks accept, the thema delete's included. |
| Left, as instructed | The item 404 sentences ("… bestaat niet meer") | Unchanged: a codebase-wide pattern, out of scope. |

**Files changed:**

- Application: `Rechtenmatrix` (docs, labels, the `StaatToe` branch, the column doc), `Rechtenbronnen` (`Themabron`),
  `IWizardrunService` (re-scope signature and doc).
- Infrastructure: `EfRechtenbronnen` (`VoorThemaAsync`), `WizardrunService` (Q4 re-scope, sentences, doc).
- Api: `WizardrunsController` (docs; the caller passed to the re-scope).
- Tests: `RechtenmatrixTests`, `RechtenAfdwingingTests` (+2), `WizardrunEndpointsTests` (+2, one assertion added).

**Gates:**

- `dotnet build`: ✓, 0 warnings.
- `dotnet format --verify-no-changes`: exit 0.
- `has-pending-model-changes`: none.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` on the local `jaarplanner-db`, using the container's own password
  (the one in `docs/dev-setup-secrets.md` does not match; that doc was not edited):
  - UnitTests: 1364 passed, 4 skipped.
  - IntegrationTests: 423 passed, 1 skipped.
- No frontend file changed.

**Open, for the orchestrator:**

1. The Q4 re-scope asks the goal-link right at both leeftijden (the stricter reading, above). If the owner meant the
   old leeftijd only, it is one condition to drop.
2. **Slice 4 must also hide** the thema delete for themabeheer when a run activiteit carries a link at a leeftijd where
   they may not link goals, and the wizard's leeftijd select in the same case.
  - "Code slice 2 — audit round 2" in `antagonist.md`: 0 CRITICAL, 0 MAJOR (MAJOR 1 resolved), 5 MINOR.
  - "E6-04 slice 2 — Test report (round 2)" in `test-report.md`: FAIL, on one MINOR defect (the phone switch fade); everything else passed, including a mutation run.

  Both are the orchestrator's and are committed unedited with this fix.
- **Branch:** `story/E6-04-beheer`, on top of `3e4ee04`.

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | MINOR: the (c) sentence still said "alleen de directie" | **Fixed.** New wording: "Bij een leeftijd zonder hoofdleerkracht doet de directie wat een hoofdleerkracht zou doen." It claims nothing about who else may act (themabeheer through the wizard, I25–I27; the FR-1 import's subdoel links; the leerkrachten of that leeftijd on the activiteiten and the streefwoordenschat). The catalogue case now refuses any "alleen" in this key, and still refuses "die leeftijd" and "activiteit". |
| 2 | MINOR: E7-06 said only a cascade ends these rows | **Fixed**, my paragraph only. "Nothing ends them earlier" and the "only" are gone. A new bullet says directie can end each fact by hand at any time (unticking a klas or a jaarfase deletes that row, `HaalKlasWegAsync`, `TrekAanstellingInAsync`; unticking themabeheer or directie clears the flag), and that no history is kept. The opening sentence now reads "stays stored until directie ends it by hand or its klas, schooljaar or gebruiker is removed". |
| 3 | MINOR: server sentences | **Fixed.** (a) "… Geef het directierecht eerst aan iemand anders die zich al heeft aangemeld." in both "enige met het directierecht" refusals. (b) The number-neutral "Wie verder het directierecht heeft, heeft zich nog niet aangemeld, …" in both "die zich al heeft aangemeld" refusals. The pinned backend tests and the two mocked sentences in `GebruikersScherm.test.tsx` follow. (c) "De gebruiker of het schooljaar bestaat niet meer." is pinned by value in a new deterministic test: another transaction deletes the schooljaar without committing, the appointment's FK check waits on it, and after the commit the answer is 404 with that sentence. |
| 4 | MINOR: a save that loses its row to a concurrent removal gave 500 | **Mapped to a Dutch 404**, not an idempotent 204. `BewaarWijzigingAsync` wraps every tracked gebruiker save (both directie writes, both themabeheer writes, the removal) and turns `DbUpdateConcurrencyException` into `GebruikerbeheerNietGevondenFout("Deze gebruiker is intussen verwijderd.")`. No concurrency token is configured on `gebruikers`, so zero rows can only mean the row is gone, and the sentence asserts exactly that. A 404 matches what a request arriving after the removal already gets; a 204 would claim a removal this request did not do. New deterministic tests: another transaction deletes An without committing, the tracked UPDATE or DELETE waits on the row lock (asserted still pending after 1 s), and after the commit the answer is 404 with that sentence. That is a theory over `PUT …/themabeheer`, `PUT …/directierecht` and `DELETE …/{id}`, plus a fact for `DELETE …/themabeheer`. |
| 5 | MINOR (audit) = the test-runner's defect: the fade covered the active label | **Fixed and measured.** The row now has `scroll-px-9` (scroll-padding-inline 36px), a little wider than the 32px fade: with exactly 32px it still touched the fade by 0.3px, because the fade starts a pixel inside the row's border. `scrollIntoView` "nearest" therefore stops the active part clear of both fades; at either end of the row the other edge has nothing hidden, so it has no fade. The antagonist's optional font-swap note is also taken: once `document.fonts.ready` resolves, the active part is placed and measured again. Measurements are in the table below. |
| TR | Note: the "allowed after binding" removal test did not first assert the refusal | **Added:** it asserts 409 before the bind, then 204 after it. |

**Phone switch measurements**, headless Chrome, signed in as directie (five parts), each part opened fresh as the landing route. Pixel positions are viewport x; "fades" are the drawn fade overlays. Every case: **overlap 0px, active part fully inside the row**; the label's contrast is 17.78:1 light and 13.12:1 dark.

| Width | Part | Scroll | Active part | Fades |
| --- | --- | --- | --- | --- |
| 390 | Klassen | 0/97 | [21,94] | right [341,373] |
| 390 | Gebruikers | 0/97 | [94,185] | right [341,373] |
| 390 | Hoeken | 0/97 | [185,257] | right [341,373] |
| 390 | Algemene fiches | 44/97 | [213,337] | left [17,49], right [341,373] |
| 390 | Weergave | 97/97 | [284,369] | left [17,49] |
| 360 | Klassen | 0/127 | [21,94] | right [311,343] |
| 360 | Gebruikers | 0/127 | [94,185] | right [311,343] |
| 360 | Hoeken | 0/127 | [185,257] | right [311,343] |
| 360 | Algemene fiches | 74/127 | [183,307] | left [17,49], right [311,343] |
| 360 | Weergave | 127/127 | [254,339] | left [17,49] |

Light and dark gave identical geometry. Before the fix, the test-runner measured Algemene fiches at [249,373] at 390, its last 19.3px under the right fade. With `scroll-px-8`, this pass measured [217,341], touching the fade by 0.3px, which is why the padding is 36px.

**Gates:**
- `dotnet build`: 0 warnings, 0 errors. `dotnet format --verify-no-changes`: exit 0.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (local `jaarplanner-db`, port 5433, the container's own password): UnitTests 1340 passed, 4 skipped; IntegrationTests 424 passed, 1 skipped (419 + 5 new). After the last test-only edit (the 409 before the bind), `GebruikerbeheerEndpointsTests` alone: 41 passed.
- `pnpm lint`: exit 0. `pnpm test`: 35 files, 258 passed. `pnpm build`: exit 0 (the >500 kB chunk warning predates this).

**Browser pass:** API in Development on port 5395 against throwaway `jp_spotcheck_e604c` (created, migrated, seeded over the API, dropped); Vite on 5185. It ran the measurements above, and the reworded (c) sentence rendered.

### Fix round 3

- **Input:**
  - "# E6-02 slice 3 — Test report (round 3)": PASS;
  - "## Code slice 3 — audit round 3": 0 CRITICAL, 0 MAJOR, 1 MINOR, 1 QUESTION, plus non-blocking nits.

  Both are the orchestrator's and are committed unedited.
- **Owner answer on Q5, 2026-09-14: both leeftijden.** A wizard re-scope of a subthema whose run activiteiten carry a
  goal link needs `DoelenKoppelen` at the old and the new leeftijd, as built. It is ratified in I27's text on
  `feature/e6-rollen-rechten` (`8c95c57`: "When the wizard changes a subthema's leeftijd, that right is needed at both
  the old and the new leeftijd."). The constitution was not edited here.
- **Branch:** `story/E6-02-afdwingen`, on top of `e83a875`. No new migration. Nothing else was changed.

| # | Finding | Resolution |
| --- | --- | --- |
| MINOR 1 | The old-leeftijd half of the Q4 re-scope check was untested | `…verhuist_alleen_mee_voor_wie_op_beide_leeftijden_mag_koppelen_Q4` gains the missing case: themabeheer + HL of **K2 only** re-scoping K3→K2 gets 403 with `GekoppeldVerhuist` in full, and the database still holds K3 (asserted right after the refusals). **Mutation proof:** with `MagDoelenKoppelenAsync(gebruikerId, huidig.Leeftijd, …)` changed to read `nieuw` (one line), the test **failed** ("Expected 403 …, got 200"). On the real code it passes. The file was restored from a copy, diffed identical, and rebuilt. |
| Nit | `Themabron.GekoppeldeLeeftijden` defaulted to null, read as "none" | Required, with no default and no `?? []` in `StaatToe`: a second producer that forgets it is now a compile error, not a silent allow. The two unit-test constructions pass `[]`. |
| Nit | Class-level summaries missed the Q4 leeftijd-change-with-link case | `IWizardrunService` (the fourth bullet), `WizardrunService` (the order of questions) and the `WizardrunWeigering` doc now name it: "remove a goal link or carry one to another leeftijd without the caller's goal-link right there". |
| Nit | `Wizardinhoud` cited "I22–I27", which includes I26 (the thema delete) | Doc and label cite "I22–I25, I27", and the doc says why I26 is left out. |
| Nit | The re-scope rule was cited without the ratified wording | Quoted as "at both the old and the new leeftijd" with the Q5 answer in: the `Rechtenmatrix` class doc, the `Wizardinhoud` doc, the `IWizardrunService` class and method docs, the `WizardrunService` re-scope comment, and the `WizardrunsController` "Rights" item and re-scope summary. |
| Nit | The `ThemaVerwijderen` label's "het" read as the thema | "… themabeheer alleen als het thema niets anders bevat dan wat de eigen open wizard van dat thema aanmaakte, en geen doelkoppeling die de themabeheerder niet mag ontkoppelen (R3; I26)". |
| Nit | The planned-thema test matched its 400 by substring | Pinned by value through `VerwachtAsync`, with the thema's name read back: "Thema '…' staat nog 1 keer in een jaarplan en kan niet verwijderd worden. Verwijder het thema eerst uit die jaarplannen." |

**Gates:**

- `dotnet build`: ✓, 0 warnings.
- `dotnet format --verify-no-changes`: exit 0.
- `has-pending-model-changes`: none.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` on the local `jaarplanner-db` (the container's password):
  - UnitTests: 1364 passed, 4 skipped.
  - IntegrationTests: 423 passed, 1 skipped. The new case extends an existing test, so the count is unchanged.
- Mutation probe: failed as required, then restored.
- No frontend file changed.
  - "Code slice 2 — audit round 3" in `antagonist.md`: 0 CRITICAL, 0 MAJOR, 1 MINOR; all five round-2 findings resolved.
  - "E6-04 slice 2 — Test report (round 3)" in `test-report.md`: FAIL on 1 MINOR, plus one LOW note. The round-2 fade defect is fixed (20/20).

  Both are the orchestrator's and are committed unedited with this fix. Nothing was changed beyond the three items below.
- **Branch:** `story/E6-04-beheer`, on top of `02394a3`.

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | Audit MINOR: after a 404 the screen still showed the removed gebruiker, with a live sheet whose next tick answered "Gebruiker <guid> is niet gevonden." | **Fixed.** A 404 from either beheer write (`useRechtWijziging`, `useVerwijderGebruiker`) now refetches the overview, the klassen and the schooljaren (`bijNietGevonden`): the boxes are built from all three, and a 404 can mean any one of them is gone. `GebruikersScherm` remembers whose sheet is open, by id and name. When the loaded list no longer holds that person, the sheet (which renders only for someone in the list) closes, and a list-level alert says "{naam} is intussen verwijderd en staat niet meer in de lijst." That condition proves the person was listed when the sheet opened and is not now. A 404 about a klas or schooljaar leaves the person listed, so the sheet stays open with the server's sentence, and the refetch drops the gone box. **The not-found sentence names no raw id:** "Deze gebruiker bestaat niet (meer).", worded that way because that branch cannot tell a removed gebruiker from an id that never existed. It is pinned by value for a GET and a toggle after a removal (the second-tab path). **New Vitest:** a 404 on a klas tick refetches the list, closes the sheet, shows the list-level alert, and the person's row is gone while the other stays. |
| 2 | Test-runner MINOR: the late-font re-placement scrolled a keyboard-focused link out of view (WCAG 2.4.7, 2.4.11) | **Fixed.** In the `document.fonts.ready` callback, if focus is inside the row and not on the active link, the **focused** link is brought into view ("nearest") and the fades are re-measured; the active part is left alone. Otherwise the active part is placed as before. **New Vitest** (mocked `document.fonts.ready` and `scrollIntoView`): with focus on Weergave while Klassen is active, the font's arrival calls `scrollIntoView` on Weergave and never on Klassen, and Weergave keeps focus. Without focus in the row, it places the active part. **Browser, fonts held back 3 s** (CDP `Fetch` interception, cache disabled), real Tab presses: see the table below. |
| 3 | Test-runner LOW (folded into 1): DELETE `…/directierecht` racing a removal answered "Gebruiker {guid} is niet gevonden." | **Fixed, and tested.** The two writes that take the directie lock (demotion, removal) first check the gebruiker exists (the plain not-found for an id that never existed). They then read it after the lock with `VindNaSlotAsync`, which answers "Deze gebruiker is intussen verwijderd." if the row vanished while the request waited, which is exactly when that sentence is true. **New race theory** `Een_directie_afzetten_of_verwijderen_die_intussen_verwijderd_wordt_is_404_en_geen_500`: `/directierecht` and removal of a directie, each held on the lock by an uncommitted delete (pending after 1 s), then 404 with that sentence. The concurrency path in `BewaarWijzigingAsync` uses the same `IntussenVerwijderd()`. |

**Keyboard repro with the fonts held back 3 s**, directie, five parts. Positions are viewport x; the row's visible span is its inner edge. In every case the fonts were loading when Tab reached the link and loaded at the second measurement.

| Width | Landing, keys | Before the font | After the font |
| --- | --- | --- | --- |
| 390 | Klassen, Tab 4× to Weergave | [284,369] of [17,373], in view, 0px under a fade, focused | [284,369], in view, 0px under a fade, focused |
| 390 | Weergave, Tab 12× to Klassen | [21,91], in view, 0px, focused | [21,94], in view, 0px, focused |
| 360 | Klassen, Tab 4× to Weergave | [254,339] of [17,343], in view, 0px, focused | [254,339], in view, 0px, focused |
| 360 | Weergave, Tab 11× to Klassen | [21,91], in view, 0px, focused | [21,94], in view, 0px, focused |

In round 3's repro, Weergave had ended at [381,466], outside the row. **The 20 landings** (5 parts × 390/360 × light/dark), re-run: identical to fix round 2's table, 0px overlap and the active part fully in the row in every case; label contrast 17.78:1 light, 13.12:1 dark.

**Gates:**
- `dotnet build`: 0 warnings, 0 errors. `dotnet format --verify-no-changes`: exit 0.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (local `jaarplanner-db`, port 5433, the container's own password): UnitTests 1340 passed, 4 skipped; IntegrationTests 426 passed, 1 skipped (424 + 2 new race cases).
- `pnpm lint`: exit 0. `pnpm test`: 35 files, 261 passed (258 + 3 new). `pnpm build`: exit 0 (the >500 kB chunk warning predates this).

**Browser pass:** API in Development on port 5395 against throwaway `jp_spotcheck_e604d` (created, migrated, seeded over the API, dropped); Vite on 5185; headless Chrome.

### Owner-approved mini-fix (after audit round 4)

- **Input:**
  - "# E6-02 slice 3 — Test report (round 4)": PASS;
  - "## Code slice 3 — audit round 4": 0 CRITICAL, 0 MAJOR, 1 MINOR.

  Both are the orchestrator's and are committed unedited. The three fix rounds were used up; the owner approved this
  one extra fix, limited to that finding.
- **The MINOR:** two doc comments in `Rechtenmatrix.cs` dropped the goal-link condition from the re-scope rule: the
  class doc's wizard paragraph and the `Wizardinhoud` doc. The code asks `DoelenKoppelen` at both leeftijden only
  while an activiteit under the subthema carries a goal link (`WizardrunService.WijzigSubthemaAsync`). A
  themabeheer-only re-scope of an unlinked run subthema is pinned at 200.
- **Fix:** both now say the rule is for "a subthema whose activiteiten carry a goal link". Only those two comment
  blocks changed. No executable line, test or other source file.
- **Proof:** `git diff -U0 -- backend`, filtered for changed lines that are neither blank nor start with `//`, `///`
  or `*`, gives **0 lines**. The only changed lines are the `///` lines of those two blocks.
- **Gates:**
  - `dotnet build`: ✓, 0 warnings;
  - `dotnet format --verify-no-changes`: exit 0;
  - `Toegang` unit tests: 209 passed.
  - "Code slice 2 — audit round 4" in `antagonist.md`: 0 CRITICAL, 0 MAJOR, 1 MINOR, 1 QUESTION.
  - The round-4 test report in `test-report.md`: PASS, with LOW notes.

  Both are the orchestrator's and are committed unedited with this fix.
- **Why this is not a fix round:** the three fix rounds were used up. The owner explicitly approved this extra fix and **waived the antagonist review for it**, so no audit round follows. The evidence is the diff, the tests and the browser check below. Only the three items below were changed.
- **Branch:** `story/E6-04-beheer`, on top of `ef4d23c`.

| # | Finding | Resolution |
| --- | --- | --- |
| 1 | Audit MINOR (comments only) in `GebruikersScherm.tsx` | **Fixed.** The removal-refusal comment now covers both refusals that end under the list: a 409 for the last directie, after which the row stays on screen, and a 404 for a person someone else removed first, after which the refetch (`bijNietGevonden`) has dropped the row and the sentence is what is left. The `verdwenen` comment presents a 404 from the sheet as the usual path, and says any refetch without the person (such as after a successful tick) reveals the same removal; the condition proves only that the person was listed when the sheet opened and is not now. |
| 2 | Audit QUESTION, the owner chose to fix: klas and schooljaar not-found sentences showed a raw GUID | **Fixed.** Now "Deze klas bestaat niet (meer)." and "Dit schooljaar bestaat niet (meer).", in the gebruiker sentence's style, with no id and no em dash. Both are pinned by value in `GebruikerbeheerEndpointsTests`: `Koppelen_aan_een_onbekende_klas_of_gebruiker_is_404` and `Aanstellen_in_een_onbekend_schooljaar_is_404`, with ids that do not exist. No other not-found sentence in `GebruikerBeheerService` carries an id; the gebruiker ones were reworded in fix round 3, and the two FK race sentences never had one. |
| 3 | Test-runner LOW notes: an alert appearing after its sheet closes can render off screen at 390, and focus falls to `body` | **Fixed** with one component, `Aandachtsmelding`, used for the list-level "{naam} is intussen verwijderd …" and for the removal's refusal under the list. It has `tabIndex={-1}` and focuses itself once, on mount, deferred one task so a closing Radix dialog's own focus return cannot land after it. Focusing scrolls it into view. It never focuses on a re-render, so it cannot take focus in any other situation. **New Vitest:** a 404 on a tick closes the sheet, and the list-level alert receives focus and has `tabindex="-1"`. The existing removal-refusal test now also asserts that its alert receives focus. |

**Backend diff check:** `git diff -- backend` shows exactly the two sentences in `GebruikerBeheerService.cs` and the two `Assert.Equal` pins (plus one comment line each) in `GebruikerbeheerEndpointsTests.cs`. Nothing else in the backend changed.

**Browser check at 390** (headless Chrome, light). API in Development on port 5395 against throwaway `jp_spotcheck_e604e` (created, migrated, seeded over the API plus twelve extra people named to sort last, then dropped); Vite on 5185. The page was 3162px tall and the target rows sat low in it (row button at `scrollY` 2318).
- **404 on a tick:** "Zz Persoon 12" was removed in the database while its sheet was open, then a klas was ticked. The sheet closed, and the alert "Zz Persoon 12 is intussen verwijderd en staat niet meer in de lijst." was focused (`tabindex=-1`), at [396,448] in an 844px viewport, fully in view; the page scrolled to it.
- **404 on a removal:** "Zz Persoon 11" was removed in the database, then "Gebruiker verwijderen" was confirmed. The row was gone, and the refusal "Deze gebruiker bestaat niet (meer)." under the list was focused, at [573,607], fully in view.
- **No focus theft:** before any of this, focus was on `body` with no alert. An ordinary tick afterwards kept focus on its box; the earlier refusal, still on screen, did not take focus again.

**Gates:**
- `dotnet build`: 0 warnings, 0 errors. `dotnet format --verify-no-changes`: exit 0.
- `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (local `jaarplanner-db`, port 5433, the container's own password): UnitTests 1340 passed, 4 skipped; IntegrationTests 426 passed, 1 skipped (the same count as before: the two pins are assertions added to existing tests).
- `pnpm lint`: exit 0. `pnpm test`: 35 files, 262 passed (261 + 1 new). `pnpm build`: exit 0 (the >500 kB chunk warning predates this).
