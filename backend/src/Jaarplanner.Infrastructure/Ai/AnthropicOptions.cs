namespace Jaarplanner.Infrastructure.Ai;

/// <summary>
/// Server-side configuration for the Anthropic Claude API client (TB-041, ADR-0048). Bound from the <c>Anthropic</c>
/// configuration section and read <b>only</b> here on the backend (Art. VI.4).
/// <para>
/// <b>The <see cref="ApiKey"/> is a server-side secret</b>: user-secrets locally, Key Vault in the cloud, never committed
/// and never sent to the frontend. Local command:
/// <code>
/// dotnet user-secrets set "Anthropic:ApiKey" "&lt;your-claude-api-key&gt;" --project src/Jaarplanner.Api
/// </code>
/// The remaining values are non-secret and may live in appsettings per environment.
/// </para>
/// </summary>
public sealed class AnthropicOptions
{
    /// <summary>Configuration section name: <c>Anthropic</c>.</summary>
    public const string SectionName = "Anthropic";

    /// <summary>
    /// The API base URL (non-secret), e.g. <c>https://api.anthropic.com</c> or a gateway in front of it. Left empty,
    /// the SDK's own default is used.
    /// </summary>
    public string? Endpoint { get; init; }

    /// <summary>The Claude API key: a <b>server-side secret</b> (see the type summary). Required.</summary>
    public string? ApiKey { get; init; }

    /// <summary>The model id to call (non-secret), e.g. <c>claude-opus-5</c>. Required.</summary>
    public string? Model { get; init; }

    /// <summary>The <c>max_tokens</c> ceiling on one answer. The Messages API requires one.</summary>
    public int MaxTokens { get; init; } = 16000;

    /// <summary>
    /// Optional <c>output_config.effort</c> (<c>low</c>, <c>medium</c>, <c>high</c>, <c>xhigh</c> or <c>max</c>). Left
    /// out of the request when empty, so the model's own default applies.
    /// </summary>
    public string? Effort { get; init; }
}
