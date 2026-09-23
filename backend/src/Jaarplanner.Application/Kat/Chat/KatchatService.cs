using Jaarplanner.Application.Ai;

namespace Jaarplanner.Application.Kat.Chat;

/// <summary>The cat's chat (FB-031, ADR-0066): it explains the tool and looks up the school's content. It stores nothing.</summary>
public interface IKatchatService
{
    /// <summary>Answers one question: the model decides what it is, the tool answers a lookup from its own data.</summary>
    Task<Katantwoord> BeantwoordAsync(string vraag, Katlezer lezer, CancellationToken cancellationToken = default);

    /// <summary>Runs a lookup again, with the candidate the gebruiker picked; the model is not called.</summary>
    Task<Katantwoord> ZoekOpAsync(Katopzoeking opzoeking, Katlezer lezer, CancellationToken cancellationToken = default);
}

/// <summary>
/// One model call per question, and none for a lookup run again (ADR-0066). The question goes as typed (Art. IV.4);
/// the school's content never goes to the model, so an answer about it cannot be invented. Nothing is persisted and
/// nothing of the question or the answer is logged (ADR-0059 D6): this class has no logger on purpose.
/// </summary>
public sealed class KatchatService : IKatchatService
{
    private readonly IAiClient _ai;
    private readonly Katopzoeker _opzoeker;
    private readonly Handleiding _handleiding;
    private readonly Promptbegrenzing _begrenzing;

    public KatchatService(IAiClient ai, IKatopzoekbron bron, Promptbegrenzing begrenzing)
        : this(ai, bron, begrenzing, Handleiding.Standaard)
    {
    }

    public KatchatService(IAiClient ai, IKatopzoekbron bron, Promptbegrenzing begrenzing, Handleiding handleiding)
    {
        _ai = ai;
        _opzoeker = new Katopzoeker(bron);
        _begrenzing = begrenzing;
        _handleiding = handleiding;
    }

    public async Task<Katantwoord> BeantwoordAsync(string vraag, Katlezer lezer, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(lezer);
        if (string.IsNullOrWhiteSpace(vraag) || vraag.Length > KatchatPromptBuilder.MaxVraagLengte)
        {
            throw new ArgumentException(
                $"A question is required and holds at most {KatchatPromptBuilder.MaxVraagLengte} characters.",
                nameof(vraag));
        }

        var verzoek = KatchatPromptBuilder.Bouw(vraag, _handleiding);
        _begrenzing.BewaakChat(verzoek);
        var antwoord = await _ai.CompleteAsync(verzoek, cancellationToken);
        var besluit = KatchatAntwoordParser.Parse(antwoord.Content, _handleiding);

        return besluit.Soort switch
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
    }

    public Task<Katantwoord> ZoekOpAsync(Katopzoeking opzoeking, Katlezer lezer, CancellationToken cancellationToken = default) =>
        _opzoeker.ZoekOpAsync(opzoeking, lezer, cancellationToken);
}
