# E0-02 — Pin toolchain

## Build round 1 — version pins only (.NET SDK + Node + pnpm)

- **FR / Article:** Constitution Art. VIII (Backend on current .NET LTS, SDK pinned in
  `global.json`; frontend uses pnpm), Art. VI (no secrets in repo), Art. X (small,
  reviewable changes). Epic E0 (Project Foundation & Scaffolding), Milestone M0.

### What was pinned (exact versions)

| Tool | Pinned version | Where | Policy / rationale |
|------|----------------|-------|--------------------|
| .NET SDK | `10.0.201` (.NET 10, current LTS) | `global.json` (repo root) | `rollForward: latestPatch` |
| Node.js | `24` (LTS line "Krypton"; installed `v24.11.1`) | `.nvmrc` (repo root) + `engines.node` in `frontend/package.json` | major-line pin |
| pnpm | `11.9.0` | `packageManager` field in `frontend/package.json` (Corepack-style) | exact pin |

### Files created

- `global.json` (repo root) — pins the .NET SDK to `10.0.201` with `rollForward: latestPatch`.
- `.nvmrc` (repo root) — pins the Node line to `24`.
- `frontend/package.json` — minimal: `name` `jaarplanner-frontend`, `private: true`,
  `packageManager: pnpm@11.9.0`, `engines.node: >=24`. No dependencies, no scripts, no app code.

### Key decisions / assumptions

- **`.NET` rollForward = `latestPatch`.** The installed SDK is `10.0.201`. `latestPatch` keeps
  every machine on the **same 10.0.2xx feature band** (reproducible) while still resolving on a
  clean machine that has a *newer patch* of 10.0.2xx installed. I avoided `latestFeature`/`major`
  to prevent silent feature-band drift; I avoided `disable` so a clean machine with a slightly
  newer patch isn't hard-blocked. This satisfies "a clean machine with a same-or-newer 10.x SDK
  still resolves" for the patch dimension; if a clean machine only has a newer *feature* band
  (e.g. 10.0.3xx) the orchestrator can relax to `latestFeature` in a follow-up — noted, not assumed.
- **Node pinned to the `24` LTS line.** As of 2026-06-29 the Node 24 line ("Krypton") is an active
  LTS (latest `v24.18.0`), and the machine's installed `v24.11.1` is on that line — so the pin is
  both a real LTS and matches what is installed. Pinning the **major line** (`24`) rather than an
  exact patch is the standard `.nvmrc`/nvm idiom: `nvm use` resolves to the newest installed/available
  24.x, which keeps clean-machine setup frictionless while fixing the major version. `engines.node:
  >=24` mirrors this and lets E0-05 add tooling without an artificial upper bound.
- **pnpm pinned via `packageManager` (Corepack).** `pnpm@11.9.0` (current latest) is declared in
  `packageManager` so Corepack provisions exactly that version with no global install. This is the
  Corepack-blessed, reproducible mechanism and is the same field E0-05 will already rely on.
- **No secrets, no app code.** Pins are pure configuration. Nothing executable, no dependencies,
  no Vite/React scaffold, no Tailwind/ESLint/etc. — all deferred to E0-05.

### E0-05 overlap note (important)

`frontend/package.json` is intentionally **minimal** so E0-05's `pnpm create vite` / scaffold
**extends** it rather than fighting it:
- It carries only the identity + the two pins (`packageManager`, `engines.node`) that E0-05 must
  not lose. E0-05 should **merge** its generated `dependencies`/`devDependencies`/`scripts` into
  this file (or generate into a temp dir and copy these fields back), keeping `packageManager:
  pnpm@11.9.0` and `engines.node: >=24` intact.
- `name: jaarplanner-frontend` and `private: true` already match the intended SPA package, so the
  Vite template's defaults can be reconciled without renaming.
- The `frontend/README.md` placeholder (from E0-01) is untouched and still points at E0-05 for the
  actual scaffold.

### Tests added

None. This story produces version-pin configuration artifacts only — there is no runtime code or
logic to unit-test. Verification is by CLI resolution (below).

### Gates

Run from the **repo root** unless noted:

- `.NET pin` — `dotnet --version` -> **`10.0.201`**.
- `.NET pin governs resolution` — `dotnet --info` -> **`global.json file: <repo-root>/global.json`**
  (confirms our file is the one being honored, not an ambient one).
- `Backend builds under the pin` — `dotnet build backend/Jaarplanner.sln` ->
  **Build succeeded. 0 Warning(s), 0 Error(s).**
- `Backend format clean under the pin` — `dotnet format backend/Jaarplanner.sln --verify-no-changes`
  -> **exit 0**.
- `Node pin` — `cat .nvmrc` -> **`24`**; `node --version` -> **`v24.11.1`** (satisfies the `24` line
  and `engines.node >=24`).
- `pnpm pin` — from `frontend/`: `corepack pnpm --version` -> **`11.9.0`** (matches the
  `packageManager` field).
- `pnpm pin is honored exactly (not coincidentally "latest")` — temporarily setting
  `packageManager` to `pnpm@10.34.3` made `corepack pnpm --version` report **`10.34.3`**; restoring
  to `pnpm@11.9.0` reported **`11.9.0`**. The temporary edit was reverted (git shows only the three
  new files, package.json contents intact).
- Frontend `pnpm lint/test/build`: **N/A** — no app, no scripts yet (E0-05). The frontend gate for
  this story is purely "pnpm resolves to the pin", which is verified above.

### Clean-machine note

- **.NET:** `global.json` + `rollForward: latestPatch` resolves to 10.0.201 (or a newer 10.0.2xx
  patch) on any machine with a matching/newer patch installed.
- **Node:** `.nvmrc` (`24`) drives `nvm install` / `nvm use` to the Node 24 LTS line.
- **pnpm:** the `packageManager` field makes Corepack (bundled with Node ≥16.9) auto-provision
  `pnpm@11.9.0` on first `pnpm`/`corepack pnpm` invocation — no global pnpm install required.
  On this machine `corepack enable` (writing shims into `C:\Program Files\nodejs`) needs admin and
  was **not** run; `corepack pnpm <cmd>` works without it and proves the pin. On a clean machine a
  one-time `corepack enable` (admin) or continued use of `corepack pnpm …` gives a bare `pnpm`
  command at the pinned version.

### Branch

`story/E0-02`

### Self-check vs acceptance criteria

- *`dotnet --version` resolves to the pinned SDK (global.json exists at repo root and governs the
  resolved SDK)* -> **met**. `global.json` at repo root pins `10.0.201`; `dotnet --version` ->
  `10.0.201`; `dotnet --info` shows the repo-root `global.json` as the governing file; the backend
  solution still builds (0/0) and formats clean under the pin.
- *`pnpm` resolves to a pinned version, and the Node version is pinned, in a way that works "on a
  clean machine"* -> **met**. `packageManager: pnpm@11.9.0` makes Corepack provision exactly
  `11.9.0` (proved via the swap test) with no global install; `.nvmrc` (`24`) + `engines.node >=24`
  pin Node to the installed LTS line.
- *Scope discipline (no Vite scaffold / deps / Tailwind / ESLint / EF / Docker / CI / health
  endpoint)* -> **met**. Only `global.json`, `.nvmrc`, and a minimal `frontend/package.json` were
  added; `git status` shows exactly those three untracked files.

### For the test-runner

**Unit/CLI verification only — no Playwright** (no UI, no HTTP endpoints, no logic).

From the **repo root**:
```
dotnet --version                                            # expect: 10.0.201
dotnet --info | grep -iA2 "global.json file"                # expect: points at <repo-root>/global.json
dotnet build backend/Jaarplanner.sln                        # expect: Build succeeded, 0 errors
cat .nvmrc                                                   # expect: 24
node --version                                               # expect: v24.x (>=24)
```
From `frontend/`:
```
corepack pnpm --version                                     # expect: 11.9.0
# (or, after one-time admin `corepack enable`: `pnpm --version` -> 11.9.0)
```
Optional pin-fidelity check: confirm `frontend/package.json` `packageManager` reads
`pnpm@11.9.0` and `engines.node` reads `>=24`.

### Open questions / Art. XIV touched

- **None re: domain decisions** (Art. XIV untouched — no entities, no planningsblok granularity,
  no Excel mapping).
- **Minor follow-up (non-blocking):** `rollForward: latestPatch` keeps the SDK on the 10.0.2xx
  feature band. If CI/dev machines provision a newer *feature* band of .NET 10 (10.0.3xx+) without
  10.0.2xx, switch to `latestFeature`. Flagged for the orchestrator; not assumed here to maximize
  reproducibility.
