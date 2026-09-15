using Jaarplanner.Application.Ai;

namespace Jaarplanner.Infrastructure.Ai;

/// <summary>
/// The ceiling on the size of a prompt sent to the model (TB-007), bound from the <c>AiPrompt</c> configuration section
/// and handed to <see cref="Promptbegrenzing"/>. Configuration so it can change without a code change, for example after
/// the TB-004 measurement; one value for every model (owner, 2026-09-14).
/// </summary>
public sealed class AiPromptOptions
{
    /// <summary>Configuration section name: <c>AiPrompt</c>.</summary>
    public const string SectionName = "AiPrompt";

    /// <summary>The ceiling in estimated tokens (<see cref="Promptbegrenzing.TekensPerToken"/> characters a token).</summary>
    public int MaxTokens { get; init; } = Promptbegrenzing.StandaardMaxTokens;
}
