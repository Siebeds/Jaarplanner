# frontend

The Jaarplanner web client. React + TypeScript + Vite, mobile first, with a real two column layout
from `lg` up rather than a stretched phone.

Direction "Inkt en Signaal": the chrome is achromatic, and every saturated colour on screen carries
domain meaning (doelsoort, suggestiestatus, dekking). The reasoning is at the top of `src/index.css`,
and it is the rule the rest of the design follows.

This directory was `frontend-v3/` until it replaced the two frontends that came before it. The name
carried a version number only while there was something to distinguish it from; the history of all
three is in git.

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

These three are what CI runs on every push.

`src/i18n/catalogus.test.ts` is worth knowing about before you write copy: it fails the build on an
em dash, on a catalogue key nothing references, and on Dutch text hard-coded in a component instead
of in `nl.json`.

## Status

Four destinations, all answering with a real screen: Doelen (leerplandoelen, minimumdoelen, filters,
detail), Thema's (library, detail, AI suggestion review), Agenda (year strip, periods, day-level
placement, generation) and Dekking (fraction, gap list, export).

Writes that carry a decision are built: accepting or rejecting a doelsuggestie and a themaplaatsing,
locking, moving, removing, generating a plan, and placing a subthema or activiteit on a day. So is
schoolcontent beheer (create, edit, delete and reorder for thema, subthema and activiteit) and both
Excel imports: the Op.stap goal workbooks and the school's own thema's.

The klas picker appears only on Agenda and Dekking. That is deliberate: nothing on Doelen or Thema's
is scoped to a class, and a class chip there would show a filter that is not being applied.
