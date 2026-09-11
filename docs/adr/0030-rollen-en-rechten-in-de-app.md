# ADR-0030 — Roles and rights live in the app: directie, themabeheer, a hoofdleerkracht per jaar, and personal content

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** Project owner (Siebe De Saedeleir), rulings given in session on 2026-09-11 in reply to direct
  questions with the options and their costs stated. Recorded the same day by session `E6-01`, before any code
  that depends on them, so this time the decision exists before the implementation that cites it (compare the
  deciders note of [ADR-0025](0025-subthema-per-leeftijd.md)).
- **Amends:** [ADR-0011](0011-authn-authz-rbac-gdpr.md). **Supersedes its decision §3** ("ownership-aware
  rules"), which assigned class-scoped content to "the owning teacher" at a time when a subthema still named a
  klas. ADR-0011 §1 (personal login over Microsoft Entra ID), §2 (server-side enforcement driven by one
  configurable matrix, no scattered role checks) and §4 (no pupil PII) stand unchanged.
- **Relates to:** [ADR-0022](0022-curriculum-administration-authorisation-seam.md) (the `Curriculumbeheer` seam,
  whose expected answer this ADR confirms: directie), [ADR-0025](0025-subthema-per-leeftijd.md) (content per
  leeftijd, which this ADR extends with personal content), ADR-0031 (the login mechanism).
- **Realises:** FR-10, FR-12.2, FA §3.1/§3.2. **Backlog:** E6-01, E6-02, E6-04, E6-08, E6-09, and E6-10 (filed
  with this ADR).

## Context

The owner asked for authentication "so teachers can log in, edit only their own classes, but still view other
classes". Building that needs an answer to *who owns what*, and the documents gave two answers that no longer fit
together:

- **ADR-0011 §3** says school-scoped content (Thema, Themadoel, kernwoordenschat) is editable by "team/directie"
  and class-scoped content (Subthema, Subdoel, Activiteit, Jaarplan) by "the owning teacher".
- **ADR-0025** (2026-08-30) took the klas out of Subthema, Subdoel and Activiteit: they are scoped by leeftijd, so
  three parallel K3 classes share one subthema. Since then there is **no owning teacher** for that content. Only
  the planning (Jaarplan, its placements, the agenda) still belongs to one klas.

On top of that, FA §3.2's matrix has a single row "Thema's/activiteiten invoeren", granted to every leerkracht
for their own klas. That row cannot be applied to content that no longer belongs to a klas.

## Decision

The owner's rulings, in the order given. Where a ruling refined an earlier one in the same session, the
refinement is what stands, and both are recorded.

1. **Entra authenticates; the app authorises.** Whether someone is directie, holds themabeheer, is hoofdleerkracht
   of a jaar or teaches a klas is **data in the app**, maintained by directie on the beheerpagina (FR-12.2). No
   Entra group or app role carries an application permission. *Why:* a hoofdleerkracht is appointed per jaar and
   per schooljaar, which Entra cannot express without a group per jaar per year. The school gets **its own Entra
   tenant**.
2. **Access is by invitation.** A person can log in only if directie has added them as a user in the app. Being a
   member of the school's tenant is not enough: a school tenant commonly also holds pupil accounts, and Art. VI.2
   keeps pupils out of the MVP. The very first directie account is provisioned from configuration, since nobody
   exists yet to add it.
3. **Directie sees and edits everything:** every klas, every piece of content, the curriculum import, the beheer.
4. **Thema's are edited by directie and by a few people directie designates.** *Themabeheer* is a right granted
   to named individuals (leerkrachten or zorgcoördinatoren), not something derived from another role. It covers
   the school-wide level of Art. IX.2: `Thema`, its `Themadoelen` and its kernwoordenschat.
   *Refines the owner's first statement in the same session*, which named the hoofdleerkracht for "subthema's en
   thema's". The answer to the direct question narrowed thema's to directie plus designated people, so a
   hoofdleerkracht holds themabeheer only when directie grants it.
5. **A hoofdleerkracht per jaar edits that jaar's subthema's.** The appointment is per `(schooljaar, jaarfase)`,
   because a klas exists per schooljaar and the person may change from year to year. It covers the subthema's
   whose `leeftijd` is that jaarfase, and the **shared** subdoelen and activiteiten under them.
   *"In overeenstemming met alle leerkrachten"* is a working agreement between people. **The tool does not
   enforce consensus, approval or voting.**
6. **Every leerkracht may add activiteiten and subdoelen under a subthema for themselves.** This is **personal
   content** next to the shared per-leeftijd content of ADR-0025: the teacher does not need the hoofdleerkracht to
   add their own activity, and doing so does not change what the other classes of that jaar see as shared.
7. **A leerkracht edits the planning of the klassen assigned to them and reads every other klas.** The planning is
   the jaarplan and its placements, (her)generation, the weekplanning/agenda, hoekplaatsingen and the klas's
   algemene fiches. The read half is the owner's opening request and FA §3.2's "lezen". A klas may have **more than
   one** leerkracht (co-teacher, duobaan), so the assignment is many-to-many.

### The matrix that follows

This replaces FA §3.2's table for the purpose of the build. The FA is updated in the Art. XI amendment that
follows this ADR. "HL" = hoofdleerkracht of the jaar concerned, "TB" = holds themabeheer, "LK eigen" / "LK ander"
= leerkracht of the klas concerned / of another klas.

| Actie | Directie | TB | HL | LK eigen | LK ander |
| --- | --- | --- | --- | --- | --- |
| Op.stap-doelen inladen/vernieuwen | ✓ | – | – | – | – |
| Gebruikers, klassen, schooljaren en rechten beheren | ✓ | – | – | – | – |
| Thema, themadoelen, kernwoordenschat aanpassen | ✓ | ✓ | – | – | – |
| Subthema van een jaar aanpassen, met zijn gedeelde subdoelen en activiteiten | ✓ | – | ✓ | – | – |
| Eigen activiteiten en subdoelen toevoegen onder een subthema | ✓ | – | ✓ | ✓ | – |
| Doelsuggesties genereren en beoordelen | volgt het recht op de inhoud waar ze aan hangen | | | | |
| Jaarplan bewerken, (her)genereren, agenda, hoeken, algemene fiches | ✓ | – | – | ✓ | – |
| Jaarplan, agenda en dekking bekijken | ✓ | lezen | lezen | ✓ | lezen |
| Exporteren | ✓ | – | – | ✓ | lezen |

TB and HL are **additive** to being a leerkracht: a hoofdleerkracht of K3 who teaches K3 groen has both the HL
column and "LK eigen" for K3 groen.

### Still open, named rather than guessed

These came up while recording the rulings. None of them blocks E6-01 (login). Each is owned by the story that
first needs it:

- **(a) Who owns personal content, and who sees it?** "Voor zichzelf" can mean the leerkracht (it follows them to
  next year) or their klas (it stays with the planning). It also leaves open whether colleagues can see it, and
  whose coverage it counts for. *Owner: E6-10.* Until it is answered, nothing personal is built.
- **(b) The FR-1 Excel import creates thema's.** On 2026-08-03 the owner ruled that FA §3.2 "stands as written",
  so a leerkracht may import thema's and activiteiten (E1-13). Ruling 4 now reserves thema's to directie and
  themabeheer. **The two cannot both hold for an import that creates a thema.** *Owner: E6-02*, to be put to the
  owner before the import route is gated. The conservative default is directie plus themabeheer.
- **(c) A jaar with no hoofdleerkracht appointed.** Until someone is appointed, only directie edits its
  subthema's (the conservative reading). *Owner: E6-02.*
- **(d) Teacher-to-teacher visibility beyond "every klas, read-only".** Ruling 7 settles the default the owner
  wants. Whether directie wants it narrower or configurable (FR-10.2, Art. XIV "Teacher visibility", question 4
  in `docs/besluiten-gevraagd.md`) remains directie's call. *Owner: E6-09*, which stays `[!]` but is no longer
  what E6-08 waits on.
- **(e) Zorgcoördinator.** FA §3.1 gives read over several klassen and "eventueel beperkte bewerkrechten, ter
  beslissing". Ruling 4 lets one hold themabeheer. Anything beyond that is still open. Under ruling 7 read access
  to every klas already exists, so the read half needs nothing extra.

## Alternatives considered

- **Roles as Entra groups or app roles** (the owner was offered this). Rejected by ruling 1: fewer screens in the
  app, but the hoofdleerkracht per jaar per schooljaar would need a group per jaar per year, maintained by ICT
  outside the tool that uses it.
- **Everyone in the tenant may log in; first login creates a user without rights.** Rejected by ruling 2. It is
  only safe if ICT sets "assignment required" in Entra, and a missed setting would let pupils in. The invitation
  gate lives in the app, where the tool can test it. Setting "assignment required" in Entra is still recommended
  as a second layer (ADR-0031).
- **Any hoofdleerkracht may edit any thema** (offered). Rejected by ruling 4: a hoofdleerkracht of L5 could then
  change a thema that K3 relies on.
- **Hoofdleerkracht of any jaar that uses the thema** (offered). Rejected by ruling 4, which designates people
  rather than deriving the right from subthema's.
- **Only the hoofdleerkracht edits activiteiten and subdoelen** (offered). Rejected by ruling 6: a teacher needs to
  add their own activity without going through a colleague.
- **Encode consensus** (the hoofdleerkracht's edit waits for the other teachers' approval). Not offered and not
  wanted: ruling 5 makes it an agreement between people. Recorded so nobody builds an approval flow from the
  words "in overeenstemming".

## Consequences

**The model gains four things** (built in the stories named, not all at once):
- a `Gebruiker`: the Entra identity (tenant id + object id), naam, e-mail, and two directie-maintained facts:
  *is directie* and *heeft themabeheer* (E6-01 creates the entity with the first; E6-04 maintains both);
- a klastoewijzing `(Gebruiker × Klas)`, many-to-many (E6-04);
- a hoofdleerkrachtaanstelling `(Gebruiker × Schooljaar × Jaarfase)`, at most one per schooljaar and jaarfase
  (E6-04);
- an owner on `Activiteit` and `Subdoel`, where no owner means shared (E6-10, after open question (a)).

**The constitution needs an amendment** (Art. XI, a dedicated commit that also updates CLAUDE.md and the FA):
Art. VI.1 names the roles, and Art. IX.2 describes Activiteit and Subdoel as purely age-scoped, which ruling 6
changes. This ADR does not edit the constitution. It records what the amendment must say.

**ADR-0022's seam gets its answer.** The `Curriculumbeheer` policy becomes "directie", as ADR-0022 expected.

**Enforcement stays one matrix.** ADR-0011 §2 stands: the rows above become named policies in one place, and a
controller names a policy; it never tests a role inline. The "LK eigen" and "HL" columns are **resource-based**
(they depend on which klas or which jaar a request is about), so they are ASP.NET Core authorization handlers over
a resource. Role claims alone cannot express them.

**Costs, stated.** A jaar can be edited by exactly one hoofdleerkracht per schooljaar. Two co-heads would need a
change to the uniqueness rule. Directie carries the setup: nobody but the bootstrap account can log in until
directie has added them.

## Compliance trace

- **Constitution:** Art. VI.1 (roles, configurable; amendment owed), Art. VI.2 (invitation gate keeps pupil
  accounts out), Art. VI.5 (personal login), Art. IX.2 (level scoping; amendment owed for personal content),
  Art. III (school content autonomy), Art. XI (amendment process), Art. XIV (teacher visibility and zorgcoördinator
  rights stay open for directie).
- **Backlog:** E6-01 (Gebruiker + login), E6-02 (the matrix above as policies), E6-04 (beheer of users,
  assignments, appointments, themabeheer), E6-08 (read other klassen), E6-09 `[!]`, E6-10 (personal content),
  E7-11 (the deployment gate these close).
- **FR/NFR:** FR-10.1, FR-10.2, FR-12.2, FA §3.1/§3.2; NFR-5.
