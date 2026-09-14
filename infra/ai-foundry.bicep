// A Foundry (Azure OpenAI) resource for measuring the AI doelsuggesties (TB-004, ADR-0036): Sweden Central, Data Zone
// Standard (EU) deployments only, and no keys: every caller signs in with Microsoft Entra. It lives in a resource group
// of its own, which this template creates, apart from the demo (ADR-0034) and from any school's environment, so
// deleting the group removes nothing else. Everything is in code; infra/deploy-ai.ps1 deploys it (see infra/ai-foundry.md).
targetScope = 'subscription'

@description('Region of the resource group and the account. Data Zone Standard follows the account\'s region, so this is what keeps prompts in the EU (Art. VI.3): Sweden Central offers every model below as Data Zone Standard (EU); Belgium Central offers none of them.')
@allowed([
  'swedencentral'
])
param location string = 'swedencentral'

@description('The resource group that holds this resource and nothing else.')
param resourceGroupName string = 'rg-jaarplanner-ai'

@description('Object id of the person who runs the eval. Gets Cognitive Services OpenAI User on this resource and nothing else.')
param evaluatorObjectId string

@description('The model deployments. Capacity is in thousands of tokens per minute: it caps how fast the eval can spend, not what a token costs. Kept low on purpose (TB-004). Only models with Data Zone Standard quota on the subscription: gpt-5-mini and text-embedding-3-large have none (owner 2026-09-14), so adding one means requesting quota first.')
param modelDeployments array = [
  {
    name: 'gpt-5.4-mini'
    model: 'gpt-5.4-mini'
    version: '2026-03-17'
    capacity: 50
  }
  {
    name: 'text-embedding-3-small'
    model: 'text-embedding-3-small'
    version: '1'
    capacity: 100
  }
]

@description('Names from modelDeployments to leave out, for a model the data zone refuses or has no quota for.')
param skipDeployments array = []

var tags = {
  project: 'jaarplanner'
  purpose: 'ai-eval'
}

resource group 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module foundry 'ai-foundry-account.bicep' = {
  scope: group
  name: 'ai-foundry-account'
  params: {
    location: location
    evaluatorObjectId: evaluatorObjectId
    modelDeployments: filter(modelDeployments, d => !contains(skipDeployments, d.name))
    tags: tags
  }
}

output resourceGroup string = group.name
output accountName string = foundry.outputs.accountName
output endpoint string = foundry.outputs.endpoint
output deployments array = foundry.outputs.deploymentNames
