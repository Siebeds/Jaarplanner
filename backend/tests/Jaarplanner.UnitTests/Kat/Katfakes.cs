using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Kat;
using Jaarplanner.Domain.Kat;

namespace Jaarplanner.UnitTests.Kat;

/// <summary>
/// The fakes the cat's round is tested with (TB-057). <b>None of them is an AI client</b>: the round is tested
/// without one, which is the point of ADR-0059 K1.
/// </summary>
internal sealed class VasteTijd(DateTimeOffset nu) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => nu;
}

/// <summary>A fixed set of watched klassen.</summary>
internal sealed class NepKlassenlezer(params Katklas[] klassen) : IKatklassenlezer
{
    public Task<IReadOnlyList<Katklas>> HaalKlassenAsync(CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Katklas>>(klassen);
}

/// <summary>Signals in memory, with what was written to them recorded.</summary>
internal sealed class NepSignaalopslag : ISignaalopslag
{
    private readonly List<Signaal> _signalen = [];

    public IReadOnlyList<Signaal> Alles => _signalen;

    public int Schrijfbeurten { get; private set; }

    public void Zaai(params Signaal[] signalen) => _signalen.AddRange(signalen);

    public Task<IReadOnlyList<Signaal>> HaalVoorKlasAsync(Guid klasId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Signaal>>(_signalen.Where(s => s.KlasId == klasId).ToList());

    public Task<IReadOnlyList<Signaal>> HaalVoorOntvangerAsync(Guid ontvangerId, CancellationToken ct) =>
        Task.FromResult<IReadOnlyList<Signaal>>(_signalen.Where(s => s.OntvangerId == ontvangerId).ToList());

    public Task<Signaal?> HaalAsync(Guid signaalId, CancellationToken ct) =>
        Task.FromResult(_signalen.FirstOrDefault(s => s.Id == signaalId));

    public Task BewaarAsync(IReadOnlyList<Signaal> nieuw, IReadOnlyList<Signaal> verdwenen, CancellationToken ct)
    {
        Schrijfbeurten++;
        _signalen.AddRange(nieuw);
        foreach (var signaal in verdwenen)
        {
            _signalen.Remove(signaal);
        }

        return Task.CompletedTask;
    }

    public Task BewaarWijzigingAsync(Signaal signaal, CancellationToken ct)
    {
        Schrijfbeurten++;
        return Task.CompletedTask;
    }
}

/// <summary>A detector that returns what the test tells it to, and counts how often it was asked.</summary>
internal sealed class NepDetector(params Signaalvondst[] vondsten) : ISignaaldetector
{
    private Signaalvondst[] _vondsten = vondsten;

    public int Aanroepen { get; private set; }

    public void Zet(params Signaalvondst[] vondsten) => _vondsten = vondsten;

    public Task<IReadOnlyList<Signaalvondst>> DetecteerAsync(Katcontext context, CancellationToken ct)
    {
        Aanroepen++;
        return Task.FromResult<IReadOnlyList<Signaalvondst>>(_vondsten);
    }
}

/// <summary>A task that records the findings it was given. The stand-in for the AI work of FB-070.</summary>
internal sealed class NepTaak(Signaalsoort soort, bool faalt = false) : IKattaak
{
    public Signaalsoort Soort { get; } = soort;

    public List<Signaalvondst> Uitgevoerd { get; } = [];

    public Task VoerUitAsync(Signaalvondst vondst, CancellationToken ct)
    {
        Uitgevoerd.Add(vondst);
        return faalt ? throw new InvalidOperationException("This task is broken on purpose.") : Task.CompletedTask;
    }
}

internal static class Katbouw
{
    /// <summary>A dekking source that fails loudly: a detector that does not ask for it must not make the test need it.</summary>
    public static Katdekkingbron GeenDekking { get; } =
        (_, _) => throw new InvalidOperationException("This test's detectors should not need the dekking.");

    public static Signaalronde Ronde(
        IKatklassenlezer klassen,
        ISignaalopslag opslag,
        IEnumerable<ISignaaldetector>? detectoren = null,
        IEnumerable<IKattaak>? taken = null,
        Katdekkingbron? dekking = null,
        DateTimeOffset? nu = null) =>
        new(
            klassen,
            opslag,
            detectoren ?? [],
            taken ?? [],
            dekking ?? GeenDekking,
            new VasteTijd(nu ?? new DateTimeOffset(2026, 9, 22, 7, 0, 0, TimeSpan.Zero)));

    public static Signaalvondst Vondst(Guid klasId, string sleutel, params Guid[] ontvangers) =>
        new(Signaalsoort.MinimumdoelInGevaar, klasId, sleutel, ontvangers, $"Doel {sleutel} komt in gevaar.");
}
