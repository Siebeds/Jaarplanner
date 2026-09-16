---
id: FB-004
titel: Leerkracht laat een rapporttekst of het besluit herwerken door AI
soort: functioneel
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-14
bijgewerkt: 2026-09-16 09:32
opgepakt-door: rapport-herwerken
branch: ticket/FB-004-rapporttekst-herwerken
pr:
geblokkeerd:
fr: [FR-13.4]
---

## Aanleiding

Drie keer per jaar een verzorgde tekst schrijven bij elk rapportdoel en een besluit voor elk kind van de klas kost veel
tijd. De eigenaar besliste dat de leerkracht de tekst bij een rapportdoel (R21) en het algemene besluit (R22) kan laten
herwerken door AI, zonder dat de naam van het kind meegaat.

Dit is bouwticket 4 van ADR-0035 §6. **Bouwvolgorde:** na FB-003 (de teksten en het besluit).

## Gewenst gedrag

- Bij elke tekst van een rapportdoel en bij het algemeen besluit staat een knop om de tekst te laten herwerken. Die is er
  alleen voor wie het rapport mag invullen: een leerkracht van de klas tijdens het schooljaar, of de directie.
- **Alleen die ene tekst vertrekt** (R21): geen titel van het rapportdoel, geen ster, geen subdoelen, geen ander kind en
  geen vroeger rapport. De AI houdt de betekenis en voegt niets toe.
- **Namen** (R21, R25, D14):
  - voor de tekst vertrekt, vervangt de app de voornaam en de achternaam van **elk kind van de klas**, en daarna zet ze
    ze terug;
  - de app volgt de hoofdletters van de naam: "Roos" als naam wordt vervangen, "een roos" in kleine letters niet;
  - bij de knop staat een **melding** dat de namen van de kinderen van de klas vervangen worden, en een bijnaam, een
    tikfout of een andere naam (van een broer, een zus of een ouder) niet. Er is geen stap waarin de leerkracht eerst
    ziet wat vertrekt. De bouw stelt de tekst van de melding voor.
- De leerkracht ziet de oude en de nieuwe tekst **naast elkaar, zonder uitleg** (R24), en kan het voorstel aanvaarden,
  eerst aanpassen of weigeren.
- **Wat bewaard wordt** (R23):
  - aanvaard zonder wijziging: de tekst, als `aanvaard`;
  - eerst aangepast: de tekst, als `manueel`;
  - geweigerd: alleen dat er een voorstel geweigerd werd, zonder de voorgestelde tekst. De bewaarde tekst blijft zoals
    hij was.
  - Een voorstel waarover nog niet beslist is, wordt nergens bewaard.
- Antwoordt de AI niet, of geeft ze een onbruikbaar antwoord, dan krijgt de leerkracht een Nederlandse melding en
  blijft de eigen tekst staan.

**Bindend:** Art. IV (zoals gewijzigd op 2026-09-14), Art. VI.3 en VI.7, en ADR-0035 §3.5, met D13 (de server
ondertekent elk voorstel, zodat `aanvaard` en `geweigerd` de vaststelling van de server zijn) en D14. De prompt en het
antwoord van de AI komen nooit in een log. Dit ticket past ook de twee codecommentaren aan die ADR-0035 §4 eraan
toewijst (`IAiClient.cs` en `JaarplanGeneratiePromptBuilder.cs`).

## Acceptatiecriteria

- [ ] Gegeven een tekst bij een rapportdoel of het algemeen besluit, wanneer de leerkracht op herwerken klikt, dan ziet die bij de knop de melding over de namen, en daarna de oude en de nieuwe tekst naast elkaar, zonder uitleg.
- [ ] Gegeven een tekst met de naam van een kind van de klas, wanneer het voorstel terugkomt, dan staat die naam er correct in, en blijft een gewoon woord in kleine letters dat ook een voornaam is (zoals "roos") onveranderd.
- [ ] Gegeven een voorstel, wanneer de leerkracht het zonder wijziging aanvaardt, dan wordt het bewaard als aanvaard; past de leerkracht het eerst aan, dan als manueel.
- [ ] Gegeven een voorstel, wanneer de leerkracht het weigert, dan blijft de bewaarde tekst ongewijzigd, en is de voorgestelde tekst na herladen nergens terug te vinden.
- [ ] Gegeven een schooljaar dat voorbij is, of een gebruiker die het rapport alleen mag lezen, dan is er geen knop om te herwerken, en weigert de app een herwerking ook via het adres.
- [ ] Gegeven dat de AI-dienst niet antwoordt of een onbruikbaar antwoord geeft, dan krijgt de leerkracht een Nederlandse melding, en blijft de eigen tekst staan.

## Testscenario's

1. Zorg voor een K3-klas met de verzonnen kinderen "Roos Proefmans" en "Staf Voorbeeld". Schrijf in Rapport 1 van Roos
   bij een rapportdoel: "Roos tekende deze periode vaak een roos en speelde graag met Staf."
2. Klik op herwerken. De melding over de namen staat er. De oude en de nieuwe tekst staan naast elkaar, zonder uitleg.
   In de nieuwe tekst staan "Roos" en "Staf" correct, en "een roos" in kleine letters.
3. Aanvaard het voorstel zonder wijziging. De nieuwe tekst is bewaard.
4. Herwerk opnieuw, pas het voorstel aan en bewaar. De aangepaste tekst is bewaard.
5. Herwerk opnieuw en weiger. De tekst uit stap 4 blijft staan. Herlaad: het voorstel is weg.
6. Herwerk het algemeen besluit en doorloop dezelfde stappen.
7. Meld aan als directie: herwerken lukt. Kies als leerkracht een schooljaar dat voorbij is: er is geen knop.
8. Op een testomgeving zonder AI-instellingen: herwerken geeft een Nederlandse melding, en de tekst blijft staan.

## Buiten scope

- Een stap waarin de leerkracht eerst ziet welke tekst vertrekt (R25: niet gekozen).
- Bijnamen, tikfouten of andere namen herkennen (R25).
- Een uitleg bij het voorstel (R24).
- De naam van het kind, de ster of de titel van het rapportdoel meesturen (R21).
- Een tekst laten schrijven zonder dat de leerkracht er een typte: de AI herwerkt alleen een bestaande tekst.

## Open vragen

Geen.

## Werklog

- 2026-09-14 14:38 · rapport-tickets · aangemaakt (status nieuw)
- 2026-09-16 09:32 · eigenaar · nieuw → klaar-voor-bouw: eigenaar geeft groen licht om te bouwen tegen de fake AI-client; de echte AI-test volgt zodra er een Foundry-endpoint is
- 2026-09-16 09:32 · rapport-herwerken · klaar-voor-bouw → in-uitvoering: opgepakt
