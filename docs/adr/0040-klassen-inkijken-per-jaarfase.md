# ADR-0040 — A leerkracht reads the klassen of her own jaarfase

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** Project owner, 2026-09-15: the rulings recorded in FB-013 (*Beslissingen van de eigenaar*). Directie's
  confirmation of question 4 in [`docs/besluiten-gevraagd.md`](../besluiten-gevraagd.md) is still outstanding.
- **Supersedes:** [ADR-0030](0030-rollen-en-rechten-in-de-app.md) default **I9** (every gebruiker reads and exports
  every klas) and the "lezen" cells it gave the §3 rows *Jaarplan, agenda en dekking bekijken* and *Exporteren*.
  Narrows ADR-0030 §4 (d), which stays open for directie.
- **Realises:** FB-013, which takes over E6-08 and E6-09; FR-10.1, FR-10.2. **Constitution:** Art. VI.1, VI.7, XIV.

## Context

ADR-0030 R7 lets a leerkracht view *"andere klassen"* without saying how many. The build's default, I9, let every
signed-in gebruiker read and export every klas, including a gebruiker who holds no right at all. Directie was asked how
far that should reach (question 4) and has not answered. On 2026-09-15 the owner asked: *"een leerkracht mag agenda's
zien van klassen uit dezelfde klasfase, maar NIET van andere klasfases"*, and ruled who else reads what.

## Decision

Five rulings of the owner (Z1 to Z5) and one default (Z6):

- **Z1.** A leerkracht reads the klassen of her own jaarfase: their agenda, jaarplan and dekking, and their export. A
  leerkracht with klassen in two jaarfasen reads the klassen of both. Her own klassen she reads in any case.
- **Z2.** A hoofdleerkracht reads the klassen of the jaarfase she is appointed for, with or without a klas of her own.
- **Z3.** Whoever holds themabeheer reads every klas.
- **Z4.** A gebruiker who holds none of these relations (no klas, no appointment, no themabeheer, not directie) reads
  no klas, and the screen says so in plain words.
- **Z5.** Directie reads every klas, as before (R3).
- **Z6 (a default, not ruled).** The rule holds in every schooljaar: a leerkracht of K3 reads the K3 klassen of earlier
  and later schooljaren too. FB-013 offered it as the standard answer to its third open question.

"Her jaarfase" is the relation ADR-0030 §3 already has: "LK leeftijd", the stated jaarfase of a klas she teaches in a
schooljaar that has not ended (R20, R22), and "HL", an appointment in such a schooljaar. The jaarfase **of the klas that
is read** comes from the one klas→leeftijden mapping of Art. VI.1 (`Leeftijdsrechten.VoorKlas`). So a graadklas stands
for its one stated jaarfase, and directie's graadklas decision (Art. XIV) moves this rule with the leeftijd rights. A
klas without a stated jaarfase stands for none: only its own leerkrachten, themabeheer and directie read it, which fails
closed as I12 does.

Writing does not change: only the klas's own leerkrachten and directie edit its planning (R7, R15). The
ontwikkelingsrapport keeps its stricter rule (ADR-0035 R17).

## How it is built

- **One row is the E6-09 seam.** `Rechtenmatrix.KlasplanningBekijken` is the two §3 rows *bekijken* and *Exporteren*
  as one policy. It has columns of its own (`Themabeheer`, `HoofdleerkrachtLezen`, `LeerkrachtLeeftijdLezen`,
  `LeerkrachtEigenLezen`) and a resource of its own (`Klasinzage`, which can only be built from the klas's stated
  jaarfase through the one mapping). The read resource therefore passes no other row, and no other resource passes the
  read row. A different answer from directie changes this row and nothing else.
- **Every read of one klas's planning declares the row:** `GET /api/klassen/{klasId}` and that klas's jaarplan,
  jaarplan parameters, weekplanning, dekking (with voortgang and export), hoeken, hoekplaatsingen, algemene fiches and
  algemene ficheplaatsingen, each as `[RechtOp(KlasplanningBekijken, Rechtbron.Klasinzage, "klasId")]`. A sweep test
  sends every GET route that names a klas to a gebruiker without any right and fails on any route that answers anything
  but the authorisation's 403, so a read added later cannot skip the row unnoticed.
- **`GET /api/klassen` lists only the klassen the row lets the gebruiker read**, each asked on its own `Klasinzage`, so
  the klaskiezer offers nothing the routes would refuse.
- **Taking hoeken over** from another klas reads that klas, so the action asks the row on the source klas as well.
- **Two reads stay open to every signed-in gebruiker**, because they read shared content at a klas's leeftijden and not
  the klas's planning (Art. IX.2): `GET /api/themas/{themaId}/voor-klas/{klasId}` and
  `GET /api/subthemas/voor-klas/{klasId}`. The sweep lists them with that reason.
- **The frontend** mirrors the row in `lib/rechten.ts` and asks only its resource-free part: whether a gebruiker reads
  every klas (only then may an empty list say the schooljaar has no klassen) and whether they hold no relation at all
  (Z4's sentence).

## Consequences

- A leerkracht no longer reaches another jaarfase's klassen: not in the klaskiezer, not by typing an address, not
  through an export or a hoek overname.
- A zorgcoördinator or ICT-coördinator without a right, who read every plan under I9, now reads none until directie
  gives them a klas, an appointment or themabeheer. That is Z4 as ruled.
- ADR-0030 §4 (d) stays open for directie: confirm the rule, widen it, narrow it, or make it configurable. E6-09 stays
  blocked on that answer.

## Alternatives considered

- **Keep I9 until directie answers.** Rejected by the owner's ruling of 2026-09-15.
- **Filter only the klaskiezer.** Rejected: a typed address or an export would still reach another jaarfase, which
  FB-013's second criterion forbids.
- **Let the ordinary HL, "LK leeftijd" and "LK eigen" columns match the read resource.** Rejected while building: the
  read resource would then pass every row that has those columns, against the matrix's rule that a resource of the
  wrong kind opens nothing.
