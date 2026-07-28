using Jaarplanner.Application.AiAuthoring;
using Jaarplanner.Domain.Curriculum;

namespace Jaarplanner.UnitTests.AiAuthoring;

/// <summary>
/// In-memory <see cref="ILeerdoelCatalogus"/> for tests (Art. VIII / IV.6). It returns a canned
/// leerplandoel set and does <b>no</b> database I/O, proving the authoring assist runs against fakes
/// with no database. It applies the same optional discipline/jaar-fase filter as the real EF query so
/// selection behaviour is exercised, and records the last selection so tests can assert on it.
/// </summary>
public sealed class FakeLeerdoelCatalogus : ILeerdoelCatalogus
{
    private readonly IReadOnlyList<Leerplandoel> _leerdoelen;

    /// <summary>The selection most recently passed to <see cref="HaalLeerdoelenAsync"/>, or null if none.</summary>
    public LeerdoelSelectie? LaatsteSelectie { get; private set; }

    public FakeLeerdoelCatalogus(IReadOnlyList<Leerplandoel> leerdoelen) => _leerdoelen = leerdoelen;

    /// <inheritdoc />
    public Task<IReadOnlyList<Leerplandoel>> HaalLeerdoelenAsync(
        LeerdoelSelectie selectie,
        CancellationToken cancellationToken = default)
    {
        LaatsteSelectie = selectie;

        IEnumerable<Leerplandoel> query = _leerdoelen;

        if (selectie.Disciplines is { Count: > 0 } disciplines)
        {
            query = query.Where(d => disciplines.Contains(d.DisciplineNummer));
        }

        if (selectie.JaarFasen is { Count: > 0 } jaarFasen)
        {
            query = query.Where(d => jaarFasen.Contains(d.JaarFase));
        }

        return Task.FromResult<IReadOnlyList<Leerplandoel>>(query.OrderBy(d => d.Code, StringComparer.Ordinal).ToList());
    }
}
