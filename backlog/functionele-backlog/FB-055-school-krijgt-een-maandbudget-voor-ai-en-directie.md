---
id: FB-055
titel: School krijgt een maandbudget voor AI, en directie ziet het verbruik in de instellingen
soort: functioneel
status: nieuw
prioriteit: hoog
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 22:23
opgepakt-door:
branch:
pr:
geblokkeerd:
fr: [FR-12]
---

## Aanleiding

Elke AI-vraag kost geld per token, en één vraag om doelsuggesties bij een thema kost vandaag al zo'n 37.000 tokens.
Niets begrenst hoeveel een school per maand verbruikt, en de directie ziet nergens hoeveel er al opging. De school
krijgt een vast maandbudget voor AI, dat de directie kan opvolgen.

## Gewenst gedrag

- Elke school heeft een **maandbudget voor AI**, uitgedrukt in tokens (bijvoorbeeld 3,5 miljoen). Wie de app technisch
  beheert, stelt het basisbudget in; de school stelt het niet zelf in.
- Elke AI-vraag in de app telt mee: doelsuggesties, de thema-opbouwwizard, de jaarplangeneratie, het woordweb en het
  herwerken van een rapporttekst.
- Het verbruik telt **gewogen naar de kost**, volgens de prijsverhouding van het ingestelde model. Voor Claude is dat
  vandaag: een gewoon inputtoken telt 1, een inputtoken uit de cache 0,1, een inputtoken dat in de cache geschreven
  wordt 1,25 en een outputtoken 5. Zo volgt het budget de echte kost, en een goedkopere vraag spaart ook budget.
- Het budget loopt per **kalendermaand** (Belgische tijd) en begint op de eerste van de maand opnieuw bij nul.
- De directie ziet in **Instellingen** een onderdeel AI-verbruik met een **voortgangsbalk**: hoeveel van het budget deze
  maand verbruikt is, in tokens en als percentage, en op welke datum het budget opnieuw begint.
- Vanaf **80 %** verbruik staat bij de balk een waarschuwing in woorden.
- Is het budget **op**, dan vertrekt er geen AI-vraag meer tot de volgende maand of tot er extra tokens bijkomen
  (FB-056). Wie dan een AI-knop gebruikt, krijgt een Nederlandse melding dat het AI-budget van deze maand op is en dat
  de directie het kan laten uitbreiden. Er wordt niets bewaard. Een vraag die vertrok toen er nog budget was, mag
  afgewerkt worden; wat ze te veel verbruikte, telt mee.
- Het verbruik bewaart alleen aantallen, het soort vraag en het tijdstip: geen prompt, geen antwoord en niets over
  kinderen (Art. VI.7).

## Acceptatiecriteria

- [ ] Gegeven een maandbudget van 3.500.000 tokens, wanneer een AI-vraag klaar is, dan stijgt het verbruik van de
  lopende maand met de gewogen tokens van die vraag, en de voortgangsbalk in Instellingen toont het nieuwe totaal.
- [ ] Gegeven een Claude-vraag met 30.000 inputtokens uit de cache, 7.000 gewone inputtokens en 1.000 outputtokens,
  wanneer ze meetelt, dan telt ze als 30.000 × 0,1 + 7.000 × 1 + 1.000 × 5 = 15.000 budgettokens.
- [ ] Gegeven een verbruik van 80 % of meer, wanneer de directie Instellingen opent, dan staat naast de balk een
  waarschuwing in woorden, niet alleen in kleur.
- [ ] Gegeven een budget dat op is, wanneer iemand een AI-knop gebruikt, dan wordt het model niet aangeroepen, wordt er
  niets bewaard en ziet de gebruiker een Nederlandse melding over het maandbudget.
- [ ] Gegeven het verbruik van september, wanneer 1 oktober begint, dan toont de balk 0 verbruikt en werken de
  AI-knoppen weer; het verbruik van september blijft bewaard.
- [ ] Gegeven een gebruiker zonder directierecht, dan ziet die het onderdeel AI-verbruik niet, en de server geeft de
  cijfers ook niet.

## Testscenario's

1. Zet lokaal een klein maandbudget in de configuratie, bijvoorbeeld 60.000 tokens, en start de app.
2. Meld aan als directie en open Instellingen, AI-verbruik. Je ziet een lege balk (0 %) en de datum waarop het budget
   opnieuw begint.
3. Open een thema en vraag doelsuggesties. Ga terug naar AI-verbruik: de balk is gestegen.
4. Vraag opnieuw suggesties tot je boven 80 % komt. Bij de balk staat een waarschuwing in woorden.
5. Vraag verder tot het budget op is. De volgende vraag geeft een melding dat het AI-budget van deze maand op is, en er
   verschijnen geen nieuwe suggesties.
6. Meld aan als leerkracht en open Instellingen. Het onderdeel AI-verbruik staat er niet.

## Buiten scope

- Extra tokens aanvragen en toekennen: FB-056.
- Online betalen in de app.
- Verbruik per gebruiker of per klas tonen.
- De eval-runner van TB-004: die draait buiten de app en telt niet mee.

## Open vragen

- **De hoogte van het basisbudget** per school (3,5 miljoen is een voorbeeld): de eigenaar beslist het per omgeving.
- **De weging voor Azure AI Foundry** (gpt-5.4-mini) volgt de prijslijst van Azure; de waarden komen in de configuratie
  naast die van Claude.

## Werklog

- 2026-09-16 22:23 · eigenaar · aangemaakt (status nieuw)
