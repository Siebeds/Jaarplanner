using Microsoft.Extensions.Configuration;

namespace Jaarplanner.Infrastructure.Ai;

/// <summary>Which model provider serves <see cref="Jaarplanner.Application.Ai.IAiClient"/> (TB-041, ADR-0048).</summary>
public enum AiProviderSoort
{
    /// <summary>Azure AI Foundry, through <see cref="AzureAiFoundryClient"/>. The default.</summary>
    AzureAI = 0,

    /// <summary>The Anthropic Claude API, through <see cref="AnthropicClaudeClient"/>.</summary>
    Anthropic = 1,
}

/// <summary>Reads the provider choice from the <c>Ai:Provider</c> configuration key.</summary>
public static class AiProvider
{
    /// <summary>The configuration key: <c>Ai:Provider</c>.</summary>
    public const string ConfigKey = "Ai:Provider";

    /// <summary>
    /// The configured provider. Absent or empty means <see cref="AiProviderSoort.AzureAI"/>, so an environment that sets
    /// nothing keeps the provider it had. Any other unknown value stops the app at startup, where a deploy sees it.
    /// </summary>
    public static AiProviderSoort Lees(IConfiguration configuration)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        var waarde = configuration[ConfigKey];
        if (string.IsNullOrWhiteSpace(waarde))
        {
            return AiProviderSoort.AzureAI;
        }

        return Enum.TryParse<AiProviderSoort>(waarde.Trim(), ignoreCase: true, out var soort)
               && Enum.IsDefined(soort)
            ? soort
            : throw new InvalidOperationException(
                $"'{ConfigKey}' is '{waarde}'; use 'AzureAI' or 'Anthropic', or leave it empty for AzureAI.");
    }
}
