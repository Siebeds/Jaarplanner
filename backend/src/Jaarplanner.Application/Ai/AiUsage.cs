namespace Jaarplanner.Application.Ai;

/// <summary>
/// The token usage a provider reported for one completion (TB-004). It is optional on <see cref="AiCompletion"/>: a
/// fake client, or a provider that reports nothing, leaves it <c>null</c>, and no flow may depend on it. It exists so
/// cost and latency can be measured (the eval runner in <c>backend/tools/Jaarplanner.Eval</c>) without the Application
/// layer knowing which provider answered.
/// </summary>
public sealed record AiUsage
{
    /// <summary>All prompt tokens, the cached ones included.</summary>
    public int InputTokens { get; init; }

    /// <summary>The part of <see cref="InputTokens"/> the provider served from its prompt cache (billed lower).</summary>
    public int CachedInputTokens { get; init; }

    /// <summary>All completion tokens, the hidden reasoning tokens of a reasoning model included.</summary>
    public int OutputTokens { get; init; }

    /// <summary>The part of <see cref="OutputTokens"/> a reasoning model spent on reasoning it does not return.</summary>
    public int ReasoningTokens { get; init; }
}
