# infra — the Jaarplanner demo environment

What this folder builds, and why, is [ADR-0034](../docs/adr/0034-demo-omgeving-op-azure.md). The environment is a
**demo**: fictional data only, the owner's own test accounts, and no AI. Those are the conditions under which the owner
waived E7-11's deployment clause (2026-09-13). Do not put a school's real data in it.

## What runs where

Everything is in **Belgium Central**, in the resource group `rg-jaarplanner-demo`. The group itself sits in West
Europe, which only holds its metadata. `<suffix>` is derived from the resource group's id, so a redeploy keeps the names.

| Resource | Name | SKU |
| --- | --- | --- |
| App Service plan | `plan-jaarplanner-demo` | F1, Linux |
| Web app | `jaarplanner-demo-<suffix>` | .NET 10, self-contained, started by `start.sh` |
| PostgreSQL Flexible Server | `pg-jaarplanner-demo-<suffix>` | Burstable B1ms, 32 GB, version 17 |
| Key Vault | `kv-jpdemo-<suffix>` | Standard, RBAC |

The budget is on the subscription, not in the resource group (step 1).

## First-time setup

You need the Azure CLI signed in to the subscription (`az login`), PowerShell, the .NET SDK from `global.json`, and
pnpm. Run the commands from the repo root.

1. **The budget**, on the subscription: €10 a month, with e-mail alerts at 80% and 100% of actual cost and at 100% of
   forecast cost. It warns; it does not stop anything.

   The body holds your e-mail address, so it goes to a temporary file outside the repo and is deleted afterwards.

   ```powershell
   $subscription = az account show --query id -o tsv
   $body = Join-Path $env:TEMP 'jaarplanner-budget.json'
   @'
   {"properties":{"category":"Cost","amount":10,"timeGrain":"Monthly","timePeriod":{"startDate":"<first day of this month>T00:00:00Z"},
    "notifications":{
     "Actual-80":{"enabled":true,"operator":"GreaterThanOrEqualTo","threshold":80,"thresholdType":"Actual","contactEmails":["<your e-mail>"]},
     "Actual-100":{"enabled":true,"operator":"GreaterThanOrEqualTo","threshold":100,"thresholdType":"Actual","contactEmails":["<your e-mail>"]},
     "Forecast-100":{"enabled":true,"operator":"GreaterThanOrEqualTo","threshold":100,"thresholdType":"Forecasted","contactEmails":["<your e-mail>"]}}}}
   '@ | Set-Content -Encoding ascii $body
   az rest --method put --body "@$body" `
       --url "https://management.azure.com/subscriptions/$subscription/providers/Microsoft.Consumption/budgets/jaarplanner-maandbudget?api-version=2023-05-01"
   Remove-Item $body
   ```

2. **The resource group.**

   ```powershell
   az group create --name rg-jaarplanner-demo --location westeurope
   ```

3. **The infrastructure, without the client id.** The password goes into Key Vault and nowhere else.

   ```powershell
   $chars = [char[]]'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
   $bytes = New-Object byte[] 28; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
   $pw = 'Jp7' + (-join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] }))
   az deployment group create --resource-group rg-jaarplanner-demo --template-file infra/main.bicep `
       --parameters deployerObjectId=$(az ad signed-in-user show --query id -o tsv) `
                    eersteDirectie=<upn of the first directie> "postgresAdminPassword=$pw"
   ```

4. **The Entra app registration**, once, in the tenant whose members may sign in (ADR-0031, deployment prerequisites):
   - single tenant, with the redirect URIs `https://<host>/api/signin-oidc` and `https://<host>/`;
   - the `acct` optional claim in the ID token (`az ad app update --optional-claims`);
   - the delegated `openid` and `profile` permissions, with admin consent (`az ad app permission add`, then
     `az ad app permission admin-consent`);
   - a service principal with `appRoleAssignmentRequired=true`;
   - each test user assigned one by one through Microsoft Graph `servicePrincipals/{id}/appRoleAssignedTo`. Assigning a
     group needs Entra ID P1.

5. **The client secret, straight into Key Vault.** It is never printed.

   ```powershell
   $secret = az ad app credential reset --id <appId> --display-name demo --end-date <six months ahead> --query password -o tsv
   az keyvault secret set --vault-name kv-jpdemo-<suffix> --name Authenticatie--Entra--ClientSecret --value $secret --output none
   ```

6. **The infrastructure again, now with the client id.** Pass the same PostgreSQL password, read back from the vault,
   or the deployment changes it.

   ```powershell
   $conn = az keyvault secret show --vault-name kv-jpdemo-<suffix> --name ConnectionStrings--Postgres --query value -o tsv
   $pw = (($conn -split ';') | Where-Object { $_ -like 'Password=*' }) -replace '^Password=', ''
   az deployment group create --resource-group rg-jaarplanner-demo --template-file infra/main.bicep `
       --parameters deployerObjectId=$(az ad signed-in-user show --query id -o tsv) `
                    eersteDirectie=<upn> entraClientId=<appId> "postgresAdminPassword=$pw"
   ```

7. **The database schema.**

   ```powershell
   ./infra/migrate-db.ps1 -ServerName pg-jaarplanner-demo-<suffix> -VaultName kv-jpdemo-<suffix>
   ```

8. **The app**, from a committed working tree.

   ```powershell
   ./infra/deploy-app.ps1 -AppName jaarplanner-demo-<suffix>
   ```

9. **Check it.** `https://<host>/health` answers 200, `https://<host>/health/ready` answers 200 once the database is
   reachable, and a deep link such as `https://<host>/jaarplan` opened cold shows the sign-in.

## Later deployments

- New code: commit it, then `./infra/deploy-app.ps1 -AppName jaarplanner-demo-<suffix>`. The commit it ran from is in
  `deployed-commit.txt` next to the app.
- A new migration: run `migrate-db.ps1` **before** deploying the code that needs it.

## Demo data

`infra/seed-demo.ps1` fills the demo with the fictional kleuter content in `infra/seed-demo.data.json` (TB-003):
klassen, thema's with themadoelen and subthema's, and per klas algemene fiches and hoeken. It needs Docker besides
the tools above and a clean working tree (or `-AllowDirty`), and it runs from the commit that is deployed, after
`migrate-db.ps1`: it refuses when the database's newest migration and the checkout's differ.

```powershell
./infra/seed-demo.ps1 -ServerName pg-jaarplanner-demo-<suffix> -VaultName kv-jpdemo-<suffix> -AppName jaarplanner-demo-<suffix>
```

- It builds the API from the checkout, starts it on your machine and signs in as the demo's directie with the
  development sign-in. All content goes through the API. The one direct database write is the safeguard below.
- The session keys (ADR-0031 decision 5). The local API gets the demo's `DataProtection__KeyVaultSleutel`, so any key
  it creates is wrapped or not written. The script gives you *Key Vault Crypto User* on that key for the run if you
  lack it, so the API can use the existing key and has no reason to create one. It compares the key rows before and
  after: an unwrapped row that appeared is deleted and the run ends with an error; a new wrapped row is only reported.
- It opens the PostgreSQL firewall to your address and removes that rule and the temporary key role again when it
  ends or fails. Closing the window skips that; look for leftovers with
  `az postgres flexible-server firewall-rule list --resource-group rg-jaarplanner-demo --server-name pg-jaarplanner-demo-<suffix>`
  (only `AllowAllAzureServicesAndResourcesWithinAzureIps` belongs there) and
  `az role assignment list --scope <vault id>/keys/dataprotection`.
- A second run creates nothing twice: items are matched by name, and one that exists only gets the goal links from the
  data file that it lacks. Its other fields stay as they are. Keep the data fictional (ADR-0034).
- The teacher names in the klas names stand in for the link between leerkrachten and klassen until E6-04 builds it.

## Costs, and switching it off

- F1 is free. PostgreSQL B1ms with 32 GB is free for the first 12 months of the subscription, and about €16 a month
  after that.
- Stop the database between demos with `az postgres flexible-server stop --resource-group rg-jaarplanner-demo --name
  pg-jaarplanner-demo-<suffix>`. **Azure starts it again by itself after seven days.**
- Remove everything with `az group delete --name rg-jaarplanner-demo`. The vault then stays in soft delete for seven
  days (`az keyvault purge` ends that). The budget, the app registration and the test users are not in the resource
  group, so they have to be deleted separately.
