using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>The cat's chat (FB-031, ADR-0066): it explains the tool and looks up the school's content. It stores nothing.</summary>
public interface IKatchatService
{
    /// <summary>
    /// Answers one question after the turns of <paramref name="gesprek"/> (FB-093): the model decides what it is, the
    /// tool answers a lookup from its own data. The answer carries its own sealed turn.
    /// </summary>
    /// <exception cref="GesprekKloptNietFout">A turn of <paramref name="gesprek"/> is not one this server sealed for her.</exception>
    Task<Katantwoord> BeantwoordAsync(
        string vraag,
        Katlezer lezer,
        IReadOnlyList<Katbeurt>? gesprek = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Runs a lookup again, with the candidate the gebruiker picked; the model is not called. With
    /// <paramref name="vraag"/>, what her turn shows (the candidate), the answer carries its sealed turn.
    /// </summary>
    Task<Katantwoord> ZoekOpAsync(
        Katopzoeking opzoeking,
        Katlezer lezer,
        string? vraag = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// One model call per question, and none for a lookup run again (ADR-0066). The question goes as typed (Art. IV.4),
/// with the last turns of the conversation, each checked against the server's seal first (FB-093, ADR-0069); of the
/// school's content the model sees only the names and codes an earlier lookup found, so an answer about it cannot be
/// invented. Nothing is persisted and nothing of the question, the conversation or the answer is logged
/// (ADR-0059 D6): this class has no logger on purpose.
/// </summary>
public sealed class KatchatService : IKatchatService
{
    private readonly IAiClient _ai;
    private readonly Katopzoeker _opzoeker;
    private readonly Handleiding _handleiding;
    private readonly Promptbegrenzing _begrenzing;
    private readonly Katbeurtzegel _zegel;

    public KatchatService(IAiClient ai, IKatopzoekbron bron, Promptbegrenzing begrenzing, Katbeurtzegel zegel)
        : this(ai, bron, begrenzing, zegel, Handleiding.Standaard)
    {
    }

    public KatchatService(IAiClient ai, IKatopzoekbron bron, Promptbegrenzing begrenzing, Katbeurtzegel zegel, Handleiding handleiding)
    {
        _ai = ai;
        _opzoeker = new Katopzoeker(bron);
        _begrenzing = begrenzing;
        _zegel = zegel;
        _handleiding = handleiding;
    }

    public async Task<Katantwoord> BeantwoordAsync(
        string vraag,
        Katlezer lezer,
        IReadOnlyList<Katbeurt>? gesprek = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(lezer);
        if (string.IsNullOrWhiteSpace(vraag) || vraag.Length > KatchatPromptBuilder.MaxVraagLengte)
        {
            throw new ArgumentException(
                $"A question is required and holds at most {KatchatPromptBuilder.MaxVraagLengte} characters.",
                nameof(vraag));
        }

        // Only the turns that go along are checked; one that does not check stops the question before the model sees it.
        var beurten = (gesprek ?? []).TakeLast(KatchatPromptBuilder.MaxBeurten).ToList();
        if (beurten.Any(b => !_zegel.Klopt(lezer.Rechten.GebruikerId, b)))
        {
            throw new GesprekKloptNietFout();
        }

        var verzoek = KatchatPromptBuilder.Bouw(vraag, beurten, _handleiding);
        _begrenzing.BewaakChat(verzoek);
        var antwoord = await _ai.CompleteAsync(verzoek, cancellationToken);
        var besluit = KatchatAntwoordParser.Parse(antwoord.Content, _handleiding);

        var katantwoord = besluit.Soort switch
        {
            Katbesluitsoort.Uitleg => new Katantwoord
            {
                Soort = Katantwoordsoort.Uitleg,
                Uitleg = besluit.Uitleg,
                Hoofdstukken = besluit.Hoofdstukken,
            },
            Katbesluitsoort.Opzoeking => await _opzoeker.ZoekOpAsync(besluit.Opzoeking!, lezer, cancellationToken),
            Katbesluitsoort.Onbekend => Katantwoord.Van(Katantwoordsoort.Onbekend),
            _ => Katantwoord.Van(Katantwoordsoort.Mislukt),
        };
        return MetBeurt(katantwoord, vraag.Trim(), lezer);
    }

    public async Task<Katantwoord> ZoekOpAsync(
        Katopzoeking opzoeking,
        Katlezer lezer,
        string? vraag = null,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(lezer);
        var antwoord = await _opzoeker.ZoekOpAsync(opzoeking, lezer, cancellationToken);
        return string.IsNullOrWhiteSpace(vraag) || vraag.Length > KatchatPromptBuilder.MaxVraagLengte
            ? antwoord
            : MetBeurt(antwoord, vraag.Trim(), lezer);
    }

    private Katantwoord MetBeurt(Katantwoord antwoord, string vraag, Katlezer lezer) =>
        antwoord with { Beurt = _zegel.Verzegel(lezer.Rechten.GebruikerId, vraag, Katbeurtschrijver.Schrijf(antwoord)) };
}
