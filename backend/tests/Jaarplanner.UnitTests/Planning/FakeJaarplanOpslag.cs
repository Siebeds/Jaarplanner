using Jaarplanner.Application.Planning.Generatie;
using Jaarplanner.Domain.Planning;
using Jaarplanner.Domain.Schoolcontent;

namespace Jaarplanner.UnitTests.Planning;

/// <summary>
/// In-memory <see cref="IJaarplanOpslag"/> for tests (Art. IV.6, Art. VIII). It proves the generation flow runs
/// with <b>no database</b>: nothing here touches EF Core. It also counts commits so a test can assert that a failed
/// run persisted nothing at all.
/// </summary>
internal sealed class FakeJaarplanOpslag : IJaarplanOpslag
{
    private readonly Klas? _klas;
    private readonly Schooljaar? _schooljaar;
    private readonly List<Thema> _themas;
    private Jaarplan? _jaarplan;

    public FakeJaarplanOpslag(Klas? klas, Schooljaar? schooljaar, IEnumerable<Thema>? themas = null, Jaarplan? jaarplan = null)
    {
        _klas = klas;
        _schooljaar = schooljaar;
        _themas = themas?.ToList() ?? [];
        _jaarplan = jaarplan;
    }

    /// <summary>How many times the flow committed a unit of work.</summary>
    public int AantalKeerBewaard { get; private set; }

    /// <summary>The plan as it stands in the store — what a reload would return.</summary>
    public Jaarplan? Jaarplan => _jaarplan;

    public Task<(Klas Klas, Schooljaar Schooljaar)?> LaadKlasMetSchooljaarAsync(
        Guid klasId,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(_klas is null || _schooljaar is null || _klas.Id != klasId
            ? null
            : ((Klas, Schooljaar)?)(_klas, _schooljaar));

    public Task<Jaarplan?> LaadJaarplanAsync(Guid klasId, CancellationToken cancellationToken = default) =>
        Task.FromResult(_jaarplan?.KlasId == klasId ? _jaarplan : null);

    public void VoegJaarplanToe(Jaarplan jaarplan) => _jaarplan = jaarplan;

    public Task<IReadOnlyList<Thema>> LaadThemasAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<Thema>>(_themas);

    public Task BewaarAsync(CancellationToken cancellationToken = default)
    {
        AantalKeerBewaard++;

        return Task.CompletedTask;
    }
}
