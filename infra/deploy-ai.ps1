<#
.SYNOPSIS
    Deploys the Foundry resource for the AI eval (TB-004, ADR-0036) from infra/ai-foundry.bicep: the resource group, the
    account, its model deployments and the evaluator's role.

.DESCRIPTION
    Everything the resource consists of is in the Bicep. This script only supplies what differs per person: the object
    id of whoever runs the eval, which defaults to the user signed in to the Azure CLI. Redeploying is safe; the names
    derive from the resource group, so a second run updates the same resource.

    -WhatIf shows what would change and changes nothing. -Skip leaves a model deployment out, for a model the data zone
    refuses. -SetEvalEndpoint writes the endpoint into the eval runner's user-secrets as AzureAI:Endpoint.

.EXAMPLE
    ./infra/deploy-ai.ps1 -WhatIf
    ./infra/deploy-ai.ps1 -SetEvalEndpoint
    ./infra/deploy-ai.ps1 -Skip gpt-5.4-mini -SetEvalEndpoint
#>
param(
    [string]$EvaluatorObjectId,
    [string[]]$Skip = @(),
    [switch]$WhatIf,
    [switch]$SetEvalEndpoint
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$template = Join-Path $PSScriptRoot 'ai-foundry.bicep'
$deploymentName = 'jaarplanner-ai'
# Not an option: Data Zone Standard follows the region, so the region is what keeps prompts in the EU (Art. VI.3).
# The template allows only this one.
$Location = 'swedencentral'

function Invoke-Checked([scriptblock]$Command, [string]$What) {
    $output = & $Command
    if ($LASTEXITCODE -ne 0) { throw "$What failed with exit code $LASTEXITCODE." }
    $output
}

# The Azure CLI installer does not always put az on PATH; fall back to where it installs.
$az = (Get-Command az -ErrorAction SilentlyContinue).Source
if (-not $az) {
    $az = 'C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd'
    if (-not (Test-Path $az)) { throw 'The Azure CLI was not found. Install it and run az login.' }
}

# powershell -File passes "a,b" as one string, so split it. A name the template does not know would match nothing in its
# filter and deploy everything without a word, so it is refused before anything is sent.
$Skip = @($Skip | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($Skip.Count -gt 0) {
    $compiled = (Invoke-Checked { & $az bicep build --file $template --stdout } 'az bicep build' | Out-String) | ConvertFrom-Json
    $known = @($compiled.parameters.modelDeployments.defaultValue | ForEach-Object { $_.name })
    $unknown = @($Skip | Where-Object { $known -notcontains $_ })
    if ($unknown.Count -gt 0) {
        throw "-Skip names a deployment the template does not have: $($unknown -join ', '). Known: $($known -join ', ')."
    }
}

if (-not $EvaluatorObjectId) {
    $EvaluatorObjectId = "$(Invoke-Checked { & $az ad signed-in-user show --query id -o tsv } 'Reading the signed-in user (run az login first)')".Trim()
}

# The parameters go through a file: Windows PowerShell strips the quotes of a JSON array passed on the command line.
$parameters = @{
    '$schema'      = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'
    contentVersion = '1.0.0.0'
    parameters     = @{
        location          = @{ value = $Location }
        evaluatorObjectId = @{ value = $EvaluatorObjectId }
        skipDeployments   = @{ value = @($Skip) }
    }
}
$parameterFile = Join-Path ([System.IO.Path]::GetTempPath()) "jaarplanner-ai-$([guid]::NewGuid()).parameters.json"
[System.IO.File]::WriteAllText($parameterFile, ($parameters | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding $false))

try {
    if ($WhatIf) {
        Invoke-Checked {
            & $az deployment sub what-if --name $deploymentName --location $Location --template-file $template --parameters "@$parameterFile"
        } 'az deployment sub what-if'
        return
    }

    $json = Invoke-Checked {
        & $az deployment sub create --name $deploymentName --location $Location --template-file $template `
            --parameters "@$parameterFile" --query properties.outputs -o json
    } 'az deployment sub create'
}
finally {
    Remove-Item $parameterFile -ErrorAction SilentlyContinue
}

$outputs = ($json | Out-String) | ConvertFrom-Json
$endpoint = $outputs.endpoint.value
Write-Host "Resource group: $($outputs.resourceGroup.value)"
Write-Host "Account:        $($outputs.accountName.value)"
Write-Host "Endpoint:       $endpoint"
Write-Host "Deployments:    $($outputs.deployments.value -join ', ')"
Write-Host 'The role assignment can take a few minutes before the first call is allowed.'

if ($SetEvalEndpoint) {
    $eval = Join-Path $root 'backend/tools/Jaarplanner.Eval'
    Invoke-Checked { dotnet user-secrets set 'AzureAI:Endpoint' $endpoint --project $eval } 'dotnet user-secrets set' | Out-Null
    Write-Host 'AzureAI:Endpoint is set in the eval runner''s user-secrets.'
}
