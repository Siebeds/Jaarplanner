# FB-001: frontend half and the session's own decisions

- **Ticket:** FB-001, "K3-leerkracht beheert de kinderen van de klas, via een nieuwe tab onderaan de zijbalk".
  FR-13.1, FR-13.7, FR-13.10.
- **Session:** `kindvolg`, 2026-09-15. The backend half was built by an implementer subagent; see
  `implementatie-backend.md`.
- **Branch:** `ticket/FB-001-kinderen-van-de-klas`.

## Owner rulings in session, 2026-09-15

The two open questions in the ticket were put to the owner as multiple-choice questions before anything was built:

- **Phone:** "Via Instellingen", not the recommended sixth tab. The bottom bar keeps its five tabs for everyone. On a
  phone the report is reached through a card at the top of Instellingen, shown to whoever may read a report.
- **"ONDERAAN":** "Boven Instellingen (Aanbevolen)", which is D17 as ADR-0035 writes it. From `lg` the report sits in a
  section of its own, over a rule, above Instellingen, and Instellingen stays last before the sign-in row.

Asked after antagonist round 1 (finding 12):

- **A K3 klas with children cannot be moved to another jaarfase until the children are deleted:** "Ja, zo laten
  (Aanbevolen)".

Also asked, for what comes next: the K3 scale in FB-002 starts from the owner's own example. FB-002 is built on top of
this branch, and this branch may be pushed with a PR once the antagonist is green.

## Design (frontend-design step)

The direction is fixed by ADR-0024 ("Inkt en Signaal"). The screen uses existing tokens only and adds no hue:

- `accent` appears on the primary button ("Kind toevoegen", "Bewaren") and on the active destination: two of its five
  rationed uses.
- Errors use the `attentie` style that the other screens use.

Decisions:

- **Adding twenty names is the job the screen is shaped around** (R15: by hand, one by one). The two fields sit above
  the list. After each child they empty and Voornaam takes the focus again, and a polite live region names who was
  added, because the new row lands somewhere in a sorted list.
- **One card with rules, not a card per child.** A class list is read down the page, and twenty bordered boxes would be
  louder than the names in them. The voornaam carries the weight, because it is the name a kleuterleerkracht uses.
- **Rename in place.** The row turns into the same two fields. Escape or Annuleren puts it back, and focus returns to
  the row's own buttons afterwards.
- **Delete** uses the existing `Bevestiging` sheet. Its consequence line says the reports go too (the ticket's
  acceptance criterion).
- **The klas choice** lists only the klassen that the server says can hold children and that this person may read, so
  it is not the header's Klaskiezer. Choosing one still sets the app's one klas.
- **Name fields** have `autoComplete="off"`: a child's name is not something the browser should offer again in another
  field.
- **Icon:** a sheet with a star (`IcoonRapport`), in the hand-drawn set's geometry. The star is what a report is made of
  (R5); a face or a child would draw a pupil.

## Files (frontend)

| File | What |
| --- | --- |
| `src/features/ontwikkelingsrapport/OntwikkelingsrapportScherm.tsx` | the screen |
| `src/features/ontwikkelingsrapport/leerlingen.ts` | the queries and mutations; nothing is written to storage |
| `src/lib/rechten.ts` | the two rows mirrored, the `rapportklas` resource, `ontwikkelingsrapportZien`, `ontwikkelingsrapportLezen`, `leerlingenBeheren`, `rapportAlleenNogLezen` (the one condition under which "Dit schooljaar is voorbij" may be said, per the E5-03 rule) |
| `src/lib/aanmelding.ts` | `rapportklasIds` and `lopendeRapportklasIds` on `Ik` |
| `src/app/routes.ts` | the `RAPPORT` destination |
| `src/app/Navigatie.tsx` | the section from `lg` only, which moves the push to the bottom edge off Instellingen |
| `src/features/instellingen/Instellingenindeling.tsx` | the phone card |
| `src/components/Iconen.tsx` | `IcoonRapport` |
| `src/components/ui/Veld.tsx` | `Invoer` passes a `ref` |
| `src/App.tsx` | the route |
| `src/i18n/nl.json` | `navigatie.ontwikkelingsrapport` and the `ontwikkelingsrapport` group |
| `src/lib/types.ts` | `KlasWeergave.kanLeerlingenHebben` (fix round 1) |

**Tests:**

- the new `OntwikkelingsrapportScherm.test.tsx`;
- new cases in `Navigatie.test.tsx`, `Instellingenindeling.test.tsx` and `rechten.test.ts`, whose row count goes from
  18 to 20;
- the `Ik` and `KlasWeergave` literals in existing tests gained the new fields.

## Gates

- **Before round 1:**
  - `pnpm lint` (oxlint + tsc) clean; `pnpm test` 65 files, 647 tests green.
  - Browser pass at 1440 and 390 recorded in `browsercheck.md`.
- **Fix round 1:** see the ticket Werklog and the round 2 audit.

## Fix round 1 (antagonist round 1, `antagonist-ronde-1.md`)

| Finding | Change |
| --- | --- |
| 1 (MAJOR) | The screen filters on the server's `kanLeerlingenHebben`, not on `jaarfase === "K3"`. A test with a menggroep stated as K2 that the server says can hold children pins that the screen follows the server. |
| 2 | "Dit kind is niet gevonden." |
| 3 | The comment's claim about the server's words was dropped. |
| 4 | `no-store` asserted on every 200 list read in `LeerlingEndpointsTests`. |
| 5 | This worklog, and a dated note in the backend one. |
| 6 | The browser pass is `browsercheck.md`. |
| 7 | The screen's own `ontwikkelingsrapport.verwijderTitel`. |
| 8 | "Je hebt geen toegang tot het ontwikkelingsrapport." |
| 9 | Its own sentence when no schooljaar exists. |
| 10 | A dated note in ADR-0030 footnote ⁶. |
| 11 | `.gitignore` ignores `**/Microsoft.NET.Workload_*.log`. |
| 12 | The owner ruling above. |
