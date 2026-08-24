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

Built: the shell, the navigation, and the Doelen screen (leerplandoelen, minimumdoelen, filters,
detail). Thema's, Plan and Dekking are listed in the navigation and each routes to a page that says
in visible text that it is not built yet.

There is no klas or schooljaar picker. That is deliberate rather than missing: nothing on Doelen is
scoped to a class, so a class chip here would imply a filter that is not being applied. It arrives
with the first screen that is class scoped.
