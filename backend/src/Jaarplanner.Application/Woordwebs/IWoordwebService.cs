using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.Application.Woordwebs;

/// <summary>
/// The woordweb use cases (FB-036, ADR-0043): reading every web on a subthema, keeping one's own, and asking the AI
/// for words. Rights are the Api's (the <c>WoordwebBewerken</c> row); this service trusts the web id it is given and
/// creates a web only for the gebruiker the Api names, never for an id in a body.
/// </summary>
public interface IWoordwebService
{
    /// <summary>Every woordweb on the subthema, the caller's own first, then by owner name (W2).</summary>
    /// <exception cref="Schoolcontent.Beheer.SchoolcontentNietGevondenFout">The subthema does not exist.</exception>
    Task<IReadOnlyList<WoordwebWeergave>> HaalVoorSubthemaAsync(Guid subthemaId, Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Adds typed words to the caller's own web on the subthema, creating the web on its first word (D2).</summary>
    Task<WoordwebWeergave> VoegEigenWoordenToeAsync(Guid subthemaId, Guid gebruikerId, IReadOnlyList<string> woorden, CancellationToken cancellationToken = default);

    /// <summary>Adds typed words to an existing web.</summary>
    Task<WoordwebWeergave> VoegWoordenToeAsync(Guid woordwebId, Guid gebruikerId, IReadOnlyList<string> woorden, CancellationToken cancellationToken = default);

    /// <summary>Takes a word out of a web (D6).</summary>
    Task<WoordwebWeergave> VerwijderWoordAsync(Guid woordwebId, Guid woordId, Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>Accepts or rejects a word the AI proposed (Art. IV.1, IV.2).</summary>
    Task<WoordwebWeergave> BeslisAsync(Guid woordwebId, Guid woordId, KoppelingStatus status, Guid gebruikerId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Asks the AI for at most <see cref="WoordwebPromptBuilder.MaxVoorstellen"/> words and stores each as
    /// <c>voorgesteld</c> with its motivation (W5, W6, D1). An invalid answer stores nothing (Art. IV.5).
    /// </summary>
    Task<WoordwebVoorstelResultaat> StelWoordenVoorAsync(Guid woordwebId, Guid gebruikerId, CancellationToken cancellationToken = default);
}

/// <summary>One word of a web as the screen reads it.</summary>
public sealed record WoordwebWoordWeergave(Guid Id, string Woord, string Status, string? AiMotivatie);

/// <summary>
/// One woordweb as the screen reads it: whose it is, and its words in the order they were added. Its owner gets every
/// status, so she sees her open proposals; anyone else gets only the words that stand in it (ADR-0043 D7).
/// </summary>
public sealed record WoordwebWeergave(
    Guid Id,
    Guid SubthemaId,
    Guid EigenaarId,
    string EigenaarNaam,
    bool IsEigen,
    IReadOnlyList<WoordwebWoordWeergave> Woorden);

/// <summary>Body of a request that adds typed words.</summary>
public sealed record WoordenInvoer(IReadOnlyList<string>? Woorden);

/// <summary>Body of a decision on a proposed word: <c>Aanvaard</c> or <c>Geweigerd</c>.</summary>
public sealed record WoordBeslissing(KoppelingStatus Status);

/// <summary>
/// What an AI request did: the web afterwards and how many words it proposed, or, when the model answered outside the
/// contract, an English operator diagnostic and no change (Art. IV.5).
/// </summary>
public sealed record WoordwebVoorstelResultaat(bool IsGeslaagd, WoordwebWeergave? Woordweb, int AantalVoorgesteld, string? Fout)
{
    public static WoordwebVoorstelResultaat Geslaagd(WoordwebWeergave woordweb, int aantal) => new(true, woordweb, aantal, null);

    public static WoordwebVoorstelResultaat Mislukt(string fout) => new(false, null, 0, fout);
}
