namespace Jaarplanner.Infrastructure.Ai;

/// <summary>
/// Server-side configuration for the Azure AI Foundry client (E2-01, Art. VI.4 / Art. VIII). Bound
/// from the <c>AzureAI</c> configuration section in Infrastructure — the layer that owns the AI
/// client (Art. VIII) — and read <b>only</b> here on the backend.
/// <para>
/// <b>The <see cref="ApiKey"/> is a server-side secret</b> (Art. VI.4 / Art. IV): it is supplied via
/// .NET user-secrets locally and Azure Key Vault in the cloud, is <b>never</b> committed to the repo,
/// and is <b>never</b> exposed to the frontend. Local command:
/// <code>
/// dotnet user-secrets set "AzureAI:ApiKey" "&lt;your-foundry-key&gt;" --project src/Jaarplanner.Api
/// </code>
/// The remaining values (<see cref="Endpoint"/>, <see cref="Deployment"/>, <see cref="ApiVersion"/>)
/// are non-secret and may live in appsettings per environment.
/// </para>
/// </summary>
public sealed class AzureAIOptions
{
    /// <summary>Configuration section name: <c>AzureAI</c>.</summary>
    public const string SectionName = "AzureAI";

    /// <summary>
    /// Azure AI Foundry resource endpoint (non-secret), e.g.
    /// <c>https://&lt;resource&gt;.openai.azure.com</c>. Set per environment.
    /// </summary>
    public string? Endpoint { get; init; }

    /// <summary>
    /// Azure AI Foundry API key — a <b>server-side secret</b> (see the type summary). Supplied via
    /// user-secrets locally / Key Vault in the cloud; never committed, never sent to the frontend.
    /// </summary>
    public string? ApiKey { get; init; }

    /// <summary>
    /// The model deployment name to call (non-secret). Set per environment; a chat-completions
    /// deployment in an EU data zone (Art. VI.3).
    /// </summary>
    public string? Deployment { get; init; }

    /// <summary>
    /// The Azure OpenAI REST API version (non-secret). Defaults to a recent stable version; override
    /// per environment as Foundry rolls forward.
    /// </summary>
    public string ApiVersion { get; init; } = "2024-10-21";
}
