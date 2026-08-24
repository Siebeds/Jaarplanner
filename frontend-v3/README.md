# frontend-v3

The third Jaarplanner frontend. Mobile first, and a real two column layout from `lg` up rather than
a stretched phone. Direction "Inkt en Signaal": the chrome is achromatic, and every saturated colour
on screen carries domain meaning (doelsoort, suggestiestatus, dekking). The reasoning is at the top
of `src/index.css`, and it is the rule the rest of the design follows.

## Run it

```bash
corepack pnpm install
corepack pnpm dev                                    # http://localhost:5177, proxies /api to :5184
VITE_API_PROXY_TARGET=http://localhost:5186 corepack pnpm dev   # ... or to another API
```

## Gates

```bash
corepack pnpm lint     # oxlint + tsc
corepack pnpm test     # vitest
corepack pnpm build
```

`src/i18n/catalogus.test.ts` is worth knowing about before you write copy: it fails the build on an
em dash, on a catalogue key nothing references, and on Dutch text hard-coded in a component instead
of in `nl.json`.

## Status

All four destinations are built: Doelen (leerplandoelen, minimumdoelen, filters, detail), Thema's
(library, detail, AI suggestion review), Plan (year strip, periods, placement handling, generation)
and Dekking (fraction, gap list, export).

Reads are complete. Writes are the ones that carry a decision: accepting or rejecting a doelsuggestie
and a themaplaatsing, locking, moving, removing, and generating a plan. Creating and editing thema's,
subthema's and activiteiten is not here yet, and neither is the Excel import.

The klas picker appears only on Plan and Dekking. That is deliberate: nothing on Doelen or Thema's is
scoped to a class, and a class chip there would show a filter that is not being applied.
