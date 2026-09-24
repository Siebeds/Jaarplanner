# FB-028 worklog: the AI proposes a hoekverrijking per hoek

## What was built

- Owner rulings 2026-09-24 (H1 to H3, ADR-0070): a small AI button per hoek row in the Hoekenfiches panel; the proposal
  belongs to the klas (whoever may plan it, and admin); an Art. IV.4 exception for the verrijking's text. Art. IV.1, IV.4
  and IV.5 amended, logged in `docs/constitutie-log.md`.
- Backend: `Hoekverrijkingsvoorstel` (hoek + subthema, status, motivation, xmin) and migration
  `Hoekverrijkingsvoorstellen`; prompt builder, parser, service; three routes under `KlasplanningBewerken`. Accepting
  writes through `IHoekverrijkingService.BewaarAsync`.
- Frontend: `Hoekvoorstel.tsx` in `Hoekenlijst.tsx`; `hoekvoorstel.*` in `nl.json`.

## Evidence per acceptance criterion

1. A proposal per hoek with a motivation: `HoekverrijkingsvoorstellenEndpointsTests.Per_hoek_een_voorstel_met_motivatie_...`,
   Vitest `Hoekvoorstel.test.tsx`, and the browser pass (three hoeken, real AI).
2. Taking it over makes it the verrijking for that period, still editable: endpoint tests (unchanged `Aanvaard`, edited
   `Manueel`), browser pass (edited, taken over, the text stood in the row).
3. An existing verrijking stays until she takes the proposal over: `Een_bestaande_verrijking_blijft_tot_...`, browser
   pass (boekenhoek).
4. A rejection changes nothing: `Weigeren_verandert_de_verrijking_niet_...`, browser pass (bouwhoek).
5. Faked AI: unit and integration tests run on the stubbed `IAiClient`.

## Gates

- `dotnet test`: unit 2374 passed; Postgres integration tests for hoekverrijking(svoorstellen), the route sweep and the
  seed check green.
- `pnpm test`: 1420 passed on the second full run; the first run had one flaky failure in `DoelenScherm.test.tsx`
  (unrelated, passes on its own and in the rerun).
- `pnpm lint`, `dotnet format`: clean.
- Browser (CDP, own Chrome profile, throwaway database `jp_fb028`, real Claude provider): desktop 1440, dark mode and
  390px. Contrast of the proposal's text, motivation and AI mark: 6.51 to 17.78 in light, 7.58 to 13.12 in dark.
  Found and fixed during the pass: the proposal's header overflowed the 240px column, and the AI wrote ~400 characters;
  the header now wraps and the prompt asks for about 200.

## Antagonist

One audit: COMPLIANT, no CRITICAL or MAJOR. MINOR findings:

- Fixed: the prompt named both 200 and 1000 characters; the 1000 line is gone (the parser still enforces it).
- Not fixed, left for a later ticket if it ever matters:
  - Two simultaneous requests for one (hoek, subthema) can both store an open proposal; a partial unique index on the
    open pair would prevent it. The screen shows one of them.
  - Accepting into a subthema without a stored window saves the window, and with it the decision, before the text; if
    the text then fails, the decision stands without a verrijking (the same exception `HoekverrijkingService` names).
  - The frontend's `MAXIMAAL_VOORSTEL` repeats the server's 1000 by hand.
  - "Klas {id} is niet gevonden." shows a GUID; the same pattern exists elsewhere.
- Question for the owner: Art. IX lists no hoek, verrijking or this proposal; whether it should is his call.
