# FB-013 — antagonist

## Round 1 (2026-09-15, on `d6abd72`, diff `75456e2..HEAD`)

**Verdict: VIOLATIONS FOUND.** One MAJOR, five MINOR, one question.

### MAJOR (blocking)

- **The leerplandoel register still showed every klas's algemene fiches.** `GET /api/leerplandoelen/{code}` had no
  rights check and, through `Koppelingzichtbaarheid.Alles` hard-wired in `LeerplandoelenController`, returned every
  klas's fiche links with the fiche and klas names. A K3 leerkracht could read a K2 klas's fiches, and a gebruiker
  without any right could read all of them. That made "one matrix row decides it" (Art. VI.1, XIV) and ADR-0040's
  consequence false. The new read sweep could not catch it, since it only visits GET routes with a `klasId` parameter.

  **Fixed:** the query takes a `Func<Klasinzage, bool>` and keeps a fiche only when its klas passes; the controller
  answers it from `Rechtenmatrix.StaatToe(rechten, KlasplanningBekijken, klas)`, the same row. `Koppelingzichtbaarheid`
  now gates the shared layers only (themadoelen, doelsuggesties, per-leeftijd subdoelen and activiteit links, none of
  them one klas's planning), and says so. The doel detail's empty sentence becomes "Nog nergens gebruikt in wat je mag
  inkijken" for a reader who does not read every klas. Tests: `Het_doelenregister_toont_een_algemene_fiche_alleen_aan_wie_haar_klas_mag_inkijken`
  (K3 leerkracht and gebruiker without a right do not see a K2 fiche; K2 hoofdleerkracht, themabeheer and directie do)
  and a query-level case in `AlgemeneFichesPostgresTests`.

### MINOR

1. *The reader's own relation lapses with its schooljaar* borrowed R20 unmarked. **Fixed:** recorded as default **Z7**
   in ADR-0040, Art. VI.1's defaults list, ADR-0030 footnote 8 and the ratification log row.
2. `docs/besluiten-gevraagd.md` presented Z6 to directie as a ruling and said "leerjaar". **Fixed:** "jaarfase", and Z6
   named as a standaardkeuze.
3. Default (e) in the constitution and ADR-0030 §4 (e) still granted reading. **Fixed** in both.
4. `GET /api/schooljaren` still named every klas. **Fixed:** the klassen inside a schooljaar are filtered by the same
   row, through one shared helper (`Klasinzagefilter.LeesbaarAsync`) that `GET /api/klassen` uses too. Tested for a
   leerkracht, a gebruiker without a right and directie.
5. The klaskiezer's empty-list sentence rendered while the list loaded or had failed (E5-03 rule). **Fixed:** it says
   the list is loading, or that it failed, and only otherwise what an empty list means; two tests.

### Question for the owner

- Should a leerkracht whose only klas is in a schooljaar that has ended keep reading the klassen of that jaarfase until
  she gets a new klastoewijzing (July and August)? Today she reads her own klas only (default Z7).

### Also done between the audit and the re-audit

- `main` was merged in. Main had taken **ADR-0039** for the AI buttons (TB-023), so FB-013's ADR is **ADR-0040** now.
  FB-002's new `Rapportsetleerkracht` column had the value 512 that FB-013's `HoofdleerkrachtLezen` used; the three
  read columns moved to 1024, 2048 and 4096.
