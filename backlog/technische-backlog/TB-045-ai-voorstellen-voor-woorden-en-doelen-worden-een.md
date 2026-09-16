---
id: TB-045
titel: AI-voorstellen voor woorden en doelen worden één voor één beoordeeld, als kaartenstapel
soort: technisch
status: in-uitvoering
prioriteit: middel
aangemaakt: 2026-09-16
bijgewerkt: 2026-09-16 23:32
opgepakt-door: claude-ai-voorstellen
branch: ticket/TB-ai-voorstellen
pr:
geblokkeerd:
fr: []
---

## Aanleiding

De voorstellen van de AI (woorden in het woordweb, doelsuggesties op de themapagina) staan als een vlakke lijst losse
kaarten, elk met Aanvaard en Weiger. De eigenaar vindt dat lelijk en mist een manier om alles in één keer te
beslissen. De eigenaar koos op 2026-09-16 variant 3, "één voor één", uit
https://claude.ai/artifact/HsoYvQxTxZM8Yj1UUJTT5Z.

## Voorgestelde wijziging

- Een gedeelde component `Voorstelstapel` in `frontend/src/components/ui/`: toont het eerste open voorstel groot als
  bovenste kaart van een stapel, met een voortgangsbalk (aanvaard, geweigerd, huidig, nog open), "n van m", de
  motivatie van de AI altijd zichtbaar, en twee grote knoppen Weiger en Aanvaard (met icoon, niet alleen kleur).
  Sneltoetsen A en W zolang de focus in de stapel staat.
- In de kop: "Rest aanvaarden" en "Rest weigeren". Die beslissingen worden pas na enkele seconden weggeschreven;
  tot dan toont een melding "Ongedaan maken", zodat één klik niet meteen alles vastlegt. De backend kan een
  beslissing niet terugzetten naar voorgesteld, dus er komt geen backendwijziging: elke beslissing gaat via de
  bestaande endpoints, één per voorstel.
- `Woordweb.tsx` en `ThemadetailScherm.tsx` gebruiken de stapel in plaats van hun lijst. Teksten in `nl.json`.

## Acceptatiecriteria

- [ ] Gegeven open voorstellen, wanneer de lijst verschijnt, dan staat er één voorstel tegelijk, met zijn motivatie, "1 van n" en een voortgangsbalk.
- [ ] Gegeven de bovenste kaart, wanneer de gebruiker Aanvaard of Weiger kiest (klik, of A/W), dan wordt die beslissing bewaard en schuift de volgende kaart naar boven.
- [ ] Gegeven nog open voorstellen, wanneer de gebruiker "Rest aanvaarden" of "Rest weigeren" kiest, dan verschijnt een melding met "Ongedaan maken", en pas als die niet gebruikt wordt, worden de resterende voorstellen zo bewaard.
- [ ] Gegeven die melding, wanneer de gebruiker "Ongedaan maken" kiest, dan wordt niets bewaard en staan de voorstellen weer open.
- [ ] Gegeven een scherm van 390 px breed, dan past de stapel zonder horizontaal te scrollen.

## Buiten scope

Een beslissing terugdraaien die al bewaard is. Voorstellen van andere AI-functies (FB-053, FB-057) die nog op hun
eigen branch staan: die kunnen de stapel later hergebruiken.

## Open vragen

Geen.

## Werklog

- 2026-09-16 22:59 · claude-ai-voorstellen · aangemaakt (status in-uitvoering)
- 2026-09-16 23:21 · claude-ai-voorstellen · Voorstelstapel gebouwd en ingezet voor woordweb en doelsuggesties; Alle aanvaarden/weigeren wacht 6 s met Ongedaan maken; Vitest, lint en browserpas (1440, 390, donker) groen
- 2026-09-16 23:32 · claude-ai-voorstellen · Antagonist ronde 1: 2 MAJOR (toegankelijkheid) opgelost: wachttijd pauzeert bij muis of toetsenbordfocus en focus gaat naar Ongedaan maken; voortgangsbalk toont enkel voortgang. MINOR opgelost: geen reset tijdens lopende schrijfacties, versturen bij pagehide, sneltoetsen uit de catalogus
