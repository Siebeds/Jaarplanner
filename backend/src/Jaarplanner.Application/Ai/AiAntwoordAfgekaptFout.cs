namespace Jaarplanner.Application.Ai;

/// <summary>
/// Thrown by an <see cref="IAiClient"/> when the model stopped because it reached the configured ceiling on output
/// tokens (TB-043): <c>stop_reason</c> <c>max_tokens</c> on the Claude API, <c>finish_reason</c> <c>length</c> on Azure AI
/// Foundry. The answer is cut off, so no caller parses it and nothing is persisted. Without this, the parser would read
/// the truncated JSON as an invalid answer and the person who asked would be told the AI answered badly.
/// <para>
/// The message is a Dutch sentence the person who asked can act on (Art. II.3), and it names nothing from the request or
/// the answer: a request can carry pupil text (ADR-0035 §3.8). The Api maps this to a 502 with the message as its detail.
/// </para>
/// </summary>
public sealed class AiAntwoordAfgekaptFout : Exception
{
    /// <summary>The one sentence every flow shows: it holds for a doelsuggestie, a plan, a woordweb and a rewrite alike.</summary>
    public const string Melding =
        "Het antwoord van de AI werd te lang en is afgebroken, dus er is niets bewaard. Probeer het opnieuw. " +
        "Lukt het weer niet, vraag dan wie de app technisch beheert om de grens op de lengte van een antwoord te verhogen.";

    /// <summary>A cut-off answer with the standard <see cref="Melding"/>.</summary>
    public AiAntwoordAfgekaptFout()
        : base(Melding)
    {
    }
}
