using System.Globalization;
using Jaarplanner.Domain.Curriculum;
using Jaarplanner.Domain.Schoolcontent;

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

    /// <summary>
    /// The estimated tokens of the whole request, rounded up: the system prompt, the stable context and the user prompt.
    /// A stable context the provider serves from its cache still counts in full: the ceiling guards the model's context
    /// as well as cost.
    /// </summary>
    public static int SchatTokens(AiRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var tekens = (long)request.SystemPrompt.Length + request.VasteContext.Length + request.UserPrompt.Length;
        return (int)((tekens + TekensPerToken - 1) / TekensPerToken);
    }

    /// <summary>
    /// Refuses <paramref name="request"/> when it is over the ceiling, for a prompt whose candidates are minimumdoelen
    /// (FB-053). The advice counts mijlpalen where the leerplandoel overload counts leeftijden.
    /// </summary>
    /// <exception cref="PromptTeGrootFout">The request is over the ceiling.</exception>
    public void Bewaak(AiRequest request, IReadOnlyCollection<Minimumdoel> kandidaten)
    {
        ArgumentNullException.ThrowIfNull(kandidaten);
        Bewaak(
            request,
            kandidaten.Select(m => m.Ref).Distinct(StringComparer.Ordinal).Count(),
            kandidaten.Select(m => m.Leeftijd).Distinct(StringComparer.Ordinal).Count());
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
        Bewaak(
            request,
            kandidaten.Select(d => d.Code).Distinct(StringComparer.Ordinal).Count(),
            kandidaten.Select(d => d.JaarFase).Distinct(StringComparer.Ordinal).Count());
    }

    /// <summary>
    /// Refuses <paramref name="request"/> when it is over the ceiling, for a prompt that carries the school's thema's
    /// (the jaarplan generation, ADR-0055). No choice on the screen makes that prompt smaller, so the advice is the
    /// server setting.
    /// </summary>
    /// <exception cref="PromptTeGrootFout">The request is over the ceiling.</exception>
    public void Bewaak(AiRequest request, IReadOnlyCollection<Thema> themas)
    {
        ArgumentNullException.ThrowIfNull(themas);
        var omschrijving = themas.Count == 1 ? "1 thema" : string.Create(Nederlands, $"{themas.Count:N0} thema's");
        Bewaak(request, omschrijving, ServerRaad);
    }

    /// <summary>
    /// Refuses <paramref name="request"/> when it is over the ceiling, for a prompt that carries the words of one woordweb
    /// (FB-036). The web's own bound keeps it far below the default ceiling, so only a low server setting trips this,
    /// and the advice is that setting.
    /// </summary>
    /// <exception cref="PromptTeGrootFout">The request is over the ceiling.</exception>
    public void Bewaak(AiRequest request, Woordweb woordweb)
    {
        ArgumentNullException.ThrowIfNull(woordweb);
        var aantal = woordweb.Woorden.Count;
        var omschrijving = aantal == 1 ? "1 woord" : string.Create(Nederlands, $"{aantal:N0} woorden");
        Bewaak(request, omschrijving, ServerRaad);
    }

    /// <summary>
    /// Refuses <paramref name="request"/> when it is over the ceiling, for the cat's chat (FB-031): the handleiding and
    /// one question, whose length the chat already caps, so only the server setting helps.
    /// </summary>
    /// <exception cref="PromptTeGrootFout">The request is over the ceiling.</exception>
    public void BewaakChat(AiRequest request) => Bewaak(request, "de handleiding en je vraag", ServerRaad);

    /// <summary>
    /// Refuses <paramref name="request"/> when it is over the ceiling, for a weekvoorstel (FB-027): the activiteiten of
    /// the subthema's running that week and its days. Nothing on the screen makes the week smaller, so the advice is the
    /// server setting.
    /// </summary>
    /// <exception cref="PromptTeGrootFout">The request is over the ceiling.</exception>
    public void BewaakWeekvoorstel(AiRequest request, int aantalActiviteiten)
    {
        var omschrijving = aantalActiviteiten == 1
            ? "1 activiteit"
            : string.Create(Nederlands, $"{aantalActiviteiten:N0} activiteiten");
        Bewaak(request, omschrijving, ServerRaad);
    }

    // "Beheer" is the admin's right in this app, and the ceiling is no in-app setting, so this advice names whoever
    // runs the server rather than sending admin to look for a setting it cannot find.
    private const string ServerRaad =
        "Die grens is een instelling op de server: vraag wie de app technisch beheert om ze te verhogen.";

    private void Bewaak(AiRequest request, int aantalDoelen, int aantalLeeftijden)
    {
        var doelen = aantalDoelen == 1 ? "1 doel" : string.Create(Nederlands, $"{aantalDoelen:N0} doelen");
        Bewaak(request, doelen, aantalLeeftijden > 1 ? "Kies minder leeftijden." : ServerRaad);
    }

    // The plain clause comes first; the token figures follow in brackets for whoever does change the ceiling.
    private void Bewaak(AiRequest request, string omschrijving, string raad)
    {
        var tokens = SchatTokens(request);
        if (tokens <= MaxTokens)
        {
            return;
        }

        throw new PromptTeGrootFout(
            string.Create(
                Nederlands,
                $"Deze aanvraag is te groot voor de AI: de tekst van {omschrijving} is meer dan één aanvraag mag bevatten (ongeveer {tokens:N0} tokens, de grens is {MaxTokens:N0}). {raad}"),
            tokens,
            MaxTokens);
    }
}
