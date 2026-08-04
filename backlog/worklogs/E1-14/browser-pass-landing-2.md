# E1-14 landing 2 — browser pass

Run 2026-08-04, against a **real API and real PostgreSQL** (`jp_e114`, migrated, `Demo__Seed=true`), API on
127.0.0.1:5495 and Vite on 5496, Playwright MCP. Ports and database claimed in the groepschat and released
after. The Edge profile was already free this time, so no process cleanup was needed.

## What was driven

| Flow | Result |
| --- | --- |
| New subthema in L3's section | Created and appeared with *"2 weken · Leeftijd 8"* and its onderzoeksvraag rendered |
| New activiteit under it | Created as *"Beestjes zoeken · Waarneming · Hoek: buitenhoek"*, the type sent by name |
| Link a leerplandoel to the subthema | `DEMO-L3-04` linked, listed with *Ontkoppelen* beside it |
| The seven controls on one card | All seven accessible names are distinct and name their target (below) |
| 390 px | No horizontal scroll, and **no element in the class section past the viewport** |

**The accessible names, read out of the live DOM.** This is the finding the tests produced and the browser
confirms: one card carries seven controls, and before the aria labels four of them were named "Wijzigen",
"Verwijderen" or "Leerdoel koppelen" with nothing to tell them apart.

```
Subthema Bladeren en beestjes wijzigen
Subthema Bladeren en beestjes verwijderen
Leerdoel koppelen aan subthema Bladeren en beestjes
Leerplandoel DEMO-L3-04 niet meer koppelen aan dit subthema
Leerdoel koppelen aan activiteit Beestjes zoeken
Activiteit Beestjes zoeken wijzigen
Activiteit Beestjes zoeken verwijderen
```

## Contrast at 390 px, alpha composited against the real backdrop

| Element | Ratio |
| --- | --- |
| Subthema *Wijzigen*, *Leerdoel koppelen*, and the linked code (mono 12 px) | 15.42 |
| Subthema *Verwijderen* (geweigerd on card) | 6.48 |
| The 12 px field labels (*Onderzoeksvraag*) | 6.08 |
| The activiteit line (naam, soort, hoek) | 5.80 |

Every pair is above 4.5:1, including the four 12 px cases, so none of them leans on the large-text exemption.

## What this pass did *not* find, said plainly

Nothing. Landing 1's pass found a real defect (a delete refetching the deleted thema) and landing 1's audit
found two more, so a clean pass is worth a sentence of scepticism rather than a victory lap. Two reasons it is
plausible rather than lucky: the defect class that bit landing 1 (per-record UI state held one level up) was
designed out here by giving each subthema and each activiteit its own component, and the two findings this
landing did produce were both found **while writing the tests** rather than after: the duplicate accessible
names, and an axe heading-order jump (`h3` section, `h5` form) that appeared the moment a form opened.

**Still unverified by anyone but me:** the contrast figures and the 390 px claim, for the same reason as
landing 1 — an audit is read-only and jsdom cannot evaluate colour. Re-measure rather than trust the number.
