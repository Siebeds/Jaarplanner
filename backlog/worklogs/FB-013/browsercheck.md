# FB-013 — browser check

2026-09-15, session `zichtbaarheid`, on commit `d6abd72`.

## Set-up

- Throwaway database `fb013_browser` in the local `jaarplanner-db` container (never the dev database `jaarplanner`),
  migrated, demo seed on. API built into `bin-run`, on port 5186; Vite on 5177 proxying to it.
- As directie (development sign-in), over the API: klassen **K3 blauw**, **K3 groen** and **K2 rood** in 2026-2027
  (beside the seeded L3 klas), and three gebruikers with made-up names: a leerkracht of K3 blauw, a hoofdleerkracht of
  K2 without a klas, and a gebruiker without any right.

## Over the API (curl, each gebruiker signed in through the development sign-in)

| Gebruiker | `GET /api/klassen` | Reads |
| --- | --- | --- |
| Leerkracht K3 blauw | K3 blauw, K3 groen | K2 rood jaarplan **403**, K2 rood dekking export **403** |
| Hoofdleerkracht K2, no klas | K2 rood | K2 rood jaarplan **200** |
| Without any right | (empty) | K3 blauw jaarplan **403** |

## In the browser

The Claude-in-Chrome extension was not connected, so the pages were rendered with headless Chrome. Its window cannot go
below about 500 px (a `--window-size=390` shot is a 500 px page cropped to 390, visible in the bottom bar's tab
spacing), so the 390 px views were taken by emulating the viewport over the DevTools protocol
(`Emulation.setDeviceMetricsOverride`, width 390, mobile) and measuring `innerWidth` against `scrollWidth`.

| View | 1440 | 390 |
| --- | --- | --- |
| Without any right, Agenda | "Geen klas om in te kijken" with the sentence under it; the klaskiezer reads "Kies een klas" | same, the sentence wraps; `innerWidth 390 = scrollWidth 390` |
| Without any right, Instellingen › Klassen | "Je hebt geen klas en geen recht om klassen in te kijken. Vraag het aan de directie." | same; `390 = 390` |
| Leerkracht K3 blauw, Instellingen › Klassen | K3 blauw and K3 groen, no K2 rood | same; `390 = 390` |
| Leerkracht K3 blauw, Agenda | her own klas with its planning controls | — |
| Hoofdleerkracht K2, Instellingen › Klassen | K2 rood only | — |

The new sentences reuse the existing classes (`Leegte`, `text-meta text-inkt-zacht`, `text-body text-inkt-zacht`) with
no opacity and no new colour, so no contrast changed.

Not checked in the browser: the klaskiezer sheet's own empty-list sentences (covered by `Klaskiezer.test.tsx`), and a
leerkracht with klassen in two jaarfasen (covered by the integration test).
