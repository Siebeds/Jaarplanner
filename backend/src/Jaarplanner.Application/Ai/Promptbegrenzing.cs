using System.Globalization;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.Application.Ai;

/// <summary>
/// The hard ceiling on the size of a prompt the app sends to the model (TB-007). A request over it is never sent: the
/// caller gets a <see cref="PromptTeGrootFout"/> whose Dutch sentence says how to make the run smaller, and nothing is
/// persisted.
/// <para>
/// <b>The ceiling is configuration, not code</b> (owner, 2026-09-14): <c>AiPrompt:MaxTokens</c>, 50,000 by default, one
/// value for every model. The tokens are <b>estimated</b> from the characters at <see cref="TekensPerToken"/> a token,
/// because no tokenizer is in the stack and the ceiling guards cost and the model's context, for which a rough figure
/// is enough: the Dutch Op.stap texts run at about four characters a token.
/// </para>
/// </summary>
public sealed class Promptbegrenzing
{
    /// <summary>The ceiling when the configuration sets none.</summary>
    public const int StandaardMaxTokens = 50_000;

    /// <summary>How many characters the estimate counts as one token.</summary>
    public const int TekensPerToken = 4;

    private static readonly CultureInfo Nederlands = CultureInfo.GetCultureInfo("nl-BE");

    /// <summary>A ceiling of <paramref name="maxTokens"/> estimated tokens per request.</summary>
    public Promptbegrenzing(int maxTokens = StandaardMaxTokens)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(maxTokens, 1);
        MaxTokens = maxTokens;
    }

    /// <summary>The ceiling, in estimated tokens.</summary>
    public int MaxTokens { get; }

    /// <summary>The estimated tokens of the whole request, system prompt included, rounded up.</summary>
    public static int SchatTokens(AiRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var tekens = (long)request.SystemPrompt.Length + request.UserPrompt.Length;
        return (int)((tekens + TekensPerToken - 1) / TekensPerToken);
    }

    /// <summary>
    /// Refuses <paramref name="request"/> when it is over the ceiling. The sentence names the size and gives the one
    /// remedy that exists for this run: fewer leeftijden when the candidates span more than one, and otherwise a higher
    /// ceiling, which only whoever runs the app can set.
    /// </summary>
    /// <param name="request">The request as it would be sent.</param>
    /// <param name="kandidaten">The candidate leerplandoelen written into it.</param>
    /// <exception cref="PromptTeGrootFout">The request is over the ceiling.</exception>
    public void Bewaak(AiRequest request, IReadOnlyCollection<Leerplandoel> kandidaten)
    {
        ArgumentNullException.ThrowIfNull(kandidaten);

        var tokens = SchatTokens(request);
        if (tokens <= MaxTokens)
        {
            return;
        }

        var aantalDoelen = kandidaten.Select(d => d.Code).Distinct(StringComparer.Ordinal).Count();
        var aantalLeeftijden = kandidaten.Select(d => d.JaarFase).Distinct(StringComparer.Ordinal).Count();

        var doelen = aantalDoelen == 1 ? "1 doel" : string.Create(Nederlands, $"{aantalDoelen:N0} doelen");
        var raad = aantalLeeftijden > 1
            ? "Kies minder leeftijden."
            : "Vraag wie de app beheert om de grens te verhogen.";

        throw new PromptTeGrootFout(
            string.Create(
                Nederlands,
                $"Deze aanvraag is te groot voor de AI: {doelen}, ongeveer {tokens:N0} tokens, en de grens is {MaxTokens:N0}. {raad}"),
            tokens,
            MaxTokens);
    }
}
