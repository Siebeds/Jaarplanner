# ADR-0032 — The KOV Op.stap API is the curriculum import source

- **Status:** Accepted (project owner ruling, 2026-09-11)
- **Date:** 2026-09-11
- **Deciders:** Siebe De Saedeleir (projecteigenaar)
- **Supersedes in part:** [ADR-0006](0006-opstap-readonly-import-closedxml.md), the *source* of Op.stap goals (a
  per-discipline Excel read with ClosedXML). ADR-0006's four rules stand and now bind the API path too: one place for
  the mapping, write-once reference data, a non-destructive re-import with a review report, diagnostics before commit.
  ClosedXML stays for the school-content import (FR-1).
- **Closes:** the Art. XIV open decision *"Op.stap import: manual per-discipline Excel download vs. an automated/online
  source"*, recorded in the constitution's ratification log in the same change.
- **Relates to:** [ADR-0018](0018-concordance-one-to-many-fk.md) (the concordance is one nullable FK per leerplandoel),
  [ADR-0019](0019-discipline-selection-config-seam.md) (discipline selection), [ADR-0022](0022-curriculum-administration-authorisation-seam.md)
  (the `Curriculumbeheer` policy and one endpoint per import source), E7-13 (import ports belong in Application).

## Context

**The Excel route never delivered the decreed minimumdoelen.** E1-12 has been blocked since 2026-07-28 on a source file
from directie, and a fabricated stand-in (`assets/minimumdoelen-PLAATSHOUDER-niet-decretaal.*`) was all the repo had.
Worse than late: the Op.stap Excel files in `assets/opstap-xlsx/` are **partial** (Wiskunde carries 319 goals where the
curriculum has 1,564) and their columns B–D (`LfMD`, `nrMD`, `MD`) are **empty on every row**. Through that route the
concordance does not exist, so minimumdoel-level coverage, the level the onderwijsinspectie tests (Art. V.2), could
never have been computed from it even with the decreed list in hand.

**KOV publishes Op.stap through an API.** It is documented for software builders at
`https://opstap.katholiekonderwijs.vlaanderen/docs/`, with usage notes on KOV's Confluence ("Op.stap selector usage
notes", September 2026). Verified on 2026-09-11 from a server, without credentials:

- `GET https://api.katholiekonderwijs.vlaanderen/documents/bdc19260-bd4c-46a8-8009-b2a54f381120/snapshots/{version|latest}/krcItems`
  returns the whole curriculum as one flat list of items linked by `parentHref`/`childrenHrefs` (about 12.8 MB):
  13 disciplines, 65 domeinen, 220 subdomeinen, 477 clusters and 7,480 goals. Each goal has a stable UUID `key`, an
  `identifier` in the same format as the Excel's column E (`2.1.GK2.9`), a goal set (P, G, Z, S, +, A, V), an age
  range (JK…L6, F1–F6, ZW/ZO/ZZ, AN), an HTML `description` that carries the examples and vocabulary, `minimumGoals`
  hrefs, and `coherences` to other goals.
- `…/krcItems/hash` answers `{version, hash}` in 63 bytes, and `…/snapshots` lists the versions (1.0–1.2 today) with a
  Dutch changelog. A numbered version can be requested instead of `latest`.
- `GET https://api.katholiekonderwijs.vlaanderen/agodi/onderwijsdoelen/opstap` returns the **998 decreed
  minimumdoelen** (K, 4 and 6), paged through `$$meta.next`. Each carries `uniqueCode` (`K-1.3.9`), `code` (`1.3.9`),
  `title` (the doelzin, HTML), `description` (the uitbreiding, HTML, absent on 725 rows), `type`, `validity` and `path`.
- **The concordance fits our model.** No goal references more than one minimumdoel, so ADR-0018's single FK holds, and
  all 5,654 references resolve to a row of the second endpoint.

**The usage notes** prefer KOV's web components, permit direct API access "only for functionality not covered by these
components", expect daily anonymised usage data in an AWS bucket, and whitelist browser origins through the
*KathOndVla-edtech* Teams channel. The owner read them and ruled on 2026-09-11 to use the API as the import source
without asking KOV first. That is recorded here as the context the ruling was taken in, not as an open item.

## Decision

1. **The KOV Op.stap API is the import source** for leerplandoelen, minimumdoelen and the concordance. It is called
   from the backend only, through a typed `HttpClient` in Infrastructure behind a port in Application (Art. VIII). The
   frontend never calls KOV, and no teacher request ever waits on it.
2. **Our database stays the runtime truth.** An import copies Op.stap into PostgreSQL as read-only reference data
   (Art. III.1). The register, the AI matching, generation and dekking read only from there. If the API is down,
   changes shape or changes its access rules, the tool keeps working on the last imported version.
3. **Minimumdoelen first (E1-12).** The mapping lives in one place (`OnderwijsdoelMapping`, Art. III.3):
   `Ref` = `uniqueCode` verbatim, `Leeftijd` = its prefix (`K-`, `4-`, `6-`), `Nr` = `code`, which must equal the rest
   of `uniqueCode`, and `Omschrijving` = `title` followed by `description`, both converted from HTML to plain text so
   no markup ever reaches a screen. **The conversion may not change what the decree says** (Art. III.1): a MathML
   fraction becomes `1/2` (stripping its tags would have written `12`; 49 occur), a link keeps its address (the Frans
   minimumdoelen point at their word list), an image becomes its alt text, and KOV's literal angle brackets around
   examples (`< bv. … >`, 126 rows) stay text, as does a raw `<` used as a sign, and `10<sup>2</sup>` becomes `10^2`.
   Markup the conversion cannot keep (an unknown tag, `<ol>`, `<sub>`, a `<sup>` that is not a plain number, an image
   without alt text, an unclosed link or one without a double-quoted address) makes the row **refused, not stripped**.
   Taking `uniqueCode` verbatim removes the padding hazard E1-12 recorded (`6-1` against `6-01`): nothing is
   concatenated any more. A row whose `validity.endDate` has passed is not imported.
   **All 998 are imported**, whatever the goal-set scope of decision 5, because the decree applies in full. *(This
   sentence is the implementer's reading; the owner's ruling did not address it.)*
4. **An import is a human action, never automatic.** Each source has a preview that writes nothing and an apply, both
   behind `Curriculumbeheer` (ADR-0022), both returning the review report (FR-2.5). The import is non-destructive: a
   minimumdoel that is absent from the source is **kept and reported**, never deleted, because leerplandoelen concord to
   it through a Restrict FK (Art. III.4). A scheduled check may later detect a new version and prepare the report
   (E1-23), but applying it stays a directie action.
5. **Scope for now: G goals only (owner ruling 2026-09-11).** The leerplandoelen import (E1-21) takes goal set **G**
   and skips P, S, +, A, **Z (zwemdoelen) and V (Vlaamse gebarentaal)**, counting what it skipped in the report. G maps
   to `Doelsoort.Gemeenschappelijk`. The API path never produces `Doelsoort.Minimumdoel`: the concordance travels in
   `MinimumdoelRef`, which is what coverage reads. A doelsoort filter "only MD" at leerplandoel level therefore matches
   nothing on this path; FR-2.2's and Art. V.3's "enkel de minimumdoelen" is served by the minimumdoel-level view.
   *(Implementer's reading, recorded so E5 does not build a filter that cannot match.)* **The consequence, measured on
   snapshot 1.2:** 992 of the 998
   minimumdoelen stay reachable through a G goal. `6-7.1.6` is reachable only through a Z goal, and five (`K-1.2.6`,
   `4-2.2.23`, `6-2.2.3`, `6-6.2.5`, `6-6.3.9`) through no goal at all. Those six can never be gedekt under this scope,
   and that figure assumes every discipline is imported; a narrower selection (Art. XIV "Disciplines first", still open)
   leaves more. *Implementer's default, not part of the ruling:* a dekkingsoverzicht names any minimumdoel with no loaded
   concorded leerplandoel as such, rather than presenting it as a gap the teachers left.
6. **Versions are pinned** (E1-21). The leerplandoelen import requests a numbered snapshot, never `latest`, and records
   the version and hash, so a dekkingscijfer can name the curriculum version it was computed against.
7. **The goal's UUID `key` is stored beside its code** (E1-21). `code` stays the identity (Art. III.5); the key lets the
   re-import report tell a renumbered goal from a removed one plus a new one. Codes do move: three codes in our Excel
   snapshot no longer exist in the API.
8. **The Excel path stays for now, demoted.** `ClosedXmlOpstapParser` and `POST /api/opstap-import` remain until the
   API import has run in production; whether to remove them is a later decision. *This is the implementer's default,
   not part of the owner's ruling.*
   *Amended 2026-09-13 (E1-21 fix round 1, option (b) of the antagonist's round-1 MAJOR 1; an implementation decision,
   not an owner ruling):* **once an API import has been applied** (an `opstapversies` row exists), the Excel route
   **refuses**, on the preview as on the apply, with a 409 of type `urn:jaarplanner:opstap-import:excel-na-opstap-api`,
   and writes nothing. Read after the API import, an Excel file would have overwritten the API's wording, cleared the
   concordance the files do not carry and flagged every API goal the file lacks as *niet meer in Op.stap*: measured on
   snapshot 1.2 against the repo's twelve files, about 4,700 goals flagged and 858 concordances cleared. Protecting the
   API rows inside the shared writer instead (option (a)) was rejected because it would still revert the overlapping
   goals (253 in Wiskunde) to the Excel wording. Before any API import the Excel route works as it did. Removing it
   stays a later decision.

## Alternatives considered

- **Keep the Excel route and wait for directie's file.** Rejected: the files carry no concordance, so the wait could
  not have ended in minimumdoel-level coverage.
- **Call the API live on each request.** Rejected: it couples every screen and every dekkingscijfer to a third party's
  uptime and shape, and a figure computed against whatever the API says today cannot be reproduced tomorrow.
- **KOV's `<op-stap-selector>` web component.** Not an import mechanism (it selects goals, it does not export them).
  For the manual koppel-screen it would collide with ADR-0024 (one frontend of our own, copy in `nl.json`, contrast
  measured here) and with Art. XII's colour budget. Not adopted; not ruled out for later.
- **Import every goal set.** Deferred by the owner's G-only ruling (decision 5).

## Consequences

**Positive**
- E1-12 is unblocked on real decreed text, and minimumdoel-level coverage can become truthful once E1-21 imports the
  concorded G goals.
- Curriculum updates become detectable (the hash) and reviewable (KOV's own changelog).

**Negative / trade-offs**
- A third-party dependency at import time. Decision 2 and the reviewable, non-destructive import contain it.
- The exposure under KOV's usage notes is accepted by the owner (see Context). No usage data is sent to KOV: the notes'
  data exchange is not implemented.
- Six minimumdoelen cannot be gedekt under the G-only scope (decision 5).
- `Minimumdoel` has no "no longer in Op.stap" flag, so a disappeared minimumdoel is reported by the import but not
  marked on the row. Adding one needs a migration; it belongs with E1-21.

## Follow-ups

- **E1-12** (this ADR's first story): the minimumdoelen import from the API, with preview and apply.
- **E1-21**: leerplandoelen from `krcItems` (G only, pinned version, `key`, HTML split into voorbeelden, woordenschat
  and toelichting).
- **E1-22**: the import screen for the API source, and the minimumdoelen register's empty state
  (`doelen.geenMinimumdoelenTitel` / `doelen.geenMinimumdoelenActie`) and count, which E1-12 makes false. (E1-13's
  notice `import.opstap.voorwaarde` was already deleted by `891195d`.)
- **E1-23**: a scheduled version check in production that prepares a review for directie and never applies it.
- The ADR index row in `docs/adr/README.md`, owed by whoever next holds that file.

## Compliance trace

- **Constitution:** Art. III.1, III.3, III.4, III.5 (read-only reference data, one mapping, non-destructive re-import,
  code identity); Art. V.2 (minimumdoel-level coverage); Art. VI.4 (server-side only, no secret involved); Art. VII (the
  source and its mapping); Art. VIII (typed client in Infrastructure, port in Application); Art. XIV (closes the Op.stap
  import decision).
- **Backlog:** E1-12, E1-21, E1-22, E1-23; the minimumdoel half of E1-03 and E1-04.
- **FR:** FR-2.1, FR-2.2, FR-2.3, FR-2.5.
