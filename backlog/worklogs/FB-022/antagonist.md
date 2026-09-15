# Antagonist — FB-022 day text on a planned algemene fiche (audit, round 1)

**Verdict:** COMPLIANT
**Scope:** `git diff 507a92b..6cd991a` (a391846, 81e4059, 6cd991a). The stray `frontend/src/obj/Jaarplanner.Infrastructure.EntityFrameworkCore.targets` committed in 81e4059 was excluded; 6cd991a removes it and changes nothing else (`git diff --name-status 81e4059..6cd991a`).

No blocking findings. The three points the orchestrator asked to be checked:

- **Art. VI.2 / VI.7, logging.** Nothing writes the text to a log: no HTTP request-body logging in the Api, no `EnableSensitiveDataLogging` anywhere in the backend, and the one new exception message (`AlgemeneFichemoment.ZetTekst`) states the 500-character limit without echoing the text. The test texts contain no child's name. The field is class content, not a field about a pupil.
- **Rights.** The new `PUT /api/algemene-ficheplaatsingen/{plaatsingId}/momenten/{momentId}/tekst` carries `[RechtOp(KlasplanningBewerken, Rechtbron.AlgemeneFicheplaatsing, "plaatsingId")]`, matching the ADR-0030 §3 row for a klas's planning. `ElkeWijzigendeRouteVraagtEenRechtTests` covers it automatically (endpoint enumeration; `plaatsingId` filled with the seeded placement, `momentId` with a random guid; requires the authorisation's own 403). Another klas's moment cannot be written through one's own `plaatsingId`: `AlgemeneFicheplaatsing.ZetTekst` searches only that placement's moments.
- **Dutch copy (Art. II.3, II.5).** Every new string is in `nl.json`, none has an em dash, no Dutch is hard-coded in the component, and the one server-composed Dutch message is actionable. The conditional sentences are true: `bevestigEenTekst` / `bevestigTeksten` render only for a count above 0, and the count covers the whole period because `HaalVoorBereikAsync` loads every moment of an overlapping placement. Deleting the period is the only way a text is lost (no single-moment removal exists; a planned fiche cannot be deleted). `dagtekstLeeg` renders only when no text is filled in.

Other articles: Art. IX.2 (the text is on a placement moment outside the `Jaarplan` aggregate, so no regeneration touches it), Art. V (dekking untouched; the hook refetches only placements), Art. VIII (rule in the domain, thin controller, service behind its Application interface, no new dependency). Art. III, IV, VII and XIV are not touched.

## Not blocking

- **[QUESTION]** `nl.json` `fichedetail.dagtekstHint` / `Dagtekstvorm`: the hint "Schrijf over de klas, niet over één kind." is the only guard keeping pupil data out of this field. The constitution requires nothing more and the hint is proportionate, but a per-day free text invites diary-style notes, and every gebruiker can read it through the agenda (I9), far wider than R17 allows for a child's report. For a K3 klas the app already holds the children's names and a best-effort name filter (VI.7): whether to warn softly before saving a text that contains a name of the klas is the owner's decision.
- **[MINOR]** `AlgemeneFicheEndpointsTests.cs`: no integration test with real people for the new route (a leerkracht of this klas may write, one of another klas is refused), and no HTTP test that a `momentId` of another placement answers 404. The placement→klas resolver is shared with move and delete and existed before, so this is thin coverage, not a gap in the check.
- **[MINOR]** `AlgemeneFicheplaatsingServiceTests.cs`: `ZetMomenttekstAsync` has no service-level tests for its error paths (unknown placement or moment, too-long text). The too-long case is covered over HTTP.
