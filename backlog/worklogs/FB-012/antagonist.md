# FB-012 — antagonist audit and gates

## Antagonist (one round)

**Verdict: COMPLIANT.** No CRITICAL or MAJOR findings. Checked: Art. XI/IX.2 (amendment in its own commit with ADR-0069,
the log row, CLAUDE.md and the functional analysis), IX (every path that adds a subthema is guarded, the migration
backfills all nine), V (dekking untouched), IV (generation still stores `Voorgesteld` with a motivation), VI.1 (no rights
changed), II (copy in `nl.json`, Dutch server sentences an admin or themabeheer can act on, no em dash), VIII.

MINOR findings and what happened to them:

- The guard on accepting a subthemavoorstel (`SubdoelplaatsingService`) and the skip in the FR-1 import
  (`SchoolcontentImportService`) have no test of their own. **Not fixed**; both call the tested domain rule
  `Thema.HoudtLeeftijd`.
- A new thema whose `/api/jaarfasen` had not loaded asked for a leeftijd it could not show. **Fixed**: the form then
  sends none, which the server reads as all nine.
- `GET /api/themas/bibliotheek?klasId=` does not check that the caller may read that klas; it reveals only whether a
  klas exists and filters the school-wide list. **Not fixed.**
- No service-level test pins that a klas without a derivable leeftijd is offered every thema. **Not fixed**; the domain
  test does (`GeldtVoor(null)`).
- QUESTION: a graadklas sees the thema's of its one recorded jaarfase, the seam rights already use (Art. XIV).

## Found in the browser pass and fixed

- The refusal ended with "verplaats of verwijder die subthema's" also when only a jaarplan stood in the way. The advice
  now names only what is in the way (CLAUDE.md: a conditional sentence asserts only what its condition guarantees).

## Gates

- Backend unit tests: 2378 passed.
- Postgres integration tests: full run, see the ticket's Werklog.
- `dotnet format`: clean. Frontend `pnpm lint`: clean; `pnpm test`: 1417 passed.
- Browser (throwaway copy `jp_fb012`, desktop and 390px): the form limits "Verkeer"; removing L3 is refused naming
  "L3 derde leerjaar (demo)"; "Lente en groei" limited to K2, K3 shows "Voor K2, K3" in the list, is absent from the
  L3 klas's "Thema toevoegen" and present in the K3 klas's list; its subthema form offers only K2 and K3; placing it in
  the L3 klas and a JK subthema are refused by the server.
