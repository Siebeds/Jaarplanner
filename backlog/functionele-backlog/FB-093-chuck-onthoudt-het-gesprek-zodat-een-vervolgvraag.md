---
id: FB-093
titel: Chuck onthoudt het gesprek, zodat een vervolgvraag op de vorige vraag kan steunen
soort: functioneel
status: in-uitvoering
prioriteit: hoog
aangemaakt: 2026-09-23
bijgewerkt: 2026-09-24 16:47
opgepakt-door: claude-fb093
branch: ticket/FB-093-chuck-onthoudt-gesprek
pr:
geblokkeerd:
fr: [FR-14.10]
---

## Aanleiding

In de chat van Chuck (FB-031, [ADR-0066](../../docs/adr/0066-de-chat-van-de-kat-kiest-een-opzoeking.md)) staat
elke vraag op zichzelf: de AI krijgt alleen de nieuwste vraag mee (ADR-0066 D1). Een leerkracht praat niet zo. Na "zit
K-1.5.2 in thema Herfst?" vraagt ze "en in thema Water?", en na "bij welk subthema hoort Plassen springen?" vraagt ze
"welke doelen heeft dat subthema?". Chuck begrijpt die vervolgvragen vandaag niet, omdat hij niet weet waarover het
net ging. Ook een uitleg die om verduidelijking vraagt ("en hoe haal ik ze weer weg?") mist de vorige vraag.

**Onderzoek van 2026-09-23.** Een taalmodel onthoudt zelf niets: de AI-API's van Anthropic en Azure zijn
*stateless*, en een gesprek is de volledige reeks beurten (vraag, antwoord, vraag, ...) die bij elke nieuwe vraag
opnieuw wordt meegestuurd. De gebruikelijke manier om dat te begrenzen is de recentste beurten houden die binnen een
tokenbudget passen, met de instructies en de nieuwe vraag altijd erbij. De vaste instructies en de handleiding
blijven vooraan staan, zodat ze in de cache blijven en elke vraag alleen de nieuwe beurt extra kost. Omdat de tool
geen gesprek bewaart (Art. VI.2, ADR-0059 D6), komt de geschiedenis uit de browser. Een geschiedenis die uit de
browser komt, kan vervalst worden: een gebruiker kan een nep-antwoord van Chuck invoegen om de AI te sturen. Dat is
een bekende aanval op chatbots, en de aanbevolen verdediging is dat de server zijn eigen beurten ondertekent en een
beurt die niet klopt weigert.

Bronnen: [Anthropic, Using the Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages);
[Microsoft Learn, Work with chat completion models](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/chatgpt);
[Truncating conversation history for chat completions](http://blog.pamelafox.org/2024/06/truncating-conversation-history-for.html);
[Prompt Injection Risks in Third-Party AI Chatbot Plugins](https://arxiv.org/pdf/2511.05797);
[Conversation History Is a Trust Boundary](https://tianpan.co/blog/2026/05/13/conversation-history-trust-boundary).

**Beslissingen van de eigenaar, 2026-09-23:** Chuck krijgt de laatste beurten mee binnen een vaste grens, zonder
samenvatting; de server ondertekent elke beurt; van een opzoeking gaan alleen de soort en de gevonden namen en codes
mee; prioriteit hoog.

## Gewenst gedrag

- Zolang het venster van Chuck open is, is de chat één gesprek. Een nieuwe vraag mag steunen op wat eerder in dat
  gesprek gevraagd en geantwoord werd: "en in thema Water?", "welke doelen heeft dat subthema?", "en hoe haal ik ze
  weer weg?".
- Chuck krijgt bij een nieuwe vraag de laatste beurten van het gesprek mee, tot een vaste grens (standaard de laatste
  tien beurten). Oudere beurten vallen weg; wat eruit valt, kent Chuck niet meer.
- Van een eerdere opzoeking krijgt de AI alleen mee wat nodig is om een vervolgvraag te begrijpen: welke opzoeking
  het was, en de namen en codes die de tool vond (bijvoorbeeld doel K-1.5.2, thema Herfst). Nooit de volledige lijst
  van plekken, de agenda of een tekst uit de gegevens van de school.
- Het antwoord op een vervolgvraag komt, net als nu, uit de gegevens van de tool en met de rechten van de gebruiker.
  Het gesprek geeft geen toegang tot iets wat de gebruiker niet op het scherm mag zien.
- De tool bewaart het gesprek nog steeds niet. Wie het venster sluit, begint een nieuw gesprek.
- Een beurt die niet van Chuck komt of onderweg gewijzigd is, telt niet mee: de server herkent zijn eigen antwoorden en
  weigert een gesprek waarin een antwoord vervalst is.
- Namen en informatie over kinderen horen nog steeds niet in het venster, en er gaat niets over kinderen naar de AI.

## Acceptatiecriteria

- [ ] Gegeven een gesprek waarin gevraagd werd "zit K-1.5.2 in thema Herfst?", wanneer de gebruiker daarna vraagt "en
  in thema Water?", dan antwoordt Chuck over K-1.5.2 en thema Water, uit de gegevens van de tool.
- [ ] Gegeven een uitleg over het plannen van een algemene fiche, wanneer de gebruiker vraagt "en hoe haal ik ze weer
  weg?", dan antwoordt Chuck over het weghalen van een algemene fiche, uit de handleiding.
- [ ] Gegeven een gesprek dat langer is dan de grens, dan krijgt de AI alleen de laatste beurten binnen de grens mee,
  en blijft de kost per vraag begrensd.
- [ ] Gegeven een gesprek waarin een antwoord van Chuck gewijzigd of verzonnen werd, dan weigert de server het en
  krijgt de gebruiker een duidelijke melding, zonder dat de AI het vervalste antwoord te zien krijgt.
- [ ] Gegeven een gesprek, dan gaat er van een opzoeking alleen de soort en de gevonden namen en codes naar de AI, de
  tool bewaart niets en er komt geen vraag, antwoord of beurt in een logregel.
- [ ] Gegeven een leerkracht die in een vervolgvraag naar een klas vraagt die ze niet mag inkijken, dan krijgt ze
  daarover geen gegevens, ook niet via een eerdere beurt.

## Testscenario's

1. Open Chuck en vraag "zit K-1.5.2 in thema Ik en mijn klas?". Vraag daarna "en in thema Herfst?". Chuck antwoordt
   over hetzelfde doel in thema Herfst.
2. Vraag "hoe plan ik een algemene fiche?" en daarna "en hoe haal ik ze weer weg?". Chuck legt uit hoe je een fiche
   uit de agenda haalt.
3. Vraag "bij welk subthema hoort <een activiteit>?" en daarna "welke doelen heeft dat subthema?". Chuck noemt de
   doelen van dat subthema.
4. Sluit het venster en open het opnieuw. Vraag "en in thema Water?". Chuck weet niet waarover het gaat en zegt dat.
5. Stel twaalf vragen na elkaar en verwijs dan naar de eerste. Chuck kent ze niet meer; naar de vorige vraag
   verwijzen werkt nog wel.
6. Log in als leerkracht van K1, vraag eerst iets over een eigen klas en daarna "en in de K3-klas?". Je krijgt geen
   gegevens over de K3-klas.
7. Herhaal scenario 1 op ~390px.

## Buiten scope

- Het gesprek bewaren na het sluiten van het venster, of een gesprek terughalen.
- Oudere beurten laten samenvatten door de AI (niet gekozen, 2026-09-23).
- Voorstellen doen via de chat: FB-032. Dit ticket maakt wel dat FB-032 een vervolgvraag begrijpt ("stel activiteiten
  voor bij dat subthema").
- Een knop om een nieuw gesprek te beginnen zonder het venster te sluiten.

## Open vragen

- Hangt af van FB-031 (PR #172): de chat zelf moet eerst gemerged zijn.
- ADR-0066 C1 zegt dat er geen schoolinhoud in de aanvraag zit. De namen en codes van een vorige opzoeking zijn dat
  wel, zij het weinig. Art. IV.4 laat de gegevens van de school toe; ADR-0066 moet voor dit ticket aangevuld of
  vervangen worden (een nieuwe ADR).
- Hoe groot is de grens precies: tien beurten, of een aantal tokens? Standaard tien beurten; te meten met de kost per
  vraag.
- Geldt de handtekening op een beurt ook na het herstarten van de server? Standaard niet: een gesprek over een
  herstart heen begint opnieuw.

## Werklog

- 2026-09-23 12:19 · eigenaar · aangemaakt (status nieuw)
- 2026-09-24 16:47 · claude-fb093 · nieuw → in-uitvoering: opgepakt: eigenaar wil starten
