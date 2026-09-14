<#
.SYNOPSIS
    Builds the frontend and the API and deploys both to the Jaarplanner demo App Service (ADR-0034).

.DESCRIPTION
    The API is published self-contained for linux-x64, so it runs on the .NET runtime pack the SDK resolved rather than
    on whatever patch the App Service image carries. ADR-0031 requires 10.0.10 or later, and the script refuses to
    deploy below it. The built frontend goes into wwwroot, where the API serves it. start.sh is the startup command
    infra/main.bicep configures.

    The commit the package was built from is written into it, as deployed-commit.txt next to the app (outside wwwroot,
    so it is not served). A working tree with uncommitted changes is refused unless -AllowDirty is passed, and the
    stamp then says so.

.EXAMPLE
    ./infra/deploy-app.ps1 -AppName jaarplanner-demo-abc123
#>
param(
    [Parameter(Mandatory = $true)][string]$AppName,
    [string]$ResourceGroup = 'rg-jaarplanner-demo',
    [switch]$AllowDirty
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $root 'artifacts/demo'
$publish = Join-Path $out 'publish'
$zip = Join-Path $out 'app.zip'
$minimumRuntime = [version]'10.0.10'

function Invoke-Checked([scriptblock]$Command, [string]$What) {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$What failed with exit code $LASTEXITCODE." }
}

$commit = (git -C $root rev-parse HEAD).Trim()
$dirty = [bool](git -C $root status --porcelain)
if ($dirty -and -not $AllowDirty) {
    throw 'The working tree has uncommitted changes. Commit them, or pass -AllowDirty to deploy them anyway.'
}

if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force $publish | Out-Null

Push-Location (Join-Path $root 'frontend')
try {
    Invoke-Checked { pnpm install --frozen-lockfile } 'pnpm install'
    Invoke-Checked { pnpm build } 'pnpm build'
}
finally {
    Pop-Location
}

$api = Join-Path $root 'backend/src/Jaarplanner.Api'
Invoke-Checked { dotnet publish $api -c Release -r linux-x64 --self-contained true -o $publish } 'dotnet publish'

# A self-contained publish names the runtime packs it carries in deps.json. Both are checked: the advisories behind the
# floor are in System.Security.Cryptography.Xml, which ships in the ASP.NET Core pack, not in the .NET one.
$deps = Get-Content (Join-Path $publish 'Jaarplanner.Api.deps.json') -Raw | ConvertFrom-Json
foreach ($pack in 'Microsoft.NETCore.App', 'Microsoft.AspNetCore.App') {
    $entry = $deps.libraries.PSObject.Properties.Name |
        Where-Object { $_ -like "runtimepack.$pack.Runtime.linux-x64/*" } |
        Select-Object -First 1
    if (-not $entry) { throw "Jaarplanner.Api.deps.json names no $pack runtime pack. Is the publish self-contained?" }
    $version = [version](($entry -split '/')[1] -replace '-.*$', '')
    if ($version -lt $minimumRuntime) {
        throw "The package carries $pack $version; ADR-0031 requires $minimumRuntime or later. Update the .NET SDK."
    }
    Write-Host "$pack in the package: $version"
}

Copy-Item -Recurse (Join-Path $root 'frontend/dist') (Join-Path $publish 'wwwroot')

$utf8 = New-Object System.Text.UTF8Encoding $false
$stamp = if ($dirty) { "$commit (with uncommitted changes)" } else { $commit }
[System.IO.File]::WriteAllText((Join-Path $publish 'deployed-commit.txt'), "$stamp`n", $utf8)

# LF line endings and no BOM: sh reads a carriage return as part of the command.
$start = "#!/bin/sh`ncd /home/site/wwwroot`nchmod +x ./Jaarplanner.Api`nexec ./Jaarplanner.Api`n"
[System.IO.File]::WriteAllText((Join-Path $publish 'start.sh'), $start, $utf8)

# tar.exe (bsdtar, shipped with Windows) writes forward slashes. Windows PowerShell's Compress-Archive writes
# backslashes, which Linux reads as part of the file name.
Invoke-Checked { tar.exe -a -c -f $zip -C $publish . } 'Packaging'

Invoke-Checked {
    az webapp deploy --resource-group $ResourceGroup --name $AppName --src-path $zip --type zip --clean true --restart true
} 'az webapp deploy'

$hostName = az webapp show --resource-group $ResourceGroup --name $AppName --query defaultHostName -o tsv
Write-Host "Deployed $stamp to https://$hostName/"
