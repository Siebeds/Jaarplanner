# Jaarplanner — Project Constitution

> **This file is the single source of truth for the Jaarplanner project.**
> Every decision, every change, every line of code and content is measured against it.
> When anything here conflicts with another document or with code, **this constitution wins** — unless the constitution itself is deliberately amended (see [Article XI — Amendment](#article-xi--amendment-process)).
>
> **Hierarchy of truth:**
> 1. This `CONSTITUTION.md` — governs *how* we build and the non-negotiable principles.
> 2. [`docs/Functionele_Analyse_Jaarplanner.md`](docs/Functionele_Analyse_Jaarplanner.md) — the source of truth for *scope* (the functional analysis, v0.4).
> 3. [`CLAUDE.md`](CLAUDE.md) — operational guidance for Claude Code; must stay consistent with this constitution.
>
> Authoritative source document: `assets/Functionele_Analyse_Jaarplanner.docx` (v0.4, 20 June 2026, by Siebe De Saedeleir). Supporting Op.stap reference material lives in `assets/`.
>
> **This text states the rules in force** (Art. XI.4). Who ratified each amendment, when and why, is in the [ratification log](docs/constitutie-log.md); the text as it stood before its history moved there is at commit `f5804bc`.

---

## Preamble

**Jaarplanner** is a web application for a Flemish Catholic primary school (kleuter- en lager onderwijs, 2,5–12 jr). It helps teachers map their existing **thema's** and **activiteiten** onto the learning goals of the **Op.stap** curriculum (Katholiek Onderwijs Vlaanderen), generate an AI-assisted year plan per class, adjust it via drag-and-drop, and **prove coverage of every minimumdoel** — the government-decreed attainment targets the inspectorate tests against.

The users are **teachers** (per class) and **directie** (school head). They are **non-technical**. The product exists to remove a tedious, error-prone manual mapping task and to make coverage *provable*.

This constitution encodes the principles that must hold for the product to be trustworthy: faithful curriculum data, human-controlled AI, demonstrable coverage, and a Dutch, accessible experience.

---

## Article I — Mission & Non-Goals

### I.1 Mission

Deliver a tool that lets a school:
1. Load its own **thema's / subthema's / activiteiten** (Excel import).
2. Load the official **Op.stap leerplandoelen** (incl. decreed **minimumdoelen** via concordantie) per discipline.
3. Get **AI suggestions** linking thema's/activiteiten to leerdoelen, each with a motivation.
4. **Generate a year plan per class**, spread across the school year.
5. **Edit it freely** in a calendar via drag-and-drop.
6. **Regenerate** the whole plan or a single period.
7. See a **coverage / gap analysis** down to minimumdoel level.
8. Collaborate within role-based permissions, and **export** as proof of coverage.
9. Write an **ontwikkelingsrapport** per child in the derde kleuter (K3), three times a year, and hand it to the parents as a PDF or Word document ([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md); the rules are Art. VI.7, the entities Art. IX.4).

### I.2 Non-Goals (out of scope for this version)

The following are explicitly **out of scope** and must not be built without an amendment:
- Pupil-level tracking or reporting, **except the K3 ontwikkelingsrapport** (I.1 item 9, Art. VI.7). Nothing follows a child from one schooljaar or klas to the next.
- Integration with school-administration / pupil-tracking systems (e.g. Smartschool, Informat).
- Access for parents or pupils.
- Automatic generation of the actual lesson material.
- Evaluation / grading / points management, **except the gradaties of the ontwikkelingsrapport**. A gradatie is an ordered label with a star, not a number: no points, totals, averages or comparisons between children or klassen.

The two exceptions above are the only ones. Access for parents or pupils and integration with pupil administration stay non-goals: a report the school hands to parents as a file is not access to the app, and a child's name is typed by hand.

---

## Article II — Domain Language (binding)

1. **The domain language is Dutch.** Domain entities and concepts use Dutch names in code: `Leerplandoel`, `Minimumdoel`, `Doelsoort`, `Thema`, `Subthema`, `Activiteit`, `Jaarplan`, `Planningsblok`, `Dekking`, `Concordantie`, `Klas`, `Schooljaar`. Translating *leerplandoel* vs *minimumdoel* loses meaning — do not translate domain terms.
2. **Generic / infrastructure code, technical identifiers, tooling, and comments are in English.**
3. **All user-facing strings are Dutch.** UI text is centralised in `frontend/src/i18n/nl.json`; never hard-code Dutch text in components. The language of a message follows **who it is for**, not which layer produced it:
   - **A message a teacher or directie can act on is Dutch.** A validation error, a per-row import problem, a reason a placement was refused. It may be **generated server-side**: not every Dutch string a user reads has to live in `nl.json`, because a diagnostic that names a row number, an offending column or a specific thema cannot be assembled from a static catalogue without inventing a parallel one.
   - **A message only a developer or operator can act on is English.** A malformed AI response, a parse failure, an unmapped exception. Translating these buys nothing: no teacher can fix them, and the audience is the log.
   - **UI chrome, labels, buttons and any copy the frontend authors itself stay in `nl.json`.** This does not license a component to hard-code Dutch.

   Payloads are not restructured into machine-readable codes plus parameters: `problemen[].melding`, `diff.opmerkingen[]` and the planning faults may stay free text. Where a payload is *presentation* rather than *diagnosis*, prefer structured fields anyway, so the frontend can format dates and compose sentences in real Dutch (see `ParameterRapport`, whose records exist for exactly that reason).
4. The glossary in [Article XII](#article-xii--glossary-nl--en) is authoritative for domain terms. Extend it rather than inventing synonyms.
5. **No em dashes in the product.** No `—` in any string a user can read or that becomes data: `nl.json`, seeded and demo content, `Klas.Naam` and other stored names, exported documents, and the **canonical examples in this constitution and `CLAUDE.md`**, because an example in a governing document gets copied into real rows. **Rewrite the sentence** — split the clause, or use a colon — rather than deleting the character and leaving limp Dutch. En dashes (`–`) in date and number ranges are correct Dutch typography and stay.
   This binds the **product**, not developer prose. Code comments, commit messages, ADR analysis, backlog entries and worklogs are English text written for whoever reads the code later, and normal English typography applies there. The test is whether a reader outside the team can ever see the character.
6. **Answer the project owner in Dutch.** Every reply, summary, status update and question addressed to the owner is in Dutch, whatever language the question arrived in. This governs **communication only**: clauses 1–3 above are unchanged, and repo artefacts (commit messages, ADRs, backlog, worklogs, code comments) stay English, because switching language halfway through an archive makes it less readable, not more. Operational detail in [`CLAUDE.md`](CLAUDE.md).
   **One exception:** the **tickets** in `backlog/functionele-backlog/` and `backlog/technische-backlog/`, and the guide that explains them (`backlog/TICKETS.md` and the README in each of the two folders), are written in **Dutch**, because their readers are the functional architect and the owner ([ADR-0033](docs/adr/0033-ticketbacklog-en-kanbanbord.md)). The epic backlog, commit messages (including those about tickets), ADRs and worklogs stay English. The team tooling that serves the tickets (`tools/backlog-board/`) keeps its identifiers, commands and options in English (clause 2). Its messages and its board are Dutch for the same readers, and as tooling outside the product they are not bound by the `nl.json` catalogue (clause 3, Art. X.3). The three skills that carry the ticket flow keep Dutch names (`ticket-aanmaken`, `ticket-uitvoeren`, `ticket-testen`), as `app-starten` does, because the functional architect invokes them by name.

---

## Article III — Curriculum Data Integrity & Professional Autonomy (non-negotiable)

> **The legal dividing line (the reason this product exists as it does).** The government decrees **only** the *minimumdoelen*, the *leerinhouden*, and that schools build knowledge systematically toward a *leerlijn* (kennisrijk curriculum). The government does **not** prescribe which **thema's** or **subthema's** a school uses, nor how it organises them — that is the school's **professionele autonomie**, and the inspectorate does **not** test the thema layer. Coverage is therefore proven at **minimumdoel level**, never at thema level.
>
> This is the architectural justification for the two-sided model: **Op.stap goals are read-only because they are decreed; thema's/subthema's/activiteiten are fully editable because they are autonomous school content.**

1. **Imported Op.stap goals are read-only reference data.** The official content of a `Leerplandoel` / `Minimumdoel` is **never** mutated by the application or its users.
2. Teachers may add **internal labels and ordering only** — never alter official text, code, doelsoort, jaar/fase, domein structure, or concordantie.
3. Op.stap is **still rolling out**; columns may change. The **Op.stap Excel → model mapping lives in exactly one place** in the code (see [Article VII](#article-vii--opstap-taxonomy--excel--model-mapping)).
4. When Op.stap is re-imported (updated), existing **jaarplannen are not silently overwritten**; the tool flags what must be reviewed (FR-2.5).
5. Each `Leerplandoel` carries a **unique code**. Codes are the stable identity for matching, coverage, and re-import.

---

## Article IV — AI Is Advisory (human-in-the-loop)

1. **The AI proposes; the human decides.** Nothing is "final" without teacher confirmation. "Teacher" here means the person who holds the right to decide that output under [Art. VI.1](#article-vi--roles-privacy--security): for a generated plan, a leerkracht of the klas, or directie; for a thema's **doelsuggesties**, directie or themabeheer, who need not teach any klas that plans the thema ([ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) R14); for an AI **rewrite** of a text in an ontwikkelingsrapport, a leerkracht of the klas during its schooljaar, or directie ([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) §3.5); for a word the AI proposes in a **woordweb**, the web's owner, or directie ([ADR-0043](docs/adr/0043-eigen-woordweb-per-subthema.md)); for a **subdoelplaatsing**, a proposal to place a leerplandoel as subdoel in an existing or a new subthema, a hoofdleerkracht of that subthema's jaarfase, or directie ([ADR-0050](docs/adr/0050-ai-plaatst-leerplandoelen-in-subthemas.md)); for an **activiteitvoorstel**, an activiteit the AI proposes under a subthema, the person who asked for it, who must be allowed to create an own activiteit there ([ADR-0052](docs/adr/0052-ai-stelt-activiteiten-voor.md)). A human decides, and nothing is applied without that decision.
2. Every AI output (goal match, generated plan) must be **reviewable and accept/reject/adjustable**, and its **status must be persisted** (`voorgesteld` / `aanvaard` / `geweigerd` / `manueel`).
   For the AI **rewrite** of an ontwikkelingsrapport text, a third kind of AI output, the proposed text is never stored, so a proposal nobody has decided on yet is not persisted as `voorgesteld`; that is session design and a default, not ADR-0035 R23's answer. What R23 ruled is that every decision is persisted: `aanvaard` (saved unchanged), `manueel` (typed, or edited before saving), and `geweigerd` as a status without the proposed text.
3. **Every suggestion carries a short motivation** ("waarom past dit doel hier?") surfaced in the UI (FR-4.2, Art. 7 of the FA). *Except a rewrite (ADR-0035 R24):* the teacher sees the old and the new text side by side, and no motivation is asked for.
4. The AI is **grounded only on the school's own data** (its thema's/activiteiten) and the loaded Op.stap goals — **never** external or unknown sources. A rewrite is grounded on the teacher's own text only: that text is all that goes to the AI (ADR-0035 R21), with the names of the klas's children replaced before the call (Art. VI.7). *Except a woordweb ([ADR-0043](docs/adr/0043-eigen-woordweb-per-subthema.md) W6):* there the AI proposes words from its own knowledge of the language. What it is sent is still only the school's own data (the subthema with its onderzoeksvragen, its thema, and the words already in that web), and what it returns is a word with a motivation, never a goal, a code or a fact about the curriculum. *Except the name and onderzoeksvraag of a thema or subthema the AI proposes ([ADR-0050](docs/adr/0050-ai-plaatst-leerplandoelen-in-subthemas.md)):* it may make those up from its own knowledge. Every goal it places is still one of the loaded Op.stap goals it was sent, it is sent only the school's own data and those goals, and nothing it proposes is stored as final until a person decides it (IV.1). *Except an activiteit the AI proposes under a subthema ([ADR-0052](docs/adr/0052-ai-stelt-activiteiten-voor.md)):* it may make up the activiteit's name, soort, expected outcomes and length from its own knowledge of kleuteronderwijs. It is sent only the school's own data (the subthema with its onderzoeksvragen, its decided subdoelen and the names of the activiteiten already there, and its thema), every goal it links is one of that subthema's subdoelen, it writes no lesson material (Art. I.2), and nothing it proposes becomes an activiteit until the person who asked accepts it.
5. AI calls **always request structured JSON** (goal codes + one-line motivation; or planningsblok→thema's for plan generation; or one rewritten text; or woordweb words, each with a one-line motivation; or subdoelplaatsingen, each goal code with an existing or a new subthema and a one-line motivation, and each new subthema with a name, an onderzoeksvraag and a length; or activiteitvoorstellen, each with a name, an optional soort, its expected outcomes, a length in lesuren, the subdoel codes it works on and a one-line motivation) and the response is **validated before use**.
6. The matching / plan logic must be **testable with a faked AI client** — the client is injected behind an interface.
7. **Final responsibility for correct coverage lies with the teacher and directie.** The tool supports, it does not replace, pedagogical judgement.
8. **AI fits the school's goal-first authoring method**, not the reverse. The school builds a kennisrijk thema in ~10 steps (thema → themadoelen → subthema's → subdoelen → rijk aanbod). The **thema-opbouw wizard scaffolding these steps is a committed MVP feature** (not optional — see FA Bijlage A.7), with AI assist at **themadoel selection** (step 2) and **subdoel selection** (step 6, the matching of FR-4). On the thema page, once a thema has minimumdoelen as themadoelen, the AI may also propose where their leerplandoelen go: into an existing subthema of that leeftijd or into a new one (steps 4 to 6, [ADR-0050](docs/adr/0050-ai-plaatst-leerplandoelen-in-subthemas.md)); it works only from the themadoelen a person chose, so it does not run ahead of her. AI never skips ahead of the teacher in this flow. The wizard's user is a themabeheer holder, or directie ([ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) R29, R32), so "the teacher" in this clause is that person. The **brainstorm** (step 3) is a teacher's own **woordweb** on a subthema ([ADR-0043](docs/adr/0043-eigen-woordweb-per-subthema.md)); whether the wizard shows it too is E6-05's. The AI proposes words there only once the web holds a word of the teacher's own, so it does not run ahead of her either, and "the teacher" is the web's owner.

---

## Article V — Coverage Must Be Provable (Dekking)

1. **Dekking is computed, never stored**, per klas, in **two steps that are both shown**: the **dekkingsprognose**, what the school's thema's and subthema's aim at, and the **dekking**, what the klas's agenda holds. Only a decided link (status `aanvaard` or `manueel`) counts ([ADR-0047](docs/adr/0047-dekkingsprognose-en-dekking.md)).
   - A `Minimumdoel` is in the *dekkingsprognose* when it is a themadoel of at least one thema, and *gedekt* when such a thema is placed (`aanvaard` or `manueel`) in the klas's plan. **It counts only through a thema it is itself linked to**, never through a concorded leerplandoel.
   - A `Leerplandoel` of the klas's jaar/fase is in the *dekkingsprognose* when it is a subdoel of, or linked to a shared activiteit of, a subthema at the klas's leeftijd, or an accepted doelsuggestie of a thema. It is *gedekt* when that **subthema is placed in the klas's agenda** (placing only the thema above it is not enough), or when it is an accepted doelsuggestie of a thema placed in the plan.
   - A `Leerplandoel` linked to an **own activiteit** ([ADR-0049](docs/adr/0049-eigen-activiteit-van-de-leerkracht.md)) never counts through its subthema. It is in the *dekkingsprognose* of a klas at the activiteit's leeftijd that its owner teaches, and of a klas whose agenda holds the activiteit. It is *gedekt* when the **activiteit itself is planned in the klas's agenda** (at least one placement). The evidence names the activiteit as an own activiteit.
   - The leerplandoelen a minimumdoel brings along to a thema do not count, and neither does a themadoel that links a leerplandoel.
   - A klas is measured against the minimumdoelen of its **mijlpaal**: `K-` for a kleuterklas, `4-` for L1 to L4, `6-` for L5 and L6.
   - A `Leerplandoel` is also *gedekt* when it is linked (status `aanvaard` or `manueel`) to an **algemene fiche** of the klas that is **planned in that class's agenda** (at least one placement) *(owner ruling 2026-09-11, [ADR-0029](docs/adr/0029-algemene-fiches.md))*. The evidence names the fiche as a fiche, never as a thema. *Directie's confirmation is outstanding*; a reversal drops this route from the computation, the payload's `DekkendeFiches` and the export together.
2. Coverage is shown at **both levels**: leerplandoel and **minimumdoel**, because the minimumdoel level is what the **onderwijsinspectie** tests (FR-9.3).
3. Coverage must be **filterable by doelsoort** (e.g. only minimumdoelen) and must list the **missing goals** (gap-analyse).
4. The coverage overview is **exportable as proof of coverage** (FR-9.5, FR-11).
5. The directie can pull **school-wide and per-class** overviews from the beheerpagina (FR-9.4, FR-12).
6. **The Op.stap import (the API mapping and its HTML-to-text conversion, and the Excel parser while it exists) and the coverage calculation are the highest-risk logic in the system and must be covered by tests well.**

---

## Article VI — Roles, Privacy & Security

1. **Rights, recorded in the app** *(owner rulings of 2026-09-11, 2026-09-13 and 2026-09-14, [ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) §1)*. Only a **gebruiker** that directie has added can log in, over the school's own Entra tenant. Microsoft Entra ID is the identity provider, and auth remains wrapped/swappable ([ADR-0011](docs/adr/0011-authn-authz-rbac-gdpr.md)). Which rights each gebruiker holds is recorded **in the app**, not in Entra. There are five rights, and one person may hold several.
   - **Directie** sees and edits everything. It adds gebruikers, links leerkrachten to klassen, appoints hoofdleerkrachten and gives themabeheer, which is what FA FR-12.2 has the beheerder do, and the beheerder is now the directie right. Directie may give the directie right to someone else. **There is no separate ICT-coördinator role:** an ICT-coördinator who runs the beheer holds the directie right because directie gave it, and is otherwise an ordinary leerkracht.
   - **Themabeheer** is held by a few named leerkrachten or zorgcoördinatoren. It edits thema's with their themadoelen and kernwoordenschat, and runs the FR-1 import of thema's and activiteiten, **including the goal links that import writes on themadoelen and subdoelen**. Only directie may switch on the import's option to delete human decisions (`MenselijkeBeslissingenVerwijderen`), the one switch by which a re-import removes decided themadoelen and subdoelen that the file no longer carries. Themabeheer works the thema-opbouw wizard through all its steps. For a thema it builds there from scratch, and only through the wizard's own write actions, it also creates that thema's subthema's, subdoelen and activiteiten, at any leeftijd; changing existing subthema's stays with the hoofdleerkracht. Beside directie, it is the only right that has **doelsuggesties** generated, and the only one that accepts, rejects or adjusts them.
   - **Hoofdleerkracht** is a gebruiker appointed per `(Schooljaar, jaarfase)`, several allowed. A hoofdleerkracht creates, edits and deletes the subthema's of that jaarfase (deleting one removes the activiteiten and goal links under it, as it does today) and its subdoelen, and has the AI propose **subdoelplaatsingen** for that jaarfase and decides them ([ADR-0050](docs/adr/0050-ai-plaatst-leerplandoelen-in-subthemas.md)). They link goals by hand to the jaarfase's shared activiteiten and unlink them, edit those activiteiten's content, create new ones, and delete any of them, with or without goal links. A hoofdleerkracht edits a thema only when they also hold themabeheer.
   - **Leerkracht** is held through a **klastoewijzing** on one or more klassen. It is many-to-many: a klas may have several leerkrachten, such as a co-teacher or a duobaan. A leerkracht edits the planning of those klassen (jaarplan, (her)generatie, agenda, hoeken, algemene fiches) and can view other klassen. Every leerkracht with a klas at a leeftijd also edits the **content** of the shared activiteiten under the subthema's at that leeftijd, creates **own activiteiten** there (below), and edits those subthema's **streefwoordenschat**. They may delete a shared activiteit **they created themselves**, and only while no goal is linked to it. **By hand, subdoelen, goal links on shared activiteiten, creating a shared activiteit and deleting any other shared activiteit are for directie and that jaarfase's hoofdleerkrachten only**, because a goal link there counts for the dekking of every klas at that leeftijd that plans the thema. The only exceptions are themabeheer's: the FR-1 import, and the wizard for a thema it builds from scratch. The rest of the subthema stays with directie and the hoofdleerkrachten, except what the wizard creates for such a thema.
   - **Leerlingzorg** *([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) R18)* is given by directie to a gebruiker, such as a zorgcoördinator. It reads every ontwikkelingsrapport (VI.7) and does nothing else.

   **An activiteit records its maker**, the gebruiker who created it. For a shared activiteit the maker only decides who may delete it: whoever created it may delete it while no goal is linked to it, whether or not they have a klas at that leeftijd, and also after the schooljaar. Activiteiten that predate this rule, and imported ones, have no maker and are purely shared.

   **An own activiteit is personal content** ([ADR-0049](docs/adr/0049-eigen-activiteit-van-de-leerkracht.md) E1 to E3). A new activiteit a leerkracht creates is her own: it belongs to her, not to her klas, and follows her across schooljaren. The leerkrachten of the same jaarfase read it and may use it, which gives them an own copy with the same content and goals; they do not edit the original. Its owner links its goals, and they count for the dekking of a klas once it is planned in that klas's agenda (V.1). The rest are defaults (ADR-0049 D1 to D9):
   - a hoofdleerkracht of that jaarfase and directie still create shared activiteiten, and choose per new activiteit;
   - only a leerkracht with a klas at the leeftijd, or directie, creates or uses an own activiteit;
   - its owner, the leerkrachten and hoofdleerkrachten of its leeftijd, and directie read it;
   - only its owner and directie edit it, link its goals, move it, delete it or plan it;
   - when its owner is removed as a gebruiker, it becomes shared.

   **Which schooljaar counts, for the shared content.** A subthema and its shared content belong to a leeftijd and to no schooljaar (ADR-0025). A hoofdleerkracht appointment, or a klastoewijzing as far as it gives rights on the shared content, therefore counts while its schooljaar has not yet ended, including a schooljaar that has not started, so a hoofdleerkracht can prepare the next year in June. It does not limit the maker's right above.

   **Graadklassen, provisionally, until directie decides the Art. XIV graadklas question.** A klas states one jaarfase, so the leerkrachten of a graadklas get the leeftijd rights of that jaarfase only, and a hoofdleerkracht or directie edits the other leeftijd's shared content. **The mapping from a klas to the leeftijden it grants rights for lives in one place in code**, so that directie's graadklas decision changes that place and nothing else (Art. XIV: an open decision sits behind a seam).

   **A gebruiker who holds none of the five rights**, such as a zorgcoördinator without themabeheer or Leerlingzorg, or an ICT-coördinator without the directie right and without a klas, can log in (only gebruikers directie added can) but reads no klas's planning (below). By default they can do nothing else ((e) below), apart from deleting an activiteit they created themselves (R33) and keeping a woordweb of their own (below). They create no own activiteit (ADR-0049 D2), and whether they may add personal subdoelen is E6-10's.

   **Who reads which klas's planning** (its jaarplan, agenda and dekking, and their export; [ADR-0040](docs/adr/0040-klassen-inkijken-per-jaarfase.md) Z1 to Z5). A leerkracht reads her own klassen and the klassen of her own jaarfase, of both jaarfasen when she teaches in two; a hoofdleerkracht reads the klassen of the jaarfase she is appointed for; themabeheer and directie read every klas; anyone else reads none. Her jaarfase is that of a klas she teaches, or of her appointment, while its schooljaar has not ended (default Z7 below); the klas read may be of any schooljaar (default Z6 below), and its jaarfase comes from the one klas→leeftijden mapping above. Reading is not editing: only the klas's leerkrachten and directie edit its planning. One matrix row decides it, behind the E6-09 seam, so directie's answer on visibility (Art. XIV) changes that row only.

   **"Configurable" means two things, and only one of them is data.** *Who* holds which right is data, maintained by directie. *What* each right allows is one matrix, [ADR-0030 §3](docs/adr/0030-rollen-en-rechten-in-de-app.md#3-the-matrix-that-follows), which **supersedes the table in FA §3.2**. Changing a row there is a code change. The matrix is enforced server-side, as named policies declared in one place ([ADR-0011](docs/adr/0011-authn-authz-rbac-gdpr.md) §2). The ontwikkelingsrapport's rows are in it too ([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) §3.3), with Leerlingzorg as one more relation, and **the reading rule above does not reach them**: only the klas's leerkrachten, directie and Leerlingzorg read a child's report (ADR-0035 R17). One of those rows is the only place where directie has no ✓: only the K3 leerkrachten edit the K3 set of rapportdoelen and the scale, and directie views them (ADR-0035 R31).

   **A row of that matrix is ratified by this article only as far as the rulings (R-items) it cites.** Citations count at column level too: every ✓ for directie rests on the ruling that directie sees and edits everything, and a "–" grants nothing. Whatever a row takes from an I-item of ADR-0030 §2, or from a lettered question of ADR-0030 §4, is a default and is **not** ratified here. The same holds for every item in the list of defaults below. *Directie's confirmation is outstanding* on visibility (Art. XIV, question 4 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)), graadklassen (question 14) and the role model as a whole (question 13).

   **A woordweb is personal content** ([ADR-0043](docs/adr/0043-eigen-woordweb-per-subthema.md) W2, W4). Every gebruiker may keep one woordweb of her own per subthema (default D2), and it follows her across schooljaren. Every signed-in gebruiker reads the words that stand in every woordweb (default D7); only its owner edits it, and directie (default D3). It never counts for dekking.

   *Ruled, but not yet shaped:* a leerkracht may also add subdoelen **for themselves** (2026-09-11). Whom that content belongs to, and who sees it, is still open. This article gains it with E6-10 (ADR-0030 §5, part 2). For activiteiten, ADR-0049 shaped it (above).

   *Defaults and open questions, not rulings* (ADR-0030 §2 and §4, ADR-0040). Each is kept until the owner decides, or directie for visibility:
   - **I1:** no consensus, approval or vote among the leerkrachten of a jaar is enforced.
   - **I2:** statement 8's missing verb is read as "designates". Who gives themabeheer does not hang on it: directie does, as FR-12.2 has the beheerder grant rights.
   - **I6 and (a):** the shared layer of activiteiten and subdoelen stays next to personal content; whose personal content is, and who sees it, is open for subdoelen (E6-10). ADR-0043 answers it for the woordweb, and ADR-0049 for activiteiten (above).
   - **ADR-0043 D2 to D5 and D7:** every signed-in gebruiker may keep a woordweb on any subthema; directie edits every woordweb; deleting a subthema or a gebruiker deletes the woordwebs with it, except that the wizard's own subthema delete counts a woordweb as content its run did not create (I25); for I26, a woordweb under a thema counts as someone else's content, whoever made it; every signed-in gebruiker reads the standing words of every woordweb, and another person's open proposals and rejected words stay hers.
   - **Z6 and (d):** the reading rule holds in every schooljaar, so a leerkracht of K3 reads the K3 klassen of earlier and later schooljaren too. Whether directie confirms the rule itself is (d) (Art. XIV "Teacher visibility").
   - **Z7:** a leerkracht's or hoofdleerkracht's own jaarfase counts for reading while the schooljaar of her klas or appointment has not ended, as R20 has it for the shared content; after it she reads her own klas (I21) and no other klas of that jaarfase until she has a klas or appointment in a running or coming schooljaar.
   - **I12:** a klas with no stated jaarfase gives its leerkrachten no leeftijd right.
   - **I13:** re-scoping a subthema to another leeftijd needs the hoofdleerkracht right at both leeftijden, or directie.
   - **I15:** the activiteit fields the owner's answer did not name (type, onderzoeksvraag, kleur, lengte) are content too.
   - **I16:** the subthema fields other than streefwoordenschat (naam, duur, probleemstelling, onderzoeksvragen) follow the subthema itself: directie and the hoofdleerkrachten.
   - **I17:** when a maker is removed as a gebruiker, their activiteiten become purely shared.
   - **I18** (the maker assignment only; its delete right is R33): an activiteit the wizard creates has the themabeheer holder as its maker.
   - **I19:** moving an activiteit to another thema is neither deleting nor unlinking it, because it keeps its goal links (Art. IX.2). Those links then count for the klassen that plan the other thema, so moving one with goal links needs the goal-link right; one without links, every leerkracht of that leeftijd may move.
   - **I20:** a hoofdleerkracht needs no klastoewijzing; the appointment alone gives the right.
   - **I21:** a klastoewijzing gives rights on that klas's planning with no end date, because the klas already belongs to one schooljaar.
   - **I22:** the server tells a wizard write from a hand write through wizard-only write actions, which admit themabeheer and directie, and only for a new thema. Themabeheer gets no right on the ordinary subthema, subdoel and activiteit routes, apart from the maker's delete right (R33).
   - **I23:** a thema counts as new, for the wizard, from the moment the wizard creates it until that wizard run is finished or closed.
   - **I24:** a wizard run ends when themabeheer or directie finishes or closes it, or 14 days after the wizard's last write action in it, whichever comes first. From then on its thema is no longer new (I23) and the ordinary rights apply.
   - **I25:** while its run is open, the wizard's own write actions may also edit and delete a subthema, subdoel or activiteit that the same run created, and nothing else.
   - **I26:** a themabeheer holder deletes a thema only when it holds no subthema, subdoel or activiteit other than what its own open wizard run created, an activiteit of that run carrying a goal link not counting as the run's (I27); any other thema only directie deletes. A thema placed in a jaarplan is deleted by nobody, as before.
   - **I27:** the wizard's own write actions do not delete an activiteit that carries a goal link, or a subthema whose activiteiten carry one, unless the caller also holds the goal-link right at that leeftijd; and they do not change the leeftijd of a subthema the run created while it holds a subdoel or activiteit the run did not create. An activiteit of the run that carries a goal link counts, here and in I26, as one the run did not create, unless the caller also holds the goal-link right at its leeftijd. When the wizard changes a subthema's leeftijd, that right is needed at both the old and the new leeftijd. This narrows I25.
   - **I28:** only the wizard's own write actions keep a run open (I24); editing the thema or its themadoelen through the ordinary routes does not.
   - **(c):** in a jaarfase with no hoofdleerkracht, only directie does, by hand, what the hoofdleerkracht would: its subthema's, subdoelen, goal links, and the deletions only a hoofdleerkracht may make.
   - **(e):** a zorgcoördinator, or any gebruiker holding none of the five rights, may do nothing beyond themabeheer and Leerlingzorg, if given, apart from the maker's delete right (R33) and keeping a woordweb of their own (ADR-0043 D2); without a right they read no klas's planning (above).
2. **No pupil personal data in the MVP** (GDPR/AVG), **except the ontwikkelingsrapport under VI.7**. Staff accounts only: no pupil ever logs in.
3. **Host in an EU region.** AI processing happens in an EU, GDPR-compliant environment (Azure AI Foundry, EU data zone), except on a deployment that picks the Anthropic Claude API (Art. VIII, [ADR-0048](docs/adr/0048-claude-api-als-tweede-ai-provider.md)), whose processing location is not held to the EU.
4. **No secrets in the repo.** .NET user-secrets locally, Azure Key Vault in the cloud. **AI keys are server-side only — never exposed to the frontend.**
   *Narrow exception:* credentials for a **throw-away local or CI test database** may live in the repo — `docker-compose.yml`, `.github/workflows/ci.yml`, dev-setup docs, story worklogs — because they authenticate a `127.0.0.1` or ephemeral-runner role that guards nothing reachable and holds no real data. The exception covers **nothing else**: no AI key, no production or staging credential, and no connection string to any database holding school data.
5. Access via personal login; data encrypted in transit and at rest (NFR-5).
6. A processing register and retention periods are provided (NFR-6).
   *For the ontwikkelingsrapport ([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) R19, R20, R27, R28):* the register entry covers its pupil data, the AI processor and a **concrete retention term** that directie records. **The owner ruled that real pupil data may enter before that entry exists, before the parents are informed (AVG art. 13) and before a DPIA (AVG art. 35)**, which evaluations of young children, partly passed through AI, very likely require. If a DPIA is required, as is very likely, processing before it does not meet art. 35(1). Informing the parents is owed when the data are collected (art. 13(1)), or within a month if art. 14 applies. The ruling accepts that risk; it does not defer the obligation. The school, as verwerkingsverantwoordelijke, carries it, and directie is asked (question 15 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)).
7. **The ontwikkelingsrapport (K3 only)** *([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) §1; entities in Art. IX.4)* is the one place pupil data lives.
   - **What is stored:** a leerling's voornaam and achternaam, typed by hand (R14, R15), and per evaluatiemoment a gradatie and a text per rapportdoel, an algemeen besluit and at most one kindtekening (R8 to R10). There is no other field about a child. The texts are free text, though, and can carry whatever a teacher writes, including care or health information (AVG art. 9); question 15 names it for the DPIA. Only a klas that grants K3 has leerlingen, through the one klas→leeftijden mapping of VI.1 (default D9).
   - **Who:**
     - the klas's leerkrachten fill it in during its schooljaar, and afterwards only read it (R16, R26) and download it (default);
     - directie does everything;
     - **Leerlingzorg** reads it (R18);
     - every K3 leerkracht edits the one K3 set of rapportdoelen and the one scale (R4 to R6). Directie does not edit them, but can view them (R31). That is the one exception to *directie sees and edits everything* (VI.1).

     Nobody else reads a report, whatever the reading rule of VI.1 grants for plans (R17).
   - **AI:** a rewrite of a text or of the besluit (R21, R22) sends only the teacher's text (R21), with the names of every child of the klas replaced (R25). Putting them back after the call is a default. The filter is best-effort, and the teacher is told so (R25). Pseudonymised text is still personal data.
   - **Kindtekening:** re-encoded on upload, so no metadata survives, and served only through an authorised route (defaults, ADR-0035 §3.6).
   - **Logs** carry no pupil content, and **the repository** never holds a real child's name. Both follow from VI.2: pupil content in a log, a test, seed data, a screenshot, a worklog or a ticket is pupil data outside the ontwikkelingsrapport. How the build keeps its logs clean is a default (ADR-0035 §3.8).
   - **Deletion:** kept until directie wipes a schooljaar (R19), and the beheerpagina shows which schooljaren still hold pupil data and reminds directie of them (R28). A leerling can be deleted with their reports at any time (default D8).
   - **Export:** PDF and Word (R13), made on demand and never stored (default). Per rapportdoel the parent sees the title, the star with its label, and the text (R11).
   - **It never counts for dekking** (Art. V is unchanged).

   **This clause is ratified only as far as the rulings (the R-items of ADR-0035) it cites.** Everything else in ADR-0035 §2 and §3 is the recording session's design, D1 to D5 and D7 to D16 included (D6 was replaced by R26): for example which subdoelen may be bundled, the signed rewrite proposals, the licence rule and where images are stored. It is a default, followed by the build until the owner changes it, and it is **not** ratified here. *Directie has not confirmed the rulings* (question 15).

---

## Article VII — Op.stap Taxonomy & Excel → Model Mapping

### VII.0 Two distinct structures (do not conflate)

Op.stap exposes **two related but different artifacts**, and the model must keep them apart:

1. **Ordeningskader** — the official browse/grouping taxonomy, exactly three levels: **`Discipline → Domein → Subdomein`**. There is **no `cluster` and no `leergebied`** at this level.
2. **Per-discipline goal Excel** (one file per discipline) — the rows of *leerplandoelen*, which additionally carry `cluster` (**optional/nullable**), `code`, `jaarFase`, `voorbeelden`, `toelichting`, `woordenschat`, and the `minimumdoelRef` concordance.

Rules that follow:
- **`cluster` is nullable** and belongs to the goal Excel, not the ordeningskader. Coverage roll-ups and filters must not assume it is present.
- **`subdomein` names are not globally unique** (e.g. Muzische vorming repeats *Repertorium / Bouwstenen / Vaardigheden en vormgevingsmiddelen* under Muziek/Beeld/Drama/Dans/Media). The grouping key is the composite **`(domein, subdomein)`**. The unique row identity remains the leerplandoel **`code`**.
- **Disciplines are numbered and partly nested.** A `Discipline` carries a **string `nummer`** (e.g. `"1"`, `"9.2"`) and an optional `parentDiscipline`. Authoritative list: 1 Nederlands en communicatie · 2 Wiskunde · 3 Wetenschap en techniek · 4 Aardrijkskunde · 5 Geschiedenis · 6 Muzische vorming · 7 Lichamelijke opvoeding en motoriek · 8 ICT · 9.1 Veilige en gezonde levensstijl · 9.2 Leren leren · 9.3 Sociaal en emotioneel leren · 10 Frans · 11 Rooms-katholieke godsdienst.
- **`leergebied` / `Wereldoriëntatie`** is the teachers' grouping vocabulary, *not* an Op.stap ordeningskader level. If surfaced in the UI it is a presentation-layer mapping over disciplines (open decision; see Art. XIV) — never a source of truth. *Not to be confused with the **leergebied of the decree**: the first level of a minimumdoel's own ordering (Art. IX.1), which is stored, read-only, and orders the minimumdoelen register only. It groups minimumdoelen, not disciplines, and it does not answer the open decision on this bullet.*

### VII.1 Excel → model column mapping

One Excel file per discipline. Hidden columns may be empty. **This mapping is kept in one place in code** (Art. III.3).

| Col | Op.stap | Maps to |
|-----|---------|---------|
| A | Doelsoort | `doelsoort` — enum: MD (minimumdoel), G (gemeenschappelijk), + (verdieping), P (precurriculum, illustratief), S (specifiek, illustratief), A (anderstalige nieuwkomers, illustratief) |
| B | LfMD | minimumdoel leeftijd (K- = einde 3e kleuter, 4- = 4e lj, 6- = 6e lj) |
| C | nrMD | minimumdoel nummer (decreet) |
| D | MD | B+C combined = concordance key → `minimumdoelRef` |
| E | Code | `code` (unique per leerplandoel) |
| F | Jaar/fase | `jaarFase` — JK, K2, K3, L1–L6 (or fase for P/S) |
| G | Domein | `domein` |
| H | Subdomein | `subdomein` |
| I | Cluster | `cluster` (optional) |
| J | Leerplandoel | `tekst` |
| K | Voorbeelden | `voorbeelden` (illustratief) |
| L | Toelichting | `toelichting` |
| M | Woordenschat | `woordenschat` (richtinggevend) |

> Doelsoort colours (UI convention): MD blue, G neutral, + green, P/S pink, A yellow.

### VII.2 Source: KOV's Op.stap API (ratified 2026-09-11, [ADR-0032](docs/adr/0032-opstap-api-als-importbron.md))

The Op.stap goals are imported from **KOV's Op.stap API**, read by the backend only. The Excel mapping of VII.1 describes the older per-discipline route. It is no longer the documented source, and it stays available **only until the first API import of the leerplandoelen** (a snapshot applied): once one has been applied, it refuses every file (owner ruling 2026-09-13, [ADR-0032](docs/adr/0032-opstap-api-als-importbron.md) decision 8, amended), because in a discipline that import covered a file read after it would overwrite the API's wording, clear its concordance and flag every API goal the file lacks. *The cost, ratified with it:* goals the Excel route loaded outside goal set G (P, S, +, A) stay as the file wrote them and can no longer be refreshed by any route; a removal by KOV is still flagged through the API path, a changed wording is not. The database remains the runtime truth: no screen and no dekkingscijfer ever waits on KOV. *Directie has not confirmed the API source or the Excel refusal* (question 1 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)).

- **Minimumdoelen** (`GET /agodi/onderwijsdoelen/opstap`): `ref` = `uniqueCode` verbatim (`K-1.3.9`), `leeftijd` = its prefix (`K-` / `4-` / `6-`), `nr` = `code`, `omschrijving` = the doelzin followed by the uitbreiding, as plain text that may not change what the decree says. **The decree's own ordering and kind travel with it**: `leergebied`, `rubriek` and `subrubriek` = `path` split on ` > ` (two or three levels, verbatim; any other shape leaves all three empty), and `soort` = `type` (*te bereiken op individueel niveau*, *te bereiken op populatieniveau* or *na te streven op populatieniveau*; any other value leaves it empty). An unusable `path` or `type` never costs the row: the eindterm is imported without them. **Every** decreed minimumdoel is imported, whatever the goal-set scope below, because the decree applies in full. *(That last sentence is the implementer's reading, ADR-0032 decision 3; the owner's ruling did not address it and has not confirmed it.)*
- **Leerplandoelen** (`…/snapshots/{versie}/krcItems`, E1-21): **only goal set G for now** (owner ruling 2026-09-11; P, S, +, A, Z and V are skipped), mapped to `Doelsoort.Gemeenschappelijk`, with the concordance in `minimumdoelRef`. With every discipline imported, six minimumdoelen then have no concorded G goal (ADR-0032 decision 5); a narrower discipline selection (Art. XIV "Disciplines first", still open) leaves more. *Implementer's default, not part of the ruling:* a coverage view names any minimumdoel with no loaded concorded leerplandoel as such, rather than counting it as a gap the teachers left.
- The mapping for each endpoint lives in **one place in code** (Art. III.3), as VII.1's does.

---

## Article VIII — Tech Stack & Architecture (binding choices)

> The functional analysis lists framework choices as *indicative*. For the **build**, these are fixed (CLAUDE.md). Changing them requires an amendment.

- **Frontend:** React 18 + TypeScript + Vite. Tailwind CSS, with **Radix UI + shadcn/ui** (copied into the repo) as the accessible component layer and design tokens — see [ADR-0017](docs/adr/0017-ui-ux-design-system.md). Drag-and-drop `@dnd-kit/core`. Server state TanStack Query. Local UI state Zustand. **UI/UX target: WCAG 2.2 AA**; approach in [`docs/ux/ui-ux-approach.md`](docs/ux/ui-ux-approach.md).
- **Backend:** ASP.NET Core Web API (C#) on the current **.NET LTS**, SDK pinned in `global.json`. EF Core + Npgsql. Excel parsing **ClosedXML** (MIT — **avoid EPPlus**, commercial licence).
- **Database:** PostgreSQL (local via Docker).
- **AI:** Azure AI Foundry (Azure OpenAI) or the Anthropic Claude API, one per deployment, picked by `Ai:Provider` ([ADR-0048](docs/adr/0048-claude-api-als-tweede-ai-provider.md)), **called only from the backend**.
- **Hosting:** Microsoft Azure.
- **Architecture:** SPA over REST/JSON. Backend is pragmatically layered — `Domain` (entities, invariants, Dutch ubiquitous language) ← `Application` (use cases, AI orchestration, mapping) ← `Infrastructure` (EF Core, Excel import, AI clients). `Api` is thin. **This is a small app — favour clarity over ceremony; do not over-engineer.**
- **Anchor screens:** the **kalender + drag-and-drop** and the **dekkingsoverzicht**.

---

## Article IX — Core Data Model (functional)

### IX.1 Curriculum (read-only reference data — Art. III)

- **Discipline** — `nummer` (string, e.g. `"1"`, `"9.2"`), naam, optional `parentDiscipline`. One Op.stap Excel per discipline.
- **Leerplandoel** — code (unique), doelsoort, jaarFase, domein, subdomein, **cluster? (nullable)**, tekst, voorbeelden?, toelichting?, woordenschat?, `minimumdoelRef` (concordance). Belongs to a discipline. **Read-only.** Grouping key `(domein, subdomein)`; identity `code`.
- **Minimumdoel** — ref, leeftijd (K-/4-/6-), nr, omschrijving, and the decree's own ordering `leergebied` › `rubriek` › `subrubriek?` with its `soort`. The decreed eindterm; concorded to leerplandoelen. The ordering and the kind are decreed content like the text, written only by the import and nullable, because a row imported before them has none until the next import. **The decree's leergebied is not a discipline** (Art. VII.0, XII), nor the teachers' leergebied / Wereldoriëntatie: nine of the ten carry a discipline's name, but *Attitudes* is worked out in three disciplines, so the minimumdoelen register is browsed in the decree's ordering and the leerplandoelen register in Op.stap's, and neither is read as the other.

### IX.2 School content (autonomous, fully editable — Art. III)

Scoping is **level-dependent and prescribed by pedagogy** (not a single shared/per-class flag):

- **Thema** *(school-scoped — shared school-wide)* — id, naam, invalshoeken?, `duurWeken` (≈ 4–6), `kernwoordenschat[]`, `rijkeWoordenschat[]`, subthema's[], themadoelen[], `doelsuggesties[]`. Shared through the thema-bibliotheek, and **edited by directie and by those who hold themabeheer** ([Art. VI.1](#article-vi--roles-privacy--security)).
  - **`doelsuggesties[]`** *(ratified — directie decision 2026-07-13)* — the AI's **FR-4 thema↔doel match suggestions** (E2-04), each a `DoelKoppeling` persisted as `voorgesteld` with `aiMotivatie`. Deliberately **distinct from the `themadoelen`**: these are advisory matches awaiting accept/reject (Art. IV), not the curated overarching anchors. **Only directie and themabeheer generate and review them** ([Art. VI.1](#article-vi--roles-privacy--security); owner ruling 2026-09-13), because an accepted suggestion counts for the dekking of every klas that plans the thema. Attaching FR-4 match output at **thema (school-wide) scope** is the ratified MVP granularity; **activiteit- and subdoel-level (class/age) matching is deferred to fast-follow** (backlog E8) and would carry a per-suggestion target in the response contract.
- **Themadoel** *(school-scoped)* — the **overarching goals** that anchor a whole thema and are deliberately the same school-wide, meant to be *verbreed/verdiept/herhaald*; a thema has **no maximum** of them, and at least two is advisory. A themadoel a person adds is a link to a **`Minimumdoel`** ([ADR-0046](docs/adr/0046-themadoelen-zijn-minimumdoelen.md)), because a thema spans several leeftijden and the minimumdoel is the level that spans them. It brings along the leerplandoelen that concord to it, at every leeftijd, read through the concordance and never stored on the link, and it carries no status. A themadoel that links a `Leerplandoel` is written only by the FR-1 import. Distinct from a per-activity goal link.
- **Subthema** *(age-scoped)* — naam, `probleemstelling?`, `onderzoeksvraag?`, `duurWeken` (≈ 2), belongs to a Thema and to a **`leeftijd`**, which holds one of the nine Op.stap jaar/fase codes (JK, K2, K3, L1–L6). **A subthema on K3 holds for every class that teaches K3** ([ADR-0025](docs/adr/0025-subthema-per-leeftijd.md)). *What stays per klas is the planning, not the content:* a `Jaarplan` and its plaatsingen belong to one klas, so two K3 classes share this subthema and still put its activiteiten on different days in a different order. The klas is what a teacher plans **in**; it is not what content belongs **to**.
- **Subdoel** *(age-scoped, with its owning subthema)* — a concrete, **age-differentiated** goal at the `(Subthema × leeftijd)` level, linking to a `Leerplandoel`/`Minimumdoel`; builds up toward the themadoelen. Themes are **interdisciplinary** — subdoelen routinely span multiple disciplines.
- **Activiteit** *(age-scoped, with its owning subthema)* — naam, optional `activiteitType` (enum: experiment, prentenboek, hoek, uitstap, spel, waarneming, beweging, onderzoek, …; none when the teacher chose none, never a default), optional `hoek`, `verwachteUitkomsten?`; can link to one or more leerdoelen. It records its **maker**, the gebruiker who created it, or none for an activiteit that predates the rule or came from the FR-1 import ([ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) R25–R26); for a shared activiteit the maker only decides who may delete it (Art. VI.1). An activiteit is either **shared**, as content of its leeftijd, or an **own activiteit** with an `eigenaar` ([ADR-0049](docs/adr/0049-eigen-activiteit-van-de-leerkracht.md)). An own activiteit is personal content of that gebruiker. It still hangs under a subthema of one leeftijd and follows her across schooljaren. Her jaarfase colleagues read it and may copy it, and it counts for dekking only where it is planned (Art. V.1, VI.1). It becomes shared when its owner is removed.
  **An activiteit may be moved to another `Thema`, and only to a subthema at the same `leeftijd`** *(owner ruling, 2026-08-30)*. It keeps its identity, its attributes and every `DoelKoppeling` on the way, which is what makes the move different in kind from deleting it and retyping it. The rule is a **domain invariant of that verb**, enforced in the aggregate rather than in a service, so every caller of the verb meets the same refusal a teacher does; the destination list `GET /api/subthemas/voor-klas/{klasId}` narrows the **offer** to the ages a class teaches and is not the guard.
  **It binds the verb and not the system.** `PUT /api/subthemas/{subthemaId}` re-points a subthema's own `leeftijd` (`Subthema.WijzigScope`), and its subdoelen and activiteiten inherit that scope structurally, so **one unguarded request changes the leeftijd of every activiteit inside it** — the outcome the move verb refuses, reached wholesale instead of one at a time. That route is **on a screen**: `Subthemaformulier` serves create and edit from one form and renders the leeftijd select with the stored value. Whether that re-scope is a mistake to refuse or a correction to disclose is **[E1-19](backlog/E1-curriculum-content.md)** and is **not decided**. *Directie's confirmation of the move rule is outstanding — question 11 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md).*
- **Subdoelvoorstel / Subthemavoorstel** *(age-scoped, on a thema, [ADR-0050](docs/adr/0050-ai-plaatst-leerplandoelen-in-subthemas.md))* — the AI's proposals to place an open leerplandoel of the thema's themadoelen at one leeftijd: in an existing subthema of that leeftijd (a `Subdoelvoorstel` naming it), or in a new one (a `Subthemavoorstel` with naam, `onderzoeksvraag`, `duurWeken`, holding its `Subdoelvoorstel`s). Each has a `status` (voorgesteld / aanvaard / geweigerd / manueel) and an `aiMotivatie`. Accepting one writes an ordinary subdoel, or an ordinary subthema with its subdoelen; until then it counts for nothing (Art. V.1). It goes with its thema, and a `Subdoelvoorstel` with the subthema it names.
- **Activiteitvoorstel** *(personal: of the gebruiker who asked, under one subthema, [ADR-0052](docs/adr/0052-ai-stelt-activiteiten-voor.md))* — an activiteit the AI proposes: naam, `activiteitType?`, `verwachteUitkomsten`, `lengteInLesuren`, the subdoel codes it works on, an optional onderzoeksvraag of the subthema, a `status` (voorgesteld / aanvaard / geweigerd / manueel) and an `aiMotivatie`. Only its asker sees and decides it. Accepting it, changed or not, creates an ordinary **own activiteit** of the asker (ADR-0049) whose goal links are `aanvaard`; until then it counts for nothing (Art. V.1). It goes with its subthema and with its asker.
- **Woordweb** *(personal: one per gebruiker and subthema, [ADR-0043](docs/adr/0043-eigen-woordweb-per-subthema.md))* — the brainstorm of step 3 (Art. IV.8): loose words around the subthema, each with a `status` (voorgesteld / aanvaard / geweigerd / manueel) and, for a word the AI proposed, an `aiMotivatie`. It belongs to its owner and follows her across schooljaren; it is not the leeftijd's shared content, and it goes when its subthema or its owner goes. It never counts for dekking (Art. V.1).
- **AlgemeneFiche** *(klas-scoped)* — a recurring activity of one class that belongs to **no thema** (the onthaal, turnen every Monday): naam, `omschrijving?`, and goal links that are always `manueel` ([ADR-0029](docs/adr/0029-algemene-fiches.md)). Scoped by the klas rather than by a leeftijd, because which hour a class has the gym is a fact about that class's week. It is planned as an `AlgemeneFicheplaatsing` (a window, and one occurrence per teaching day on the chosen weekdays, with clock times) that sits **outside the `Jaarplan` aggregate**, so a (re)generation cannot reach it; once planned, its goal links count for dekking (Art. V.1).
- **DoelKoppeling** (the link entity, formerly "ThemaDoel") — any link School-content↔Leerplandoel with `status` (voorgesteld / aanvaard / geweigerd / manueel) and `aiMotivatie`. Used for the themadoelen the FR-1 import writes, subdoelen, activity links, algemene fiches, and thema-level FR-4 match `doelsuggesties` (E2-04) alike.

### IX.3 Planning & coverage

- **Schooljaar** — contains multiple klassen; carries the vakantie-/periodestructuur.
- **Klas** — id, naam (e.g. "L3 derde leerjaar"), a **required `jaarfase`** (one of the nine Op.stap codes), and a `leerjaar` **derived** from it; has one `Jaarplan` ([ADR-0025](docs/adr/0025-subthema-per-leeftijd.md)). A class states **one** thing about its level rather than two that can disagree, and the jaar/fase is what couples it to the subthema's it holds. A row that predates the rule can still have none; that is a called-out state on the beheerscherm, and the leerjaar ordinal remains its fallback.
- **Jaarplan** — klasId; per **planningsblok** a list of thema's, with a `vergrendeld` flag per thema. **A (re)generation may discard only a placement that is `Voorgesteld` and not `vergrendeld`** (owner ruling 2026-08-19, FR-7.3's *"ter beslissing"* clause). A placement the teacher has decided on (`Aanvaard`, `Geweigerd` or `Manueel`) survives **without** a lock, and survives a single-period run on the same terms: the per-period path narrows *which blocks* are visited, never *what is replaceable*. The `vergrendeld` flag therefore only ever changes an outcome for a `Voorgesteld` placement; on a decided one it changes no run outcome, though the "Vast" badge still renders. **Whether the UI offers the lock control there is E4-06's decision and is *not* ratified here.** Do not paraphrase the predicate as "untouched": a drag ending in the period it started in writes nothing, so a placement the teacher did touch stays `Voorgesteld` and is discarded. Planningsblok granularity is **settled** (directie 2026-07-14): a **two-tier** model — *themaperiode* (4–6 wk) and *subthemaperiode* (~2 wk) — is the default; calendar zoom levels (E3-08) map to these two tiers. **Never hard-assume months.** The block unit stays **configurable behind a seam** (E3-05) with this two-tier default documented, not compiled-in, so a different cadence can be adopted without a code change.
  > **Directie's confirmation of the discard rule is outstanding** (question 6 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)), because FR-7.3 reserved it to them; if directie reverses it, this clause and the teacher-facing strings enumerated under E4-07 change together.
- **Generatieparameters** *(scoped per `(Klas, Schooljaar)`)* — the parameters a teacher supplies **before** generation (FR-5.4): `gewensteStartthemas[]` and `vasteMomenten[]`. **Kept between runs** (owner ruling 2026-07-30), so (her)generatie honours them and a period the teacher marked as bezet stays bezet. Each kept startthema keys on its planningsblok's **`blokStart`**, never an ordinal ([ADR-0020](docs/adr/0020-planningsblok-derivation-rules.md) §3) — persisting an ordinal is worse than sending one, because it survives exactly the schooljaar edits that invalidate it. Scoped by **schooljaar as well as klas** because every stored value is a date: a vast moment on 2026-09-15 means nothing in the next school year. A generation request body **replaces** the kept set wholesale; an **absent** body means "use the kept set". A `gewenst startthema` is a **preference** (it reaches the prompt; the report says whether the model complied); a `vast moment` may be a **constraint** (the service refuses placements in its period). Whether a startthema should instead be *enforced* is deliberately still open (Art. XIV).
- **Dekking** — computed, not stored (see Article V), in two steps per goal: in the dekkingsprognose, and gedekt. "Herhaling/opbouw over leeftijden" (verticale samenhang) may be surfaced later (Art. XIV).

### IX.4 Ontwikkelingsrapport (pupil data, K3 only, Art. VI.7)

*([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) §3.1.) None of it counts for dekking.*

- **Leerling** *(pupil data)* — voornaam, achternaam, and the klas it belongs to, and so one schooljaar. No other field.
- **Rapportdoel** — a titel, an order, and the K3 subdoelen it bundles. One set for all of K3, with no schooljaar (R3, R4, R7). Only a decided subdoel is bundled (default D11).
- **Gradatie** — a label, a colour from a fixed palette, and an order. One scale for all of K3, with no schooljaar (R5, R7). One that is in use cannot be deleted (default D1).
- **Evaluatiemoment** — 1, 2 or 3 per schooljaar (R8). A value, not an entity.
- **Ontwikkelingsrapport** *(pupil data)* — one per `(Leerling, Evaluatiemoment)`, with an algemeen besluit (R9).
- **Rapportbeoordeling** *(pupil data)* — one per `(Ontwikkelingsrapport, Rapportdoel)`: a gradatie and a text. Each text, and the besluit, carries the status of Art. IV.2: `manueel` or `aanvaard`, plus any `geweigerd` rewrite, without its text.
- **Kindtekening** *(pupil data)* — at most one per ontwikkelingsrapport (R10), stored apart from it.

---

## Article X — Definition of Done (every task)

Before a task is considered finished:
1. The relevant **tests** pass (`dotnet test`, `pnpm test`).
2. **`dotnet format`** applied (backend) and **`pnpm lint`** clean (frontend).
3. **No user-facing Dutch text hard-coded** — everything in `nl.json`. This binds the product; team tooling outside it is governed by [Art. II.6](#article-ii--domain-language-binding).
4. **No secrets** added to the repo, save the narrow local/CI test-database exception in [Art. VI.4](#article-vi--roles-privacy--security).
5. The change is **consistent with this constitution**; any conflict is resolved or escalated as an amendment.
6. Changes are **small and reviewable**.
7. **The Antagonist review has run** on a significant change (see [Article XIII](#article-xiii--the-antagonist)), and each of its CRITICAL and MAJOR findings is fixed or explicitly waived by the owner. MINOR findings do not block.

---

## Article XI — Amendment Process

1. This constitution may only change deliberately. An amendment is a **dedicated commit** that:
   - States *what* principle changed and *why*.
   - Updates any dependent text in `CLAUDE.md` and the functional analysis in the same change.
2. **Open decisions** (Article XIV) are not amendments — they are gaps awaiting a directie decision. Resolving one updates the relevant article and removes it from the open list.
3. If code and constitution disagree, the **code is wrong by default** — fix the code, or amend the constitution if the principle genuinely changed.
4. **The text states the rules in force.** An amendment rewrites the clause it changes; it does not append its own history to it. What changed, who ratified it, when and why, goes in a new row of the ratification log, in the same commit.

### Ratification log

Kept in [`docs/constitutie-log.md`](docs/constitutie-log.md): one row per ratified amendment, newest last.

---

## Article XII — Glossary (NL ↔ EN)

- **Op.stap** — the new katholiek basisonderwijs curriculum; contains leerplandoelen + minimumdoelen + leerroutes.
- **Leerplandoel** — a curriculum goal (unique code) from Op.stap.
- **Minimumdoel / eindterm** — government-decreed attainment target; embedded in Op.stap; concorded to leerplandoelen.
- **Doelsoort** — goal type (MD / G / + / P / S / A); colours: MD blue, G neutral, + green, P/S pink, A yellow.
- **Concordantie** — the link between leerplandoelen and minimumdoelen: which leerplandoelen lead to a minimumdoel, and so which ones a themadoel brings along.
- **Dekkingsprognose** — the step before dekking: a goal the school's thema's and subthema's aim at that the klas's agenda does not hold yet (Art. V.1).
- **Discipline / domein / subdomein / cluster** — the Op.stap subject taxonomy (one Excel per discipline).
- **Leerroute** — an Op.stap learning trajectory (optional, later phase).
- **Jaar/fase** — JK, K2, K3 (kleuter) and L1–L6 (lager); minimumdoelen anchor at mijlpalen K3 / L4 / L6. Teacher vocabulary **1K/2K/3K** maps to **JK/K2/K3** (confirm which form Excel col F uses).
- **Discipline (genummerd)** — the 11 numbered Op.stap subjects (1 Nederlands … 11 RKG), with 9 split into 9.1/9.2/9.3. The stable import/grouping key.
- **Leergebied / Wereldoriëntatie** — the teachers' grouping vocabulary (Wereldoriëntatie = umbrella over aardrijkskunde / geschiedenis / wetenschap en techniek). **Not** an Op.stap ordeningskader level — a presentation mapping only. *Distinct from the next entry.*
- **Leergebied van het decreet** — the first level of the decree's own ordering of the minimumdoelen, `leergebied › rubriek › subrubriek` (KOV's `path`, e.g. *Nederlands › Lezen › Vlot en vloeiend lezen*, *Attitudes › Leren leren*). Stored on `Minimumdoel`, read-only, and used only to browse the minimumdoelen register (Art. IX.1). It is neither an Op.stap discipline nor the teachers' leergebied above, and it answers nothing in the open Art. XIV bullet on Wereldoriëntatie.
- **Rubriek / subrubriek** — the second and third level of that ordering. A whole rubriek may have no subrubriek (54 minimumdoelen have a path of two levels).
- **Soort (van een minimumdoel)** — the decree's kind of a minimumdoel, in its own words: *te bereiken op individueel niveau*, *te bereiken op populatieniveau* or *na te streven op populatieniveau* (KOV's `type`). Decreed content, shown as such; it has no role in dekking.
- **Thema / subthema / activiteit** — the school's own content building blocks.
- **Themadoel** — an overarching, school-wide goal anchoring a whole thema (verbreed/verdiept/herhaald): a minimumdoel, with no maximum per thema.
- **Subdoel** — a concrete, age-differentiated goal per `(subthema × leeftijd)` building up toward the themadoelen.
- **Subdoelplaatsing** — the AI's proposal of where an open leerplandoel of a thema's themadoelen goes: into an existing subthema of its leeftijd, or into a new subthema it proposes (Art. IX.2).
- **Activiteitvoorstel** — an activiteit the AI proposes under a subthema to the leerkracht who asked, working on that subthema's subdoelen; once she accepts it, it is her own activiteit (Art. IX.2).
- **Onderzoeksvraag / probleemstelling** — the driving question(s) per subthema in a kennisrijk thema.
- **Kernwoordenschat vs. rijke (thema)woordenschat** — two-tier vocabulary per thema (basiswoorden vs. rijke themawoorden); kernwoordenschat is school-wide.
- **Rijk aanbod / activiteittype** — the palette of activity forms (experiment, prentenboek, hoek, uitstap, spel, waarneming, beweging, onderzoek).
- **Hoek** — a learning corner (ontdektafel, techniekhoek, boekenhoek …).
- **Algemene fiche** — a recurring activity of one class outside every thema (onthaal, turnen); its goals count for dekking once it is planned (Art. V.1).
- **Themaperiode / subthemaperiode** — duration units: thema 4–6 wk, subthema ±2 wk; candidate planningsblokken.
- **Startthema** — a teacher's *preference* for which thema opens a given planningsblok, given before generation (FR-5.4). **Advisory:** it reaches the prompt and the report states whether the model complied; the tool does not place a thema the model never proposed.
- **Vast moment** — a day the school has already committed **inside** a teaching period (schoolfeest, oudercontact, …), given by the leerkracht before generation (FR-5.4); it may block placement in its period. Distinct from a **Schoolsluiting** — a vakantie or vrije dag, which is school data on the `Schooljaar` under FR-12.1. A closure is never a vast moment, so no UI offers two forms for one fact.
- **Bewaarde generatieparameters** — the startthema's and vaste momenten kept per `(Klas, Schooljaar)` between generation runs; see Art. IX.3.
- **Leerlijn (verticale samenhang)** — school-guaranteed continuity/build-up of a goal across ages (1K→3K→lager); "geen gaten in de leerlijn". Distinct from Op.stap **leerroute**.
- **Professionele autonomie** — the legal principle that thema's/subthema's/ordering are the school's free choice; only minimumdoelen/leerinhouden/kennisopbouw are decreed (Art. III).
- **Kennisrijk curriculum / kennisrijk thema** — the goal-first, interdisciplinary, knowledge-building (4–6 wk) pedagogical frame the tool serves.
- **Jaarplan / planningsblok** — the year plan per class / a time slot (granularity is **settled** (directie 2026-07-14): two-tier default, configurable behind the E3-05 seam; see Art. IX.3).
- **Dekking** — coverage; **gap-analyse** — the missing-goals overview.
- **Graadklas / menggroep** — combined-grade class; a planning edge case to support.
- **Gebruiker** — a staff member directie has added, who logs in over the school's own Entra tenant; the app records which rights they hold (Art. VI.1). Staff only, never a pupil (Art. VI.2).
- **Directierecht** — the right to see and edit everything and to maintain gebruikers, klassen, schooljaren and rights. Held by directie and by whoever directie gives it, such as an ICT-coördinator. It replaces the former `Beheerder` role.
- **Themabeheer** — the right, held by a few named leerkrachten or zorgcoördinatoren and given by directie (FA FR-12.2), to edit thema's with their themadoelen and kernwoordenschat, to run the FR-1 import, to work the thema-opbouw wizard, and to generate, review and adjust doelsuggesties.
- **Hoofdleerkracht** — a gebruiker appointed per `(schooljaar, jaarfase)`, several allowed, who creates, edits and deletes that jaarfase's subthema's and subdoelen, decides the subdoelplaatsingen the AI proposes for it, and links goals to its shared activiteiten. A right, not another kind of account. Whether the holder must also teach a klas is a default: no (ADR-0030 I20).
- **Klastoewijzing** — the link between a gebruiker and a klas they teach; many-to-many (co-teacher, duobaan). It is what makes someone a leerkracht of that klas, with the right to edit its planning.
- **Maker (van een activiteit)** — the gebruiker who created an activiteit. For a shared activiteit, they may delete it while no goal is linked to it (Art. VI.1). Being the maker does not make an activiteit personal content; being its eigenaar does.
- **Eigen activiteit** (own activiteit) — an activiteit that belongs to one gebruiker, its **eigenaar**, rather than to its leeftijd ([ADR-0049](docs/adr/0049-eigen-activiteit-van-de-leerkracht.md), Art. VI.1). Its opposite is a **gedeelde activiteit** (shared activiteit).
- **Ontwikkelingsrapport** — the report per child in the derde kleuter, written three times a year and handed to the parents as a PDF or Word document; the one place pupil data lives (Art. VI.7, IX.4).
- **Leerling** — a child in a K3 klas, known by voornaam and achternaam only, who exists in the app only for the ontwikkelingsrapport. Never a gebruiker.
- **Rapportdoel** — a titled group of K3 subdoelen that a child is rated on; one set for all of K3.
- **Gradatie** — a step on the one K3 scale: a label and a coloured star, never a number.
- **Evaluatiemoment** — one of the three fixed moments per schooljaar at which an ontwikkelingsrapport is written.
- **Rapportbeoordeling** — the gradatie and the text for one rapportdoel in one ontwikkelingsrapport.
- **Algemeen besluit** — the teacher's overall conclusion in one ontwikkelingsrapport.
- **Kindtekening** — a photo or scan of a child's drawing, one per ontwikkelingsrapport, with its metadata stripped.
- **Leerlingzorg** — the right, given by directie (for example to a zorgcoördinator), to read every ontwikkelingsrapport and nothing else.

---

## Article XIII — The Antagonist

A dedicated reviewer agent (`.claude/agents/antagonist.md`) audits significant changes against this constitution ([ADR-0037](docs/adr/0037-lichter-agentproces.md)).

- It runs **once per story or ticket**, on the finished change, and audits that change's **diff**: new or changed source files, data model, import mapping, AI prompts, rights, scope-touching edits. Documents outside the diff are outside its audit unless the diff makes them false.
- **Only CRITICAL and MAJOR findings block.** MINOR findings are reported, and never block or start another round.
- A **re-audit** after fixes checks only the blocking findings still open. There are **at most two rounds**; a blocking finding still open after the second goes to the owner.
- Its verdict (`COMPLIANT` / `VIOLATIONS FOUND`) and blocking findings must be **addressed or explicitly waived** before a task is done (Article X.7).
- The Antagonist defends *this document*; it does not defend convenience.

---

## Article XIV — Open Decisions (awaiting directie)

These are **not yet settled** and must be confirmed before building deep. Until resolved, code must not hard-assume an answer; isolate the choice behind a clear seam.

- **Disciplines first**: all Op.stap disciplines, or a starter selection? (List in Art. VII.0.)
- **`cluster` presence**: is `cluster` populated in every discipline's Excel, or only some? (Affects roll-ups; cluster is nullable regardless — Art. VII.0.)
- **Ordering & graadklassen**: follow Op.stap jaar/fase ordering (JK–L6, mijlpalen K3/L4/L6); how to handle graadklassen / menggroepen? *Partly answered for rights, provisionally, by the owner (Art. VI.1; [ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) R22): a graadklas grants the leeftijd rights of its one jaarfase, and the klas→leeftijden mapping for rights lives in one place. An activiteit moves only to a subthema at the same leeftijd (Art. IX.2), which denies a graadklas the shift between its own two ages. For the ontwikkelingsrapport ([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) D9), a menggroep recorded as K2 gets no report for its K3 children until directie decides (question 14). Directie has not been asked, and the question stays theirs.*
- **`leergebied` / Wereldoriëntatie surfacing**: show it as a presentation grouping over disciplines? Confirm the Wereldoriëntatie → {Aardrijkskunde, Geschiedenis, Wetenschap en techniek} mapping. *The leergebied stored on a minimumdoel is the decree's first level (Art. IX.1, XII), not this grouping over disciplines, so it answers neither question.*
- **Coverage depth**: keep binary dekking for MVP, or later surface herhaling/opbouw over ages (verticale samenhang)?
- **`jaarFase` codes**: confirm whether Excel col F uses 1K/2K/3K or JK/K2/K3.
- **Number of classes & teachers** in the first version.
- **Teacher visibility** (FR-10.2). The owner ruled that a leerkracht reads the klassen of her own jaarfase, a hoofdleerkracht those of her appointed jaarfase, themabeheer and directie every klas, and a gebruiker without a right none (Art. VI.1; [ADR-0040](docs/adr/0040-klassen-inkijken-per-jaarfase.md), building on [ADR-0030](docs/adr/0030-rollen-en-rechten-in-de-app.md) R3 and R7). **Directie has not confirmed it.** What stays open, and is **directie's** to decide: confirm it, widen it (every klas, or per graad), narrow it, or make it configurable (question 4 in [`docs/besluiten-gevraagd.md`](docs/besluiten-gevraagd.md)). One matrix row decides it, behind the E6-09 seam. For the ontwikkelingsrapport only ([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) R17), a leerkracht reads only the reports of their own klas; directie has not confirmed that either.
- **Thema/activiteit Excel structure**: which columns exist today (defines the FR-1 import template; must accommodate themadoelen, subthema onderzoeksvragen, two-tier woordenschat, activiteittype, duurWeken).
- **Required overviews/reports** on the beheerpagina and their export format.
- **Export formats**: PDF, Excel, or both; which layout (inspectie / klassenmap). *The ontwikkelingsrapport's formats, PDF and Word, are ruled ([ADR-0035](docs/adr/0035-ontwikkelingsrapport-derde-kleuter.md) R13); this question stays open for the jaarplan and the dekking (FR-11).*
- **Multilingual** support later (e.g. for non-Dutch-speaking teachers)?
- **Final product name.**

> **Settled decisions** live in the article they settled: the Op.stap import source (Art. VII.2), planningsblok granularity (Art. IX.3), thema scope per level (Art. IX.2), the decreed/autonomous boundary (Art. III), EU hosting and AI data zone (Art. VI.3, [ADR-0016](docs/adr/0016-azure-hosting-eu-residency.md)) and Microsoft Entra ID as identity provider (Art. VI.1, [ADR-0011](docs/adr/0011-authn-authz-rbac-gdpr.md)). The [ratification log](docs/constitutie-log.md) records when each was decided.

---

*Derived faithfully from the Functionele Analyse v0.4. Keep this constitution and the functional analysis in sync — when scope is clarified, update both.*
