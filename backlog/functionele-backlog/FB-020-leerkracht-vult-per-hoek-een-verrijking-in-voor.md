---
id: FB-020
titel: Leerkracht vult per hoek een verrijking in voor het lopende subthema
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-15
bijgewerkt: 2026-09-15 17:46
opgepakt-door: hoekverrijking
branch: ticket/FB-020-hoekverrijking-per-subthema
pr:
geblokkeerd:
fr: [FR-3.1]
---

## Aanleiding

De eigenaar vroeg op 2026-09-15: *"een leerkracht moet de hoekenverrijking via de agenda kunnen invullen en bekijken, dit
is geen activiteit in de agenda (verschillend van hoekenfiches die wel als blok in de agenda kunnen geplaatst worden als
alle kleuters hoekentijd krijgen), maar loopt overheen verschillende dagen (best linken aan een subthema - klik op
subthema, vul hoekenverrijking in, zie hoekenverrijking preview in subthemabar op agenda)"*.

Vandaag is een verrijking vrije tekst die aan een ingeplande hoek hangt, met eigen datums, en ze wordt ingevuld in het
detail van die hoek. Ze heeft geen band met het subthema dat op dat moment loopt.

**Beslissingen van de eigenaar, 2026-09-15:**

- een verrijking hoort **per klas, per hoek, bij het lopende subthema**;
- ze is **geen blok** in de agenda; wie links op Hoekenfiches klikt, ziet de hoeken met daaronder hun verrijking, en ook
  in de detailpagina van de hoek;
- de subthemabalk van de agenda toont een voorbeeld;
- dit vervangt de verrijking met eigen datums;
- de directie moet achteraf kunnen zien welke verrijkingen er waren (FB-021).

## Gewenst gedrag

- In de agenda klikt de leerkracht op een lopend subthema in de subthemabalk. Er opent een blad met elke hoek van de klas
  en een tekstveld per hoek: de verrijking van die hoek voor deze subthemaperiode.
- Na bewaren toont de subthemabalk een kort voorbeeld (bv. hoeveel hoeken verrijkt zijn, en het begin van de tekst).
- In de zijbalk, onder Hoekenfiches, staat onder elke hoek de verrijking van het subthema dat in de zichtbare week loopt.
- De detailpagina van een hoek toont zijn verrijkingen per subthemaperiode.
- Een verrijking staat nooit als blok op het tijdraster. Een hoekenfiche blijft wel als blok planbaar, zoals nu.

## Acceptatiecriteria

- [ ] Gegeven een klas met drie hoeken en een lopend subthema, wanneer de leerkracht op dat subthema in de subthemabalk
  klikt, dan kan ze voor elk van de drie hoeken een verrijking invullen en bewaren.
- [ ] Gegeven bewaarde verrijkingen, dan toont de subthemabalk er een voorbeeld van, en de zijbalk toont onder elke
  hoek de verrijking van het subthema van de zichtbare week.
- [ ] Gegeven een volgende subthemaperiode, dan is de verrijking per hoek leeg tot de leerkracht ze invult; de vorige
  blijft bewaard.
- [ ] Gegeven de detailpagina van een hoek, dan staan daar zijn verrijkingen per subthemaperiode.
- [ ] Gegeven een verrijking, dan staat ze niet als blok op het tijdraster.
- [ ] Gegeven een andere klas van dezelfde leeftijd, dan ziet die haar eigen verrijkingen, niet die van deze klas.

## Testscenario's

1. Open de agenda van een K2-klas in een week waarin een subthema loopt.
2. Klik op het subthema in de subthemabalk. Vul bij de boekenhoek en de bouwhoek een verrijking in en bewaar.
3. De subthemabalk toont een voorbeeld. Klik links op Hoekenfiches: onder de boekenhoek en de bouwhoek staat hun
   verrijking.
4. Open het detail van de boekenhoek: de verrijking staat bij deze subthemaperiode.
5. Ga naar een week van het volgende subthema. Onder de hoeken staat nog niets.
6. Open de agenda van de andere K2-klas. Haar hoeken tonen haar eigen verrijkingen.
7. Herhaal stap 2 en 3 op ~390px.

## Buiten scope

- Doelen op een verrijking: FB-019.
- AI die verrijkingen voorstelt: FB-028.
- Het overzicht voor de directie: FB-021.

## Open vragen

- **Subthemabalk:** een balk boven het tijdraster met de lopende subthema's bestaat nog niet; story E10-01 ontwerpt ze
  voor de streefwoordenschat. Wie eerst gebouwd wordt, bouwt de balk, en de andere gebruikt ze.
- **Bestaande verrijkingen met eigen datums** (demo en ontwikkeling): **standaard** krijgt elke verrijking de
  subthemaperiode waarmee ze overlapt, en een verrijking zonder subthemaperiode blijft leesbaar in het detail van de hoek.
  Is dat goed, of mogen ze weg?
  **Beslist door de eigenaar, 2026-09-15:** omzetten naar elke subthemaperiode van de klas waarmee ze overlapt; een
  verrijking die met geen enkele periode overlapt, verdwijnt. Er blijft één soort verrijking over.
- Een subthema dat in de agenda van de klas niet ingepland is, heeft geen periode en dus geen verrijking. Is dat goed?
  **Beslist door de eigenaar, 2026-09-15:** de agenda toont een subthema ook als het alleen via activiteiten loopt,
  zonder vastgelegde periode. Bij het eerste bewaren legt de tool die periode vast zoals de balk ze toont, en het blad
  zegt dat vooraf.
- **Beslist door de eigenaar, 2026-09-15:** wordt een subthema verwijderd, dan gaan de verrijkingen van zijn periodes
  mee weg, en de bevestiging bij het verwijderen zegt hoeveel.
- **Beslist door de eigenaar, 2026-09-15:** in het hoekdetail kan de leerkracht de verrijking per subthemaperiode ook
  bewerken, niet alleen lezen.

## Werklog

- 2026-09-15 14:10 · wensen-tickets · aangemaakt (status nieuw)
- 2026-09-15 17:19 · eigenaar · nieuw → klaar-voor-bouw: op klaar-voor-bouw gezet door de eigenaar (in sessie, 2026-09-15)
- 2026-09-15 17:21 · hoekverrijking · klaar-voor-bouw → in-uitvoering: opgepakt; eigenaar besliste: oude verrijkingen omzetten naar de overlappende subthemaperiodes (rest weg), periode mee vastleggen bij een subthema zonder vastgelegde periode, bij verwijderen van een subthema het aantal verrijkingen noemen, verrijking ook bewerkbaar in het hoekdetail
- 2026-09-15 17:46 · hoekverrijking · backend klaar: verrijking per (hoek, subthemaperiode) buiten het jaarplan, route /api/klassen/{id}/hoekverrijkingen (lezen per bereik, bewaren per periode met periode vastleggen), aantal per subthema, migratie zet oude verrijkingen om (ADR-0040 volgt); unit 1632 groen, Postgres-tests voor endpoint, cascade en migratie groen
