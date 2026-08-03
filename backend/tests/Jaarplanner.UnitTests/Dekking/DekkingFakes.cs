using Jaarplanner.Application.Dekking;
using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.Dekking;

/// <summary>
/// A hand-built <see cref="IJaarplanLezer"/>: it returns whatever plan the test hands it, so a coverage test can
/// state a placement's status and staleness directly instead of arranging a school year, a grid and a generation run
/// to produce them. Art. V.6 asks for the coverage logic to be covered well, and the tests that get written are the
/// ones whose arrangement fits on a screen.
/// </summary>
internal sealed class FakeJaarplanLezer : IJaarplanLezer
{
    private readonly JaarplanWeergave _plan;

    public FakeJaarplanLezer(JaarplanWeergave plan) => _plan = plan;

    public int AantalAanroepen { get; private set; }

    public Task<JaarplanWeergave> HaalJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default)
    {
        AantalAanroepen++;

        return Task.FromResult(_plan);
    }
}

/// <summary>
/// An in-memory <see cref="IDekkingOpslag"/>. It records the arguments it was asked with, because two of this
/// story's rules are only observable in the <b>request</b> rather than in the answer: that a rejected or stale
/// placement's thema is never asked about at all, and that the klas is passed through so the class-scoped layers can
/// be filtered. A fake that only returned data could not prove either.
/// </summary>
internal sealed class FakeDekkingOpslag : IDekkingOpslag
{
    private readonly IReadOnlyList<DekkendeKoppeling> _koppelingen;
    private readonly IReadOnlyList<Leerplandoel> _doelen;

    public FakeDekkingOpslag(
        IReadOnlyList<DekkendeKoppeling> koppelingen,
        IReadOnlyList<Leerplandoel> doelen)
    {
        _koppelingen = koppelingen;
        _doelen = doelen;
    }

    /// <summary>The klas the service scoped the class-level layers to, or null when it never asked.</summary>
    public Guid? GevraagdeKlasId { get; private set; }

    /// <summary>The thema ids the service asked about, or null when it never asked.</summary>
    public IReadOnlyCollection<Guid>? GevraagdeThemaIds { get; private set; }

    public int AantalKoppelingAanroepen { get; private set; }

    public Task<IReadOnlyList<DekkendeKoppeling>> HaalDekkendeKoppelingenAsync(
        Guid klasId,
        IReadOnlyCollection<Guid> themaIds,
        CancellationToken cancellationToken = default)
    {
        AantalKoppelingAanroepen++;
        GevraagdeKlasId = klasId;
        GevraagdeThemaIds = themaIds;

        // Only the links whose thema was actually asked about, so the fake cannot hand back coverage the service
        // did not request — otherwise a test asserting "a rejected placement covers nothing" would pass for the
        // wrong reason.
        return Task.FromResult<IReadOnlyList<DekkendeKoppeling>>(_koppelingen.ToList());
    }

    public Task<IReadOnlyList<Leerplandoel>> HaalLeerplandoelenAsync(
        CancellationToken cancellationToken = default) =>
        Task.FromResult(_doelen);
}
