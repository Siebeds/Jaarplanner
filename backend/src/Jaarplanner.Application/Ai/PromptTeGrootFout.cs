namespace Jaarplanner.Application.Ai;

/// <summary>
/// Thrown when a prompt is over the <see cref="Promptbegrenzing"/> ceiling (TB-007). The model was not called and
/// nothing was persisted. The message is a Dutch sentence the person who asked can act on (Art. II.3), so the Api maps
/// this to a 400 with the message as its detail.
/// </summary>
public sealed class PromptTeGrootFout : Exception
{
    public PromptTeGrootFout(string message, int geschatteTokens, int maxTokens)
        : base(message)
    {
        GeschatteTokens = geschatteTokens;
        MaxTokens = maxTokens;
    }

    /// <summary>The estimated tokens of the refused request.</summary>
    public int GeschatteTokens { get; }

    /// <summary>The ceiling it was over.</summary>
    public int MaxTokens { get; }
}
