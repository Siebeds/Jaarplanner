using Jaarplanner.Application.Dekking;
using Jaarplanner.Domain.Kat;

namespace Jaarplanner.Application.Kat;

/// <summary>How the round computes a klas's dekking, so it can be faked without the whole dekking machinery.</summary>
public delegate Task<DekkingWeergave> Katdekkingbron(Guid klasId, CancellationToken ct);

/// <summary>
/// A klas the cat watches, with the leerkrachten a signal about it addresses (ADR-0059 D5).
/// </summary>
/// <param name="KlasId">The klas.</param>
/// <param name="Jaarfase">Its stated jaarfase, or <c>null</c> for a row that predates the rule.</param>
/// <param name="LeerkrachtIds">Its klastoewijzingen, each once. A klas without one addresses nobody.</param>
public sealed record Katklas(Guid KlasId, string? Jaarfase, IReadOnlyList<Guid> LeerkrachtIds);

/// <summary>Which klassen the cat watches. Implemented over EF in Infrastructure.</summary>
public interface IKatklassenlezer
{
    /// <summary>
    /// The klassen of the schooljaren that have not ended, with their leerkrachten. A klas of a finished schooljaar
    /// is not watched: nothing about its dekking can still be acted on.
    /// </summary>
    Task<IReadOnlyList<Katklas>> HaalKlassenAsync(CancellationToken ct);
}

/// <summary>Where the signals live. Implemented over EF in Infrastructure.</summary>
public interface ISignaalopslag
{
    /// <summary>Every stored signal about <paramref name="klasId"/>, whoever it addresses.</summary>
    Task<IReadOnlyList<Signaal>> HaalVoorKlasAsync(Guid klasId, CancellationToken ct);

    /// <summary>Every stored signal addressed to <paramref name="ontvangerId"/>, about whichever klas.</summary>
    Task<IReadOnlyList<Signaal>> HaalVoorOntvangerAsync(Guid ontvangerId, CancellationToken ct);

    /// <summary>One stored signal, or <c>null</c>: the deurmat's route to "seen" and "later".</summary>
    Task<Signaal?> HaalAsync(Guid signaalId, CancellationToken ct);

    /// <summary>
    /// Writes one klas's round in one transaction: what was newly noticed, and what lost its reason. A round that
    /// found nothing new and lost nothing writes nothing (D1).
    /// </summary>
    Task BewaarAsync(IReadOnlyList<Signaal> nieuw, IReadOnlyList<Signaal> verdwenen, CancellationToken ct);

    /// <summary>Persists a change a person made to a stored signal (seen, postponed).</summary>
    Task BewaarWijzigingAsync(Signaal signaal, CancellationToken ct);
}
