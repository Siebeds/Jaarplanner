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
/// The key is the default way to authenticate (ADR-0012). <see cref="Authentication"/> set to
/// <see cref="AzureAIAuthentication.Entra"/> signs in with Microsoft Entra instead, as an explicit choice (ADR-0036);
/// the eval runner uses it. The remaining values are non-secret and may live in appsettings per environment.
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
    /// How the client authenticates. <see cref="AzureAIAuthentication.Key"/> (the default) requires
    /// <see cref="ApiKey"/>; <see cref="AzureAIAuthentication.Entra"/> asks Microsoft Entra for a token and ignores the key.
    /// </summary>
    public AzureAIAuthentication Authentication { get; init; } = AzureAIAuthentication.Key;

    /// <summary>
    /// Azure AI Foundry API key — a <b>server-side secret</b> (see the type summary). Required with
    /// <see cref="AzureAIAuthentication.Key"/>. Supplied via user-secrets locally / Key Vault in the cloud; never
    /// committed, never sent to the frontend.
    /// </summary>
    public string? ApiKey { get; init; }

    /// <summary>
    /// The model deployment name to call (non-secret). Set per environment; a chat-completions
    /// deployment in an EU data zone (Art. VI.3). On the v1 API it travels as the request's <c>model</c>.
    /// </summary>
    public string? Deployment { get; init; }

    /// <summary>
    /// Optional <c>reasoning_effort</c> for a reasoning model (the gpt-5 family: <c>minimal</c>, <c>low</c>,
    /// <c>medium</c> or <c>high</c>). Left out of the request when empty, so a model that does not know the parameter
    /// never receives it.
    /// </summary>
    public string? ReasoningEffort { get; init; }

    /// <summary>
    /// Optional <c>max_completion_tokens</c>, the ceiling reasoning models accept instead of <c>max_tokens</c>. Left
    /// out of the request when unset.
    /// </summary>
    /// <remarks>
    /// A reasoning model spends its hidden reasoning tokens out of this same ceiling, so it must leave room for them on
    /// top of the answer. An answer that reaches it is cut off and rejected as an <c>AiAntwoordAfgekaptFout</c> (TB-043).
    /// </remarks>
    public int? MaxCompletionTokens { get; init; }
}

/// <summary>How <see cref="AzureAiFoundryClient"/> authenticates (ADR-0036).</summary>
public enum AzureAIAuthentication
{
    /// <summary>The server-side <see cref="AzureAIOptions.ApiKey"/> on the <c>api-key</c> header (ADR-0012). The default.</summary>
    Key = 0,

    /// <summary>A Microsoft Entra token, chosen explicitly; no key is needed or sent.</summary>
    Entra = 1,
}
