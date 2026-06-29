namespace Jaarplanner.Api.Configuration;

/// <summary>
/// Placeholder options seam for the future Azure AI Foundry integration (E2).
///
/// <para>
/// <b>This type is documentation + a binding seam only — no AI client exists yet (E2).</b>
/// It records, in code, the principle from Art. VI.4 / Art. IV / CLAUDE.md and ADR-0012:
/// the AI key is a <b>server-side secret</b> that lives in .NET user-secrets locally and
/// Azure Key Vault in the cloud, and must <b>never</b> reach the frontend or the repo.
/// </para>
///
/// <para>
/// When E2 implements the AI client, bind this from the <c>AzureAI</c> configuration
/// section in Infrastructure (where the AI client lives, Art. VIII) and read
/// <see cref="ApiKey"/> there only. The value is supplied via:
/// <code>
/// dotnet user-secrets set "AzureAI:ApiKey" "&lt;your-foundry-key&gt;" --project src/Jaarplanner.Api
/// </code>
/// locally, or the matching Key Vault secret in the cloud. Never serialise this into any
/// API response or frontend bundle.
/// </para>
/// </summary>
public sealed class AzureAIOptions
{
    /// <summary>Configuration section name: <c>AzureAI</c>.</summary>
    public const string SectionName = "AzureAI";

    /// <summary>
    /// Azure AI Foundry endpoint (non-secret). Set per environment; safe to keep in
    /// appsettings if desired (it is not a credential).
    /// </summary>
    public string? Endpoint { get; init; }

    /// <summary>
    /// Azure AI Foundry API key — a <b>server-side secret</b>. Supplied via user-secrets
    /// (key <c>AzureAI:ApiKey</c>) locally or Key Vault in the cloud. Never committed,
    /// never exposed to the frontend (Art. VI.4 / Art. IV). Unused until E2.
    /// </summary>
    public string? ApiKey { get; init; }
}
