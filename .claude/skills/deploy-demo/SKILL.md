---
name: deploy-demo
description: >-
  Deploy the latest origin/main to the Jaarplanner Azure demo (web app jaarplanner-demo-ertren in
  rg-jaarplanner-demo): find out what is live, migrate the demo database first when main brings new migrations,
  build and deploy with infra/deploy-app.ps1 from a detached worktree, and smoke-test the live site before saying
  it worked. Use when the owner says "deploy main naar de demo", "zet de laatste main op Azure", "update de
  demo-omgeving", "kan je main naar de azure demo deployen", "/deploy-demo". Not for creating the environment
  (infra/README.md), filling it with data (seed-demo.ps1), AI Foundry (deploy-ai.ps1) or the school's own
  environments (TB-006).
---

# Deploy demo — the latest main to the Azure demo

What the demo is and why it exists: [ADR-0034](../../../docs/adr/0034-demo-omgeving-op-azure.md) and
[`infra/README.md`](../../../infra/README.md). This skill is that README's *Later deployments* section plus the checks
and traps that the deploys of 2026-09-13 to 2026-09-15 turned up. **Where the two disagree, the README wins**: fix
this file. Talk to the owner in **Dutch**.

| What | Name |
| --- | --- |
| Resource group | `rg-jaarplanner-demo` |
| Web app, the only instance | `jaarplanner-demo-ertren`, https://jaarplanner-demo-ertren.azurewebsites.net/ |
| PostgreSQL | `pg-jaarplanner-demo-ertren` |
| Key Vault | `kv-jpdemo-ertren` |
| Deploy worktree | `C:\source\Jaarplanner\.claude\worktrees\deploy-main`, detached, never a branch |

`ertren` is the `<suffix>` of the README, derived from the resource group's id. It holds as long as the resource
group is not recreated; step 1 checks it.

Use **Bash** (Git Bash) throughout. The two scripts are started through `powershell` from Bash; step 5 says why.

```bash
REPO=/c/source/Jaarplanner
COORD=$REPO/.claude/coordination
WT=$REPO/.claude/worktrees/deploy-main
APP=jaarplanner-demo-ertren; RG=rg-jaarplanner-demo; PG=pg-jaarplanner-demo-ertren; KV=kv-jpdemo-ertren
HOST=https://$APP.azurewebsites.net
LOGS=<your scratchpad directory>   # never the repo
```

## 1. The lock first, then the preconditions

Take the lock **`deploy-azure-demo`** before anything else. It guards every write to the demo, including starting,
stopping or restarting the app or the database, and so `deploy-app.ps1`, `migrate-db.ps1` and `seed-demo.ps1`. The
lock is a file whose existence is the lock; `set -C` makes creating it atomic, so two sessions cannot both get it:

```bash
mkdir -p $COORD/claims; LOCK=$COORD/claims/deploy-azure-demo.md
( set -C; printf 'owner: %s\ntaken: %s\nwhy: %s\n' "<session>" "$(date '+%Y-%m-%d %H:%M')" "deploy main" > $LOCK ) \
  2>/dev/null && echo "OK: the lock is yours" || { echo "REFUSED:"; cat $LOCK; }
```

A refused lock means another session is deploying, migrating or seeding the demo: tell the owner who holds it and
since when, and wait. **Whenever you stop and the owner does not tell you to go on, remove the lock** (step 7) and say
so. A lock left behind blocks every seed and migration of the demo; only the owner decides to remove someone else's.

```bash
az account show --query name -o tsv            # signed in? if not, ask the owner to run `! az login`
az webapp show -g $RG -n $APP --query state -o tsv                            # must be Running
az webapp list --query "[?contains(name,'jaarplanner')].name" -o tsv          # on 2026-09-15: only $APP
```

- **The app is not found, or a second one is listed:** the environment was recreated or extended. Tell the owner and
  go on only with the names they confirm.
- **The app is `Stopped`:** ask the owner before `az webapp start -g $RG -n $APP`. Starting it acts on Azure.

## 2. What is live, and what main is

```bash
git -C $REPO fetch origin
TARGET=$(git -C $REPO rev-parse origin/main)
RAW=$(az rest --method get --resource https://management.azure.com/ \
  --url "https://$APP.scm.azurewebsites.net/api/vfs/site/wwwroot/deployed-commit.txt" 2>/dev/null | tr -d '\r\n')
LIVE=${RAW%% *}
echo "raw=[$RAW] live=$LIVE target=$TARGET"
[ -n "$LIVE" ] && [ "$RAW" = "$LIVE" ] && git -C $REPO merge-base --is-ancestor "$LIVE" origin/main \
  && echo "GO: live is a clean commit on main" || echo "STOP: read the list below"
git -C $REPO log --oneline --first-parent "$LIVE"..origin/main
az postgres flexible-server show -g $RG -n $PG --query state -o tsv          # must be Ready
```

`deployed-commit.txt` is written by `deploy-app.ps1` next to the app, outside the static `wwwroot` folder inside it, so
the site does not serve it; Kudu reads it. `az rest` warns *"Not a json response"* on stderr, which is why stderr is
dropped.

**Go on to step 3 only after `GO`.** Every later step compares against `LIVE`; with a wrong `LIVE` the migration check
in step 4 misses migrations and puts new code on an old schema. The `git log` line above is only meaningful after
`GO`. On `STOP`:

- **`RAW` is empty:** Kudu did not answer (expired sign-in, stopped app, a recreated environment). Find the cause.
- **`RAW` ends in "(with uncommitted changes)":** someone deployed with `-AllowDirty`. **Not on main:** someone
  deployed a branch. Either way the database may hold a migration that `main` does not know. Tell the owner what the
  stamp says and go on only on their word.

After `GO`:

- **`LIVE` equals `TARGET`:** nothing to deploy. Run step 6 anyway, tell the owner, remove the lock.
- **Database `Stopped`:** the owner stops it between demos to save cost (infra/README.md). Ask before starting it
  with `az postgres flexible-server start -g $RG -n $PG`; `/health/ready` answers 503 until it runs.

## 3. Put the deploy worktree on origin/main

Never deploy from the main tree: a checkout there moves HEAD under whoever runs from it, the owner's app for one. The
deploy worktree is detached, so moving it costs nobody anything.

```bash
[ -d $WT ] || git -C $REPO worktree add --detach $WT origin/main
git -C $WT status --porcelain          # must print nothing
git -C $WT checkout --detach origin/main && git -C $WT log --oneline -1
```

`deploy-app.ps1` refuses a dirty tree. **Never pass `-AllowDirty`** here: the stamp would then say the demo runs code
that is in no commit. If the worktree is dirty, look at what it holds before touching it; it is not yours.

## 4. Migrations and infra since what is live

```bash
M=backend/src/Jaarplanner.Infrastructure/Persistence/Migrations
git -C $WT diff --name-only --diff-filter=A "$LIVE" "$TARGET" -- $M | grep -v -e Designer -e Snapshot   # new ones
git -C $WT diff --name-only --diff-filter=DMR "$LIVE" "$TARGET" -- $M | grep -v -e Designer -e Snapshot # must be empty
git -C $WT diff --stat "$LIVE" "$TARGET" -- infra
```

- **A migration was changed, renamed or deleted since `LIVE`** (the second command prints something): the demo already
  ran the old version. Stop and tell the owner.
- **`infra/main.bicep` changed:** stop and tell the owner. A Bicep redeploy needs the database password read back from
  the vault (infra/README.md, step 6) and is not this skill's job.
- **`infra/deploy-app.ps1` or `infra/migrate-db.ps1` changed:** you are about to run the new version, so read its diff
  first (`git -C $WT diff "$LIVE" "$TARGET" -- infra/deploy-app.ps1 infra/migrate-db.ps1`). Where it changes a
  parameter, a step or an output that this skill relies on, the script is right and this file is stale: follow the
  script, and tell the owner.
- **`infra/README.md` changed:** read its diff. Where it changes the deploy procedure, it wins over this file: follow
  it, and tell the owner.
- `seed-demo.ps1`, `seed-demo.data.json` and the AI Foundry files are not part of a deploy.
- **No new migrations:** go to step 5.

**New migrations run before the code.** The app never migrates itself, and new code against an old schema answers
500 on the first query that needs the new table. In this order:

1. **Read each new migration's `Up()`, before running anything.** Read `Up()` itself rather than grepping the file:
   `Down()` always drops what `Up()` creates, so a grep over the whole file cries wolf (it did for `RechtenModel` and
   `Wizardrun`, whose `Up()` only adds). Any of these in `Up()` needs the **owner's word first**, because it can lose,
   move or rewrite demo data that the owner entered by hand or with `seed-demo.ps1`: `DropTable`, `DropColumn`,
   `RenameTable`, `RenameColumn`, `AlterColumn`, `DeleteData`, `UpdateData`, and any `Sql(...)`. Tell them which
   migration and what it does. An additive migration can still change behaviour, for instance a rights column that
   starts out empty for every existing user: name such a one in your report.
2. **Tell the owner** which migrations you are about to run.
3. **Run it in the background** (`run_in_background: true`). The script builds the API first; the run of 2026-09-14
   took about four minutes, longer than the Bash tool's default timeout, and a killed run skips the script's
   `finally`, which is what removes its firewall rule.

   ```bash
   cd $WT && powershell -NoProfile -ExecutionPolicy Bypass -File infra/migrate-db.ps1 \
     -ServerName $PG -VaultName $KV > $LOGS/migrate.log 2>&1; echo "exit=$?"
   ```

4. **Exit other than 0: do not deploy.** Quote the error lines from `migrate.log` to the owner (the script never
   prints the connection string), check the firewall as below, and stop.
5. **The firewall, afterwards, in either case:**

   ```bash
   az postgres flexible-server firewall-rule list -g $RG --server-name $PG --query "[].name" -o tsv
   ```

   Expected: only `AllowAllAzureServicesAndResourcesWithinAzureIps`. A leftover `migration-from-operator` after your
   own run died is yours: remove it with `az postgres flexible-server firewall-rule delete -g $RG --server-name $PG
   --name migration-from-operator --yes`. **Never delete any other rule**, `seed-from-operator` included: it may belong
   to a run that is still going. Report it to the owner instead.

## 5. Build and deploy

Keep holding the lock of step 1. Run it in the **background** (`run_in_background: true`), because the build, the
upload and the restart take several minutes:

```bash
cd $WT && PATH="/c/Windows/System32:$PATH" powershell -NoProfile -ExecutionPolicy Bypass \
  -File infra/deploy-app.ps1 -AppName $APP > $LOGS/deploy.log 2>&1; echo "exit=$?"
```

Two traps, each of which cost a failed run on 2026-09-14 (nothing reached Azure either time):

- **Redirect in Bash, never inside PowerShell.** On the owner's PC the only PowerShell is Windows PowerShell 5.1
  (`pwsh` was not installed on 2026-09-14). There, `*>&1` or `2>&1` turns the `$ tsc -b && vite build` line that pnpm
  prints on stderr into a NativeCommandError, and the script's `$ErrorActionPreference = 'Stop'` aborts the build.
- **`/c/Windows/System32` first on PATH.** From Git Bash, `tar.exe` otherwise resolves to GNU tar, which reads `C:`
  as a remote host (*"Cannot connect to C: resolve failed"*). The script needs Windows' bsdtar, which writes the
  forward slashes Linux expects.

A good run ends with `exit=0`, `"status": "RuntimeSuccessful"` and `Deployed <sha> to https://…` (both seen in the
log of 2026-09-15). The log names the runtime packs (`Microsoft.AspNetCore.App in the package: 10.0.12`); the script
itself refuses anything below 10.0.10 (ADR-0031). It calls plain `pnpm`: if that is not recognised, stop and tell the
owner rather than editing the script. **Exit other than 0:** read the end of `deploy.log`, run step 6 to see what the
live site now serves, and tell the owner before a second attempt.

## 6. Verify before you report

```bash
az rest --method get --resource https://management.azure.com/ \
  --url "https://$APP.scm.azurewebsites.net/api/vfs/site/wwwroot/deployed-commit.txt" 2>/dev/null   # must be $TARGET
for p in /health /health/ready /api/klassen /agenda; do
  printf '%s -> %s\n' "$p" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 "$HOST$p")"; done
git -C $WT diff "$LIVE" "$TARGET" -- frontend/src/i18n/nl.json | grep '^+ ' | head    # pick one new string
NEW='<an ASCII-only fragment of that string, e.g. van {begin} tot {einde}>'
JS=$(curl -s --max-time 60 "$HOST/" | grep -o '/assets/index-[^"]*\.js' | head -1)
curl -s --max-time 60 "$HOST$JS" | grep -c -F "$NEW"                                    # must be 1 or more
```

Expect:

- the stamp equal to the target;
- **`/health` 200** and **`/health/ready` 200**, which means the database is reachable;
- **`/api/klassen` 401**: since E6-01 every `/api` route other than signing in and signing out needs a session, so
  a 200 there would mean an API without authentication;
- **`/agenda` 200**, a deep link served by the SPA fallback;
- the new string in the live bundle. Keep the fragment ASCII: the build writes some characters such as `é` as
  `\u00e9`, so a fragment with them can miss a string that is there. When `nl.json` gained no string, tell the owner
  this check did not apply rather than dropping it silently.

When something is off:

- **F1 is slow to wake.** The first request after a restart can take tens of seconds, hence `--max-time 60`. A 503
  straight after the deploy may be the warm-up: retry once after a minute before calling it broken.
- **`/health` 200 but `/health/ready` 503:** the database is stopped or unreachable (step 2), or a migration is
  missing (step 4).
- **Anything else:** `az webapp log tail -g $RG -n $APP` streams the app's log, including a startup exception. (Not
  needed on any deploy so far, so not yet run from this recipe.)

## 7. Unlock and report

Remove the lock, after checking with `cat $LOCK` that it is yours: `rm -- $COORD/claims/deploy-azure-demo.md`, then
`ls $COORD/claims` to see it is gone. Leave the worktree where it is, detached at the deployed commit: the next run
moves it.

Tell the owner, in Dutch: the commit and the PRs it brings since the previous deploy, whether migrations ran, each
check with its result, and what did **not** go along: an open PR they may think is in, or infra that was not
applied.
